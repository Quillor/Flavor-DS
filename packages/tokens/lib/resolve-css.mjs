/**
 * Shared CSS-cascade resolver for the generated flavor.css.
 * Used by scripts/wcag-qa.mjs (final hex) and figma-export.mjs (immediate refs)
 * so both tools see exactly what a browser sees — no second implementation of
 * the cascade, no drift between QA and the Figma sync.
 */

/** Parse flavor.css into ordered blocks with attribute selectors. */
export function parseCss(css) {
  const blocks = [];
  // Strip comments FIRST. A comment sitting above a rule becomes part of the
  // selector text and would otherwise drop the whole block — which is exactly
  // what happened to the light-mode primitive palette (first rule in the file,
  // preceded by the header comment).
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selText = m[1].trim();
    if (!selText || selText.startsWith('@') || selText.startsWith('/*')) continue;
    const decls = {};
    for (const line of m[2].split(';')) {
      const i = line.indexOf(':');
      if (i > 0) { const k = line.slice(0, i).trim(); if (k.startsWith('--')) decls[k] = line.slice(i + 1).trim(); }
    }
    const selectors = selText.split(',').map((s) => s.trim()).filter((s) => s.startsWith(':root')).map((s) => {
      const attrs = {}; const nots = []; let spec = 0;
      for (const a of s.matchAll(/\[data-([a-z]+)(?:="([^"]+)")?\]/g)) {
        if (s.slice(0, a.index).endsWith(':not(')) nots.push(a[1]); else attrs[a[1]] = a[2] ?? true;
        spec++;
      }
      return { attrs, nots, spec };
    });
    if (selectors.length) blocks.push({ selectors, decls });
  }
  return blocks;
}

/** Winning declaration map for one attribute set (cascade: specificity, then source order). */
export function declarationsFor(blocks, attrs) {
  const ordered = [];
  blocks.forEach((b, order) => {
    for (const s of b.selectors) {
      let ok = true;
      for (const [k, v] of Object.entries(s.attrs)) { if (v === true ? !(k in attrs) : attrs[k] !== v) { ok = false; break; } }
      if (ok) for (const k of s.nots) if (k in attrs) { ok = false; break; }
      if (ok) ordered.push({ spec: s.spec, order, decls: b.decls });
    }
  });
  ordered.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const out = {};
  for (const o of ordered) Object.assign(out, o.decls);
  return out;
}

/** Follow var() chains to a literal value (hex / url / shadow). */
export function makeValueResolver(decls) {
  const walk = (name, seen) => {
    if (seen.has(name)) return null;
    seen.add(name);
    const v = decls[name];
    if (v == null) return null;
    const mm = v.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
    return mm ? walk(mm[1], seen) : v;
  };
  // Single-argument on purpose: callers pass this straight to Array#map, where a
  // second parameter would receive the index.
  return (name) => walk(name, new Set());
}

/** Classify an IMMEDIATE declaration value into a Figma-bindable reference. */
export function classifyRef(raw) {
  if (!raw) return null;
  let m = raw.match(/^var\(--ramp-(\d+)\)$/);
  if (m) return { kind: 'ramp', step: Number(m[1]) };
  m = raw.match(/^var\(--rampD-(\d+)\)$/);
  if (m) return { kind: 'rampD', step: Number(m[1]) };   // fixed-dark value set of the active hue (dark backgrounds)
  m = raw.match(/^var\(--neutral-(\d+)\)$/);
  if (m) return { kind: 'neutralRamp', step: Number(m[1]) };
  m = raw.match(/^var\(--flavor-(white|black|transparent)\)$/);
  if (m) return { kind: 'fixed', name: m[1] };
  m = raw.match(/^var\(--flavor-([a-z]+)-(muted|regular|bold)-(\d+)\)$/);
  if (m) return { kind: 'primitive', hue: m[1], sat: m[2], step: Number(m[3]) };
  m = raw.match(/^var\(--flavorL-([a-z]+)-(muted|regular|bold)-(\d+)\)$/);
  if (m) return { kind: 'primitiveL', hue: m[1], sat: m[2], step: Number(m[3]) };
  m = raw.match(/^var\(--flavorD-([a-z]+)-(muted|regular|bold)-(\d+)\)$/);
  if (m) return { kind: 'primitiveD', hue: m[1], sat: m[2], step: Number(m[3]) };
  return null; // shadows, urls, numeric scales — not color variables
}

export const refKey = (r) => r == null ? 'null'
  : r.kind === 'ramp' ? `ramp:${r.step}`
  : r.kind === 'rampD' ? `rampD:${r.step}`
  : r.kind === 'neutralRamp' ? `neutral:${r.step}`
  : r.kind === 'fixed' ? `fixed:${r.name}`
  : `${r.kind === 'primitiveL' ? 'L' : r.kind === 'primitiveD' ? 'D' : 'P'}:${r.hue}/${r.sat}/${r.step}`;
