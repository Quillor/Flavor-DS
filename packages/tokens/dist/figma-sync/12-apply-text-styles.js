// RUN ONCE PER PAGE: set PAGE_INDEX to 0, 1, 2 … and issue the calls in parallel.
// The first run returns totalPages so you know how many to fire.
// (use_figma has no loadAllPagesAsync; a page's contents load when it becomes current,
// and setCurrentPageAsync may be called at most once per script.)
const PAGE_INDEX = 0;
const STYLES = [{"name":"Display/2XL","step":12,"family":"display","weight":"Bold"},{"name":"Display/XL","step":11,"family":"display","weight":"Bold"},{"name":"Display/L","step":10,"family":"display","weight":"Bold"},{"name":"Display/M","step":9,"family":"display","weight":"Bold"},{"name":"Display/S","step":8,"family":"display","weight":"Bold"},{"name":"Heading/L","step":7,"family":"display","weight":"Bold"},{"name":"Heading/M","step":6,"family":"text","weight":"Semi Bold"},{"name":"Heading/S","step":5,"family":"text","weight":"Semi Bold"},{"name":"Body/L","step":5,"family":"text","weight":"Regular"},{"name":"Body/M","step":4,"family":"text","weight":"Regular"},{"name":"Body/M Strong","step":4,"family":"text","weight":"Semi Bold"},{"name":"Body/S","step":3,"family":"text","weight":"Regular"},{"name":"Body/S Strong","step":3,"family":"text","weight":"Semi Bold"},{"name":"Label/M","step":2,"family":"text","weight":"Medium"},{"name":"Label/S","step":1,"family":"text","weight":"Semi Bold"},{"name":"Mono/M","step":3,"family":"mono","weight":"Regular"},{"name":"Mono/S","step":2,"family":"mono","weight":"Regular"}];
const SIZES = [11,12,14,16,18,20,24,30,36,48,60,72];
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
return { page: page.name, pageIndex: PAGE_INDEX, totalPages: pages.length, applied: touched.length, byStyle: touched.reduce((a, t) => (a[t.style] = (a[t.style] || 0) + 1, a), {}), skipped, errors: errors.slice(0, 10), mutatedNodeIds: touched.map(t => t.id).slice(0, 200) };