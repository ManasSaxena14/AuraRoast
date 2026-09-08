#!/usr/bin/env node
/**
 * The motion lint (Blueprint §12.5, §16.4).
 *
 * Four easing tokens exist. A fifth curve anywhere in `src/` is drift, not an
 * exception worth keeping — so the build fails on it. This is the thing that
 * stops a motion system from silently decaying into a pile of
 * individually-fine animations.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `.pathname` is percent-encoded — a checkout under a path with a space in it
// (this one) would send every readdirSync at a directory that does not exist.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const ALLOWED = join(SRC, 'styles', 'tokens.css');
const EXTS = new Set(['.css', '.tsx', '.ts']);

const offences = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (![...EXTS].some((e) => entry.endsWith(e))) continue;
    if (full === ALLOWED) continue;

    const text = readFileSync(full, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (line.includes('cubic-bezier(')) {
        offences.push(`${relative(ROOT, full)}:${i + 1}  ${line.trim()}`);
      }
    });
  }
}

walk(SRC);

if (offences.length) {
  console.error('\n✗ Easing drift — cubic-bezier() outside tokens.css:\n');
  offences.forEach((o) => console.error('   ' + o));
  console.error(
    `\n   ${offences.length} offence(s). Use --ease-aura, --ease-bloom, --ease-settle or --ease-scrub.\n`,
  );
  process.exit(1);
}

console.log('✓ Motion lint clean — the only cubic-bezier() values live in tokens.css.');
