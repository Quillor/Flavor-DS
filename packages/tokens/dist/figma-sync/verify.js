// Resolves the public tokens on a frame for a given Background mode and prints hex.
// Compare against `node scripts/wcag-qa.mjs --json` / the browser.
const page = figma.root.children.find(p => p.name === 'Tokens'); await figma.setCurrentPageAsync(page);
const sheet = page.children.find(n => n.type === 'FRAME');
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const byId = {}; for (const c of cols) byId[c.id] = c;
const bgCol = cols.find(c => c.name === 'Background');
const vs = await Promise.all(bgCol.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
const hex = (v) => '#' + [v.r, v.g, v.b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const modes = {}; for (const [cid, mid] of Object.entries(sheet.explicitVariableModes || {})) modes[byId[cid]?.name] = byId[cid]?.modes.find(m => m.modeId === mid)?.name;
const out = {}; for (const v of vs) { try { out[v.name] = hex(v.resolveForConsumer(sheet).value); } catch (e) {} }
return { frame: sheet.name, modes, out };