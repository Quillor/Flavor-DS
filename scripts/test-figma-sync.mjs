/**
 * Static integration test for the generated Figma sync scripts.
 *
 * Simulates running dist/figma-sync/* in ORDER.json order against an in-memory
 * model of the Figma variable collections, and asserts that EVERY alias target a
 * script asks for was created by an earlier (or the same) script. This catches
 * the whole class of "undefined.id" failures — missing ref-kind branches, wrong
 * collection for a lookup, wrong tier order — before a single `use_figma` call.
 *
 *   node scripts/test-figma-sync.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../packages/tokens/dist/figma-sync/');
if (!existsSync(DIR)) { console.error('No dist/figma-sync — run `npm run build:tokens` first.'); process.exit(1); }
const F = JSON.parse(readFileSync(join(DIR, '../figma.json'), 'utf8'));
const order = JSON.parse(readFileSync(join(DIR, 'ORDER.json'), 'utf8')).order;

const { hues: HUES, sats: SATS, modes: MODES, contrasts: CONTRASTS, bgs: BGS, allNames: NAMES, hueScoped } = F;
const reg = { Primitives: new Set(), Hue: new Set(), Saturation: new Set(), Contrast: new Set(), Background: new Set(), Radius: new Set(), Density: new Set(), Typography: new Set(), Language: new Set() };
const errors = [];
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const GLOBALS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'await', 'do', 'else',
  'async', 'var', 'let', 'const', 'new', 'delete', 'void', 'in', 'of', 'yield', 'throw',
  'true', 'false', 'null', 'undefined', 'this',
  'Object', 'Array', 'JSON', 'Math', 'Promise', 'String', 'Number', 'Boolean', 'Set', 'Map', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'figma', 'console']);
/** call sites by bare name — `foo(` but not `.foo(` and not `new Foo(` */
const callsIn = (src) => [...src.matchAll(/(^|[^.\w$])([a-z_$][A-Za-z0-9_$]*)\s*\(/g)];
/** helpers passed by REFERENCE, e.g. `.map(colName)` — dropping one is as fatal as calling it */
const refsIn = (src) => [...src.matchAll(/[(,]\s*()([a-z_$][A-Za-z0-9_$]*)\s*[),]/g)];
const declCache = new Map();
const declaredIn = (src) => {
  if (declCache.has(src)) return declCache.get(src);
  const d = new Set();
  for (const m of src.matchAll(/(?:const|let|var|function)\s+([A-Za-z0-9_$]+)/g)) d.add(m[1]);
  for (const m of src.matchAll(/\(([^()]*)\)\s*=>/g)) for (const part of m[1].split(',')) { const t = part.trim().split(/[\s=:]/)[0]; if (/^[A-Za-z_$][\w$]*$/.test(t)) d.add(t); }
  for (const m of src.matchAll(/(?:^|[^\w$])([A-Za-z_$][\w$]*)\s*=>/g)) d.add(m[1]);
  for (const m of src.matchAll(/for\s*\(\s*(?:const|let|var)\s*\[([^\]]*)\]/g)) for (const part of m[1].split(',')) { const t = part.trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) d.add(t); }
  for (const m of src.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  // destructuring, and every name in a multi-declarator `const a = 1, b = 2`
  for (const m of src.matchAll(/(?:const|let|var)\s*[[{]([^\]}]*)[\]}]/g))
    for (const part of m[1].split(',')) { const t = part.trim().split(/[\s=:]/).pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) d.add(t); }
  for (const m of src.matchAll(/[,;]\s*([A-Za-z_$][\w$]*)\s*=[^=]/g)) d.add(m[1]);
  for (const m of src.matchAll(/function\s*[A-Za-z0-9_$]*\s*\(([^)]*)\)/g)) for (const part of m[1].split(',')) { const t = part.trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) d.add(t); }
  declCache.set(src, d);
  return d;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** pull `const ROWS = [...]` out of a generated script */
const rowsOf = (src) => {
  const m = src.match(/const ROWS = (\[[\s\S]*?\]);\s*(?:\/\/|\n)/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { errors.push(`ROWS not parseable: ${e.message}`); return null; }
};
const need = (col, name, where) => { if (!reg[col].has(name)) errors.push(`${where}: ${col} has no "${name}"`); };

/** The bug this catches: ROWS may contain a ref kind the script's own resolver has
 *  no branch for (it then falls through and looks up an undefined name at runtime).
 *  So assert the generated SOURCE handles every kind its own payload uses. */
const checkResolverCoverage = (file, src, rows, extract) => {
  const kinds = new Set();
  for (const row of rows) for (const ref of extract(row)) if (typeof ref === 'string' && /^[A-Z]:/.test(ref)) kinds.add(ref[0]);
  // "P:" (plain primitive) is the resolver's fallback branch; every other kind needs an explicit test.
  for (const k of kinds) {
    if (k === 'P') { if (!/return P\[/.test(src)) errors.push(`${file}: payload uses "P:" refs but the script has no primitive fallback`); continue; }
    if (!src.includes(`startsWith('${k}:')`)) errors.push(`${file}: payload uses "${k}:" refs but the script has no startsWith('${k}:') branch`);
  }
  if ([...rows].some((r) => extract(r).includes('H')) && !src.includes("=== 'H'")) errors.push(`${file}: payload uses "H" targets but the script has no === 'H' branch`);
};

for (const file of order) {
  const src = readFileSync(join(DIR, file), 'utf8');
  const rows = rowsOf(src);

  if (file.startsWith('01')) {
    for (const [name] of rows) { reg.Primitives.add(name); reg.Primitives.add('fixedL/' + name); reg.Primitives.add('fixedD/' + name); }
    if (file.startsWith('01a')) for (const n of ['white', 'black', 'transparent']) reg.Primitives.add(n);

  } else if (file.startsWith('02')) {
    for (const s of SATS) for (let n = 1; n <= 12; n++) { need('Primitives', `neutral/${s}/${n}`, file); reg.Hue.add(`ramp/${s}/${n}`); need('Primitives', `fixedD/neutral/${s}/${n}`, file); reg.Hue.add(`rampD/${s}/${n}`); }
    for (let n = 1; n <= 12; n++) { need('Primitives', `neutral/regular/${n}`, file); reg.Hue.add(`neutral/${n}`); }

  } else if (file.startsWith('03')) {
    for (let n = 1; n <= 12; n++) { for (const s of SATS) { need('Hue', `ramp/${s}/${n}`, file); need('Hue', `rampD/${s}/${n}`, file); } reg.Saturation.add(`ramp/${n}`); reg.Saturation.add(`rampD/${n}`); need('Hue', `neutral/${n}`, file); reg.Saturation.add(`neutral/${n}`); }

  } else if (file.startsWith('04')) {
    checkResolverCoverage(file, src, rows, ([, list]) => list);
    // the Hue tier resolves R:/N: relative to the row's saturation — the resolver must receive it
    if (src.includes("startsWith('R:')") && !/target\(list\[i\], *sat\)|ramp\/' \+ sat/.test(src)) errors.push(`${file}: R: refs resolved without the row saturation`);
    // hue leaves: [key, [ref per hue]] — key = bg/contrast/mode/sat/name
    for (const [key, list] of rows) {
      const sat = key.split('/')[3];
      for (const ref of list) {
        if (ref == null) { errors.push(`${file}: null ref in ${key}`); continue; }
        if (ref.startsWith('R:')) need('Hue', `ramp/${sat}/${ref.slice(2)}`, `${file} ${key}`);
        else if (ref.startsWith('Q:')) need('Hue', `rampD/${sat}/${ref.slice(2)}`, `${file} ${key}`);
        else if (ref.startsWith('D:')) need('Primitives', 'fixedD/' + ref.slice(2), `${file} ${key}`);
        else if (ref.startsWith('N:')) need('Hue', `neutral/${ref.slice(2)}`, `${file} ${key}`);
        else if (ref.startsWith('F:')) need('Primitives', ref.slice(2), `${file} ${key}`);
        else if (ref.startsWith('L:')) need('Primitives', 'fixedL/' + ref.slice(2), `${file} ${key}`);
        else if (ref.startsWith('P:')) need('Primitives', ref.slice(2), `${file} ${key}`);
        else errors.push(`${file} ${key}: unknown ref kind "${ref}"`);
      }
      reg.Hue.add('sem/' + key);
    }

  } else if (file.startsWith('05')) {
    checkResolverCoverage(file, src, rows, ([, t]) => [t]);
    for (const [key, t] of rows) {
      const [bg, ct, m, sat, name] = key.split('/');
      if (t === 'H') need('Hue', 'sem/' + key, `${file} ${key}`);
      else if (t.startsWith('R:')) need('Saturation', `ramp/${t.slice(2)}`, `${file} ${key}`);
      else if (t.startsWith('Q:')) need('Saturation', `rampD/${t.slice(2)}`, `${file} ${key}`);
      else if (t.startsWith('D:')) need('Primitives', 'fixedD/' + t.slice(2), `${file} ${key}`);
      else if (t.startsWith('N:')) need('Saturation', `neutral/${t.slice(2)}`, `${file} ${key}`);
      else if (t.startsWith('F:')) need('Primitives', t.slice(2), `${file} ${key}`);
      else if (t.startsWith('L:')) need('Primitives', 'fixedL/' + t.slice(2), `${file} ${key}`);
      else if (t.startsWith('P:')) need('Primitives', t.slice(2), `${file} ${key}`);
      else errors.push(`${file} ${key}: unknown target "${t}"`);
      reg.Saturation.add(`sem/${bg}/${ct}/${m}/${name}`);
    }

  } else if (file.startsWith('06')) {
    for (const bg of BGS) for (const ct of CONTRASTS) for (const name of NAMES) {
      for (const m of MODES) need('Saturation', `sem/${bg}/${ct}/${m}/${name}`, `${file} ${bg}/${ct}/${name}`);
      reg.Primitives.add(`sem/${bg}/${ct}/${name}`);
    }
  } else if (file.startsWith('07')) {
    for (const bg of BGS) for (const name of NAMES) {
      for (const ct of CONTRASTS) need('Primitives', `sem/${bg}/${ct}/${name}`, `${file} ${bg}/${name}`);
      reg.Contrast.add(`sem/${bg}/${name}`);
    }
  } else if (file.startsWith('08')) {
    for (const bg of BGS) for (const name of NAMES) need('Contrast', `sem/${bg}/${name}`, `${file} ${bg}/${name}`);
    for (const name of NAMES) reg.Background.add(name);
  }
}

// --- structural expectations
const expectHueLeaves = () => {
  let n = 0;
  for (const bg of BGS) for (const ct of CONTRASTS) for (const m of MODES) for (const sat of SATS) n += hueScoped[bg][ct][m][sat].length;
  return n;
};
const hueLeaves = [...reg.Hue].filter((n) => n.startsWith('sem/')).length;
if (hueLeaves !== expectHueLeaves()) errors.push(`Hue leaf count ${hueLeaves} ≠ expected ${expectHueLeaves()} (04 scripts lost rows during chunking?)`);
for (const bg of BGS) for (const ct of CONTRASTS) for (const m of MODES) for (const name of NAMES) {
  if (!reg.Saturation.has(`sem/${bg}/${ct}/${m}/${name}`)) errors.push(`05 never creates sem/${bg}/${ct}/${m}/${name} — 06 would fail with missingCount>0`);
}
// every script must be runnable as a top-level-await body and stay under the tool limit
for (const file of readdirSync(DIR)) {
  if (!file.endsWith('.js')) continue;
  const src = readFileSync(join(DIR, file), 'utf8');
  // Strip comments before scanning for API usage — a script that DOCUMENTS a banned API
  // in a comment is doing the right thing and must not be flagged for it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (src.length > 50000) errors.push(`${file}: ${src.length} chars exceeds the use_figma limit`);
  // APIs the use_figma sandbox rejects outright (loadAllPagesAsync cost a full sync run).
  for (const api of ['figma.notify', 'closePlugin', 'loadAllPagesAsync', 'setPluginData', 'createImageAsync'])
    if (code.includes(api)) errors.push(`${file}: uses ${api}, which the use_figma sandbox does not support`);
  if (!/return \{/.test(code)) errors.push(`${file}: does not return a summary object`);
  if (/figma\.currentPage\s*=/.test(code)) errors.push(`${file}: assigns figma.currentPage (must use setCurrentPageAsync)`);
  if ((code.match(/setCurrentPageAsync/g) || []).length > 1) errors.push(`${file}: calls setCurrentPageAsync more than once`);
  // scripts run as an async function body — parse them the same way use_figma will
  try { new AsyncFn(src); } catch (e) { errors.push(`${file}: syntax error — ${e.message}`); }
  // Rewriting a FONT_FAMILY-scoped variable re-renders every text node reachable through
  // it, and Figma throws unless those fonts are loaded. A script can pass this check on its
  // first run and start failing later, once text styles are bound and applied to real
  // content — so require the preload up front rather than discovering it in Figma.
  if (/'FONT_FAMILY'|"FONT_FAMILY"/.test(code) && !/loadFontAsync/.test(code))
    errors.push(`${file}: writes a FONT_FAMILY variable but never calls loadFontAsync — this throws once text styles are applied`);
  // A preload can also be present but INCOMPLETE: it must cover the fonts currently painted
  // through the variable, not just the ones being written. A hardcoded list goes stale on the
  // next revision, so require the outgoing half to be read off the live variable.
  if (/'FONT_FAMILY'|"FONT_FAMILY"/.test(code) && /loadFontAsync/.test(code) && !/valuesByMode/.test(code))
    errors.push(`${file}: preloads fonts from a static list only — derive the outgoing families from the variables' valuesByMode, or the list goes stale on the next pairing change`);
  // Parsing does NOT catch a call to a helper that was dropped during a rewrite: that only
  // throws at runtime, in Figma, after the script has already started mutating. Check that
  // every function called by name is actually declared in the file.
  // strings hold prose and JSON payloads full of parens — scan code only
  const bare = code.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  const decls = declaredIn(code);
  const seen = new Set();
  for (const [kind, list] of [['calls', callsIn(bare)], ['references', refsIn(bare)]])
    for (const [, , name] of list) {
      if (decls.has(name) || GLOBALS.has(name) || seen.has(name)) continue;
      seen.add(name);
      errors.push(`${file}: ${kind} ${name} but nothing in the script declares it`);
    }
}

if (errors.length) {
  console.error(`✗ figma sync validation: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 40)) console.error('  ' + e);
  if (errors.length > 40) console.error(`  … +${errors.length - 40} more`);
  process.exit(1);
}
console.log(`✓ figma sync valid: ${order.length} scripts, ${hueLeaves} hue leaves, ${reg.Saturation.size} saturation vars, ${reg.Contrast.size} contrast vars, ${reg.Background.size} public tokens — every alias target is created before use`);
