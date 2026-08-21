/**
 * Token engine regression tests. Run after `npm run build:tokens`.
 *
 *   node scripts/test-tokens.mjs            → compare against golden, exit 1 on drift
 *   node scripts/test-tokens.mjs --update   → rewrite the golden (intentional change)
 *
 * What is guarded:
 *   1. GOLDEN: every semantic selection (steps + worst ratios) and every ramp hex.
 *      Any drift is reported per key — a curve tweak can no longer move values silently.
 *   2. FLOOR: worst-case ratios per pairing must never DECREASE vs the golden
 *      (a change may improve contrast, never regress it) — checked even on --update.
 *      Override with --update --accept-floor ONLY when the old floor itself was wrong.
 *   3. STRUCTURE: axes/defaults in meta.json, token names in flavor.css.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const dist = (f) => new URL(`packages/tokens/dist/${f}`, root);
const goldenPath = new URL('packages/tokens/golden.json', root);
const update = process.argv.includes('--update');

const contrast = JSON.parse(readFileSync(dist('contrast.json'), 'utf8'));
const ramps = JSON.parse(readFileSync(dist('ramps.json'), 'utf8'));
const meta = JSON.parse(readFileSync(dist('meta.json'), 'utf8'));
const css = readFileSync(dist('flavor.css'), 'utf8');

// --- build the snapshot
const snap = { selections: {}, ramps, axes: meta.axes, defaults: meta.defaults, tokenNames: [], worst: {} };
for (const mode of ['light', 'dark']) for (const sat of Object.keys(contrast.modes[mode].families)) {
  const fam = contrast.modes[mode].families[sat];
  for (const c of ['aa', 'aaa']) {
    const s = fam.selections[c];
    for (const k of ['textPrimary', 'textSecondary', 'textTertiary', 'borderInteractive']) snap.selections[`${mode}/${sat}/${c}/${k}`] = `${s[k].step}@${s[k].worstRatio}`;
    for (const hue of Object.keys(fam.perRamp)) {
      const p = fam.perRamp[hue][c];
      snap.selections[`${mode}/${sat}/${hue}/${c}/accent`] = `${p.standard.accent.step}/${p.standard.accent.fg}@${p.standard.accent.ratio}`;
      snap.selections[`${mode}/${sat}/${hue}/${c}/link`] = `${p.standard.link.step}@${p.standard.link.worstRatio}`;
      const t = p.tonal;
      snap.selections[`${mode}/${sat}/${hue}/${c}/tonal`] = `page${t.surfaces.page}/s1:${t.surfaces.surface1}/ink:${t.textPrimary.step}@${t.textPrimary.worstRatio}/accent:${t.accent.step}/${t.accent.fg}@${t.accent.ratio}`;
    }
  }
}
snap.tokenNames = [...new Set([...css.matchAll(/^\s+(--[a-z][a-z0-9-]*):/gm)].map((m) => m[1]).filter((n) => !n.startsWith('--flavor')))].sort();
// worst ratios from the QA script (shipped-CSS truth)
const qa = JSON.parse(execSync('node scripts/wcag-qa.mjs --json', { cwd: root, encoding: 'utf8' }));
if (qa.failures.length) { console.error(`WCAG QA reports ${qa.failures.length} failures — fix before snapshotting.`); process.exit(1); }
// recompute per-pairing worst from a second pass (qa --json only lists failures) — cheap: rerun in report mode and parse
const report = execSync('node scripts/wcag-qa.mjs', { cwd: root, encoding: 'utf8' });
for (const line of report.split('\n')) { const m = line.match(/^\s{2}(.+?)\s{2,}([\d.]+):1/); if (m) snap.worst[m[1].trim()] = Number(m[2]); }

// --- compare
if (!existsSync(goldenPath) || update) {
  if (existsSync(goldenPath)) {
    const old = JSON.parse(readFileSync(goldenPath, 'utf8'));
    const regress = Object.entries(snap.worst).filter(([k, v]) => old.worst?.[k] != null && v < old.worst[k] - 0.005);
    if (regress.length && !process.argv.includes('--accept-floor')) {
      console.error('✗ FLOOR: worst-case contrast regressed — refusing to update golden:');
      for (const [k, v] of regress) console.error(`   ${k}: ${old.worst[k]} → ${v}`);
      console.error('\nEvery new floor must still clear its WCAG threshold (verify with scripts/wcag-qa.mjs).');
      console.error('Only if the OLD number was wrong — e.g. it was measured over an incomplete matrix —');
      console.error('re-baseline deliberately: node scripts/test-tokens.mjs --update --accept-floor');
      process.exit(1);
    }
  }
  writeFileSync(goldenPath, JSON.stringify(snap, null, 2));
  console.log(`golden written: ${Object.keys(snap.selections).length} selections, ${snap.tokenNames.length} token names, ${Object.keys(snap.worst).length} pairings`);
  process.exit(0);
}
const gold = JSON.parse(readFileSync(goldenPath, 'utf8'));
const diffs = [];
for (const k of new Set([...Object.keys(gold.selections), ...Object.keys(snap.selections)])) if (gold.selections[k] !== snap.selections[k]) diffs.push(`selection ${k}: ${gold.selections[k]} → ${snap.selections[k]}`);
for (const hue of Object.keys(snap.ramps)) for (const sat of Object.keys(snap.ramps[hue])) for (const mode of ['light', 'dark']) snap.ramps[hue][sat][mode].forEach((hex, i) => { if (gold.ramps?.[hue]?.[sat]?.[mode]?.[i] !== hex) diffs.push(`ramp ${hue}/${sat}/${mode}/${i + 1}: ${gold.ramps?.[hue]?.[sat]?.[mode]?.[i]} → ${hex}`); });
const removed = gold.tokenNames.filter((n) => !snap.tokenNames.includes(n)); if (removed.length) diffs.push(`token names REMOVED (breaking): ${removed.join(', ')}`);
const added = snap.tokenNames.filter((n) => !gold.tokenNames.includes(n)); if (added.length) diffs.push(`token names added: ${added.join(', ')}`);
if (JSON.stringify(gold.axes) !== JSON.stringify(snap.axes)) diffs.push('axes changed');
if (JSON.stringify(gold.defaults) !== JSON.stringify(snap.defaults)) diffs.push('defaults changed');
const regress = Object.entries(snap.worst).filter(([k, v]) => gold.worst?.[k] != null && v < gold.worst[k] - 0.005);
for (const [k, v] of regress) diffs.push(`FLOOR ${k}: ${gold.worst[k]} → ${v} (regression)`);
if (diffs.length) { console.error(`✗ token drift vs golden (${diffs.length}):`); for (const d of diffs.slice(0, 80)) console.error('  ' + d); if (diffs.length > 80) console.error(`  … +${diffs.length - 80}`); console.error('\nIf intentional: node scripts/test-tokens.mjs --update'); process.exit(1); }
console.log(`✓ tokens match golden (${Object.keys(snap.selections).length} selections, ${snap.tokenNames.length} names, floors held)`);
