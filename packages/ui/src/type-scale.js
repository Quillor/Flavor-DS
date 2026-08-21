/**
 * Dynamic type — OS text-size scaling for Flavor tokens.
 *
 * Both platforms scale text NON-linearly: small text grows the most, display text the least.
 * Every --font-size-N / --line-height-N token multiplies by --type-scale-N, so this module only
 * has to compute twelve multipliers per (platform, step) and write them onto a root.
 *
 * iOS — Dynamic Type content size categories (Apple HIG "Typography" size tables, iOS 17):
 *   xSmall · Small · Medium · Large (default) · xLarge · xxLarge · xxxLarge · AX1 · AX2 · AX3 · AX4 · AX5
 *   Anchors are the HIG point sizes for Caption 2 (11pt), Body (17pt) and Large Title (34pt) at each
 *   category; other sizes interpolate between anchors by their base px so a 14px label scales like
 *   Footnote/Subhead and a 48px display like Large Title.
 * Android — font scale (Settings → Display size and text): 85% · 100% (default) · 115% · 130% · 150% ·
 *   180% · 200%. Up to 130% scaling is linear (pre-Android-14 behaviour); 150%+ follow Android 14's
 *   FontScaleConverter tables, which taper the increase for large sp values (anchors at 14, 24, 30 sp).
 * Web — no OS setting; the browser's zoom/minimum-font-size apply. Uniform --type-scale is exposed
 *   for apps that want their own control.
 */
export const IOS_CATEGORIES = [
  { id: 'xSmall',   label: 'xSmall',           caption: 11, body: 14, largeTitle: 31 },
  { id: 'small',    label: 'Small',            caption: 11, body: 15, largeTitle: 32 },
  { id: 'medium',   label: 'Medium',           caption: 11, body: 16, largeTitle: 33 },
  { id: 'large',    label: 'Large (default)',  caption: 11, body: 17, largeTitle: 34, default: true },
  { id: 'xLarge',   label: 'xLarge',           caption: 13, body: 19, largeTitle: 36 },
  { id: 'xxLarge',  label: 'xxLarge',          caption: 15, body: 21, largeTitle: 38 },
  { id: 'xxxLarge', label: 'xxxLarge',         caption: 17, body: 23, largeTitle: 40 },
  { id: 'ax1',      label: 'AX1 (accessibility)', caption: 22, body: 28, largeTitle: 44 },
  { id: 'ax2',      label: 'AX2',              caption: 26, body: 33, largeTitle: 48 },
  { id: 'ax3',      label: 'AX3',              caption: 32, body: 40, largeTitle: 52 },
  { id: 'ax4',      label: 'AX4',              caption: 38, body: 47, largeTitle: 56 },
  { id: 'ax5',      label: 'AX5',              caption: 44, body: 53, largeTitle: 60 },
];
const IOS_BASE = { caption: 11, body: 17, largeTitle: 34 };

/** Android font-scale steps; `sp` maps base sp → scaled sp for the non-linear (≥150%) settings. */
export const ANDROID_SCALES = [
  { id: '0.85', label: '85%',  scale: 0.85 },
  { id: '1.0',  label: '100% (default)', scale: 1.0, default: true },
  { id: '1.15', label: '115%', scale: 1.15 },
  { id: '1.3',  label: '130%', scale: 1.3 },
  { id: '1.5',  label: '150%', scale: 1.5, sp: { 8: 12, 10: 15, 12: 18, 14: 21, 18: 25.5, 20: 28, 24: 31.5, 30: 36, 100: 106 } },
  { id: '1.8',  label: '180%', scale: 1.8, sp: { 8: 14.4, 10: 18, 12: 21.6, 14: 25.2, 18: 30, 20: 32.6, 24: 36.2, 30: 40.9, 100: 112 } },
  { id: '2.0',  label: '200%', scale: 2.0, sp: { 8: 16, 10: 20, 12: 24, 14: 28, 18: 34, 20: 36, 24: 40, 30: 46, 100: 116 } },
];

/** Flavor's base type scale in px (mirrors --font-size-1..12). */
export const BASE_PX = [11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];

const lerp = (a, b, t) => a + (b - a) * t;
/** piecewise-linear lookup over sorted {x: y} anchors, extrapolating flat at the ends */
function piecewise(anchors, x) {
  const xs = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  if (x <= xs[0]) return anchors[xs[0]] * (x / xs[0]);
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return lerp(anchors[xs[i - 1]], anchors[xs[i]], t); }
  const last = xs[xs.length - 1]; return anchors[last] * (x / last);
}

/** multiplier for one base px size on iOS at a category */
export function iosMultiplier(basePx, category) {
  const c = typeof category === 'string' ? IOS_CATEGORIES.find((k) => k.id === category) : category;
  if (!c) return 1;
  const r = { caption: c.caption / IOS_BASE.caption, body: c.body / IOS_BASE.body, largeTitle: c.largeTitle / IOS_BASE.largeTitle };
  if (basePx <= IOS_BASE.caption) return r.caption;
  if (basePx <= IOS_BASE.body) return lerp(r.caption, r.body, (basePx - IOS_BASE.caption) / (IOS_BASE.body - IOS_BASE.caption));
  if (basePx <= IOS_BASE.largeTitle) return lerp(r.body, r.largeTitle, (basePx - IOS_BASE.body) / (IOS_BASE.largeTitle - IOS_BASE.body));
  // beyond Large Title (display sizes) the HIG tables flatten further: keep the Large Title ratio, eased toward 1
  return lerp(r.largeTitle, 1, Math.min(1, (basePx - IOS_BASE.largeTitle) / 60) * 0.5);
}

/** multiplier for one base px (≈ sp) size on Android at a font-scale step */
export function androidMultiplier(basePx, step) {
  const s = typeof step === 'string' || typeof step === 'number' ? ANDROID_SCALES.find((k) => k.id === String(step) || k.scale === Number(step)) : step;
  if (!s) return 1;
  if (!s.sp) return s.scale;                       // ≤130%: linear
  return piecewise(s.sp, basePx) / basePx;         // ≥150%: Android 14 non-linear tables
}

/** twelve multipliers for a platform + step */
export function multipliers(platform, step) {
  return BASE_PX.map((px) => platform === 'ios' ? iosMultiplier(px, step) : platform === 'android' ? androidMultiplier(px, step) : Number(step) || 1);
}

/** Write --type-scale-1..12 on `root` (an element). platform 'web' with a number = uniform. */
export function applyTypeScale(root, { platform = 'web', step } = {}) {
  const m = multipliers(platform, step);
  m.forEach((v, i) => root.style.setProperty(`--type-scale-${i + 1}`, String(Math.round(v * 1000) / 1000)));
  root.setAttribute('data-type-scale', platform === 'web' ? String(step ?? 1) : String(step));
  return m;
}
export function clearTypeScale(root) {
  BASE_PX.forEach((_, i) => root.style.removeProperty(`--type-scale-${i + 1}`));
  root.removeAttribute('data-type-scale');
}
export const stepsFor = (platform) => platform === 'ios' ? IOS_CATEGORIES : platform === 'android' ? ANDROID_SCALES : [];
