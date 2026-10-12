/**
 * A field of coffee beans that ROASTS — green to cinnamon to near-black — as
 * one number (`roast`, 0–1) moves. Plain imperative three.js: React mounts it
 * once and never re-renders it; scroll and pointer only write numbers that
 * the render loop reads.
 *
 * Budget rules, because this shares a page with a 144-frame canvas hero:
 *   · ONE InstancedMesh — every bean is one draw call together
 *   · device pixel ratio capped at 1.6; fewer beans on small screens
 *   · the loop stops when the canvas is off screen or the tab is hidden
 *   · reduced motion renders single frames on demand, never a loop
 */
import * as THREE from 'three';

export interface BeanSceneOptions {
  /** Beans in the field. Scaled down automatically on small screens. */
  count?: number;
  /** Starting roast, 0 (green) … 1 (dark). */
  roast?: number;
  /** How far the field drifts on its own — the login page wants less. */
  drift?: number;
  /** Sparks rise from the field past first crack. */
  sparks?: boolean;
  /** Shift the cloud sideways (world units) — keeps it clear of left-set headings. */
  offsetX?: number;
}

/* Roast colour stops — sampled from real beans, warmed into the palette. */
const STOPS: [number, THREE.Color][] = [
  [0.0, new THREE.Color('#7f9a5a')], // green
  [0.25, new THREE.Color('#b9a86a')], // drying
  [0.45, new THREE.Color('#c79558')], // yellowing → tan
  [0.65, new THREE.Color('#8f5a33')], // cinnamon, first crack
  [0.85, new THREE.Color('#5a3520')], // city+
  [1.0, new THREE.Color('#2e1a10')], // dark
];

function roastColor(t: number, out: THREE.Color): THREE.Color {
  const k = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    const [a, ca] = STOPS[i - 1];
    if (k <= b) return out.copy(ca).lerp(cb, (k - a) / (b - a));
  }
  return out.copy(STOPS[STOPS.length - 1][1]);
}

/** An ellipsoid with a flat face and the centre crease every bean has. */
function beanGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 40, 28);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Flatten the top half into the bean's flat face…
    if (v.y > 0) v.y *= 0.45;
    // …and cut the crease down its length.
    const crease = Math.exp(-((v.x / 0.11) ** 2)) * Math.max(0, v.y) * 1.6;
    v.y -= crease * 0.32;
    // Taper the ends slightly so it is not a pill.
    const taper = 1 - 0.12 * v.z * v.z;
    v.x *= 0.62 * taper;
    v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

interface Bean {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  bob: number;
  scale: number;
}

export class BeanScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private material: THREE.MeshStandardMaterial;
  private sparks: THREE.Points | null = null;
  private sparkSpeeds: Float32Array | null = null;
  private beans: Bean[] = [];
  private dummy = new THREE.Object3D();
  private colorTmp = new THREE.Color();
  private clock = new THREE.Clock();
  private frame = 0;
  private running = false;
  private visible = true;
  private disposed = false;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private reduced: boolean;

  /** Inputs — written from outside, read by the loop. */
  private roast = 0;
  private roastShown = 0;
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private drift: number;

  constructor(
    private host: HTMLElement,
    opts: BeanSceneOptions = {},
  ) {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.innerWidth < 640;
    const count = Math.round((opts.count ?? 180) * (small ? 0.5 : 1));
    this.roast = this.roastShown = opts.roast ?? 0;
    this.drift = opts.drift ?? 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 0, 16);

    // Warm key from above-left, a gold rim from behind, a dim cool fill —
    // the lighting of a roastery at night.
    this.scene.add(new THREE.HemisphereLight('#f2ce93', '#1a1310', 0.55));
    const key = new THREE.DirectionalLight('#ffe2b8', 2.4);
    key.position.set(-6, 8, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#d8a657', 3.2);
    rim.position.set(6, -2, -8);
    this.scene.add(rim);
    const fill = new THREE.PointLight('#7b3b2c', 18, 30);
    fill.position.set(0, -6, 6);
    this.scene.add(fill);

    this.material = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
    this.mesh = new THREE.InstancedMesh(beanGeometry(), this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Each bean gets its own place in a loose ellipsoidal cloud, its own
    // tumble and a slight tonal variation — no two beans roast identically.
    const tone = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 3.2 + Math.random() * 5.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta) * 1.6,
        r * Math.sin(phi) * Math.sin(theta) * 0.85,
        r * Math.cos(phi) * 0.9 - 1.5,
      );
      this.beans.push({
        pos,
        rot: new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28),
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3),
        bob: Math.random() * Math.PI * 2,
        scale: 0.22 + Math.random() * 0.2,
      });
      const shade = 0.82 + Math.random() * 0.3;
      this.mesh.setColorAt(i, tone.setRGB(shade, shade * (0.96 + Math.random() * 0.06), shade * 0.94));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    if (opts.sparks !== false) this.addSparks(small ? 60 : 140);
    this.group.position.x = small ? 0 : (opts.offsetX ?? 0);
    this.scene.add(this.group);

    this.applyRoast();
    this.layout(0);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    // Off screen → no frames at all.
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this.sync();
    });
    this.io.observe(host);
    document.addEventListener('visibilitychange', this.sync);
    window.addEventListener('pointermove', this.onPointer, { passive: true });

    this.sync();
    // Draw once now: the loop only starts when the observer reports the
    // canvas on screen, and until then it would be an empty rectangle.
    this.render();
  }

  /** 0 = green, 1 = dark. Eased toward inside the loop, so scroll never jerks it. */
  setRoast(value: number): void {
    this.roast = Math.min(1, Math.max(0, value));
    if (this.reduced) {
      this.roastShown = this.roast;
      this.applyRoast();
      this.layout(0);
      this.render();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.sync);
    window.removeEventListener('pointermove', this.onPointer);
    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this.sparks) {
      this.sparks.geometry.dispose();
      (this.sparks.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ── internals ─────────────────────────────────────────────────── */

  private addSparks(n: number) {
    const pos = new Float32Array(n * 3);
    this.sparkSpeeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      this.sparkSpeeds[i] = 0.4 + Math.random() * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#f2ce93',
      size: 0.07,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sparks = new THREE.Points(geo, mat);
    this.group.add(this.sparks);
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };

  private sync = () => {
    const should = this.visible && !document.hidden && !this.reduced && !this.disposed;
    if (should) this.start();
    else this.stop();
  };

  private start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.tick(Math.min(0.05, this.clock.getDelta()));
      this.render();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // Narrow screens pull the camera back so the cloud still fits.
    this.camera.position.z = w / h < 0.8 ? 22 : 16;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.render(); // a paused scene must not show a stretched frame
  }

  private applyRoast() {
    const t = this.roastShown;
    roastColor(t, this.colorTmp);
    this.material.color.copy(this.colorTmp);
    // Dark beans are oily: the surface goes from chalky to glossy.
    this.material.roughness = 0.82 - t * 0.5;
    this.material.metalness = 0.02 + t * 0.12;
    if (this.sparks) {
      const m = this.sparks.material as THREE.PointsMaterial;
      // Sparks appear around first crack and stay through development.
      m.opacity = Math.max(0, Math.min(1, (t - 0.5) / 0.2)) * 0.85;
    }
  }

  private layout(time: number) {
    // The cloud tightens as it roasts — beans lose water and shrink a little.
    const shrink = 1 - this.roastShown * 0.12;
    for (let i = 0; i < this.beans.length; i++) {
      const b = this.beans[i];
      this.dummy.position.set(b.pos.x, b.pos.y + Math.sin(time * 0.6 + b.bob) * 0.18 * this.drift, b.pos.z);
      this.dummy.rotation.copy(b.rot);
      this.dummy.scale.setScalar(b.scale * shrink * (1 + this.roastShown * 0.18)); // and puff up at crack
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private tick(dt: number) {
    const time = this.clock.elapsedTime;
    for (const b of this.beans) {
      b.rot.x += b.spin.x * dt * this.drift;
      b.rot.y += b.spin.y * dt * this.drift;
      b.rot.z += b.spin.z * dt * this.drift;
    }
    // Ease the roast toward its target — scroll writes the target only.
    const prev = this.roastShown;
    this.roastShown += (this.roast - this.roastShown) * Math.min(1, dt * 4);
    if (Math.abs(prev - this.roastShown) > 0.0005) this.applyRoast();
    this.layout(time);

    // Sparks drift upward and wrap.
    if (this.sparks && this.sparkSpeeds) {
      const p = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + this.sparkSpeeds[i] * dt * (0.4 + this.roastShown);
        if (y > 5) y = -5;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    // The whole cloud turns slowly and leans toward the pointer.
    this.pointerSmooth.lerp(this.pointer, Math.min(1, dt * 2.5));
    this.group.rotation.y = time * 0.05 * this.drift + this.pointerSmooth.x * 0.35;
    this.group.rotation.x = this.pointerSmooth.y * 0.22;
    this.camera.position.x = this.pointerSmooth.x * 0.8;
    this.camera.position.y = -this.pointerSmooth.y * 0.5;
    this.camera.lookAt(0, 0, 0);
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }
}
