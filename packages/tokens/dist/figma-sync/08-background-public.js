
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

const BGS = ["primary","secondary","dark-primary","dark-secondary","accent","media"], NAMES = ["surface-page","surface-1","surface-2","surface-3","surface-tint","text-primary","text-secondary","text-tertiary","text-disabled","text-accent","text-on-accent-subtle","text-on-media","text-on-media-secondary","border-subtle","border-default","border-strong","border-interactive","accent-subtle","accent-subtle-hover","accent-border","focus-ring","accent-bg","accent-bg-hover","accent-bg-active","accent-fg","secondary-bg","secondary-bg-hover","secondary-bg-active","secondary-fg","secondary-subtle","secondary-subtle-hover","secondary-border","secondary-text","text-on-secondary-subtle","success-bg","success-border","success-text","success-solid","success-solid-fg","warning-bg","warning-border","warning-text","warning-solid","warning-solid-fg","danger-bg","danger-border","danger-text","danger-solid","danger-solid-fg","info-bg","info-border","info-text","info-solid","info-solid-fg"], MODE_NAMES = {"primary":"Surface Primary","secondary":"Surface Secondary","accent":"Accent Color","media":"Media"};
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
return { updated: n, modes: col.modes.map(m => m.name), removedMedia, pagesLeftToSweep: stillPinned };