
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

const SATS = ["muted","regular","bold"], STEPS = [1,2,3,4,5,6,7,8,9,10,11,12];
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
return { updated: n };