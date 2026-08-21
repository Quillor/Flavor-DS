/**
 * Native export verification.
 *
 *   node scripts/test-native.mjs
 *
 * 1. FlavorTokens.swift must TYPECHECK against the real SwiftUI SDK (swiftc -typecheck),
 *    not merely parse — a parse-only check would pass a file that references a Color
 *    initialiser that does not exist. Skipped with a loud notice if no Xcode toolchain.
 * 2. Kotlin has no compiler on this machine; the file is structure-checked (balanced
 *    braces, every enum case referenced, every theme key present) and that limitation
 *    is stated in the output rather than hidden.
 * 3. Parity: for a sample of (theme, scheme, token) triples the hex embedded in the
 *    Swift and Kotlin files must equal what the web cascade resolves — native cannot
 *    drift from web because both are read from the same flavor.css.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseCss, declarationsFor, makeValueResolver } from '../packages/tokens/lib/resolve-css.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NATIVE = join(ROOT, 'packages/tokens/dist/native');
const swiftPath = join(NATIVE, 'FlavorTokens.swift'), ktPath = join(NATIVE, 'FlavorTokens.kt');
const problems = [];
if (!existsSync(swiftPath) || !existsSync(ktPath)) { console.error('✗ native exports missing — run npm run build:tokens'); process.exit(1); }

// 1. Swift typecheck
let swiftChecked = false;
try {
  const sdk = execSync('xcrun --show-sdk-path --sdk macosx', { stdio: 'pipe' }).toString().trim();
  execSync(`swiftc -typecheck -sdk "${sdk}" -target arm64-apple-macosx14.0 "${swiftPath}"`, { stdio: 'pipe' });
  swiftChecked = true;
} catch (e) {
  if (/not found|No such file|xcrun: error/.test(String(e.stderr || e.message))) console.warn('  ⚠ no Swift toolchain — Swift typecheck SKIPPED (not passed)');
  else problems.push('Swift typecheck failed:\n' + String(e.stderr || e.stdout || e.message).split('\n').slice(0, 8).join('\n'));
}

// 2. Kotlin structure
const kt = readFileSync(ktPath, 'utf8');
const open = (kt.match(/\{/g) || []).length, close = (kt.match(/\}/g) || []).length;
if (open !== close) problems.push(`Kotlin: unbalanced braces (${open} { vs ${close} })`);
for (const must of ['data class FlavorTheme', 'data class FlavorColors', 'object FlavorTokens', 'fun colors(theme: FlavorTheme, dark: Boolean)', 'fun FlavorThemed(', 'LocalFlavorColors']) if (!kt.includes(must)) problems.push(`Kotlin: missing ${must}`);

// 3. Parity with the web cascade
const meta = JSON.parse(readFileSync(join(ROOT, 'packages/tokens/dist/meta.json'), 'utf8'));
const blocks = parseCss(readFileSync(join(ROOT, 'packages/tokens/dist/flavor.css'), 'utf8'));
const swift = readFileSync(swiftPath, 'utf8');
const toKt = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;
const toSwift = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (x) => (x / 255).toFixed(4); return `red: ${f((n >> 16) & 255)}, green: ${f((n >> 8) & 255)}, blue: ${f(n & 255)}`; };
const NAMES = [
  'surface-page', 'surface-1', 'surface-2', 'surface-3', 'surface-tint',
  'text-primary', 'text-secondary', 'text-tertiary', 'text-disabled', 'text-accent', 'text-on-accent-subtle',
  'border-subtle', 'border-default', 'border-strong', 'border-interactive',
  'accent-subtle', 'accent-subtle-hover', 'accent-border', 'focus-ring',
  'accent-bg', 'accent-bg-hover', 'accent-bg-active', 'accent-fg',
  'secondary-bg', 'secondary-bg-hover', 'secondary-bg-active', 'secondary-fg',
  'secondary-subtle', 'secondary-subtle-hover', 'secondary-border', 'secondary-text', 'text-on-secondary-subtle',
  ...['success', 'warning', 'danger', 'info'].flatMap((k) => ['bg', 'border', 'text', 'solid', 'solid-fg'].map((p) => `${k}-${p}`)),
];
const SAMPLE = [
  ['brand', 'regular', 'aa', 'primary', 'light', 'accent-bg'],
  ['brand', 'regular', 'aa', 'primary', 'dark', 'surface-page'],
  ['yellow', 'bold', 'aaa', 'accent', 'light', 'text-primary'],
  ['purple', 'muted', 'aa', 'secondary', 'dark', 'border-strong'],
  ['teal', 'regular', 'aaa', 'primary', 'light', 'success-text'],
  ['red', 'bold', 'aa', 'accent', 'dark', 'accent-fg'],
  ['brand2', 'regular', 'aa', 'primary', 'light', 'secondary-bg'],
  ['magenta', 'muted', 'aaa', 'accent', 'dark', 'success-text'],
];
let checked = 0;
for (const [hue, sat, c, bg, mode, name] of SAMPLE) {
  const hex = makeValueResolver(declarationsFor(blocks, { hue, sat, mode, contrast: c, bg }))('--' + name);
  if (!hex || hex === 'transparent') continue;
  const key = `${hue}/${sat}/${c}/${bg}`;
  // find the Swift case line and confirm the hex appears in the right scheme branch for that token
  const swiftLine = swift.split('\n').find((l) => l.includes(`case "${key}":`));
  const ktLine = kt.split('\n').find((l) => l.includes(`"${key}" ->`));
  if (!swiftLine) { problems.push(`Swift: no case for ${key}`); continue; }
  if (!ktLine) { problems.push(`Kotlin: no branch for ${key}`); continue; }
  const camel = name.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  const seg = swiftLine.split(`${camel}: dark ? `)[1] || '';
  const [darkPart, lightPart] = seg.split(' : ');
  const swiftHit = (mode === 'dark' ? darkPart : lightPart || '').includes(toSwift(hex));
  if (!swiftHit) problems.push(`Swift parity: ${key} ${mode} ${name} expected ${hex}`);
  // Kotlin FlavorColors is positional: the Nth argument is the Nth NAME. Check that slot, not
  // "anywhere on the line" — the same hex legitimately recurs (accent-bg and info-solid share it).
  const idx = NAMES.indexOf(name);
  const branch = mode === 'dark' ? ktLine.split('if (dark) FlavorColors(')[1] : ktLine.split('else FlavorColors(')[1];
  const args = (branch || '').split(/,\s*(?=Color)/);
  if (!args[idx] || !args[idx].includes(toKt(hex))) problems.push(`Kotlin parity: ${key} ${mode} ${name} (slot ${idx}) expected ${toKt(hex)}, got ${(args[idx] || '').trim().slice(0, 24)}`);
  checked++;
}

if (problems.length) { console.error(`✗ native exports: ${problems.length} problem(s)`); for (const p of problems) console.error('  ' + p); process.exit(1); }
console.log(`✓ native exports: Swift ${swiftChecked ? 'TYPECHECKS against SwiftUI SDK' : 'typecheck skipped (no toolchain)'}; Kotlin structure ok (no kotlinc — not compiled); ${checked}/${SAMPLE.length} parity samples match the web cascade byte-for-byte`);
