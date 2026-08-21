
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

const STYLES = [{"name":"Display/2XL","step":12,"family":"display","weight":"Bold"},{"name":"Display/XL","step":11,"family":"display","weight":"Bold"},{"name":"Display/L","step":10,"family":"display","weight":"Bold"},{"name":"Display/M","step":9,"family":"display","weight":"Bold"},{"name":"Display/S","step":8,"family":"display","weight":"Bold"},{"name":"Heading/L","step":7,"family":"display","weight":"Bold"},{"name":"Heading/M","step":6,"family":"text","weight":"Semi Bold"},{"name":"Heading/S","step":5,"family":"text","weight":"Semi Bold"},{"name":"Body/L","step":5,"family":"text","weight":"Regular"},{"name":"Body/M","step":4,"family":"text","weight":"Regular"},{"name":"Body/M Strong","step":4,"family":"text","weight":"Semi Bold"},{"name":"Body/S","step":3,"family":"text","weight":"Regular"},{"name":"Body/S Strong","step":3,"family":"text","weight":"Semi Bold"},{"name":"Label/M","step":2,"family":"text","weight":"Medium"},{"name":"Label/S","step":1,"family":"text","weight":"Semi Bold"},{"name":"Mono/M","step":3,"family":"mono","weight":"Regular"},{"name":"Mono/S","step":2,"family":"mono","weight":"Regular"}];
const PAIRS = [["Flavor (default)","Space Grotesk","Inter"],["Editorial","Fraunces","Libre Franklin"],["Reading","Source Serif 4","Source Sans 3"],["Geometric","Jost","DM Sans"],["Expressive","Syne","Archivo"]];
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
  style.fontSize = [11,12,14,16,18,20,24,30,36,48,60,72][st.step - 1];
  style.lineHeight = { unit: 'PIXELS', value: [16,16,20,24,26,28,32,38,44,54,66,78][st.step - 1] };
  style.setBoundVariable('fontSize', T['size/' + st.step]);
  style.setBoundVariable('lineHeight', T['line-height/' + st.step]);
  const famVar = st.family === 'mono' ? T['font/mono'] : st.family === 'display' ? T['font/display'] : T['font/text'];
  // fontFamily binding needs every mode's family loaded; skip when any is missing.
  const allLoaded = PAIRS.every(([, d, t]) => { const f = st.family === 'mono' ? MONO : st.family === 'display' ? d : t; return loaded[f] && loaded[f].length; });
  if (allLoaded && famVar) { try { style.setBoundVariable('fontFamily', famVar); } catch (e) { failed.push(st.name + ' fontFamily: ' + e.message); } }
  style.description = 'Bound to Typography size/' + st.step + ' + line-height/' + st.step + (allLoaded ? ' + font family (mode-switchable)' : '');
  out.push(style.name);
}
return { created: out.length, styles: out, missingFonts: missing, failed };