
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

const HUES = ["brand","brand2","neutral","red","scarlet","orange","tangerine","yellow","lime","green","teal","cyan","blue","violet","purple","magenta"], REAL = ["neutral","red","scarlet","orange","tangerine","yellow","lime","green","teal","cyan","blue","violet","purple","magenta"], BRANDS = ["brand","brand2"], SATS = ["muted","regular","bold"], STEPS = [1,2,3,4,5,6,7,8,9,10,11,12];
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
return { updated: n, modes: col.modes.map(m => m.name) };