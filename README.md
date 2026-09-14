# Flavor DS

An agent-ready design system delivered via MCP. Humans get a documented, themeable component
system; agents get a tool surface that serves tokens, computed contrast approvals, components,
and stack-specific adoption plans.

## Repo layout

| Path | What it is |
|---|---|
| `packages/tokens` | Token **generator** (`build.mjs`). Ramps, WCAG pairings, and theme CSS are computed, never hand-picked. Outputs in `dist/`. |
| `packages/ui` | Core components. CSS-first (`fds-*` classes, framework-agnostic) + thin React wrappers. Semantic tokens only. |
| `packages/mcp` | Working MCP server (stdio). `npx flavor-ds-mcp` / `node packages/mcp/src/server.mjs`. |
| `apps/docs` | Astro doc site: homepage, MCP import page, Brand / Core UI / Product / Marketing sections, live 7-axis theme switcher, 14 product templates with device/platform/language frames, social marketing formats. |
| `assets/` | Sourced assets: Open Doodles illustrations (CC0, tokenized — a stand-in for the tech-Memphis target, see /core/assets/), generated retro-futurism photography. Icons are built from the `heroicons` package into `packages/ui/dist/icons/` (`npm run build:icons`). |
| `scripts/check-tokens.mjs` | Tier guard: fails CI if any component/app references a primitive token. |

## The theme model

Seven orthogonal axes, set as attributes on `<html>`:

```
data-hue      brand (default: neutral surfaces + Flavor Blue accents + Signal Orange focus) | neutral | red | orange | yellow | green | teal | blue | purple
data-bg       primary | secondary | accent | media     ← the Background axis
data-radius   square | rounded | pill                  ← the Shape axis
data-sat      muted | regular | bold
data-mode     light | dark
data-contrast aa | aaa
data-density  compact | regular | comfy
data-font     flavor | editorial | geometric | serif | atomic   (Google Fonts pairs)
dir           ltr | rtl
```

**Surfaces are tonal.** Semantic surfaces resolve from the *active hue ramp*: `regular` gives a
subtle tonal tint; `muted` and `bold` carry the hue as the interface background (accent-colored
surfaces), with all text/border/accent selections recomputed per saturation family.

16 hues (14 ramps + Brand + Brand 2) × 3 saturations × 2 modes × 2 contrast × 6 backgrounds = **1,152 color themes**, × 3 densities × 3 radii × 5 type pairs × 2 directions.

**Background** is one axis with four values: `primary` (crisp surfaces), `secondary` (softer — page and
cards sit one step closer), `accent` (the hue's most-saturated step IS the page), `media` (white UI over
a photo; page transparent, ink fixed, accents light-mode). Sections can mix: set `data-bg` on any element. There are no per-theme files:
hue×sat selects a ramp (24 small CSS blocks), mode×contrast maps semantics onto it (4 blocks),
density and direction are orthogonal. Everything composes.

### Token tiers (strict)

1. **Primitive** — `--flavor-{hue}-{sat}-{step}` (12 steps, equal OKLCH lightness across hues per step; separate light/dark value sets). Off-limits outside the token layer.
2. **Semantic** — `--surface-*`, `--text-*`, `--border-*`, `--accent-*`, `--space-*`, `--font-*`, `--radius-*`, `--duration-*`, feedback pairs. The only tier components may reference. Enforced by `npm run lint:tokens`.
3. **Component** — scoped tokens like `--illustration-accent`, referencing semantic.

### Contrast is computed

`build.mjs` selects semantic steps by walking the ramp until the **worst-case ratio across all
24 ramps** clears the threshold (AA 4.5 / AAA 7.0 / UI 3.0), and emits `dist/contrast.json` with
every approved pairing and its ratio to two decimals. On-accent foregrounds are chosen per
ramp×mode×contrast (that's why yellow buttons get dark text automatically).

### Elevation

Three layers (surface, drawer, modal). Light mode separates by shadow; dark mode **lightens**
each layer (`page=step1 → modal=step4`) — deliberately not a pure inversion.

## Commands

```bash
npm install
npm run build:tokens   # regenerate ramps/CSS/JSON + verification report
npm run lint:tokens    # tier guard (wire into CI)
npm run dev:docs       # doc site
node packages/mcp/src/server.mjs   # MCP server (stdio)
```

## Governance

- **Propose:** open a PR touching `packages/tokens/build.mjs` (tokens) or `packages/ui` (components). New components need three real consuming use cases (rule of three).
- **Decide:** DS maintainer approves; contrast regressions are auto-blocked (the generator throws when a threshold fails).
- **Ship:** semver. **Breaking** = removing/renaming a semantic token or component prop, or changing an approved pairing below threshold. Additive ramps/steps are minor.
- **Communicate:** changelog per release; doc site is regenerated from the same source.
- **Deprecate:** deprecated tokens keep resolving (aliased) for one major version with a console/docs warning and a stated removal version + migration line.
- **Adoption metric:** primitive-reference count outside the token layer (target 0, enforced by `lint:tokens`) + % of app color values routed through semantic tokens.

## Asset licenses

- Illustrations: [Open Doodles](https://www.opendoodles.com) — CC0. Tokenized (see `assets/illustrations/LICENSE.md`).
- Icons: [Heroicons](https://heroicons.com) v2 — MIT. Full set (324) as a sprite + per-file SVGs; outline/solid/mini/micro. `<Icon>` in React, `.fds-icon` + `<use>` in HTML, `flavor_find_icon` over MCP.
- Photography: generated (Higgsfield), owned by this project.
- Fonts (all OFL): Syne + Archivo (Expressive, default) · Space Grotesk + Inter (Flavor) · Fraunces + Libre Franklin (Editorial) ·
  Source Serif 4 + Source Sans 3 (Reading) · Jost + DM Sans (Geometric) ·
  IBM Plex Mono (code, all pairings).
