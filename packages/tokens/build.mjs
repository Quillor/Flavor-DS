/**
 * Flavor DS token generator.
 *
 * Everything downstream (CSS, JSON, contrast approvals) is COMPUTED here:
 *  - 8 hues × 3 saturation families × 12 steps × 2 modes, equal OKLCH lightness
 *    per step across hues; gamut clamping reduces chroma only.
 *  - Surfaces are TINTED: regular = tonal tint, muted/bold = accent-colored
 *    surfaces (deeper steps).
 *  - BACKGROUND AXIS (data-bg): primary | secondary | accent | media.
 *    secondary = softer surfaces (one step deeper, lower contrast); accent = the
 *    hue's most saturated step IS the page; media = white UI over a photo.
 *  - ACCENT-COLOR BACKGROUND: the accent color IS the background — page sits
 *    mid-ramp, text flips to the light end (light mode) / stays light (dark
 *    mode), and the accent walk inverts. Every selection is computed per
 *    (mode × sat × contrast × tonal) family; a failing pairing is not expressible.
 *  - All attribute selectors are :root-prefixed so the cascade is order-proof
 *    (an unprefixed [data-*] block ties with :root and silently loses).
 *
 * Outputs (dist/): flavor.css, tokens.json, ramps.json, contrast.json, meta.json
 */
import { formatHex, clampChroma, wcagContrast, oklch } from 'culori';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
mkdirSync(DIST, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Ramp definition
// ---------------------------------------------------------------------------

// Hue wheel (OKLCH degrees). In-between hues sit halfway between their neighbours so every
// ramp keeps the same equal-lightness steps and the same three saturation families.
const HUES = {
  neutral:   { h: 255, baseC: 0.012 },
  red:       { h: 27,  baseC: 0.165 },
  scarlet:   { h: 41,  baseC: 0.160 },   // red-orange
  orange:    { h: 55,  baseC: 0.150 },
  tangerine: { h: 75,  baseC: 0.150 },   // yellow-orange
  yellow:    { h: 95,  baseC: 0.145 },
  lime:      { h: 122, baseC: 0.145 },   // yellow-green
  green:     { h: 150, baseC: 0.140 },
  teal:      { h: 200, baseC: 0.120 },
  cyan:      { h: 228, baseC: 0.140 },
  blue:      { h: 255, baseC: 0.155 },
  violet:    { h: 280, baseC: 0.160 },   // blue-purple
  purple:    { h: 305, baseC: 0.165 },
  magenta:   { h: 345, baseC: 0.170 },
};

// Brand themes are PAIRS of hues from the ramps above: primary carries accents,
// secondary carries the second brand colour (--secondary-*), focus ring and accent border.
// Single-hue themes get a NEUTRAL secondary so --secondary-* always resolves.
const BRANDS = {
  brand:  { primary: 'blue',    secondary: 'orange', label: 'Brand (Blue + Orange)' },
  brand2: { primary: 'magenta', secondary: 'cyan',   label: 'Brand 2 (Magenta + Cyan)' },
};

const SATS = { muted: 0.45, regular: 1.0, bold: 1.6 };

const L_LIGHT = [0.99, 0.975, 0.945, 0.91, 0.87, 0.825, 0.77, 0.70, 0.60, 0.53, 0.42, 0.25];
const L_DARK  = [0.145, 0.175, 0.205, 0.235, 0.28, 0.33, 0.42, 0.53, 0.68, 0.75, 0.83, 0.94];
const C_CURVE = [0.14, 0.20, 0.30, 0.60, 0.90, 1.0, 1.0, 1.0, 1.0, 0.96, 0.78, 0.42];

const MODES = { light: L_LIGHT, dark: L_DARK };
const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WHITE = '#ffffff';
const BLACK = '#0d0d0f';

const ramps = {};
for (const [hueName, { h, baseC }] of Object.entries(HUES)) {
  ramps[hueName] = {};
  for (const [satName, satMul] of Object.entries(SATS)) {
    ramps[hueName][satName] = {};
    for (const [modeName, lScale] of Object.entries(MODES)) {
      ramps[hueName][satName][modeName] = lScale.map((l, i) => {
        const c = baseC * satMul * C_CURVE[i];
        const clamped = clampChroma({ mode: 'oklch', l, c, h }, 'oklch', 'rgb');
        return formatHex(clamped);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Surface + selection architecture
// ---------------------------------------------------------------------------
// Standard: near-extreme surfaces per saturation family.
// Tonal: mid-ramp surfaces — the hue IS the page. Configs below define surface
// steps AND the candidate walks for text/accent/etc.; the generator walks each
// list until the worst-case ratio across the family's 8 hues clears the
// threshold, and throws if none does.

// Background axis: 'primary' (crisp) and 'secondary' (softer, lower-contrast —
// page and cards sit closer together, one step deeper into the ramp).
const SURFACES_PRIMARY = {
  light: {
    regular: { page: 2, surface1: 1, surface2: 1, surface3: 1 },
    muted:   { page: 3, surface1: 2, surface2: 2, surface3: 1 },
    bold:    { page: 3, surface1: 2, surface2: 2, surface3: 1 },
  },
  dark: {
    regular: { page: 1, surface1: 2, surface2: 3, surface3: 4 },
    muted:   { page: 2, surface1: 3, surface2: 4, surface3: 5 },
    bold:    { page: 2, surface1: 3, surface2: 4, surface3: 5 },
  },
};
const softer = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.min(v + 1, 12)]));
// Dark backgrounds: ALWAYS dark. In light mode they use the dark-mode surface steps of the dark
// ramps (fixed --flavorD-* primitives, so light mode cannot lighten them); in dark mode they go one
// step deeper still — the page becomes the fixed black ink and cards start at step 1.
const deeper = (m) => ({ page: 'black', surface1: Math.max(m.page, 1), surface2: Math.max(m.surface1, 1), surface3: Math.max(m.surface2, 1) });
const SURFACES = {
  primary: SURFACES_PRIMARY,
  secondary: Object.fromEntries(['light', 'dark'].map((mode) => [mode,
    Object.fromEntries(Object.keys(SURFACES_PRIMARY[mode]).map((sat) => [sat, softer(SURFACES_PRIMARY[mode][sat])]))])),
};
SURFACES['dark-primary'] = { light: SURFACES_PRIMARY.dark, dark: Object.fromEntries(Object.keys(SURFACES_PRIMARY.dark).map((sat) => [sat, deeper(SURFACES_PRIMARY.dark[sat])])) };
SURFACES['dark-secondary'] = { light: SURFACES.secondary.dark, dark: Object.fromEntries(Object.keys(SURFACES.secondary.dark).map((sat) => [sat, deeper(SURFACES.secondary.dark[sat])])) };
const DARK_BGS = new Set(['dark-primary', 'dark-secondary']);
/** which ramp value-set a background resolves its colours from: dark bgs are always the dark set */
const rampModeOf = (bg, mode) => (DARK_BGS.has(bg) ? 'dark' : mode);

const STD_WALKS = {
  light: {
    primary: [12], secondary: [11, 12], tertiary: [10, 11, 12],
    border: [8, 9, 10], accent: [9, 10, 11, 12], link: [9, 10, 11, 12],
    onSubtle: [11, 12], subtleOffset: 'plus2', focus: 9,
  },
  dark: {
    primary: [12], secondary: [11, 12], tertiary: [10, 11, 12],
    border: [8, 9, 10], accent: [9, 10, 11, 12], link: [9, 10, 11, 12],
    onSubtle: [11, 12], subtleOffset: 'plus2', focus: 9,
  },
};


// ---------------------------------------------------------------------------
// 3. Contrast computation
// ---------------------------------------------------------------------------

const r2 = (n) => Math.round(n * 100) / 100;
// HARDENED thresholds: WCAG floors + a 0.05 safety margin, so 8-bit sRGB rounding in any
// renderer or design tool can never turn a computed pass into a measured fail.
const MARGIN = 0.05;
const TH = { aa: 4.5 + MARGIN, aaa: 7.0 + MARGIN, ui: 3.0 + MARGIN };
const thOf = (contrast) => TH[contrast];
const stepContrast = (ramp, a, b) => wcagContrast(ramp[a - 1], ramp[b - 1]);
const HUE_NAMES = Object.keys(HUES);
const INK = { white: WHITE, black: BLACK };
/** color of a "step or ink" ref: number → ramp step, 'white'|'black' → fixed ink */
const colorOf = (ramp, ref) => (typeof ref === 'number' ? ramp[ref - 1] : INK[ref]);
const refContrast = (ramp, a, b) => wcagContrast(colorOf(ramp, a), colorOf(ramp, b));

function familyWalk(mode, sat, surfaces, candidates, threshold, label) {
  const surfaceSteps = Object.values(surfaces);
  for (const step of candidates) {
    let worst = Infinity, worstHue = '';
    for (const hue of HUE_NAMES) {
      const ramp = ramps[hue][sat][mode];
      for (const s of surfaceSteps) {
        const c = refContrast(ramp, step, s);
        if (c < worst) { worst = c; worstHue = hue; }
      }
    }
    if (worst >= threshold) return { step, worstRatio: r2(worst), worstHue };
  }
  throw new Error(`No step satisfies ${threshold}:1 for ${label} (${mode}/${sat})`);
}

function perRampWalk(ramp, surfaces, candidates, threshold) {
  const surfaceSteps = Object.values(surfaces);
  for (const step of candidates) {
    const worst = Math.min(...surfaceSteps.map((s) => refContrast(ramp, step, s)));
    if (worst >= threshold) return { step, worstRatio: r2(worst) };
  }
  return null;
}

/** Accent solid: fg (white/black) must clear `threshold`; solid must sit ≥3:1
 *  from every surface so the control reads as a component (WCAG 1.4.11).
 *  Prefer the first step where WHITE passes; black only if no white step exists. */
function accentWalk(ramp, surfaces, candidates, threshold, label) {
  const surfaceSteps = Object.values(surfaces);
  const evals = candidates.map((step) => {
    const bg = ramp[step - 1];
    return { step, w: wcagContrast(WHITE, bg), b: wcagContrast(BLACK, bg),
      vsSurface: Math.min(...surfaceSteps.map((s) => refContrast(ramp, step, s))) };
  });
  for (const fgName of ['white', 'black']) {
    for (const e of evals) {
      const ratio = fgName === 'white' ? e.w : e.b;
      if (ratio >= threshold && e.vsSurface >= TH.ui) return { step: e.step, fg: fgName, ratio: r2(ratio), vsSurface: r2(e.vsSurface) };
    }
  }
  throw new Error(`No accent step reaches ${threshold}:1 (+3:1 vs surfaces) for ${label}`);
}

/** Cross-ramp walks: fg comes from `ramp`, backgrounds are literal hex colours (another ramp's
 *  surfaces). Used for the SECONDARY brand hue, which must read on the PRIMARY hue's surfaces. */
function hexWalk(ramp, bgHexes, candidates, threshold) {
  for (const step of candidates) {
    const worst = Math.min(...bgHexes.map((b) => wcagContrast(colorOf(ramp, step), b)));
    if (worst >= threshold) return { step, worstRatio: r2(worst) };
  }
  return null;
}
function hexAccentWalk(ramp, bgHexes, candidates, threshold, label) {
  const evals = candidates.map((step) => { const bg = ramp[step - 1]; return { step, w: wcagContrast(WHITE, bg), b: wcagContrast(BLACK, bg), vsSurface: Math.min(...bgHexes.map((h) => wcagContrast(bg, h))) }; });
  for (const fgName of ['white', 'black']) for (const e of evals) {
    const ratio = fgName === 'white' ? e.w : e.b;
    if (ratio >= threshold && e.vsSurface >= TH.ui) return { step: e.step, fg: fgName, ratio: r2(ratio), vsSurface: r2(e.vsSurface) };
  }
  throw new Error(`No secondary accent step reaches ${threshold}:1 (+3:1 vs surfaces) for ${label}`);
}
/** Secondary hue on a set of surface hexes: solid + fg, subtle fill + text, link text, border. */
function secondaryOn(ramp, surfaceHexes, mode, threshold, label) {
  const accent = hexAccentWalk(ramp, surfaceHexes, mode === 'light' ? [9, 10, 11, 12] : [9, 10, 11, 12], threshold, label);
  const link = hexWalk(ramp, surfaceHexes, [9, 10, 11, 12], threshold);
  // subtle: a light tint (light mode) / dark tint (dark mode) of the secondary ramp — step 3, hover 4
  const subtle = 3, subtleHover = 4;
  const onSubtle = hexWalk(ramp, [ramp[subtle - 1]], [11, 12, 'black', 'white'], threshold);
  const border = hexWalk(ramp, surfaceHexes, [7, 8, 9, 10], TH.ui);
  if (!link || !onSubtle || !border) throw new Error(`secondary walk failed: ${label}`);
  return { accent, hover: Math.min(accent.step + 1, 12), active: Math.min(accent.step + 2, 12), link, subtle, subtleHover, onSubtle, border };
}

// --- Tonal: the page IS the hue at its MOST SATURATED step (per ramp — yellow
// peaks high on the ramp, blue low), light/dark still apply. Everything else is
// derived from the page: which ink side clears contrast, then walks per side.
const chromaOf = (hex) => (oklch(hex)?.c) || 0;
function tonalForRamp(ramp, mode, threshold, label) {
  const chroma = ramp.map(chromaOf);
  const maxC = Math.max(...chroma);
  // Plateaus are common (yellow holds max chroma across several steps): among
  // steps within 3% of the peak, prefer the LIGHTER one — reads more vivid.
  const near = STEPS.filter((s) => chroma[s - 1] >= maxC * 0.97);
  // Neutral has no meaningful chroma peak — use a mid-tone so tonal-neutral is a real surface.
  const peak = maxC < 0.03 ? 9 : (mode === 'light' ? Math.min(...near) : Math.max(...near));
  // try the peak first, then walk outward by proximity
  const order = [...STEPS].sort((a, b) => Math.abs(a - peak) - Math.abs(b - peak) || a - b);
  const lighterDir = mode === 'light' ? -1 : 1;  // step direction that gets LIGHTER in this mode
  for (const p of order) {
    // Inputs/cards (surface-1) sit one step LIGHTER than the page; drawers/modals one more.
    const p1 = Math.min(Math.max(p + lighterDir, 1), 12);
    const p2 = Math.min(Math.max(p + lighterDir * 2, 1), 12);
    const surfaces = { page: p, surface1: p1, surface2: p2, surface3: p2 };
    // ink side: dark ink (ramp end that is darkest) vs light ink; ramp end 12 is dark in light mode, light in dark mode
    const darkEnd = mode === 'light' ? 12 : 1, lightEnd = mode === 'light' ? 1 : 12;
    // Ink stays a TONE of the hue: prefer the ramp's own end (step 12 / step 1); fall back to
    // fixed black/white only when the ramp end cannot clear the threshold.
    const cands = [
      { side: 'dark', primary: darkEnd, tone: true },  { side: 'light', primary: lightEnd, tone: true },
      { side: 'dark', primary: 'black', tone: false }, { side: 'light', primary: 'white', tone: false },
    ];
    let best = null;
    for (const c of cands) {
      const worst = Math.min(...Object.values(surfaces).map((s) => refContrast(ramp, c.primary, s)));
      if (worst < threshold) continue;
      if (!best) { best = { ...c, worst }; continue; }
      // toned candidates beat fixed ink; among equals, higher contrast wins
      if ((c.tone && !best.tone) || (c.tone === best.tone && worst > best.worst)) best = { ...c, worst };
    }
    if (!best) continue;
    const towardInk = best.side === 'dark' ? (mode === 'light' ? 1 : -1) : (mode === 'light' ? -1 : 1); // step direction toward the ink end
    const seq = (from, n) => Array.from({ length: n }, (_, i) => Math.min(Math.max(from + towardInk * i, 1), 12));
    const inkEnd = best.side === 'dark' ? darkEnd : lightEnd;
    const inkFixed = best.side === 'dark' ? 'black' : 'white';
    const secondary = perRampWalk(ramp, surfaces, [...seq(inkEnd - towardInk, 2), inkEnd, inkFixed], threshold);
    const tertiary = perRampWalk(ramp, surfaces, [...seq(inkEnd - towardInk * 2, 3), inkEnd, inkFixed], threshold);
    const border = perRampWalk(ramp, surfaces, seq(p + towardInk * 3, 9), TH.ui);
    if (!secondary || !tertiary || !border) continue;
    // accent (button on the tonal page): a fill that contrasts the page ≥3 and carries readable text.
    // Order candidates by contrast against the page, descending, exclude steps within ±1 of page.
    // Accent fill: the MOST VIBRANT step that still works — order by chroma (desc), then contrast
    // vs page; accentWalk enforces fg text ≥ threshold and ≥3:1 vs every surface.
    const accCands = STEPS.filter((s) => Math.abs(s - p) > 1)
      .sort((a, b) => (chroma[b - 1] - chroma[a - 1]) || (stepContrast(ramp, b, p) - stepContrast(ramp, a, p)));
    let accent = null;
    // walk candidates one at a time so the FIRST (most vibrant) passing step wins
    for (const s of accCands) { try { accent = accentWalk(ramp, surfaces, [s], threshold, label); break; } catch {} }
    if (!accent) continue;
    // subtle fill: 2 steps from page opposite to ink (i.e. toward the ink's *own* end? no — subtle should be a light-ish tint
    // readable with ink-side text): pick step at inkEnd - towardInk*? Use the accent's fill neighbourhood: 2 steps from the ink end.
    const subtle = Math.min(Math.max(inkEnd - towardInk * 10, 1), 12); // the far end from ink (light fill for dark ink, dark fill for light ink)
    const subtleHover = Math.min(Math.max(subtle + towardInk, 1), 12);
    const onSubtle = perRampWalk(ramp, { s: subtle }, [inkEnd, inkFixed, ...seq(inkEnd - towardInk, 2)], threshold);
    const link = perRampWalk(ramp, surfaces, [...seq(inkEnd - towardInk, 2), inkEnd, inkFixed], threshold);
    // status text on the tonal page: must read on the surfaces AND on the subtle fill it may sit in
    const statusText = perRampWalk(ramp, { ...surfaces, subtle }, [inkEnd, inkFixed, ...seq(inkEnd - towardInk, 2)], threshold);
    if (!onSubtle || !link || !statusText) continue;
    const hover = Math.min(Math.max(accent.step + (accent.step > p ? 1 : -1), 1), 12);
    const active = Math.min(Math.max(accent.step + (accent.step > p ? 2 : -2), 1), 12);
    return {
      peakStep: peak, surfaces, inkSide: best.side,
      textPrimary: { step: best.primary, worstRatio: r2(best.worst) },
      textSecondary: secondary, textTertiary: tertiary,
      textDisabled: { step: Math.min(Math.max(p + towardInk * 3, 1), 12) },
      borderSubtle: { step: Math.min(Math.max(p + towardInk * 1, 1), 12) },
      borderDefault: { step: Math.min(Math.max(p + towardInk * 2, 1), 12) },
      borderInteractive: border, focus: border,
      surfaceTint: { step: Math.min(Math.max(p - lighterDir, 1), 12) },
      accent, accentHover: hover, accentActive: active,
      accentSubtle: subtle, accentSubtleHover: subtleHover, accentBorder: Math.min(Math.max(subtle + towardInk * 2, 1), 12),
      onSubtle, link, statusText,
    };
  }
  throw new Error(`No tonal page step works for ${label}`);
}

const SURFACE_BGS = ['primary', 'secondary', 'dark-primary', 'dark-secondary'];
const semantics = {};   // [bg][mode][sat][contrast]
const perRampSel = {};  // [bg][mode][sat][hue][contrast] = {accent,link,onSubtle}; tonal lives in tonalSel
const tonalSel = {};    // [mode][sat][hue][contrast] (background = "Accent Color")
const contrastReport = { thresholds: { aa: 4.5, aaa: 7.0, uiComponent: 3.0 }, backgrounds: {}, modes: {} };

for (const bg of SURFACE_BGS) { semantics[bg] = {}; perRampSel[bg] = {}; }
for (const mode of ['light', 'dark']) {
  tonalSel[mode] = {};
  for (const bg of SURFACE_BGS) { semantics[bg][mode] = {}; perRampSel[bg][mode] = {}; }
  contrastReport.modes[mode] = { families: {}, approvedPairs: {} };
  for (const sat of Object.keys(SATS)) {
    tonalSel[mode][sat] = {};
    for (const bg of SURFACE_BGS) { semantics[bg][mode][sat] = {}; perRampSel[bg][mode][sat] = {}; for (const hue of HUE_NAMES) perRampSel[bg][mode][sat][hue] = { aa: {}, aaa: {} }; }
    for (const hue of HUE_NAMES) tonalSel[mode][sat][hue] = {};
    for (const contrast of ['aa', 'aaa']) {
      const th = thOf(contrast);
      const cfg = STD_WALKS[mode];
      for (const bg of SURFACE_BGS) {
        const surfaces = SURFACES[bg][mode][sat];
        const rm = rampModeOf(bg, mode), rcfg = STD_WALKS[rm];
        semantics[bg][mode][sat][contrast] = {
          surfaces,
          textPrimary: familyWalk(rm, sat, surfaces, rcfg.primary, TH.aaa, `text-primary/${bg}`),
          textSecondary: familyWalk(rm, sat, surfaces, rcfg.secondary, th, `text-secondary/${bg}`),
          textTertiary: familyWalk(rm, sat, surfaces, rcfg.tertiary, th, `text-tertiary/${bg}`),
          borderInteractive: familyWalk(rm, sat, surfaces, rcfg.border, TH.ui, `border-interactive/${bg}`),
          focus: familyWalk(rm, sat, surfaces, [9, 10, 11, 12], TH.ui, `focus-ring/${bg}`),
        };
        for (const hue of HUE_NAMES) {
          const ramp = ramps[hue][sat][rm];
          const label = `${hue}-${sat}/${mode}/${contrast}/${bg}`;
          const std = {
            accent: accentWalk(ramp, surfaces, rcfg.accent, th, label),
            link: perRampWalk(ramp, surfaces, rcfg.link, th),
            onSubtle: perRampWalk(ramp, { s: Math.min(surfaces.surface1 + 2, 12) }, rcfg.onSubtle, th),
          };
          if (!std.link || !std.onSubtle) throw new Error(`link/onSubtle walk failed: ${label}`);
          perRampSel[bg][mode][sat][hue][contrast] = std;
        }
      }
      for (const hue of HUE_NAMES) {
        const ramp = ramps[hue][sat][mode];
        tonalSel[mode][sat][hue][contrast] = tonalForRamp(ramp, mode, th, `${hue}-${sat}/${mode}/${contrast}/accent`);
      }
    }
    contrastReport.modes[mode].families[sat] = {
      selections: semantics.primary[mode][sat],
      selectionsSecondary: semantics.secondary[mode][sat],
      perRamp: Object.fromEntries(HUE_NAMES.map((hue) => [hue, Object.fromEntries(['aa', 'aaa'].map((c) => [c, {
        standard: perRampSel.primary[mode][sat][hue][c],
        secondary: perRampSel.secondary[mode][sat][hue][c],
        tonal: tonalSel[mode][sat][hue][c],
      }]))])),
    };
  }
  for (const hue of HUE_NAMES) {
    for (const sat of Object.keys(SATS)) {
      const ramp = ramps[hue][sat][mode];
      const approved = { aaText: [], aaaText: [], uiComponent: [] };
      for (const fg of STEPS) for (const bgS of STEPS) {
        if (fg === bgS) continue;
        const ratio = r2(stepContrast(ramp, fg, bgS));
        if (ratio >= 7) approved.aaaText.push({ fg, bg: bgS, ratio });
        if (ratio >= 4.5) approved.aaText.push({ fg, bg: bgS, ratio });
        else if (ratio >= 3) approved.uiComponent.push({ fg, bg: bgS, ratio });
      }
      contrastReport.modes[mode].approvedPairs[`${hue}-${sat}`] = approved;
    }
  }
}

// --- Brand PRIMARY accents are computed against the NEUTRAL surfaces they actually sit on
// (a brand theme keeps neutral surfaces; only the accents come from the primary hue).
const brandSel = {}; // [bg][mode][sat][brand][contrast] = { accent, link, onSubtle, focus }
for (const bg of SURFACE_BGS) { brandSel[bg] = {}; for (const mode of ['light', 'dark']) { brandSel[bg][mode] = {}; for (const sat of Object.keys(SATS)) { brandSel[bg][mode][sat] = {};
  for (const [b, def] of Object.entries(BRANDS)) { brandSel[bg][mode][sat][b] = {};
    for (const contrast of ['aa', 'aaa']) {
      const th = thOf(contrast); const S = SURFACES[bg][mode][sat]; const rm = rampModeOf(bg, mode); const nr = ramps.neutral[sat][rm];
      const hexes = [S.page, S.surface1, S.surface2, S.surface3].map((n) => colorOf(nr, n));
      const pr = ramps[def.primary][sat][rm], sr = ramps[def.secondary][sat][rm];
      const label = `brand ${b}/${sat}/${mode}/${contrast}/${bg}`;
      const accent = hexAccentWalk(pr, hexes, [9, 10, 11, 12], th, label);
      const link = hexWalk(pr, hexes, [9, 10, 11, 12, rm === 'light' ? 'black' : 'white'], th);
      const onSubtle = hexWalk(pr, [pr[2]], [11, 12, rm === 'light' ? 'black' : 'white'], th);
      const focus = hexWalk(sr, hexes, [9, 10, 11, 12], TH.ui);
      if (!link || !onSubtle || !focus) throw new Error(`brand walk failed: ${label}`);
      brandSel[bg][mode][sat][b][contrast] = { accent, link, onSubtle, focus };
    }
  } } } }

// --- Secondary brand colour, computed against the surfaces it will actually sit on.
// Single-hue themes: secondary = neutral. Brand themes: the pair's secondary hue.
const secondaryHueOf = (hue) => (BRANDS[hue] ? BRANDS[hue].secondary : 'neutral');
const secSel = {}, secTonal = {}; // secSel[bg][mode][sat][hue][contrast], secTonal[mode][sat][hue][contrast]
for (const bg of SURFACE_BGS) { secSel[bg] = {}; for (const mode of ['light', 'dark']) { secSel[bg][mode] = {}; for (const sat of Object.keys(SATS)) { secSel[bg][mode][sat] = {};
  for (const hue of [...HUE_NAMES, ...Object.keys(BRANDS)]) { secSel[bg][mode][sat][hue] = {};
    const sh = secondaryHueOf(hue), ph = BRANDS[hue] ? BRANDS[hue].primary : hue;
    for (const contrast of ['aa', 'aaa']) {
      const th = thOf(contrast);
      // surfaces of THIS theme: brand themes and plain hues sit on the neutral ramp? No — surfaces resolve from
      // --ramp-N which is the ACTIVE hue ramp for plain hues and neutral for brands (see 5b).
      const rm = rampModeOf(bg, mode);
      const surfRamp = BRANDS[hue] ? ramps.neutral[sat][rm] : ramps[ph][sat][rm];
      const S = SURFACES[bg][mode][sat];
      const surfaceHexes = [S.page, S.surface1, S.surface2, S.surface3].map((n) => colorOf(surfRamp, n));
      secSel[bg][mode][sat][hue][contrast] = secondaryOn(ramps[sh][sat][rm], surfaceHexes, rm, th, `secondary ${hue}(${sh})/${sat}/${mode}/${contrast}/${bg}`);
    }
  } } } }
for (const mode of ['light', 'dark']) { secTonal[mode] = {}; for (const sat of Object.keys(SATS)) { secTonal[mode][sat] = {};
  for (const hue of [...HUE_NAMES, ...Object.keys(BRANDS)]) { secTonal[mode][sat][hue] = {};
    const sh = secondaryHueOf(hue), ph = BRANDS[hue] ? BRANDS[hue].primary : hue;
    for (const contrast of ['aa', 'aaa']) {
      const th = thOf(contrast);
      const t = tonalSel[mode][sat][ph][contrast]; const pr = ramps[ph][sat][mode];
      const surfaceHexes = Object.values(t.surfaces).map((n) => pr[n - 1]);
      // on a saturated tonal page, the secondary must be found anywhere on its ramp — try both ends
      const cands = STEPS.slice().sort((a, b) => Math.abs(b - 6.5) - Math.abs(a - 6.5)); // ends first
      const sr = ramps[sh][sat][mode];
      const accent = hexAccentWalk(sr, surfaceHexes, cands, th, `secondary-tonal ${hue}(${sh})/${sat}/${mode}/${contrast}`);
      const link = hexWalk(sr, surfaceHexes, [...cands, 'black', 'white'], th);
      const dir = accent.step >= 7 ? 1 : -1;
      const border = hexWalk(sr, surfaceHexes, cands, TH.ui);
      // subtle: near the accent's own end of the ramp so it stays legible on the tonal page; text = the far end
      const subtle = accent.step >= 7 ? 3 : 10, subtleHover = accent.step >= 7 ? 4 : 9;
      const onSubtle = hexWalk(sr, [sr[subtle - 1]], accent.step >= 7 ? [12, 11, 'black'] : [1, 2, 'white'], th);
      if (!link || !border || !onSubtle) throw new Error(`secondary tonal walk failed: ${hue}/${sat}/${mode}/${contrast} accent=${accent.step}/${accent.fg} link=${!!link} border=${!!border} onSubtle=${!!onSubtle} surfaces=${surfaceHexes}`);
      secTonal[mode][sat][hue][contrast] = { accent, hover: Math.min(Math.max(accent.step + dir, 1), 12), active: Math.min(Math.max(accent.step + 2 * dir, 1), 12), link, subtle, subtleHover, onSubtle, border };
    }
  } } }

// --- On Media: UI is solid white on a photo, ignoring light/dark. Text is fixed
// ink; accents use the LIGHT-mode selections (white surfaces) via fixed light
// primitives (--flavorL-*). Feedback likewise. Computed against WHITE surfaces.
const MEDIA_SURF = { page: 'white', s1: 'white' };
const mediaSel = {}; // [contrast][hue][sat]
for (const contrast of ['aa', 'aaa']) {
  mediaSel[contrast] = {};
  const th = thOf(contrast);
  for (const hue of HUE_NAMES) { mediaSel[contrast][hue] = {};
    for (const sat of Object.keys(SATS)) {
      const ramp = ramps[hue][sat].light;
      const surf = { w: 'white' };
      const whiteRamp = ramp.map(() => WHITE); // surfaces are pure white on media
      const accent = accentWalk(ramp, { w: 1 }, [9, 10, 11, 12], th, `media ${hue}-${sat}`); // step-1 (near white) stands in for white
      const link = perRampWalk(ramp, surf, [9, 10, 11, 12], th);
      const onSubtle = perRampWalk(ramp, { s: 3 }, [11, 12], th);
      mediaSel[contrast][hue][sat] = { accent, link, onSubtle };
    }
  }
}
const secMedia = {}; // [contrast][hue][sat] — secondary hue on white
for (const contrast of ['aa', 'aaa']) { secMedia[contrast] = {}; const th = thOf(contrast);
  for (const hue of [...HUE_NAMES, ...Object.keys(BRANDS)]) { secMedia[contrast][hue] = {};
    for (const sat of Object.keys(SATS)) secMedia[contrast][hue][sat] = secondaryOn(ramps[secondaryHueOf(hue)][sat].light, [WHITE], 'light', th, `secondary media ${hue}/${sat}/${contrast}`);
  } }
// Fixed neutral ink on white (light neutral ramp)
const NL = ramps.neutral.regular.light;
const mediaInk = {
  aa:  { primary: 12, secondary: 11, tertiary: [10, 11].find((s) => wcagContrast(NL[s - 1], WHITE) >= 4.5) },
  aaa: { primary: 12, secondary: [11, 12].find((s) => wcagContrast(NL[s - 1], WHITE) >= 7), tertiary: [11, 12].find((s) => wcagContrast(NL[s - 1], WHITE) >= 7) },
};

// ---------------------------------------------------------------------------
// 4. Non-color scales + font pairs
// ---------------------------------------------------------------------------

const SPACE_BASE = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
const DENSITY = { compact: 0.75, regular: 1.0, comfy: 1.25 };
// Shape axis (data-radius). Component-level radius tokens; --radius-round is NEVER
// remapped (avatars, radios, switches, spinners, dots stay circular in every mode).
const RADIUS_MODES = {
  square:  { control: 0, field: 0, container: 0, media: 0 },
  rounded: { control: 6, field: 6, container: 12, media: 8 },
  pill:    { control: 9999, field: 20, container: 20, media: 12 },
};
const TYPE_SIZES = [11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];
const LINE_HEIGHTS = [16, 16, 20, 24, 26, 28, 32, 38, 44, 54, 66, 78];
const RADII = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 12, 6: 16, full: 9999 };
/** Press feedback. 0.96 exactly — anything below 0.95 reads as exaggerated. */
const PRESS_SCALE = 0.96;
/** Minimum interactive target. Touch/mobile prefers 44; dense desktop may drop to 40. */
const HIT_AREA = { touch: 44, dense: 40 };
/** Icon stroke carries the optical weight of the text beside it. */
const ICON_STROKE = { regular: 1.5, strong: 2, bold: 2.5 };
const DURATIONS = { 1: 75, 2: 150, 3: 250, 4: 400, 5: 600 };
const EASINGS = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1.2)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};
/**
 * Type pairings — five, covering the range a product system actually needs:
 * technical, editorial, long-form reading, geometric, expressive.
 *
 * Selection rules, applied deliberately:
 *  - Every face is a considered design with a real weight range (400/500/600/700 in text,
 *    500+/700 in display). A single-weight display face cannot express hierarchy and
 *    silently degrades wherever semibold is asked for — the previous Righteous did exactly
 *    that, collapsing to Regular in Figma's text styles.
 *  - Display and text must do different jobs. Two near-identical grotesques is not a pairing.
 *  - Prefer pairings with a documented basis: a superfamily designed to pair (Source Serif 4
 *    with Source Sans 3), or a face whose own specimen sets it against a neutral workhorse
 *    (Fraunces, Syne).
 *  - Avoid the defaults that read as unconsidered: Playfair Display is a display-only didone
 *    that falls apart at text sizes, and Outfit is a generic geometric with no voice.
 */
const FONT_PAIRS = {
  // Technical grotesque. The brand default — Space Grotesk's Space Mono lineage gives the
  // headline a machined character that Inter, the strongest libre UI face, sets off cleanly.
  flavor: { label: 'Flavor (default)', display: `'Space Grotesk', 'Helvetica Neue', system-ui, sans-serif`, text: `'Inter', system-ui, -apple-system, sans-serif`, google: ['Space Grotesk:wght@500;700', 'Inter:wght@400;500;600;700'] },
  // Editorial. Fraunces is a variable old-style with a wonk axis built for headlines; Libre
  // Franklin is a Franklin Gothic revival — the workhorse gothic editorial design has paired
  // with old-style serifs for a century.
  editorial: { label: 'Editorial', display: `'Fraunces', Georgia, serif`, text: `'Libre Franklin', system-ui, sans-serif`, google: ['Fraunces:opsz,wght@9..144,600;9..144,700', 'Libre Franklin:wght@400;500;600;700'] },
  // Reading. A superfamily: Source Serif 4 and Source Sans 3 were drawn to work together, so
  // the pairing is correct by construction rather than by taste. Optical sizing on the serif
  // keeps long-form text comfortable where a didone would not.
  // `was` records the previous Figma mode name so the sync renames BY NAME. Renaming by
  // position looks equivalent and is not: Reading sits at index 2 in the new order while the
  // pairing it replaces sat at index 3, so a positional pass would swap it with Geometric and
  // silently repoint every frame pinned to either.
  reading: { was: 'Classic Serif', label: 'Reading', display: `'Source Serif 4', Georgia, serif`, text: `'Source Sans 3', system-ui, sans-serif`, google: ['Source Serif 4:opsz,wght@8..60,600;8..60,700', 'Source Sans 3:wght@400;500;600;700'] },
  // Geometric. Jost is a considered Futura revival with a full weight range; DM Sans carries
  // the geometric skeleton into text sizes without Futura's low x-height legibility problems.
  geometric: { label: 'Geometric', display: `'Jost', system-ui, sans-serif`, text: `'DM Sans', system-ui, sans-serif`, google: ['Jost:wght@500;700', 'DM Sans:wght@400;500;700'] },
  // Expressive. Syne is an experimental display family (400–800) that keeps the retro-futurist
  // voice the brand asked for, with the hierarchy Righteous could not provide; Archivo is a
  // neutral grotesque that stays out of its way.
  expressive: { was: 'Atomic Age', label: 'Expressive', display: `'Syne', system-ui, sans-serif`, text: `'Archivo', system-ui, sans-serif`, google: ['Syne:wght@600;700;800', 'Archivo:wght@400;500;600;700'] },
};
const FONT_MONO = `'IBM Plex Mono', ui-monospace, 'SF Mono', monospace`;

// ---------------------------------------------------------------------------
// 5. CSS emission
// ---------------------------------------------------------------------------
// Selector contract: base values live on bare `:root`; every override is
// `:root[data-…]…` so it out-specifies the base regardless of source order.
// data-media is emitted LAST with boosted specificity so it wins over any
// mode/contrast/tonal combination ("UI is always white on media").

const css = [];
css.push(`/* Flavor DS — generated by @flavor-ds/tokens. DO NOT EDIT BY HAND.
 * Theme axes (set on <html>):
 *   data-hue:      ${[...Object.keys(BRANDS), ...HUE_NAMES].join(' | ')}   (default: brand — brand themes pair a primary + secondary hue)
 *   data-sat:      ${Object.keys(SATS).join(' | ')}   (default: regular)
 *   data-mode:     light | dark    data-contrast: aa | aaa
 *   data-tonal:    (present = the hue's most-saturated step is the page)
 *   data-media:    (present = photo background, solid white UI, ignores mode)
 *   data-density:  ${Object.keys(DENSITY).join(' | ')}
 *   data-font:     ${Object.keys(FONT_PAIRS).join(' | ')}
 *   dir:           ltr | rtl
 */`);

// 5a. Primitives (mode-scoped) + fixed light primitives (--flavorL-*, mode-independent)
for (const mode of ['light', 'dark']) {
  const sel = mode === 'light' ? ':root, :root[data-mode="light"]' : ':root[data-mode="dark"]';
  const lines = [`${sel} {`, `  color-scheme: ${mode};`, `  --flavor-white: ${WHITE};`, `  --flavor-black: ${BLACK};`];
  for (const hue of HUE_NAMES) for (const sat of Object.keys(SATS))
    ramps[hue][sat][mode].forEach((hex, i) => lines.push(`  --flavor-${hue}-${sat}-${i + 1}: ${hex};`));
  lines.push('}');
  css.push(lines.join('\n'));
}
{
  const lines = [':root {', '  --flavor-transparent: transparent;'];
  for (const hue of HUE_NAMES) for (const sat of Object.keys(SATS))
    ramps[hue][sat].light.forEach((hex, i) => lines.push(`  --flavorL-${hue}-${sat}-${i + 1}: ${hex};`));
  for (const hue of HUE_NAMES) for (const sat of Object.keys(SATS))
    ramps[hue][sat].dark.forEach((hex, i) => lines.push(`  --flavorD-${hue}-${sat}-${i + 1}: ${hex};`));
  lines.push('}');
  css.push(lines.join('\n'));
}

// 5b. Ramp selection (hue × sat → --ramp-N + --neutral-N). Default: blue/regular.
{
  const def = [`:root {`];
  // Default (no data-hue) = brand: neutral surfaces + Flavor Blue accents.
  STEPS.forEach((s) => def.push(`  --ramp-${s}: var(--flavor-neutral-regular-${s});`));
  STEPS.forEach((s) => def.push(`  --rampD-${s}: var(--flavorD-neutral-regular-${s});`));
  STEPS.forEach((s) => def.push(`  --neutral-${s}: var(--flavor-neutral-regular-${s});`));
  def.push('}');
  css.push(def.join('\n'));
  for (const hue of HUE_NAMES) for (const sat of Object.keys(SATS)) {
    const lines = [`:root[data-hue="${hue}"][data-sat="${sat}"] {`];
    STEPS.forEach((s) => lines.push(`  --ramp-${s}: var(--flavor-${hue}-${sat}-${s});`));
    STEPS.forEach((s) => lines.push(`  --rampD-${s}: var(--flavorD-${hue}-${sat}-${s});`));
    lines.push('}');
    css.push(lines.join('\n'));
  }
}

// ---- selector helpers -----------------------------------------------------
// Background is ONE axis: data-bg = primary | secondary | accent | media.
// Every bg-specific block repeats the attributes of the primary block it must
// beat and adds [data-bg], so it always out-specifies it. Only one bg value can
// be active at a time, so bg blocks never fight each other.
const attrsFor = (mode, contrast, sat, hue) => {
  let a = '';
  if (mode === 'dark') a += '[data-mode="dark"]';
  if (contrast === 'aaa') a += '[data-contrast="aaa"]';
  if (hue) a += `[data-hue="${hue}"][data-sat="${sat}"]`;
  else if (sat && sat !== 'regular') a += `[data-sat="${sat}"]`;
  return a;
};
/** Selector list. bg 'primary' also matches when no data-bg is present at all.
 *  hue 'brand' at regular sat also matches when no data-hue is present (bare default). */
function selFor({ mode, contrast, sat = null, hue = null, bg }) {
  const a = attrsFor(mode, contrast, sat, hue);
  const out = bg === 'primary' ? [`:root${a}`, `:root${a}[data-bg="primary"]`] : [`:root${a}[data-bg="${bg}"]`];
  if (hue === 'brand' && sat === 'regular') {
    const bare = attrsFor(mode, contrast, null, null) + ':not([data-hue])';
    if (bg === 'primary') out.push(`:root${bare}`, `:root${bare}[data-bg="primary"]`);
    else out.push(`:root${bare}[data-bg="${bg}"]`);
  }
  return out.join(',\n');
}
const block = (sel, decls) => css.push(`${sel} {\n${decls.map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`);
/** step → the active hue ramp (--ramp-N; --rampD-N = fixed dark set for dark backgrounds); 'black'|'white' → fixed ink */
const rampV = (n, D = false) => (typeof n === 'string' ? `var(--flavor-${n})` : `var(--ramp${D ? 'D' : ''}-${n})`);
/** V: false → mode-scoped primitive · true/'L' → fixed light · 'D' → fixed dark */
const flavorV = (hue, sat, ref, V = false) => typeof ref === 'number'
  ? `var(--flavor${V === 'D' ? 'D' : V ? 'L' : ''}-${hue}-${sat}-${ref})`
  : `var(--flavor-${ref})`;
const varOf = (bg) => (DARK_BGS.has(bg) ? 'D' : false);
const HUES_ALL = [...HUE_NAMES, ...Object.keys(BRANDS)];
/** brand themes = mixed hues: neutral ramp surfaces, primary-hue accents, secondary-hue focus/borders */
const accentHueOf = (hue) => (BRANDS[hue] ? BRANDS[hue].primary : hue);
const focusHueOf = (hue) => (BRANDS[hue] ? BRANDS[hue].secondary : hue);
const secDecls = (sh, sat, q, L = false) => [
  ['secondary-bg', flavorV(sh, sat, q.accent.step, L)], ['secondary-bg-hover', flavorV(sh, sat, q.hover, L)], ['secondary-bg-active', flavorV(sh, sat, q.active, L)],
  ['secondary-fg', flavorV(sh, sat, q.accent.fg, L)],
  ['secondary-subtle', flavorV(sh, sat, q.subtle, L)], ['secondary-subtle-hover', flavorV(sh, sat, q.subtleHover, L)],
  ['secondary-border', flavorV(sh, sat, q.border.step, L)],
  ['secondary-text', flavorV(sh, sat, q.link.step, L)], ['text-on-secondary-subtle', flavorV(sh, sat, q.onSubtle.step, L)],
];

// 5c. Surface backgrounds (primary | secondary) — sat-scoped, hue-agnostic via --ramp-N
for (const bg of SURFACE_BGS) for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) for (const sat of Object.keys(SATS)) {
  const sem = semantics[bg][mode][sat][contrast];
  const S = sem.surfaces; const D = DARK_BGS.has(bg);
  const subtleStep = Math.min(S.surface1 + 2, 12);
  const pageN = typeof S.page === 'number' ? S.page : 0; // 'black' page → tint/border count from step 0
  block(selFor({ mode, contrast, sat, bg }), [
    ['surface-page', rampV(S.page, D)], ['surface-1', rampV(S.surface1, D)], ['surface-2', rampV(S.surface2, D)], ['surface-3', rampV(S.surface3, D)],
    ['surface-tint', rampV(Math.min(pageN + 1, 12), D)],
    ['text-primary', rampV(sem.textPrimary.step, D)], ['text-secondary', rampV(sem.textSecondary.step, D)], ['text-tertiary', rampV(sem.textTertiary.step, D)],
    ['text-disabled', rampV(7, D)],
    ['border-subtle', rampV(Math.min(pageN + 2, 12), D)], ['border-default', rampV(6, D)],
    ['border-strong', rampV(sem.borderInteractive.step, D)], ['border-interactive', rampV(sem.borderInteractive.step, D)],
    ['accent-subtle', rampV(subtleStep, D)], ['accent-subtle-hover', rampV(Math.min(subtleStep + 1, 12), D)],
    ['accent-border', rampV(7, D)], ['focus-ring', rampV(sem.focus.step, D)],
    ['feedback-tonal', '0'],
  ]);
}

// 5d. Accent tokens per ramp for the surface backgrounds (hue-scoped)
for (const bg of SURFACE_BGS) for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) for (const hue of HUES_ALL) for (const sat of Object.keys(SATS)) {
  const ah = accentHueOf(hue), fh = focusHueOf(hue), V = varOf(bg);
  const p = BRANDS[hue] ? brandSel[bg][mode][sat][hue][contrast] : perRampSel[bg][mode][sat][ah][contrast];
  const hover = Math.min(p.accent.step + 1, 12), active = Math.min(p.accent.step + 2, 12);
  const decls = [
    ['accent-bg', flavorV(ah, sat, p.accent.step, V)], ['accent-bg-hover', flavorV(ah, sat, hover, V)], ['accent-bg-active', flavorV(ah, sat, active, V)],
    ['accent-fg', flavorV(ah, sat, p.accent.fg, V)],
    ['text-accent', flavorV(ah, sat, p.link.step, V)], ['text-on-accent-subtle', flavorV(ah, sat, p.onSubtle.step, V)],
  ];
  if (BRANDS[hue]) decls.push(
    ['accent-subtle', flavorV(ah, sat, 3, V)], ['accent-subtle-hover', flavorV(ah, sat, 4, V)],
    ['accent-border', flavorV(fh, sat, 7, V)], ['focus-ring', flavorV(fh, sat, p.focus.step, V)],
  );
  decls.push(...secDecls(secondaryHueOf(hue), sat, secSel[bg][mode][sat][hue][contrast], V));
  block(selFor({ mode, contrast, sat, hue, bg }), decls);
}

// 5e. ACCENT COLOR background — the hue's most saturated step IS the page (fully hue-scoped)
for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) for (const hue of HUES_ALL) for (const sat of Object.keys(SATS)) {
  const src = accentHueOf(hue), fh = focusHueOf(hue);
  const t = tonalSel[mode][sat][src][contrast];
  const R = (ref) => flavorV(src, sat, ref);
  block(selFor({ mode, contrast, sat, hue, bg: 'accent' }), [
    ['surface-page', R(t.surfaces.page)], ['surface-1', R(t.surfaces.surface1)], ['surface-2', R(t.surfaces.surface2)], ['surface-3', R(t.surfaces.surface3)],
    ['surface-tint', R(t.surfaceTint.step)],
    ['text-primary', R(t.textPrimary.step)], ['text-secondary', R(t.textSecondary.step)], ['text-tertiary', R(t.textTertiary.step)], ['text-disabled', R(t.textDisabled.step)],
    ['border-subtle', R(t.borderSubtle.step)], ['border-default', R(t.borderDefault.step)],
    ['border-strong', R(t.borderInteractive.step)], ['border-interactive', R(t.borderInteractive.step)],
    ['accent-subtle', R(t.accentSubtle)], ['accent-subtle-hover', R(t.accentSubtleHover)],
    ['accent-border', flavorV(fh, sat, t.accentBorder)], ['focus-ring', BRANDS[hue] ? flavorV(fh, sat, secTonal[mode][sat][hue][contrast].border.step) : R(t.focus.step)],
    ['accent-bg', R(t.accent.step)], ['accent-bg-hover', R(t.accentHover)], ['accent-bg-active', R(t.accentActive)],
    ['accent-fg', flavorV(src, sat, t.accent.fg)],
    ['text-accent', R(t.link.step)], ['text-on-accent-subtle', R(t.onSubtle.step)],
    ...secDecls(secondaryHueOf(hue), sat, secTonal[mode][sat][hue][contrast]),
    // Tonal feedback: status colours are TONES of the page hue (the page already owns the colour);
    // components add a status ICON under [data-bg="accent"] so meaning never rides on hue alone.
    ...['success', 'warning', 'danger', 'info'].flatMap((name) => [
      [`${name}-bg`, R(t.accentSubtle)], [`${name}-border`, R(t.accentBorder)],
      [`${name}-text`, R(t.statusText.step)], [`${name}-solid`, R(t.accent.step)], [`${name}-solid-fg`, flavorV(src, sat, t.accent.fg)],
    ]),
    ['feedback-tonal', '1'],
  ]);
}

// 5f. Feedback pairs (fixed hues; mode × contrast, per surface background)
for (const bg of SURFACE_BGS) for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) {
  const decls = [];
  // Feedback sits on EVERY sat family's surfaces (the block is sat-agnostic), so the text step is
  // walked against the worst surface across muted/regular/bold plus its own tinted background.
  const th = thOf(contrast); const rm = rampModeOf(bg, mode), V = varOf(bg);
  for (const [name, hue] of [['success', 'green'], ['warning', 'orange'], ['danger', 'red'], ['info', 'blue']]) {
    const p = perRampSel[bg][mode].regular[hue][contrast];
    const fr = ramps[hue].regular[rm];
    const hexes = [fr[2], ...Object.keys(SATS).flatMap((sat) => { const S = SURFACES[bg][mode][sat]; return HUE_NAMES.flatMap((h) => { const r = ramps[h][sat][rm]; return [S.page, S.surface1, S.surface2, S.surface3].map((n) => colorOf(r, n)); }); })];
    const text = hexWalk(fr, hexes, [11, 12, rm === 'light' ? 'black' : 'white'], th);
    if (!text) throw new Error(`feedback text walk failed: ${name}/${mode}/${contrast}/${bg}`);
    decls.push([`${name}-bg`, flavorV(hue, 'regular', 3, V)], [`${name}-border`, flavorV(hue, 'regular', 7, V)],
      [`${name}-text`, flavorV(hue, 'regular', text.step, V)], [`${name}-solid`, flavorV(hue, 'regular', p.accent.step, V)],
      [`${name}-solid-fg`, flavorV(hue, 'regular', p.accent.fg, V)]);
  }
  block(selFor({ mode, contrast, bg }), decls);
}
// (Accent-colour background feedback is emitted inside 5e — it is a tone of the page hue.)

// 5f'. Elevation shadows
css.push(`:root, :root[data-mode="light"] {
  --elevation-1: 0 1px 2px rgb(13 13 15 / 0.06), 0 1px 3px rgb(13 13 15 / 0.08);
  --elevation-2: 0 4px 10px rgb(13 13 15 / 0.10), 0 2px 4px rgb(13 13 15 / 0.06);
  --elevation-3: 0 16px 40px rgb(13 13 15 / 0.18), 0 4px 12px rgb(13 13 15 / 0.08);
}
:root[data-mode="dark"], :root[data-bg="accent"], :root[data-bg="dark-primary"], :root[data-bg="dark-secondary"] {
  --elevation-1: 0 1px 2px rgb(0 0 0 / 0.45);
  --elevation-2: 0 4px 12px rgb(0 0 0 / 0.50);
  --elevation-3: 0 20px 48px rgb(0 0 0 / 0.60);
}`);

// 5f'''. Interface-polish primitives (see .claude/skills/make-interfaces-feel-better).
// These are deliberately NOT themed. A ring or image outline drawn from the ramp picks up
// the surface tint underneath and reads as dirt on the edge, so they are pure black/white
// at low alpha and vary only by light/dark. Structural and state borders keep using the
// contrast-computed --border-* tokens; these express DEPTH, which is not a contrast concern.
css.push(`:root, :root[data-mode="light"] {
  --shadow-border:
    0 0 0 1px oklch(0 0 0 / 0.06),
    0 1px 2px -1px oklch(0 0 0 / 0.06),
    0 2px 4px 0 oklch(0 0 0 / 0.04);
  --shadow-border-hover:
    0 0 0 1px oklch(0 0 0 / 0.08),
    0 1px 2px -1px oklch(0 0 0 / 0.08),
    0 2px 4px 0 oklch(0 0 0 / 0.06);
  --image-outline: oklch(0 0 0 / 0.1);
}
:root[data-mode="dark"], :root[data-bg="dark-primary"], :root[data-bg="dark-secondary"] {
  /* Layered depth is invisible on dark ground — collapse to a single white ring. */
  --shadow-border: 0 0 0 1px oklch(1 0 0 / 0.08);
  --shadow-border-hover: 0 0 0 1px oklch(1 0 0 / 0.13);
  --image-outline: oklch(1 0 0 / 0.1);
}
:root[data-bg="media"] {
  /* On a photo the UI is always the light treatment, whatever data-mode says. */
  --shadow-border: 0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06);
  --shadow-border-hover: 0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.08);
  --image-outline: oklch(1 0 0 / 0.1);
}`);

// 5f''. MEDIA background — white UI on a photo, identical in light and dark.
// Emitted for BOTH mode selectors so it wins whatever data-mode says.
for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) {
  const ink = mediaInk[contrast];
  for (const sat of Object.keys(SATS)) {
    const decls = [
      ['media-image', `url('/photography/hero.jpg')`],
      ['surface-page', 'var(--flavor-transparent)'],
      ['surface-1', 'var(--flavor-white)'], ['surface-2', 'var(--flavor-white)'], ['surface-3', 'var(--flavor-white)'],
      ['surface-tint', 'var(--flavorL-neutral-regular-2)'],
      ['media-ink-primary', `var(--flavorL-neutral-regular-${ink.primary})`],
      ['media-ink-secondary', `var(--flavorL-neutral-regular-${ink.secondary})`],
      ['media-ink-tertiary', `var(--flavorL-neutral-regular-${ink.tertiary})`],
      ['text-on-media', 'var(--flavor-white)'],
      ['text-on-media-secondary', 'var(--flavorL-neutral-regular-3)'],
      ['text-on-media-shadow', '0 1px 2px rgb(0 0 0 / 0.6), 0 2px 12px rgb(0 0 0 / 0.5)'],
      ['text-primary', `var(--flavorL-neutral-regular-${ink.primary})`],
      ['text-secondary', `var(--flavorL-neutral-regular-${ink.secondary})`],
      ['text-tertiary', `var(--flavorL-neutral-regular-${ink.tertiary})`],
      ['text-disabled', 'var(--flavorL-neutral-regular-7)'],
      ['border-subtle', 'var(--flavorL-neutral-regular-4)'], ['border-default', 'var(--flavorL-neutral-regular-6)'],
      ['border-strong', 'var(--flavorL-neutral-regular-9)'], ['border-interactive', 'var(--flavorL-neutral-regular-9)'],
      ['elevation-1', '0 2px 6px rgb(0 0 0 / 0.25), 0 8px 24px rgb(0 0 0 / 0.30)'],
      ['elevation-2', '0 6px 16px rgb(0 0 0 / 0.30), 0 16px 40px rgb(0 0 0 / 0.35)'],
      ['elevation-3', '0 12px 32px rgb(0 0 0 / 0.35), 0 32px 80px rgb(0 0 0 / 0.45)'],
    ];
    for (const [name, hue] of [['success', 'green'], ['warning', 'orange'], ['danger', 'red'], ['info', 'blue']]) {
      const p = perRampSel.primary.light.regular[hue][contrast];
      decls.push([`${name}-bg`, flavorV(hue, 'regular', 3, true)], [`${name}-border`, flavorV(hue, 'regular', 7, true)],
        [`${name}-text`, flavorV(hue, 'regular', p.onSubtle.step, true)], [`${name}-solid`, flavorV(hue, 'regular', p.accent.step, true)],
        [`${name}-solid-fg`, flavorV(hue, 'regular', p.accent.fg, true)]);
    }
    block(selFor({ mode, contrast, sat, bg: 'media' }), decls);
  }
  for (const hue of HUES_ALL) for (const sat of Object.keys(SATS)) {
    const ah = accentHueOf(hue), fh = focusHueOf(hue);
    const p = mediaSel[contrast][ah][sat];
    const hover = Math.min(p.accent.step + 1, 12), active = Math.min(p.accent.step + 2, 12);
    block(selFor({ mode, contrast, sat, hue, bg: 'media' }), [
      ['accent-bg', flavorV(ah, sat, p.accent.step, true)], ['accent-bg-hover', flavorV(ah, sat, hover, true)], ['accent-bg-active', flavorV(ah, sat, active, true)],
      ['accent-fg', flavorV(ah, sat, p.accent.fg, true)],
      ['text-accent', flavorV(ah, sat, p.link.step, true)], ['text-on-accent-subtle', flavorV(ah, sat, p.onSubtle.step, true)],
      ['accent-subtle', flavorV(ah, sat, 3, true)], ['accent-subtle-hover', flavorV(ah, sat, 4, true)],
      ['accent-border', flavorV(fh, sat, 7, true)], ['focus-ring', flavorV(fh, sat, 9, true)],
      ...secDecls(secondaryHueOf(hue), sat, secMedia[contrast][hue][sat], true),
    ]);
  }
}

// 5g. Density-scoped spacing (:root-prefixed so every density actually applies)
for (const [density, mul] of Object.entries(DENSITY)) {
  const selector = density === 'regular' ? ':root' : `:root[data-density="${density}"]`;
  const lines = [`${selector} {`];
  SPACE_BASE.forEach((px, i) => lines.push(`  --space-${i + 1}: ${Math.max(1, Math.round(px * mul))}px;`));
  lines.push(`  --control-height-sm: ${Math.round(32 * mul)}px;`);
  lines.push(`  --control-height-md: ${Math.round(40 * mul)}px;`);
  lines.push(`  --control-height-lg: ${Math.round(48 * mul)}px;`);
  lines.push('}');
  css.push(lines.join('\n'));
}

// 5h. Typography (switchable pairs), radius, motion
{
  const lines = [':root {'];
  lines.push(`  --font-display: ${FONT_PAIRS.flavor.display};`);
  lines.push(`  --font-text: ${FONT_PAIRS.flavor.text};`);
  lines.push(`  --font-mono: ${FONT_MONO};`);
  // Dynamic type: every step carries its own multiplier so OS text-size settings can scale
  // NON-linearly (iOS Dynamic Type and Android 14 both scale small text more than display text).
  // --type-scale is the uniform fallback; @flavor-ds/ui/type-scale sets --type-scale-N per platform.
  lines.push(`  --type-scale: 1;`);
  lines.push('}');
  // The size tokens are (re)declared on any [data-type-scale] root too: a custom property resolves
  // its var() where it is DECLARED, so a scale set on a subtree must re-declare the sizes there.
  lines.push(':root, [data-type-scale] {');
  TYPE_SIZES.forEach((px, i) => {
    lines.push(`  --font-size-${i + 1}: calc(${px / 16}rem * var(--type-scale-${i + 1}, var(--type-scale)));`);
    lines.push(`  --line-height-${i + 1}: calc(${LINE_HEIGHTS[i] / 16}rem * var(--type-scale-${i + 1}, var(--type-scale)));`);
  });
  lines.push('}');
  lines.push(':root {');
  for (const [k, v] of Object.entries(RADII)) lines.push(`  --radius-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(DURATIONS)) lines.push(`  --duration-${k}: ${v}ms;`);
  for (const [k, v] of Object.entries(EASINGS)) lines.push(`  --ease-${k}: ${v};`);
  // Interface-polish scalars. Fixed values, not scales: each is a threshold where a
  // different number is worse, so exposing a ramp would only invite drift.
  lines.push(`  --press-scale: ${PRESS_SCALE};`);              // below 0.95 reads as exaggerated
  lines.push(`  --hit-area-touch: ${HIT_AREA.touch}px;`);      // touch / mobile minimum
  lines.push(`  --hit-area-dense: ${HIT_AREA.dense}px;`);      // dense desktop minimum
  for (const [k, v] of Object.entries(ICON_STROKE)) lines.push(`  --icon-stroke-${k}: ${v}px;`);
  lines.push('}');
  for (const [key, pair] of Object.entries(FONT_PAIRS)) {
    if (key === 'flavor') continue;
    lines.push(`:root[data-font="${key}"] {
  --font-display: ${pair.display};
  --font-text: ${pair.text};
}`);
  }
  lines.push(`@media (prefers-reduced-motion: reduce) {
  :root { --duration-1: 0ms; --duration-2: 0ms; --duration-3: 0ms; --duration-4: 0ms; --duration-5: 0ms; }
}`);
  css.push(lines.join('\n'));
}

// 5i. Shape modes (Square | Rounded | Pill). Default = rounded.
for (const [name, r] of Object.entries(RADIUS_MODES)) {
  const sel = name === 'rounded' ? ':root, :root[data-radius="rounded"]' : `:root[data-radius="${name}"]`;
  css.push(`${sel} {
  --radius-control: ${r.control}px;
  --radius-field: ${r.field}px;
  --radius-container: ${r.container}px;
  --radius-media: ${r.media}px;
}`);
}
css.push(`:root { --radius-round: 9999px; }`);

writeFileSync(join(DIST, 'flavor.css'), css.join('\n\n') + '\n');

// ---------------------------------------------------------------------------
// 6. JSON outputs
// ---------------------------------------------------------------------------

writeFileSync(join(DIST, 'ramps.json'), JSON.stringify(ramps, null, 2));
writeFileSync(join(DIST, 'contrast.json'), JSON.stringify(contrastReport, null, 2));

const meta = {
  name: 'Flavor DS',
  version: '0.3.0',
  axes: {
    hue: [...Object.keys(BRANDS), ...Object.keys(HUES)],
    sat: Object.keys(SATS),
    mode: ['light', 'dark'],
    contrast: ['aa', 'aaa'],
    bg: ['primary', 'secondary', 'dark-primary', 'dark-secondary', 'accent', 'media'],
    radius: Object.keys(RADIUS_MODES),
    density: Object.keys(DENSITY),
    font: Object.keys(FONT_PAIRS),
    dir: ['ltr', 'rtl'],
  },
  defaults: { hue: 'brand', sat: 'regular', mode: 'light', contrast: 'aa', bg: 'primary', radius: 'rounded', density: 'regular', font: 'flavor', dir: 'ltr' },
  fontPairs: Object.fromEntries(Object.entries(FONT_PAIRS).map(([k, p]) => [k, {
    label: p.label, display: p.display, text: p.text, ...(p.was ? { was: p.was } : {}),
    googleCss: `https://fonts.googleapis.com/css2?${p.google.map((f) => `family=${encodeURIComponent(f).replace(/%3A/g, ':').replace(/%40/g, '@').replace(/%2C/g, ',').replace(/%3B/g, ';')}`).join('&')}&display=swap`,
  }])),
  surfaceModel: {
    note: 'Surfaces resolve from the ACTIVE hue ramp. regular = tonal tint; muted/bold = accent-colored surfaces. data-tonal makes the page the ramp\'s MOST-SATURATED step (per hue) with ink chosen per contrast; data-media forces white UI on a photo regardless of mode.',
    surfaces: SURFACES,
    radius: RADIUS_MODES,
    accentBgPeakStep: Object.fromEntries(HUE_NAMES.map((h) => [h, Object.fromEntries(Object.keys(SATS).map((s) => [s, { light: tonalSel.light[s][h].aa.peakStep, dark: tonalSel.dark[s][h].aa.peakStep }]))])),
  },
  brands: BRANDS,
  themeCount: (Object.keys(HUES).length + Object.keys(BRANDS).length) * Object.keys(SATS).length * 2 * 2 * 6,
  htmlAttributes: ['data-hue', 'data-sat', 'data-mode', 'data-contrast', 'data-bg', 'data-radius', 'data-density', 'data-font', 'dir'],
};
writeFileSync(join(DIST, 'meta.json'), JSON.stringify(meta, null, 2));

const dtcg = {
  color: { primitives: {}, semantic: 'see flavor.css — semantic tier is mode/contrast/sat/tonal scoped' },
  space: Object.fromEntries(SPACE_BASE.map((px, i) => [i + 1, { $value: `${px}px`, $type: 'dimension' }])),
  fontSize: Object.fromEntries(TYPE_SIZES.map((px, i) => [i + 1, { $value: `${px}px`, $type: 'dimension' }])),
  radius: Object.fromEntries(Object.entries(RADII).map(([k, v]) => [k, { $value: `${v}px`, $type: 'dimension' }])),
  duration: Object.fromEntries(Object.entries(DURATIONS).map(([k, v]) => [k, { $value: `${v}ms`, $type: 'duration' }])),
  easing: Object.fromEntries(Object.entries(EASINGS).map(([k, v]) => [k, { $value: v, $type: 'cubicBezier' }])),
  fontFamily: Object.fromEntries(Object.entries(FONT_PAIRS).map(([k, p]) => [k, { $value: { display: p.display, text: p.text }, $type: 'fontFamily' }])),
};
for (const hue of HUE_NAMES)
  for (const sat of Object.keys(SATS))
    for (const mode of ['light', 'dark'])
      ramps[hue][sat][mode].forEach((hex, i) => {
        dtcg.color.primitives[`${hue}-${sat}-${i + 1}-${mode}`] = { $value: hex, $type: 'color' };
      });
writeFileSync(join(DIST, 'tokens.json'), JSON.stringify(dtcg, null, 2));

// ---------------------------------------------------------------------------
// 7. Verification summary
// ---------------------------------------------------------------------------

console.log('Flavor DS tokens built.\n');
for (const bg of SURFACE_BGS) for (const mode of ['light', 'dark']) for (const sat of Object.keys(SATS)) for (const contrast of ['aa', 'aaa']) {
  const s2 = semantics[bg][mode][sat][contrast];
  console.log(`${bg}/${mode}/${sat}/${contrast}: page=s${s2.surfaces.page} primary=s${s2.textPrimary.step} (${s2.textPrimary.worstRatio}:1), secondary=s${s2.textSecondary.step} (${s2.textSecondary.worstRatio}:1), tertiary=s${s2.textTertiary.step} (${s2.textTertiary.worstRatio}:1), border=s${s2.borderInteractive.step} (${s2.borderInteractive.worstRatio}:1)`);
}
console.log('\naccent-color background (per hue, regular sat): page = peak-chroma step · ink · ratio');
for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) {
  console.log(`accent/${mode}/${contrast}: ` + HUE_NAMES.map((h) => { const t = tonalSel[mode].regular[h][contrast]; return `${h}:${t.surfaces.page}/${t.inkSide[0]}/${t.textPrimary.worstRatio}`; }).join('  '));
}
for (const bg of SURFACE_BGS) for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) {
  let worst = Infinity, worstKey = '';
  for (const sat of Object.keys(SATS)) for (const hue of HUE_NAMES) { const a = perRampSel[bg][mode][sat][hue][contrast].accent; if (a.ratio < worst) { worst = a.ratio; worstKey = `${hue}-${sat}`; } }
  console.log(`${bg}/${mode}/${contrast}: worst accent-fg pairing = ${worstKey} at ${worst}:1`);
}
console.log(`\nTheme combinations: ${meta.themeCount} (${HUES_ALL.length} hues × 3 sats × 2 modes × 2 contrast × 6 backgrounds) × 3 densities × 3 radii × 5 type pairs × 2 directions`);
