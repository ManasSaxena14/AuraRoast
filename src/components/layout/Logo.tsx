/**
 * AURA TOAST — the mark.
 *
 * The brand's signature element is the Halo (§1.3): a thin amber arc with a
 * soft outer bloom. The logo is that Halo, opened at twelve o'clock, with a
 * single curl of steam rising out through the gap.
 *
 * The gap is not decoration — it is the reason the mark works. A closed ring
 * is a generic roundel; an opened one with something escaping through it reads
 * as *aura*, and as the top of a cup, at the same time. Both words of the name
 * are in there: the atmosphere around the thing, and the thing that makes it.
 *
 * Geometry is fixed in a 64×64 box so the mark is identical at every size, and
 * strokes get an optical bump below 24px, where a hairline disappears.
 */

const R = 24;
const GAP_DEG = 30; // half-angle of the opening at twelve o'clock
const point = (deg: number): [number, number] => [
  32 + R * Math.cos((deg * Math.PI) / 180),
  32 + R * Math.sin((deg * Math.PI) / 180),
];
const [ax, ay] = point(-90 + GAP_DEG);
const [bx, by] = point(-90 - GAP_DEG);

/** 300° of arc, opening centred on twelve o'clock. */
export const HALO_ARC = `M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${R} ${R} 0 1 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;

/** One confident S of steam, exiting centrally through the gap. */
export const STEAM_CURL = 'M 30.6 43.5 C 24.5 35.8, 40.5 30.6, 33.2 20.6 C 29.4 16.1, 31.4 12.4, 34.0 8.6';

export interface LogoProps {
  size?: number;
  /** Drops the bloom layer — for favicons and anywhere under ~32px. */
  flat?: boolean;
  /** Draws itself once on mount. Off by default: a mark that re-animates on
      every navigation stops reading as a logo and starts reading as a spinner. */
  animate?: boolean;
  title?: string;
  className?: string;
}

export function LogoMark({
  size = 40,
  flat = false,
  animate = false,
  title = 'Aura Toast',
  className,
}: LogoProps) {
  const small = size <= 24;
  const arcWidth = small ? 3.4 : 2.6;
  const curlWidth = small ? 3.0 : 2.3;
  const showBloom = !flat && size >= 32;
  const uid = `logo-${size}-${flat ? 'f' : 'b'}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`logo-mark${animate ? ' logo-mark--draw' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={title}
    >
      {showBloom ? (
        <defs>
          <filter id={uid} x="-70%" y="-70%" width="240%" height="240%">
            {/* Pre-blurred once. Per §16.3 the bloom's OPACITY is what may ever
                animate — never the blur radius, which is a per-frame paint. */}
            <feGaussianBlur stdDeviation="3.4" />
          </filter>
        </defs>
      ) : null}

      {showBloom ? (
        <g filter={`url(#${uid})`} opacity="0.34" aria-hidden="true">
          <path
            d={HALO_ARC}
            fill="none"
            stroke="var(--logo-bloom, #f2ce93)"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        </g>
      ) : null}

      <path
        className="logo-mark__arc"
        d={HALO_ARC}
        pathLength={1}
        fill="none"
        stroke="var(--logo-arc, #d8a657)"
        strokeWidth={arcWidth}
        strokeLinecap="round"
      />
      <path
        className="logo-mark__steam"
        d={STEAM_CURL}
        pathLength={1}
        fill="none"
        stroke="var(--logo-steam, #f0e8da)"
        strokeWidth={curlWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  size = 34,
  layout = 'horizontal',
  tagline = false,
  animate = false,
  className,
}: LogoProps & {
  layout?: 'horizontal' | 'stacked' | 'mark';
  tagline?: boolean;
}) {
  if (layout === 'mark') return <LogoMark size={size} animate={animate} className={className} />;

  return (
    <span className={`logo logo--${layout}${className ? ` ${className}` : ''}`}>
      <LogoMark size={size} animate={animate} />
      <span className="logo__type">
        <span className="logo__word">AURA TOAST</span>
        {tagline ? <span className="logo__tag">Atmospheric Craft, Pure Origin</span> : null}
      </span>
    </span>
  );
}
