/**
 * Emits dist/figma.json — the variable graph the Figma sync consumes.
 *
 * Figma resolves ONE mode per collection, so each theme axis is its own
 * collection and the combination emerges through an alias CHAIN:
 *
 *   Background (Surface Primary | Surface Secondary | Accent Color | Media)
 *     → Contrast (AA | AAA)
 *       → Primitives (Light | Dark)          [also holds the raw ramps]
 *         → Saturation (Muted | Regular | Bold)
 *           → Hue (8 hues + brand)           [only for hue-dependent tokens]
 *             → Primitives raw {hue}/{sat}/{step}
 *   plus Radius (Square | Rounded | Pill), Density, Typography, Language.
 *
 * Every value is read back out of the SHIPPED flavor.css through the same
 * cascade resolver the WCAG QA uses, so Figma cannot drift from the web.
 * Which tokens need a Hue-level leaf is DERIVED (a token is hue-scoped when its
 * reference differs across hues), never hand-listed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCss, declarationsFor, classifyRef, refKey } from './lib/resolve-css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const meta = JSON.parse(readFileSync(join(DIST, 'meta.json'), 'utf8'));
const css = readFileSync(join(DIST, 'flavor.css'), 'utf8');
const blocks = parseCss(css);

const HUES = meta.axes.hue;            // 10 hues + brand, brand2
const SATS = meta.axes.sat;
const MODES = meta.axes.mode;
const CONTRASTS = meta.axes.contrast;
const BGS = meta.axes.bg;

const SEMANTIC_NAMES = [
  'surface-page', 'surface-1', 'surface-2', 'surface-3', 'surface-tint',
  'text-primary', 'text-secondary', 'text-tertiary', 'text-disabled',
  'text-accent', 'text-on-accent-subtle', 'text-on-media', 'text-on-media-secondary',
  'border-subtle', 'border-default', 'border-strong', 'border-interactive',
  'accent-subtle', 'accent-subtle-hover', 'accent-border', 'focus-ring',
  'accent-bg', 'accent-bg-hover', 'accent-bg-active', 'accent-fg',
  'secondary-bg', 'secondary-bg-hover', 'secondary-bg-active', 'secondary-fg',
  'secondary-subtle', 'secondary-subtle-hover', 'secondary-border', 'secondary-text', 'text-on-secondary-subtle',
];
const FEEDBACK_NAMES = [];
for (const k of ['success', 'warning', 'danger', 'info']) for (const p of ['bg', 'border', 'text', 'solid', 'solid-fg']) FEEDBACK_NAMES.push(`${k}-${p}`);
const ALL_NAMES = [...SEMANTIC_NAMES, ...FEEDBACK_NAMES];

// --- resolve the immediate reference for every (bg, contrast, mode, sat, hue, name)
const refs = {};   // refs[bg][c][m][sat][hue][name]
for (const bg of BGS) { refs[bg] = {}; for (const c of CONTRASTS) { refs[bg][c] = {}; for (const m of MODES) { refs[bg][c][m] = {};
  for (const sat of SATS) { refs[bg][c][m][sat] = {};
    for (const hue of HUES) {
      const decls = declarationsFor(blocks, { hue, sat, mode: m, contrast: c, bg });
      const row = {};
      for (const n of ALL_NAMES) row[n] = classifyRef(decls['--' + n]);
      refs[bg][c][m][sat][hue] = row;
    }
  }
} } }

// --- derive which names need a Hue-level leaf (ref differs by hue, or points at a hue primitive)
const hueScoped = {};
for (const bg of BGS) { hueScoped[bg] = {}; for (const c of CONTRASTS) { hueScoped[bg][c] = {}; for (const m of MODES) { hueScoped[bg][c][m] = {};
  for (const sat of SATS) {
    const set = [];
    for (const n of ALL_NAMES) {
      // A Hue leaf is needed only when the reference actually DIFFERS by hue.
      // Fixed-hue tokens (feedback greens/reds…) resolve identically everywhere
      // and bind straight to the primitive one level up.
      const keys = new Set(HUES.map((h) => refKey(refs[bg][c][m][sat][h][n])));
      if (keys.size > 1) set.push(n);
    }
    hueScoped[bg][c][m][sat] = set;
  }
} } }

const TYPE_SIZES = [11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];
const LINE_HEIGHTS = [16, 16, 20, 24, 26, 28, 32, 38, 44, 54, 66, 78];
/** Curated text styles → scale step. fontSize/lineHeight bind to Typography vars in Figma. */
const TEXT_STYLES = [
  { name: 'Display/2XL', step: 12, family: 'display', weight: 'Bold' },
  { name: 'Display/XL', step: 11, family: 'display', weight: 'Bold' },
  { name: 'Display/L', step: 10, family: 'display', weight: 'Bold' },
  { name: 'Display/M', step: 9, family: 'display', weight: 'Bold' },
  { name: 'Display/S', step: 8, family: 'display', weight: 'Bold' },
  { name: 'Heading/L', step: 7, family: 'display', weight: 'Bold' },
  { name: 'Heading/M', step: 6, family: 'text', weight: 'Semi Bold' },
  { name: 'Heading/S', step: 5, family: 'text', weight: 'Semi Bold' },
  { name: 'Body/L', step: 5, family: 'text', weight: 'Regular' },
  { name: 'Body/M', step: 4, family: 'text', weight: 'Regular' },
  { name: 'Body/M Strong', step: 4, family: 'text', weight: 'Semi Bold' },
  { name: 'Body/S', step: 3, family: 'text', weight: 'Regular' },
  { name: 'Body/S Strong', step: 3, family: 'text', weight: 'Semi Bold' },
  { name: 'Label/M', step: 2, family: 'text', weight: 'Medium' },
  { name: 'Label/S', step: 1, family: 'text', weight: 'Semi Bold' },
  { name: 'Mono/M', step: 3, family: 'mono', weight: 'Regular' },
  { name: 'Mono/S', step: 2, family: 'mono', weight: 'Regular' },
];

const out = {
  version: meta.version,
  axes: meta.axes, defaults: meta.defaults,
  hues: HUES, sats: SATS, modes: MODES, contrasts: CONTRASTS, bgs: BGS,
  semanticNames: SEMANTIC_NAMES, feedbackNames: FEEDBACK_NAMES, allNames: ALL_NAMES,
  refs, hueScoped,
  radius: meta.surfaceModel?.radius ?? null,
  typography: { sizes: TYPE_SIZES, lineHeights: LINE_HEIGHTS, pairs: meta.fontPairs, textStyles: TEXT_STYLES },
  bgModeNames: { primary: 'Surface Primary', secondary: 'Surface Secondary', accent: 'Accent Color', media: 'Media' },
  radiusModeNames: { square: 'Square', rounded: 'Rounded', pill: 'Pill' },
  chain: 'Background(4) → Contrast(2) → Primitives(Light|Dark) → Saturation(3) → Hue(9) → raw primitives; plus Radius(3), Density(3), Typography(5), Language(5)',
};
writeFileSync(join(DIST, 'figma.json'), JSON.stringify(out));
let leaves = 0;
for (const bg of BGS) for (const c of CONTRASTS) for (const m of MODES) for (const sat of SATS) leaves += hueScoped[bg][c][m][sat].length;
console.log(`figma.json: ${BGS.length} backgrounds × ${CONTRASTS.length} contrast × ${MODES.length} modes × ${SATS.length} sats · ${ALL_NAMES.length} tokens · ${leaves} hue-scoped leaf-slots (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
