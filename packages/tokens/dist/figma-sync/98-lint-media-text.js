const ON_PANE = ['text/primary', 'text/secondary', 'text/tertiary'];
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
return { page: page.name, mediaRoots: roots.map(r => r.id + ' ' + r.name), offenders: bad.length, sample: bad.slice(0, 30) };