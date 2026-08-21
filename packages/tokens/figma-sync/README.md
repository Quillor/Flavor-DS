# Figma sync (scripted)

`node packages/tokens/figma-sync/plan.mjs` reads `dist/figma.json`, `dist/ramps.json`,
`dist/i18n.json` and writes **ready-to-run `use_figma` scripts** to `dist/figma-sync/NN-*.js`,
in dependency order. Each script is idempotent (find-or-create by name, then `setValueForMode`),
so re-running after a token change updates values in place and preserves every binding.

Run order (each file is one `use_figma` call; all payloads < 40 KB):

| # | File | What it does |
|---|---|---|
| 01 | primitives-a.js / 01-primitives-b.js | raw `{hue}/{sat}/{n}` Light/Dark values + `fixedL/*` copies + `white/black/transparent` |
| 02 | hue-ramps.js | Hue collection (8 hues + brand): `ramp/{sat}/{n}`, `neutral/{n}` |
| 03 | saturation-ramps.js | Saturation: `ramp/{n}` |
| 04 | hue-leaves.js | `sem/{off\|on}/{c}/{m}/{sat}/{name}` per hue (tonal-off accents+subtle/border/focus; tonal-on all 23) |
| 05 | saturation-leaves.js | `sem/{t}/{c}/{m}/{name}` → ramp/N or Hue leaves |
| 06 | media-chain.js | Hue/Saturation `media/*` leaves, Primitives `sem/*` + `fb/*` leaves, Contrast `sem/*`, `media/*`, `feedback/*` |
| 07 | media-tonal-public.js | Media collection `sem/*` + `feedback/*`; Tonal public tokens re-aliased |
| 08 | density-typography-shape.js | value updates for Density / Typography / Shape & Motion |
| 09 | language.js | Language collection `ui/*` from i18n.json |
| 99 | lint-modes.js | **lint**: report/clear `explicitVariableModes` on non-top-level nodes across all pages |

Executing: paste each file's contents into `use_figma` (fileKey `hylcPk1PFpE0dkU9GH37Dp`), or from
Claude Code: "run the figma sync" → the `flavor-figma-sync` skill runs them in order and reports
counts. Verify afterwards with `dist/figma-sync/verify.js` (resolves a sample of tokens on the Tokens
page sheet and prints hex) against `node scripts/wcag-qa.mjs --json` values.
