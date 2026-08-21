// Three findings, current page only. Set CLEAR = true to fix categories 1 and 3.
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
const DEFAULTS = {"Hue":"brand","Saturation":"Regular","Primitives":"Light","Contrast":"AA","Background":"Surface Primary","Radius":"Rounded","Density":"Regular","Typography":"Flavor (default)"};
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
return { page: page.name, toggleRoots: roots.length, offenders: bad.length, sample: bad.slice(0, 40), topLevelMissing: missing.length, missingSample: missing.slice(0, 20), stalePins: stale.length, staleSample: stale.slice(0, 20), cleared: CLEAR };