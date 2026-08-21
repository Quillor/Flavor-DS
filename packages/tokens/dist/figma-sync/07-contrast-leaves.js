
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

const BGS = ["primary","secondary","dark-primary","dark-secondary","accent","media"], NAMES = ["surface-page","surface-1","surface-2","surface-3","surface-tint","text-primary","text-secondary","text-tertiary","text-disabled","text-accent","text-on-accent-subtle","text-on-media","text-on-media-secondary","border-subtle","border-default","border-strong","border-interactive","accent-subtle","accent-subtle-hover","accent-border","focus-ring","accent-bg","accent-bg-hover","accent-bg-active","accent-fg","secondary-bg","secondary-bg-hover","secondary-bg-active","secondary-fg","secondary-subtle","secondary-subtle-hover","secondary-border","secondary-text","text-on-secondary-subtle","success-bg","success-border","success-text","success-solid","success-solid-fg","warning-bg","warning-border","warning-text","warning-solid","warning-solid-fg","danger-bg","danger-border","danger-text","danger-solid","danger-solid-fg","info-bg","info-border","info-text","info-solid","info-solid-fg"];
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
return { updated: n };