
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

const BGS = ["primary","secondary","dark-primary","dark-secondary","accent","media"], CONTRASTS = ["aa","aaa"], MODES = ["light","dark"], NAMES = ["surface-page","surface-1","surface-2","surface-3","surface-tint","text-primary","text-secondary","text-tertiary","text-disabled","text-accent","text-on-accent-subtle","text-on-media","text-on-media-secondary","border-subtle","border-default","border-strong","border-interactive","accent-subtle","accent-subtle-hover","accent-border","focus-ring","accent-bg","accent-bg-hover","accent-bg-active","accent-fg","secondary-bg","secondary-bg-hover","secondary-bg-active","secondary-fg","secondary-subtle","secondary-subtle-hover","secondary-border","secondary-text","text-on-secondary-subtle","success-bg","success-border","success-text","success-solid","success-solid-fg","warning-bg","warning-border","warning-text","warning-solid","warning-solid-fg","danger-bg","danger-border","danger-text","danger-solid","danger-solid-fg","info-bg","info-border","info-text","info-solid","info-solid-fg"];
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
return { updated: n, missing: missing.slice(0, 20), missingCount: missing.length };