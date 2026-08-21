/**
 * Emits ready-to-run `use_figma` scripts to dist/figma-sync/*.js from the token
 * outputs. Every script is IDEMPOTENT (find-or-create by name, then
 * setValueForMode), so re-running after a token change updates values in place
 * and preserves all existing bindings/instances.
 *
 *   node packages/tokens/figma-sync/plan.mjs
 *
 * Chain: Background(4) → Contrast(2) → Primitives(Light|Dark) → Saturation(3)
 *        → Hue(9) → raw primitives.  Plus Radius(3), Density(3), Typography(5),
 *        Language(5) and the typography TEXT STYLES.
 * Scripts are auto-chunked to stay under Figma's 50k script limit.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '../dist');
const OUT = join(DIST, 'figma-sync');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const J = (f) => JSON.parse(readFileSync(join(DIST, f), 'utf8'));
const F = J('figma.json'), ramps = J('ramps.json'), meta = J('meta.json');
let i18n = null; try { i18n = J('i18n.json'); } catch {}

const { hues: HUES, sats: SATS, modes: MODES, contrasts: CONTRASTS, bgs: BGS, allNames: NAMES, refs, hueScoped, bgModeNames, radiusModeNames } = F;
const BRANDS = Object.keys(meta.brands || { brand: 1 }); // brand THEMES (hue pairs) — no primitives of their own
const c = (v) => JSON.stringify(v);
const files = {};
/** Families that must be loaded before a FONT_FAMILY variable can be rewritten:
 *  every pairing face, the mono, and the Noto fallbacks the Language axis pulls in. */
const PRELOAD_FAMILIES = [...new Set([
  ...Object.values(meta.fontPairs).flatMap((p) => [p.display, p.text].map((f) => f.split(',')[0].replace(/'/g, '').trim())),
  'IBM Plex Mono', 'Inter', 'Noto Sans', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans Arabic', 'Noto Sans Hebrew',
])];
/** Split rows into as many scripts as needed so each stays under the limit. */
function chunked(prefix, rows, bodyFn, limit = 40000) {
  let parts = 1;
  for (;;) {
    const size = Math.ceil(rows.length / parts);
    const slices = Array.from({ length: parts }, (_, i) => rows.slice(i * size, (i + 1) * size)).filter((x) => x.length);
    const bodies = slices.map(bodyFn);
    if (bodies.every((b) => b.length <= limit) || parts > 40) {
      bodies.forEach((b, i) => { files[`${prefix}${slices.length > 1 ? String.fromCharCode(97 + i) : ''}.js`] = b; });
      return;
    }
    parts++;
  }
}
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((x) => Math.round(x * 1e4) / 1e4); };

/** compact ref encoding used inside the generated scripts */
const encRef = (r) => r == null ? null
  : r.kind === 'ramp' ? `R:${r.step}`
  : r.kind === 'rampD' ? `Q:${r.step}`
  : r.kind === 'neutralRamp' ? `N:${r.step}`
  : r.kind === 'fixed' ? `F:${r.name}`
  : r.kind === 'primitiveL' ? `L:${r.hue}/${r.sat}/${r.step}`
  : r.kind === 'primitiveD' ? `D:${r.hue}/${r.sat}/${r.step}`
  : `P:${r.hue}/${r.sat}/${r.step}`;
const refFor = (bg, ct, m, sat, hue, name) => {
  const row = refs[bg][ct][m][sat][hue];
  let r = row[name];
  if (!r && name === 'text-on-media') r = row['text-primary'];
  if (!r && name === 'text-on-media-secondary') r = row['text-secondary'];
  return r ?? null;
};

/** shared JS prelude every script can use */
const PRE = `
const load = async (col) => { const vs = await Promise.all(col.variableIds.map(id => figma.variables.getVariableByIdAsync(id))); const o = {}; for (const v of vs) o[v.name] = v; return o; };
const getCol = async (name, modeNames) => {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find(c => c.name === name);
  if (!col) { col = figma.variables.createVariableCollection(name); col.renameMode(col.modes[0].modeId, modeNames[0]); }
  for (const m of modeNames) if (!col.modes.find(x => x.name === m)) col.addMode(m);
  return col;
};
const modeMap = (col) => { const o = {}; for (const m of col.modes) o[m.name] = m.modeId; return o; };
const A = (id) => ({ type: 'VARIABLE_ALIAS', id });
`;

// ---------------------------------------------------------------- 01 primitives
{
  const rows = [];
  for (const h of HUES.filter((x) => !BRANDS.includes(x))) for (const s of SATS) for (let n = 0; n < 12; n++)
    rows.push([`${h}/${s}/${n + 1}`, ...rgb(ramps[h][s].light[n]), ...rgb(ramps[h][s].dark[n])]);
  const half = Math.ceil(rows.length / 2);
  const mk = (chunk, extra) => `${PRE}
const ROWS = ${c(chunk)};
const col = await getCol('Primitives', ['Light', 'Dark']);
const M = modeMap(col); const P = await load(col);
const ensure = (name) => { let v = P[name]; if (!v) { v = figma.variables.createVariable(name, col, 'COLOR'); v.scopes = []; P[name] = v; } return v; };
let n = 0;
for (const [name, lr, lg, lb, dr, dg, db] of ROWS) {
  const v = ensure(name); v.setValueForMode(M.Light, { r: lr, g: lg, b: lb, a: 1 }); v.setValueForMode(M.Dark, { r: dr, g: dg, b: db, a: 1 });
  v.setVariableCodeSyntax('WEB', 'var(--flavor-' + name.replace(/\\//g, '-') + ')');
  const f = ensure('fixedL/' + name); f.setValueForMode(M.Light, { r: lr, g: lg, b: lb, a: 1 }); f.setValueForMode(M.Dark, { r: lr, g: lg, b: lb, a: 1 });
  const d = ensure('fixedD/' + name); d.setValueForMode(M.Light, { r: dr, g: dg, b: db, a: 1 }); d.setValueForMode(M.Dark, { r: dr, g: dg, b: db, a: 1 });
  n++;
}
${extra || ''}
return { updated: n };`;
  files['01a-primitives.js'] = mk(rows.slice(0, half), `for (const [nm, val] of [['white',{r:1,g:1,b:1,a:1}],['black',{r:0.051,g:0.051,b:0.0588,a:1}],['transparent',{r:1,g:1,b:1,a:0}]]) { const v = ensure(nm); v.setValueForMode(M.Light, val); v.setValueForMode(M.Dark, val); }`);
  files['01b-primitives.js'] = mk(rows.slice(half));
}

// ---------------------------------------------------------------- 02 hue ramps
files['02-hue-ramps.js'] = `${PRE}
const HUES = ${c(HUES)}, REAL = ${c(HUES.filter((h) => !BRANDS.includes(h)))}, BRANDS = ${c(BRANDS)}, SATS = ${c(SATS)}, STEPS = [1,2,3,4,5,6,7,8,9,10,11,12];
const prim = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Primitives');
const P = await load(prim);
const col = await getCol('Hue', HUES); const M = modeMap(col); const H = await load(col);
const ensure = (name) => { let v = H[name]; if (!v) { v = figma.variables.createVariable(name, col, 'COLOR'); v.scopes = []; H[name] = v; } return v; };
let n = 0;
for (const s of SATS) for (const st of STEPS) {
  const v = ensure('ramp/' + s + '/' + st);
  for (const h of REAL) v.setValueForMode(M[h], A(P[h + '/' + s + '/' + st].id));
  for (const b of BRANDS) v.setValueForMode(M[b], A(P['neutral/' + s + '/' + st].id));   // brand surfaces are neutral
  n++;
  const vd = ensure('rampD/' + s + '/' + st);   // fixed-dark value set: dark backgrounds stay dark in both modes
  for (const h of REAL) vd.setValueForMode(M[h], A(P['fixedD/' + h + '/' + s + '/' + st].id));
  for (const b of BRANDS) vd.setValueForMode(M[b], A(P['fixedD/neutral/' + s + '/' + st].id));
  n++;
}
for (const st of STEPS) { const v = ensure('neutral/' + st); for (const h of HUES) v.setValueForMode(M[h], A(P['neutral/regular/' + st].id)); n++; }
return { updated: n, modes: col.modes.map(m => m.name) };`;

// ---------------------------------------------------------------- 03 saturation ramps
files['03-saturation-ramps.js'] = `${PRE}
const SATS = ${c(SATS)}, STEPS = [1,2,3,4,5,6,7,8,9,10,11,12];
const hue = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Hue'); const H = await load(hue);
const col = await getCol('Saturation', SATS.map(s => s[0].toUpperCase() + s.slice(1))); const M = modeMap(col); const S = await load(col);
let n = 0;
for (const st of STEPS) {
  let v = S['ramp/' + st];
  if (!v) { v = figma.variables.createVariable('ramp/' + st, col, 'COLOR'); v.scopes = ['ALL_FILLS','STROKE_COLOR','EFFECT_COLOR']; v.setVariableCodeSyntax('WEB', 'var(--ramp-' + st + ')'); }
  for (const s of SATS) v.setValueForMode(M[s[0].toUpperCase() + s.slice(1)], A(H['ramp/' + s + '/' + st].id));
  n++;
}
for (const st of STEPS) {
  let v = S['rampD/' + st];
  if (!v) { v = figma.variables.createVariable('rampD/' + st, col, 'COLOR'); v.scopes = []; v.setVariableCodeSyntax('WEB', 'var(--rampD-' + st + ')'); }
  for (const s of SATS) v.setValueForMode(M[s[0].toUpperCase() + s.slice(1)], A(H['rampD/' + s + '/' + st].id));
  n++;
}
for (const st of STEPS) {
  let v = S['neutral/' + st];
  if (!v) { v = figma.variables.createVariable('neutral/' + st, col, 'COLOR'); v.scopes = []; }
  for (const s of SATS) v.setValueForMode(M[s[0].toUpperCase() + s.slice(1)], A(H['neutral/' + st].id));
  n++;
}
return { updated: n };`;

// ---------------------------------------------------------------- 04 hue leaves (chunked per background)
const hueLeafBody = (rows) => `${PRE}
const ROWS = ${c(rows)};   // [key, [ref per hue]]
const HUES = ${c(HUES)};
const prim = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Primitives'); const P = await load(prim);
const col = await getCol('Hue', HUES); const M = modeMap(col); const H = await load(col);
// Refs reaching the Hue tier can be ramp-relative (R:/N: — resolve inside this very
// collection, per the row's saturation) or absolute primitives (P:/L:/F:).
const target = (ref, sat) => {
  if (ref.startsWith('R:')) return H['ramp/' + sat + '/' + ref.slice(2)].id;
  if (ref.startsWith('Q:')) return H['rampD/' + sat + '/' + ref.slice(2)].id;
  if (ref.startsWith('N:')) return H['neutral/' + ref.slice(2)].id;
  if (ref.startsWith('F:')) return P[ref.slice(2)].id;
  if (ref.startsWith('D:')) return P['fixedD/' + ref.slice(2)].id;
  const L = ref.startsWith('L:'), body = ref.slice(2);
  return P[(L ? 'fixedL/' : '') + body].id;
};
let n = 0, unresolved = [];
for (const [key, list] of ROWS) {
  const sat = key.split('/')[3];
  let v = H['sem/' + key];
  if (!v) { v = figma.variables.createVariable('sem/' + key, col, 'COLOR'); v.scopes = []; H['sem/' + key] = v; }
  HUES.forEach((h, i) => {
    const id = target(list[i], sat);
    if (!id) { unresolved.push(key + ' @' + h + ' = ' + list[i]); return; }
    v.setValueForMode(M[h], A(id));
  });
  n++;
}
if (unresolved.length) throw new Error('unresolved refs: ' + unresolved.slice(0, 5).join(', '));
return { updated: n };`;
for (const bg of BGS) {
  const rows = [];
  for (const ct of CONTRASTS) for (const m of MODES) for (const sat of SATS) for (const name of hueScoped[bg][ct][m][sat]) {
    rows.push([`${bg}/${ct}/${m}/${sat}/${name}`, HUES.map((h) => encRef(refFor(bg, ct, m, sat, h, name)))]);
  }
  chunked(`04-hue-leaves-${bg}`, rows, hueLeafBody);
}

// ---------------------------------------------------------------- 05 saturation leaves
{
  const rows = [];
  for (const bg of BGS) for (const ct of CONTRASTS) for (const m of MODES) for (const sat of SATS) for (const name of NAMES) {
    const key = `${bg}/${ct}/${m}/${sat}/${name}`;
    if (hueScoped[bg][ct][m][sat].includes(name)) rows.push([key, 'H']);
    else { const r = encRef(refFor(bg, ct, m, sat, HUES[0], name)); if (r) rows.push([key, r]); }
  }
  const body = (chunk) => `${PRE}
const ROWS = ${c(chunk)};   // [bg/contrast/mode/sat/name, target]
const SATS = ${c(SATS)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const prim = cols.find(c => c.name === 'Primitives'), hue = cols.find(c => c.name === 'Hue');
const P = await load(prim), H = await load(hue);
const col = await getCol('Saturation', SATS.map(s => s[0].toUpperCase() + s.slice(1))); const M = modeMap(col); const S = await load(col);
const targetFor = (t, key, sat) => {
  if (t === 'H') return H['sem/' + key].id;
  if (t.startsWith('R:')) return S['ramp/' + t.slice(2)].id;
  if (t.startsWith('Q:')) return S['rampD/' + t.slice(2)].id;
  if (t.startsWith('N:')) return S['neutral/' + t.slice(2)].id;
  if (t.startsWith('F:')) return P[t.slice(2)].id;
  if (t.startsWith('D:')) return P['fixedD/' + t.slice(2)].id;
  return P[(t.startsWith('L:') ? 'fixedL/' : '') + t.slice(2)].id;
};
let n = 0;
for (const [key, t] of ROWS) {
  const [bg, ct, m, sat, name] = key.split('/');
  const vname = 'sem/' + bg + '/' + ct + '/' + m + '/' + name;
  let v = S[vname]; if (!v) { v = figma.variables.createVariable(vname, col, 'COLOR'); v.scopes = []; S[vname] = v; }
  v.setValueForMode(M[sat[0].toUpperCase() + sat.slice(1)], A(targetFor(t, key, sat)));
  n++;
}
return { updated: n };`;
  chunked('05-saturation-leaves', rows, body);
}

// ---------------------------------------------------------------- 06 primitives (mode) leaves
files['06-mode-leaves.js'] = `${PRE}
const BGS = ${c(BGS)}, CONTRASTS = ${c(CONTRASTS)}, MODES = ${c(MODES)}, NAMES = ${c(NAMES)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const sat = cols.find(c => c.name === 'Saturation'); const S = await load(sat);
const col = await getCol('Primitives', ['Light', 'Dark']); const M = modeMap(col); const P = await load(col);
let n = 0, missing = [];
for (const bg of BGS) for (const ct of CONTRASTS) for (const name of NAMES) {
  const vname = 'sem/' + bg + '/' + ct + '/' + name;
  let v = P[vname]; if (!v) { v = figma.variables.createVariable(vname, col, 'COLOR'); v.scopes = []; P[vname] = v; }
  for (const m of MODES) {
    const src = S['sem/' + bg + '/' + ct + '/' + m + '/' + name];
    if (!src) { missing.push(bg + '/' + ct + '/' + m + '/' + name); continue; }
    v.setValueForMode(M[m === 'light' ? 'Light' : 'Dark'], A(src.id));
  }
  n++;
}
return { updated: n, missing: missing.slice(0, 20), missingCount: missing.length };`;

// ---------------------------------------------------------------- 07 contrast leaves
files['07-contrast-leaves.js'] = `${PRE}
const BGS = ${c(BGS)}, NAMES = ${c(NAMES)};
const prim = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Primitives'); const P = await load(prim);
const col = await getCol('Contrast', ['AA', 'AAA']); const M = modeMap(col); const C = await load(col);
let n = 0;
for (const bg of BGS) for (const name of NAMES) {
  const vname = 'sem/' + bg + '/' + name;
  let v = C[vname]; if (!v) { v = figma.variables.createVariable(vname, col, 'COLOR'); v.scopes = []; C[vname] = v; }
  v.setValueForMode(M.AA, A(P['sem/' + bg + '/aa/' + name].id));
  v.setValueForMode(M.AAA, A(P['sem/' + bg + '/aaa/' + name].id));
  n++;
}
return { updated: n };`;

// ---------------------------------------------------------------- 08 Background (public tokens)
files['08-background-public.js'] = `${PRE}
const BGS = ${c(BGS)}, NAMES = ${c(NAMES)}, MODE_NAMES = ${c(bgModeNames)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const con = cols.find(c => c.name === 'Contrast'); const C = await load(con);
// The public collection used to be called "Tonal" (Off/On). Rename in place so every
// existing binding on components/pages keeps working; then extend to 4 modes.
let col = cols.find(c => c.name === 'Background') || cols.find(c => c.name === 'Tonal');
if (!col) { col = figma.variables.createVariableCollection('Background'); col.renameMode(col.modes[0].modeId, MODE_NAMES.primary); }
col.name = 'Background';
const rename = { Off: MODE_NAMES.primary, On: MODE_NAMES.accent };
for (const m of col.modes) if (rename[m.name]) col.renameMode(m.modeId, rename[m.name]);
for (const bg of BGS) if (!col.modes.find(m => m.name === MODE_NAMES[bg])) col.addMode(MODE_NAMES[bg]);
const M = modeMap(col); const T = await load(col);
const scopeFor = (n) => /^(surface|accent-bg|accent-subtle)/.test(n) || /-bg$|-solid$/.test(n) ? ['FRAME_FILL','SHAPE_FILL']
  : /^text|accent-fg|-fg$|-text$/.test(n) ? ['TEXT_FILL'] : ['STROKE_COLOR'];
const pub = (n) => n.startsWith('success-') || n.startsWith('warning-') || n.startsWith('danger-') || n.startsWith('info-')
  ? 'feedback/' + n.replace('-', '/') : n.replace('-', '/');
let n = 0;
for (const name of NAMES) {
  const vname = pub(name);
  let v = T[vname];
  if (!v) { v = figma.variables.createVariable(vname, col, 'COLOR'); T[vname] = v; }
  v.scopes = scopeFor(name); v.setVariableCodeSyntax('WEB', 'var(--' + name + ')');
  for (const bg of BGS) v.setValueForMode(M[MODE_NAMES[bg]], A(C['sem/' + bg + '/' + name].id));
  n++;
}
// The old Media collection is superseded by the Background axis. Removing a collection does
// NOT clean up the explicitVariableModes entries nodes hold against it: those entries survive
// as dangling ids, and afterwards they are unreachable through the object overload of
// clearExplicitVariableModeForCollection because the collection can no longer be looked up.
// So migrate every page's pins away FIRST, and only drop the collection once none remain.
// (Only the current page is loaded, hence the per-page sweep — see 12-apply-text-styles.js.)
const media = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Media');
let removedMedia = false, stillPinned = 0;
if (media) {
  for (const page of figma.root.children) {
    if (page.id !== figma.currentPage.id) { stillPinned += 1; continue; }   // counted, swept by its own run
    for (const top of page.children) {
      const nodes = 'findAll' in top ? [top, ...top.findAll(() => true)] : [top];
      for (const nd of nodes) if (nd.explicitVariableModes && nd.explicitVariableModes[media.id]) {
        try { nd.clearExplicitVariableModeForCollection(media); } catch (e) {}
      }
    }
  }
  // Drop it only when this is the last page left to sweep, so no dangling ids can be stranded.
  if (stillPinned === 0) { try { media.remove(); removedMedia = true; } catch (e) {} }
}
return { updated: n, modes: col.modes.map(m => m.name), removedMedia, pagesLeftToSweep: stillPinned };`;

// ---------------------------------------------------------------- 09 radius / density / typography / shape
{
  const R = F.radius;
  files['09-radius-density-typography.js'] = `${PRE}
const RADIUS = ${c(R)}, RMODES = ${c(radiusModeNames)};
const SPACE = [2,4,8,12,16,20,24,32,40,48,64,80], MUL = { Compact: 0.75, Regular: 1, Comfy: 1.25 };
const PAIRS = ${c(Object.values(meta.fontPairs).map((p) => [p.label, p.display.split(',')[0].replace(/'/g, '').trim(), p.text.split(',')[0].replace(/'/g, '').trim()]))};
const SIZES = ${c(F.typography.sizes)}, LH = ${c(F.typography.lineHeights)};
let n = 0;
// --- Radius (Square | Rounded | Pill). radius/round is intentionally constant.
const rad = await getCol('Radius', Object.values(RMODES)); const rm = modeMap(rad); const RV = await load(rad);
const eR = (name, cs) => { let v = RV[name]; if (!v) { v = figma.variables.createVariable(name, rad, 'FLOAT'); v.scopes = ['CORNER_RADIUS']; v.setVariableCodeSyntax('WEB', cs); RV[name] = v; } return v; };
for (const key of ['control','field','container','media']) {
  const v = eR('radius/' + key, 'var(--radius-' + key + ')');
  for (const [mode, vals] of Object.entries(RADIUS)) v.setValueForMode(rm[RMODES[mode]], vals[key]);
  n++;
}
{ const v = eR('radius/round', 'var(--radius-round)'); for (const mode of Object.values(RMODES)) v.setValueForMode(rm[mode], 9999); n++; }
// --- Density
const dens = await getCol('Density', Object.keys(MUL)); const dm = modeMap(dens); const D = await load(dens);
const eD = (name, scopes, cs) => { let v = D[name]; if (!v) { v = figma.variables.createVariable(name, dens, 'FLOAT'); v.scopes = scopes; v.setVariableCodeSyntax('WEB', cs); D[name] = v; } return v; };
SPACE.forEach((px, i) => { const v = eD('space/' + (i+1), ['GAP','WIDTH_HEIGHT'], 'var(--space-' + (i+1) + ')'); for (const k of Object.keys(MUL)) v.setValueForMode(dm[k], Math.max(1, Math.round(px * MUL[k]))); n++; });
for (const [k, b] of [['sm',32],['md',40],['lg',48]]) { const v = eD('control/height-' + k, ['WIDTH_HEIGHT'], 'var(--control-height-' + k + ')'); for (const d of Object.keys(MUL)) v.setValueForMode(dm[d], Math.round(b * MUL[d])); n++; }
// --- Typography (families + size/line-height scales)
// The pairings were revised, so the mode NAMES changed while the axis kept its size.
// Rename positionally instead of letting getCol add five new modes beside five stale ones:
// renaming preserves mode ids, so a frame already pinned to slot N keeps resolving and
// simply follows the axis to its new name. (Reported so the caller sees it happened.)
const wantedTypo = PAIRS.map(p => p[0]);
// Rename BY NAME, never by position. The two look equivalent and are not: 'Reading'
// sits at a different index than the pairing it replaces, so a positional pass would
// swap it with 'Geometric' and silently repoint every frame pinned to either. RENAMES
// is generated from each pairing's recorded previous label.
const RENAMES = ${c(Object.values(meta.fontPairs).filter((p) => p.was).map((p) => [p.was, p.label]))};
const typoExisting = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Typography');
const renamedTypoModes = [];
if (typoExisting) {
  for (const [from, to] of RENAMES) {
    const m = typoExisting.modes.find(x => x.name === from);
    if (m && !typoExisting.modes.find(x => x.name === to)) { typoExisting.renameMode(m.modeId, to); renamedTypoModes.push(from + ' -> ' + to); }
  }
}
const typo = await getCol('Typography', wantedTypo); const tm = modeMap(typo); const T = await load(typo);
const eT = (name, type, scopes, cs) => { let v = T[name]; if (!v) { v = figma.variables.createVariable(name, typo, type); v.scopes = scopes; v.setVariableCodeSyntax('WEB', cs); T[name] = v; } return v; };
const fd = eT('font/display', 'STRING', ['FONT_FAMILY'], 'var(--font-display)'), ft = eT('font/text', 'STRING', ['FONT_FAMILY'], 'var(--font-text)');
const fm = eT('font/mono', 'STRING', ['FONT_FAMILY'], 'var(--font-mono)');
// Changing a FONT_FAMILY variable re-renders every text node reachable through it, and
// Figma requires those fonts loaded first. This script needed no preload on its first run,
// but once 11 bound fontFamily and 12 attached styles to real content — including the CJK
// and Arabic language demos — the same call started throwing on Noto Sans JP/SC/Arabic.
// Load the pairing families, the mono, and the language-axis fallbacks before writing.
// The set must include the families being written AND the ones currently painted through
// these variables — Figma re-renders the existing text, so it needs the OUTGOING font too.
// The outgoing half is read off the live variables rather than hardcoded: a static list
// goes stale on the next pairing revision, which is exactly how this failed twice (first
// on the Noto language fallbacks, then on the pairings being replaced).
const PRELOAD_STATIC = ${c(PRELOAD_FAMILIES)};
const famOf = (v) => String(v).split(',')[0].replace(/['"]/g, '').trim();
const outgoing = [];
for (const v of [fd, ft, fm]) for (const val of Object.values(v.valuesByMode || {}))
  if (typeof val === 'string' && val) outgoing.push(famOf(val));
const PRELOAD = [...new Set([...PRELOAD_STATIC, ...outgoing])];
const avail = await figma.listAvailableFontsAsync();
const loadedFams = [], missingFams = [];
for (const fam of PRELOAD) {
  const faces = avail.filter(f => f.fontName.family === fam);
  if (!faces.length) { missingFams.push(fam); continue; }
  for (const f of faces) { try { await figma.loadFontAsync(f.fontName); } catch (e) {} }
  loadedFams.push(fam);
}
for (const [label, d, t] of PAIRS) { fd.setValueForMode(tm[label], d); ft.setValueForMode(tm[label], t); fm.setValueForMode(tm[label], 'IBM Plex Mono'); }
n += 3;
SIZES.forEach((px, i) => {
  const s = eT('size/' + (i+1), 'FLOAT', ['FONT_SIZE'], 'var(--font-size-' + (i+1) + ')');
  const l = eT('line-height/' + (i+1), 'FLOAT', ['LINE_HEIGHT'], 'var(--line-height-' + (i+1) + ')');
  for (const p of PAIRS) { s.setValueForMode(tm[p[0]], px); l.setValueForMode(tm[p[0]], LH[i]); }
  n += 2;
});
return { renamedTypographyModes: renamedTypoModes, preloadedFamilies: loadedFams.length, preloadedOutgoing: [...new Set(outgoing)], missingFamilies: missingFams, updated: n, radiusModes: rad.modes.map(m => m.name) };`;
}

// ---------------------------------------------------------------- 10 language
if (i18n) files['10-language.js'] = `${PRE}
const LANGS = ${c(i18n.langs.map((l) => i18n.labels[l]))}; const ROWS = ${c(Object.entries(i18n.strings).map(([k, v]) => [k, ...i18n.langs.map((l) => v[l])]))};
const col = await getCol('Language', LANGS); const M = modeMap(col); const E = await load(col);
let n = 0;
for (const [key, ...vals] of ROWS) {
  let v = E['ui/' + key]; if (!v) { v = figma.variables.createVariable('ui/' + key, col, 'STRING'); v.scopes = ['TEXT_CONTENT']; E['ui/' + key] = v; }
  v.setVariableCodeSyntax('WEB', "t('" + key + "')");
  vals.forEach((val, i) => v.setValueForMode(M[LANGS[i]], val));
  n++;
}
return { updated: n };`;

// ---------------------------------------------------------------- 11 text styles
files['11-text-styles.js'] = `${PRE}
const STYLES = ${c(F.typography.textStyles)};
const PAIRS = ${c(Object.values(meta.fontPairs).map((p) => [p.label, p.display.split(',')[0].replace(/'/g, '').trim(), p.text.split(',')[0].replace(/'/g, '').trim()]))};
const MONO = 'IBM Plex Mono';
const typo = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Typography');
const T = await load(typo);
// Load every family/weight the styles + every Typography mode can resolve to.
const avail = await figma.listAvailableFontsAsync();
const has = (fam, style) => avail.some(f => f.fontName.family === fam && f.fontName.style === style);
const WEIGHTS = ['Regular','Medium','Semi Bold','SemiBold','Bold'];
const families = new Set([MONO]); for (const [, d, t] of PAIRS) { families.add(d); families.add(t); }
const loaded = {}, missing = [];
for (const fam of families) { loaded[fam] = []; for (const w of WEIGHTS) if (has(fam, w)) { await figma.loadFontAsync({ family: fam, style: w }); loaded[fam].push(w); } if (!loaded[fam].length) missing.push(fam); }
const pick = (fam, want) => { const l = loaded[fam] || []; if (l.includes(want)) return want;
  if (want === 'Semi Bold' && l.includes('SemiBold')) return 'SemiBold';
  if (want === 'Medium' && l.includes('Regular')) return 'Regular';
  return l.includes('Bold') && want === 'Bold' ? 'Bold' : (l[0] || 'Regular'); };
const defPair = PAIRS[0];
const existing = await figma.getLocalTextStylesAsync();
const byName = {}; for (const s of existing) byName[s.name] = s;
const out = [], failed = [];
for (const st of STYLES) {
  const fam = st.family === 'mono' ? MONO : st.family === 'display' ? defPair[1] : defPair[2];
  if (!loaded[fam] || !loaded[fam].length) { failed.push(st.name + ' (font ' + fam + ' unavailable)'); continue; }
  let style = byName[st.name];
  if (!style) { style = figma.createTextStyle(); style.name = st.name; }
  style.fontName = { family: fam, style: pick(fam, st.weight) };
  style.fontSize = ${c(F.typography.sizes)}[st.step - 1];
  style.lineHeight = { unit: 'PIXELS', value: ${c(F.typography.lineHeights)}[st.step - 1] };
  style.setBoundVariable('fontSize', T['size/' + st.step]);
  style.setBoundVariable('lineHeight', T['line-height/' + st.step]);
  const famVar = st.family === 'mono' ? T['font/mono'] : st.family === 'display' ? T['font/display'] : T['font/text'];
  // fontFamily binding needs every mode's family loaded; skip when any is missing.
  const allLoaded = PAIRS.every(([, d, t]) => { const f = st.family === 'mono' ? MONO : st.family === 'display' ? d : t; return loaded[f] && loaded[f].length; });
  if (allLoaded && famVar) { try { style.setBoundVariable('fontFamily', famVar); } catch (e) { failed.push(st.name + ' fontFamily: ' + e.message); } }
  style.description = 'Bound to Typography size/' + st.step + ' + line-height/' + st.step + (allLoaded ? ' + font family (mode-switchable)' : '');
  out.push(style.name);
}
return { created: out.length, styles: out, missingFonts: missing, failed };`;

// ---------------------------------------------------------------- 12 apply text styles
// Binding the styles is only half the job: existing text layers keep raw font sizes and
// ignore the Typography mode until a style is actually attached. This walks every page
// (loadAllPagesAsync, so no setCurrentPageAsync needed) and attaches the closest style.
files['12-apply-text-styles.js'] = `// RUN ONCE PER PAGE: set PAGE_INDEX to 0, 1, 2 … and issue the calls in parallel.
// The first run returns totalPages so you know how many to fire.
// (use_figma has no loadAllPagesAsync; a page's contents load when it becomes current,
// and setCurrentPageAsync may be called at most once per script.)
const PAGE_INDEX = 0;
const STYLES = ${JSON.stringify(F.typography.textStyles)};
const SIZES = ${JSON.stringify(F.typography.sizes)};
const pages = figma.root.children;
if (PAGE_INDEX >= pages.length) return { skipped: 'PAGE_INDEX out of range', totalPages: pages.length };
const page = pages[PAGE_INDEX];
await figma.setCurrentPageAsync(page);
const styles = await figma.getLocalTextStylesAsync();
const byName = {}; for (const s of styles) byName[s.name] = s;
const known = STYLES.filter(s => byName[s.name]);
if (!known.length) throw new Error('no Flavor text styles found — run 11-text-styles.js first');

const BOLDISH = /Bold|Black|Heavy/i, MEDIUMISH = /Medium/i;
/** score a candidate style against a node's current typography — size dominates, then role, then weight */
const scoreFor = (st, size, family, weight) => {
  let s = Math.abs(SIZES[st.step - 1] - size) * 10;
  const isMono = /Mono|Code|Courier/i.test(family);
  if ((st.family === 'mono') !== isMono) s += 100;
  const wantBold = BOLDISH.test(weight), stBold = /Bold/i.test(st.weight);
  if (wantBold !== stBold) s += 6;
  if (MEDIUMISH.test(weight) !== (st.weight === 'Medium')) s += 2;
  return s;
};

const touched = [], skipped = { alreadyStyled: 0, mixed: 0, noFont: 0 }, errors = [];
{
  for (const node of page.findAllWithCriteria({ types: ['TEXT'] })) {
    if (node.textStyleId && node.textStyleId !== figma.mixed) { skipped.alreadyStyled++; continue; }
    if (node.fontName === figma.mixed || node.fontSize === figma.mixed) { skipped.mixed++; continue; }
    // A node's CURRENT font must be loaded before any mutation, including applying a style.
    try { await figma.loadFontAsync(node.fontName); } catch (e) { skipped.noFont++; continue; }
    const { family, style: weight } = node.fontName;
    let best = null, bestScore = Infinity;
    for (const st of known) { const sc = scoreFor(st, node.fontSize, family, weight); if (sc < bestScore) { bestScore = sc; best = st; } }
    try { await node.setTextStyleIdAsync(byName[best.name].id); touched.push({ id: node.id, style: best.name }); }
    catch (e) { errors.push(node.id + ': ' + e.message); }
  }
}
return { page: page.name, pageIndex: PAGE_INDEX, totalPages: pages.length, applied: touched.length, byStyle: touched.reduce((a, t) => (a[t.style] = (a[t.style] || 0) + 1, a), {}), skipped, errors: errors.slice(0, 10), mutatedNodeIds: touched.map(t => t.id).slice(0, 200) };`;

// ---------------------------------------------------------------- 99 lint + verify
// Canonical Figma mode name for each axis's WEB default — used by the lint to tell a
// harmless fallback from one that silently renders the wrong theme.
const cap = (x) => x[0].toUpperCase() + x.slice(1);
const DEFAULT_MODES = {
  Hue: meta.defaults.hue,
  Saturation: cap(meta.defaults.sat),
  Primitives: cap(meta.defaults.mode),
  Contrast: meta.defaults.contrast.toUpperCase(),
  Background: bgModeNames[meta.defaults.bg],
  Radius: radiusModeNames[meta.defaults.radius],
  Density: cap(meta.defaults.density),
  Typography: meta.fontPairs[meta.defaults.font].label,
};

// ---------------------------------------------------------------- 98 on-media text lint
// The one Media defect the variable graph cannot express: text sitting directly on the
// transparent page bound to text/primary renders dark ink on the photo. Find it mechanically.
files['98-lint-media-text.js'] = `const ON_PANE = ['text/primary', 'text/secondary', 'text/tertiary'];
const page = figma.currentPage;
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const bgCol = cols.find(c => c.name === 'Background');
const mediaMode = bgCol && bgCol.modes.find(m => m.name === 'Media');
if (!mediaMode) throw new Error('no Background/Media mode — run 08-background-public.js first');
const nameCache = {};
const varName = async (id) => { if (!(id in nameCache)) { const v = await figma.variables.getVariableByIdAsync(id); nameCache[id] = v ? v.name : null; } return nameCache[id]; };

// Find the Media roots first, then work only inside them. Panes are detected by GEOMETRY,
// not ancestry: the opaque card behind a value is very often a SIBLING layer, not a parent,
// so an ancestor walk both misses real panes and — because an outer board frame is itself
// opaque — exempts everything below it. We ask instead: does any opaque-filled node inside
// this Media root cover the text's box? (Approximation: ignores a covering node painted on
// TOP of the text, which would hide it outright and is not a case that occurs here.)
// findAll forces a full traversal; hand-rolled child recursion under-reported because
// instance sublayers materialise lazily, so the root count varied between identical runs.
const isMediaRoot = (n) => { const p = n.explicitVariableModes || {}; return bgCol && p[bgCol.id] === mediaMode.modeId; };
const allRoots = page.findAll(isMediaRoot);
// A Media root nested inside another is already covered by the outer scan.
const roots = allRoots.filter(r => { let p = r.parent; while (p && p.type !== 'PAGE') { if (isMediaRoot(p)) return false; p = p.parent; } return true; });

// Resolve the alpha a bound paint actually renders with. Reading the static f.opacity is
// not enough: a paint bound to a variable can carry opacity 1 and still resolve to alpha 0,
// which would read as an opaque pane and silently suppress real findings.
const alphaOf = async (f, node) => {
  const b = (f.boundVariables || {}).color;
  if (b) { const v = await figma.variables.getVariableByIdAsync(b.id); if (v) { try { const r = v.resolveForConsumer(node).value; if (r && typeof r.a === 'number') return r.a * (f.opacity === undefined ? 1 : f.opacity); } catch (e) {} } }
  return f.opacity === undefined ? 1 : f.opacity;
};
const opaque = async (n) => {
  if (!Array.isArray(n.fills)) return false;
  for (const f of n.fills) if (f.visible !== false && f.type === 'SOLID' && await alphaOf(f, n) > 0.5) return true;
  return false;
};
const box = (n) => n.absoluteBoundingBox;
const covers = (p, t) => p.x <= t.x + 0.5 && p.y <= t.y + 0.5 && p.x + p.width >= t.x + t.width - 0.5 && p.y + p.height >= t.y + t.height - 0.5;

const bad = [];
for (const root of roots) {
  const all = 'findAll' in root ? [root, ...root.findAll(() => true)] : [root];
  // The root itself counts: a media-on Form pane IS the opaque backdrop for its own text.
  // opaque() rejects a transparent root on merit (surface/page resolves to alpha 0).
  const panes = [];
  for (const n of all) if (n.type !== 'TEXT' && box(n) && await opaque(n)) panes.push(n);
  for (const n of all) {
    if (n.type !== 'TEXT') continue;
    const tb = box(n); if (!tb) continue;
    if (panes.some(p => covers(box(p), tb))) continue;   // sits on an opaque pane — correct as-is
    for (const b of (n.boundVariables || {}).fills || []) {
      const nm = await varName(b.id);
      if (nm && ON_PANE.includes(nm)) bad.push(n.id + ' "' + String(n.characters || '').slice(0, 24) + '" binds ' + nm + ' with nothing opaque behind it → use text/on-media');
    }
  }
}
return { page: page.name, mediaRoots: roots.map(r => r.id + ' ' + r.name), offenders: bad.length, sample: bad.slice(0, 30) };`;

files['99-lint-modes.js'] = `// Three findings, current page only. Set CLEAR = true to fix categories 1 and 3.
//  1. offenders — a node that re-pins EVERY theme axis its pinning ancestor pins, i.e. it
//     replaces the whole theme instead of varying one dimension of it. That is the bug
//     that broke On Media: the frame you flip has an inner copy overriding all of it.
//     A node pinning a STRICT SUBSET (a tile pinning only Primitives under a baseline
//     frame that pins all five) is the correct demo-matrix pattern and is NOT flagged.
//  2. topLevelMissing — toggle roots with no explicit mode for a theme collection.
//     Figma has no API to set a collection's default mode (defaultModeId is readonly and
//     modes can't be reordered), so those fall back to each collection's FIRST mode —
//     currently Hue=neutral, Saturation=Muted, which is NOT the web default
//     (brand/regular). Anything meant to show the default theme must say so explicitly.
//  3. stalePins — explicitVariableModes entries keyed to a collection that no longer
//     exists (e.g. the retired Media collection). They render as nothing, but they keep
//     this lint red. The object overload of clearExplicitVariableModeForCollection cannot
//     reach them because the collection can no longer be looked up; the deprecated STRING
//     overload takes the raw id and can.
const CLEAR = false;
const THEME_COLS = ['Background', 'Contrast', 'Primitives', 'Saturation', 'Hue'];
const page = figma.currentPage;
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const byId = {}; for (const c of cols) byId[c.id] = c;
const pinned = (n) => n.explicitVariableModes ? Object.keys(n.explicitVariableModes) : [];
const colName = (id) => (byId[id] || {}).name;
// THEME_COLS governs OFFENDER detection only (does a node re-pin the whole theme).
// The fallback check below is driven by DEFAULTS and covers every axis.
const themeAxes = (ids) => ids.map(colName).filter(n => THEME_COLS.includes(n));

const bad = [], roots = [], stale = [];
const walk = (node, ancestor) => {
  for (const n of node.children || []) {
    const ids = pinned(n);
    if (ids.length) {
      for (const id of ids) if (!byId[id]) {
        stale.push(n.id + ' ' + n.name);
        if (CLEAR) { try { n.clearExplicitVariableModeForCollection(id); } catch (e) {} }
      }
      const mine = themeAxes(ids);
      const theirs = ancestor ? themeAxes(pinned(ancestor)) : [];
      // Offender only when the node pins the COMPLETE theme under a pinning ancestor: at
      // that point the ancestor is irrelevant and toggling it does nothing. Anything less
      // still inherits at least one axis and is an additive variant, which is how the demo
      // tiles are authored. (Comparing against the ancestor's own set instead degenerates
      // when the ancestor pins a single axis — a child pinning two then "covers" it while
      // plainly adding a dimension.)
      const full = ancestor && mine.length === THEME_COLS.length;
      if (full) {
        bad.push(n.id + ' ' + n.name + ' (pins the whole theme inside ' + ancestor.name + ')');
        if (CLEAR) for (const c of cols) { try { n.clearExplicitVariableModeForCollection(c); } catch (e) {} }
      } else if (!ancestor) roots.push(n);
    }
    walk(n, ids.length ? n : ancestor);
  }
};
walk(page, null);

// An unpinned axis is only a problem when its FIRST mode (what Figma falls back to)
// differs from the web default. Radius is the trap: its first mode is Square while the
// web ships Rounded, so an unpinned board renders square corners everywhere.
const DEFAULTS = ${JSON.stringify(DEFAULT_MODES)};
const wrongFallback = [];
for (const c of cols) {
  const want = DEFAULTS[c.name];
  if (want && c.modes[0] && c.modes[0].name !== want) wrongFallback.push(c);
}
const missing = [];
for (const r of roots) {
  const names = pinned(r).map(colName);
  const absent = wrongFallback.filter(c => !names.includes(c.name));
  if (absent.length) missing.push(r.id + ' ' + r.name + ' → ' + absent.map(c => c.name + ' falls back to "' + c.modes[0].name + '", web default is "' + DEFAULTS[c.name] + '"').join('; '));
}
for (const top of page.children) {
  if (pinned(top).length) continue;
  const anyInside = roots.some(r => { let p = r.parent; while (p) { if (p.id === top.id) return true; p = p.parent; } return false; });
  if (!anyInside) missing.push(top.id + ' ' + top.name + ' → pins nothing at all');
}
return { page: page.name, toggleRoots: roots.length, offenders: bad.length, sample: bad.slice(0, 40), topLevelMissing: missing.length, missingSample: missing.slice(0, 20), stalePins: stale.length, staleSample: stale.slice(0, 20), cleared: CLEAR };`;

files['verify.js'] = `// Resolves the public tokens on a frame for a given Background mode and prints hex.
// Compare against \`node scripts/wcag-qa.mjs --json\` / the browser.
const page = figma.root.children.find(p => p.name === 'Tokens'); await figma.setCurrentPageAsync(page);
const sheet = page.children.find(n => n.type === 'FRAME');
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const byId = {}; for (const c of cols) byId[c.id] = c;
const bgCol = cols.find(c => c.name === 'Background');
const vs = await Promise.all(bgCol.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
const hex = (v) => '#' + [v.r, v.g, v.b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const modes = {}; for (const [cid, mid] of Object.entries(sheet.explicitVariableModes || {})) modes[byId[cid]?.name] = byId[cid]?.modes.find(m => m.modeId === mid)?.name;
const out = {}; for (const v of vs) { try { out[v.name] = hex(v.resolveForConsumer(sheet).value); } catch (e) {} }
return { frame: sheet.name, modes, out };`;

// ---------------------------------------------------------------- write + report
const LIMIT = 48000;
const report = [];
for (const [name, code] of Object.entries(files)) {
  writeFileSync(join(OUT, name), code);
  report.push(`${name} ${(code.length / 1024).toFixed(1)}KB${code.length > LIMIT ? '  ⚠ OVER LIMIT' : ''}`);
}
writeFileSync(join(OUT, 'ORDER.json'), JSON.stringify({
  order: Object.keys(files).filter((f) => !/^9\d/.test(f) && f !== 'verify.js' && f !== 'ORDER.json').sort(),
  optional: ['98-lint-media-text.js', '99-lint-modes.js', 'verify.js'],
  chain: F.chain,
  note: 'Run in order with use_figma (fileKey of the target file). Each script is idempotent.',
}, null, 2));
console.log('figma-sync scripts:\n  ' + report.join('\n  '));
const over = Object.values(files).filter((c2) => c2.length > LIMIT).length;
if (over) { console.error(`\n${over} script(s) exceed the ${LIMIT} char limit — increase chunking.`); process.exit(1); }
