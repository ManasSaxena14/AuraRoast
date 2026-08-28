/**
 * A minimal resolver so `node --test` can run the domain suite directly
 * against the app's own TypeScript, without a build step or a test framework.
 *
 * It teaches Node two things the source already relies on:
 *   · the `@/*` path alias from tsconfig.json
 *   · extensionless imports (`./money` → `./money.ts`)
 *
 * Everything else — type stripping — Node does natively.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const CANDIDATES = ['.ts', '.tsx', '/index.ts'];

function probe(url) {
  if (existsSync(fileURLToPath(url))) return url;
  for (const ext of CANDIDATES) {
    const candidate = new URL(url.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;

    if (specifier.startsWith('@/')) {
      base = new URL(specifier.slice(2), SRC);
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      base = new URL(specifier, context.parentURL);
    }

    if (base) {
      const hit = probe(base);
      if (hit) return { url: hit.href, format: 'module-typescript', shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
