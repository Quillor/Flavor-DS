/**
 * Canvas — design-system adapter for Flavor DS.
 *
 * Fills the five adapter modules from canvas-maker/reference/design-system-adapter.md
 * with this project's REAL routes and tokens. canvas.tsx (the EthiGov reference
 * implementation, ported verbatim) imports these under the same identifiers it used
 * inline, so the board's mechanics are untouched and this file is the only thing a
 * future project rewrites.
 *
 * Discovery, this project:
 *  - Stack: Astro (static) + React islands; pages render standalone, same-origin, no
 *    auth, no CSP → live iframes with full DOM access, as the reference requires.
 *  - Routes: siteNav (Getting started · Brand · Core UI · Product · Marketing) — real
 *    groupings, never invented. Component pages (47) belong to Core UI.
 *  - Tokens: CSS custom properties from @flavor-ds/tokens. STORED FORMAT IS HEX, not
 *    the reference's shadcn HSL triplets — so the colour-math layer below parses hex/
 *    rgb into HSL for the picker and writes back hex (adapter §3c: "swap the conversion
 *    layer, not the picker UI"). Semantic tokens are var() aliases into a ramp that
 *    resolve per NINE theme axes; overrides go on the frame's root, same as the ref.
 *  - Type presets: the 17 curated text styles (figma.json), not a raw size scale.
 *  - Spacing: --space-1..12 (2..80px, density-scaled). Palette: 14 hues × 3 sats × 12.
 */
import { siteNav } from '../siteNav';
import meta from '@flavor-ds/tokens/dist/meta.json';
import figma from '@flavor-ds/tokens/dist/figma.json';

/* ── 1. route registry (hierarchical) ─────────────────────────────────────── */
export interface CanvasPage { path: string; label: string }
export interface CanvasGroup { label: string; pages: CanvasPage[] }
export const GROUPS: CanvasGroup[] = siteNav.map((g) => ({
  label: g.group,
  pages: g.items.flatMap((i) => [
    { path: i.href, label: i.label },
    ...(i.children || []).flatMap((c) => c.items.map((s) => ({ path: s.href, label: `${c.group} · ${s.label}` }))),
  ]).filter((p) => p.path !== '/canvas/' && p.path !== '/canvas-demo/'),   // never frame the board itself
}));

/** §1 per-page defaults: component reference pages (label "Group · Name") start hidden. */
export const DEFAULT_HIDDEN: string[] = GROUPS.flatMap((g) => g.pages.filter((p) => p.label.includes(' · ')).map((p) => p.path));

/* ── 2. typography presets ────────────────────────────────────────────────── */
export interface TypographyPreset { label: string; css: Record<string, string>; spec: string }
const FAMILY_VAR: Record<string, string> = { display: '--font-display', text: '--font-text', mono: '--font-mono' };
const WEIGHT: Record<string, string> = { Regular: '400', Medium: '500', 'Semi Bold': '600', Bold: '700' };
export const TYPOGRAPHY_TOKENS: Record<string, TypographyPreset> = Object.fromEntries(
  (figma.typography.textStyles as { name: string; step: number; family: string; weight: string }[]).map((t) => {
    const size = figma.typography.sizes[t.step - 1], lh = figma.typography.lineHeights[t.step - 1];
    return [t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), {
      label: t.name,
      css: { 'font-family': `var(${FAMILY_VAR[t.family]})`, 'font-size': `var(--font-size-${t.step})`, 'font-weight': WEIGHT[t.weight] || '400', 'line-height': `var(--line-height-${t.step})` },
      spec: `${t.name} — ${FAMILY_VAR[t.family]} ${WEIGHT[t.weight] || '400'}, size/${t.step} (${size}px / ${lh}px line-height)`,
    }];
  }),
);
export const TYPOGRAPHY_CSS_PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color'];

/* ── 3. colour tokens + role scoping ──────────────────────────────────────── */
const SEMANTIC = figma.allNames as string[];
const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const human = (s: string) => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const COLOR_TOKENS: Record<string, { label: string; cssVar: string }> = Object.fromEntries(SEMANTIC.map((n) => [camel(n), { label: human(n), cssVar: `--${n}` }]));
export const TEXT_COLOR_KEYS = SEMANTIC.filter((n) => /^text-|-text$|-fg$/.test(n)).map(camel);
export const BACKGROUND_COLOR_KEYS = SEMANTIC.filter((n) => /^surface-|^accent-(bg|subtle)|-bg$|-solid$/.test(n)).map(camel);

/* palette for aliasing — the real primitives, grouped by hue (14 hues × 3 sats × 12) */
export const PALETTE_GROUPS: Array<{ label: string; tokens: string[] }> = (meta.axes.hue as string[]).filter((h) => h !== 'brand').map((h) => ({
  label: h[0].toUpperCase() + h.slice(1),
  tokens: (meta.axes.sat as string[]).flatMap((s) => Array.from({ length: 12 }, (_, i) => `--flavor-${h}-${s}-${i + 1}`)),
}));

/* ── 4. spacing ───────────────────────────────────────────────────────────── */
const SPACE_PX = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
export const SPACING_TOKENS: Record<string, { label: string; rem: number }> = {
  '0': { label: '0', rem: 0 },
  ...Object.fromEntries(SPACE_PX.map((px, i) => [`space-${i + 1}`, { label: `space-${i + 1} · ${px}px`, rem: px / 16 }])),
};
/** the CSS the tweak writes for a spacing key — a var(), so density still applies */
export const spacingCss = (key: string) => (key === '0' ? '0' : `var(--${key})`);

/* ── theme axes (this project's "modes") + defaults ────────────────────────── */
export const AXES: Record<string, string[]> = { hue: meta.axes.hue, sat: meta.axes.sat, mode: meta.axes.mode, contrast: meta.axes.contrast, bg: meta.axes.bg, radius: meta.axes.radius, density: meta.axes.density, font: meta.axes.font, dir: ['ltr', 'rtl'] };
export const AXIS_DEFAULTS: Record<string, string> = { ...(meta.defaults as Record<string, string>) };
export const AXIS_LABELS: Record<string, string> = { hue: 'Hue', sat: 'Saturation', mode: 'Mode', contrast: 'Contrast', bg: 'Background', radius: 'Radius', density: 'Density', font: 'Type pairing', dir: 'Direction' };

/* ── token editor categories (the panel is generated from these) ──────────── */
export const EDITOR_CATEGORIES: { id: string; label: string; tokens: { key: string; label: string; cssVar: string; kind: 'color' | 'length' | 'text' | 'shadow' }[] }[] = [
  ...[['Surface', /^surface-/], ['Text', /^text-/], ['Border', /^border-|^focus-ring$/], ['Accent', /^accent-/], ['Feedback', /^(success|warning|danger|info)-/]].map(([label, re]) => ({
    id: String(label).toLowerCase(), label: String(label),
    tokens: SEMANTIC.filter((n) => (re as RegExp).test(n)).map((n) => ({ key: camel(n), label: human(n), cssVar: `--${n}`, kind: 'color' as const })),
  })),
  { id: 'spacing', label: 'Spacing', tokens: SPACE_PX.map((px, i) => ({ key: `space-${i + 1}`, label: `space-${i + 1} · ${px}px`, cssVar: `--space-${i + 1}`, kind: 'length' as const })) },
  { id: 'radius', label: 'Radius', tokens: ['control', 'field', 'container', 'media', 'round'].map((k) => ({ key: `radius-${k}`, label: `radius-${k}`, cssVar: `--radius-${k}`, kind: 'length' as const })) },
  { id: 'type', label: 'Type', tokens: [{ key: 'font-display', label: 'Display family', cssVar: '--font-display', kind: 'text' as const }, { key: 'font-text', label: 'Text family', cssVar: '--font-text', kind: 'text' as const }, { key: 'font-mono', label: 'Mono family', cssVar: '--font-mono', kind: 'text' as const }, ...figma.typography.sizes.map((_: number, i: number) => ({ key: `font-size-${i + 1}`, label: `size/${i + 1}`, cssVar: `--font-size-${i + 1}`, kind: 'length' as const }))] },
  { id: 'elevation', label: 'Elevation', tokens: [1, 2, 3].map((n) => ({ key: `elevation-${n}`, label: `elevation-${n}`, cssVar: `--elevation-${n}`, kind: 'shadow' as const })) },
  { id: 'motion', label: 'Motion', tokens: [...[1, 2, 3, 4, 5].map((n) => ({ key: `duration-${n}`, label: `duration-${n}`, cssVar: `--duration-${n}`, kind: 'text' as const })), ...['standard', 'emphasized', 'exit', 'spring'].map((e) => ({ key: `ease-${e}`, label: `ease-${e}`, cssVar: `--ease-${e}`, kind: 'text' as const }))] },
];

/* ── 5. theming bridge ────────────────────────────────────────────────────── */
/** Apply the theme axes to a frame — the same data-attributes the site sets on <html>. */
export function applyAxes(doc: Document, axes: Record<string, string>) {
  const el = doc.documentElement;
  for (const [k, v] of Object.entries(axes)) k === 'dir' ? el.setAttribute('dir', v) : el.setAttribute(`data-${k}`, v);
  try { doc.defaultView?.localStorage.setItem('flavor-theme', JSON.stringify(axes)); } catch {}
}
export const VERSION = meta.version;
export const FEEDBACK_ENDPOINT = '/__canvas/feedback';

/* ── provenance ───────────────────────────────────────────────────────────── */
/** canvas.tsx is the canvas-maker reference (== EthiGov's canvas.tsx working copy).
 *  Delta from the reference, by hunk (diff <(tail -n +32 reference/implementation.tsx) canvas.tsx):
 *    header + import block · inline adapter blocks removed (routes, type, colour, palette, spacing)
 *    · parseHslTriplet/formatHslTriplet/rgbToHsl/resolveTripletForVar (hex storage) · 6 hsl(var())
 *    sites → var() · spacing tweak writes the token · applyCanvasTheme on data-mode · [ext §7]
 *    persistence + header pill · wordmark/preamble text · DEFAULT_HIDDEN seed · 3 declared-raw markers.
 *  Everything else — layout, engine, comment flow, MentionTextarea, TokenEditorPanel, export —
 *  is unchanged. `npm run test` enforces the utility-class contract; scripts/test-behaviors.mjs
 *  does not cover the board (it has its own probe in the commit that added it). */
