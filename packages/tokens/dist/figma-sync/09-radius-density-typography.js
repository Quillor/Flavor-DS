
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

const RADIUS = {"square":{"control":0,"field":0,"container":0,"media":0},"rounded":{"control":6,"field":6,"container":12,"media":8},"pill":{"control":9999,"field":20,"container":20,"media":12}}, RMODES = {"square":"Square","rounded":"Rounded","pill":"Pill"};
const SPACE = [2,4,8,12,16,20,24,32,40,48,64,80], MUL = { Compact: 0.75, Regular: 1, Comfy: 1.25 };
const PAIRS = [["Flavor (default)","Space Grotesk","Inter"],["Editorial","Fraunces","Libre Franklin"],["Reading","Source Serif 4","Source Sans 3"],["Geometric","Jost","DM Sans"],["Expressive","Syne","Archivo"]];
const SIZES = [11,12,14,16,18,20,24,30,36,48,60,72], LH = [16,16,20,24,26,28,32,38,44,54,66,78];
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
const RENAMES = [["Classic Serif","Reading"],["Atomic Age","Expressive"]];
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
const PRELOAD_STATIC = ["Space Grotesk","Inter","Fraunces","Libre Franklin","Source Serif 4","Source Sans 3","Jost","DM Sans","Syne","Archivo","IBM Plex Mono","Noto Sans","Noto Sans JP","Noto Sans SC","Noto Sans Arabic","Noto Sans Hebrew"];
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
return { renamedTypographyModes: renamedTypoModes, preloadedFamilies: loadedFams.length, preloadedOutgoing: [...new Set(outgoing)], missingFamilies: missingFams, updated: n, radiusModes: rad.modes.map(m => m.name) };