# Semantic token tier — v1 (frozen 2026-08-15)

These names are the public contract for components, templates, agents (MCP), and Figma (the **Background** collection).
Renaming or removing any is a BREAKING change (major) and needs a deprecation alias for one major.
Adding is minor. Values may change in a minor only if no approved contrast pairing regresses (`npm test` enforces the floor).

| Group | Tokens |
|---|---|
| accent | `--accent-bg`, `--accent-bg-active`, `--accent-bg-hover`, `--accent-border`, `--accent-fg`, `--accent-subtle`, `--accent-subtle-hover` |
| border | `--border-default`, `--border-interactive`, `--border-strong`, `--border-subtle` |
| control | `--control-height-lg`, `--control-height-md`, `--control-height-sm` |
| danger | `--danger-bg`, `--danger-border`, `--danger-solid`, `--danger-solid-fg`, `--danger-text` |
| duration | `--duration-1`, `--duration-2`, `--duration-3`, `--duration-4`, `--duration-5` |
| ease | `--ease-emphasized`, `--ease-exit`, `--ease-spring`, `--ease-standard` |
| elevation | `--elevation-1`, `--elevation-2`, `--elevation-3` |
| focus | `--focus-ring` |
| font | `--font-display`, `--font-mono`, `--font-size-1`, `--font-size-10`, `--font-size-11`, `--font-size-12`, `--font-size-2`, `--font-size-3`, `--font-size-4`, `--font-size-5`, `--font-size-6`, `--font-size-7`, `--font-size-8`, `--font-size-9`, `--font-text` |
| info | `--info-bg`, `--info-border`, `--info-solid`, `--info-solid-fg`, `--info-text` |
| line | `--line-height-1`, `--line-height-10`, `--line-height-11`, `--line-height-12`, `--line-height-2`, `--line-height-3`, `--line-height-4`, `--line-height-5`, `--line-height-6`, `--line-height-7`, `--line-height-8`, `--line-height-9` |
| media | `--media-image` |
| radius | `--radius-1`, `--radius-2`, `--radius-3`, `--radius-4`, `--radius-5`, `--radius-6`, `--radius-container`, `--radius-control`, `--radius-field`, `--radius-full`, `--radius-media` |
| space | `--space-1`, `--space-10`, `--space-11`, `--space-12`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-7`, `--space-8`, `--space-9` |
| secondary | `--secondary-bg`, `--secondary-bg-active`, `--secondary-bg-hover`, `--secondary-border`, `--secondary-fg`, `--secondary-subtle`, `--secondary-subtle-hover`, `--secondary-text`, `--text-on-secondary-subtle` — the SECOND brand colour (Brand: orange · Brand 2: cyan · single hues: neutral); components take it via `data-tone="secondary"` (added 2026-08-16, minor) |
| success | `--success-bg`, `--success-border`, `--success-solid`, `--success-solid-fg`, `--success-text` |
| surface | `--surface-1`, `--surface-2`, `--surface-3`, `--surface-page`, `--surface-tint` |
| text | `--text-accent`, `--text-disabled`, `--text-on-accent-subtle`, `--text-on-secondary-subtle`, `--text-on-media`, `--text-on-media-secondary`, `--text-on-media-shadow`, `--text-primary`, `--text-secondary`, `--text-tertiary` |
| warning | `--warning-bg`, `--warning-border`, `--warning-solid`, `--warning-solid-fg`, `--warning-text` |

## Theme axes (attributes on `<html>`, or any element for `data-bg`)

`data-hue` (brand = Blue + Orange · brand2 = Magenta + Cyan · 14 single ramps: red, scarlet, orange, tangerine, yellow, lime, green, teal, cyan, blue, violet, purple, magenta, neutral) · `data-sat` (muted/regular/bold) · `data-mode` (light/dark) · `data-contrast` (aa/aaa) ·
**`data-bg`** (primary/secondary/**dark-primary**/**dark-secondary**/accent/media — dark-* are always dark: in light mode they use the dark-mode surface steps from fixed dark primitives (`--flavorD-*`, `--rampD-N`); in dark mode they go one step deeper (page = fixed black ink). Under `accent` the four status tokens are TONES of the page hue and `--feedback-tonal: 1`; components draw a status icon so meaning never rides on hue) · **`data-radius`** (square/rounded/pill) · `data-density` · `data-font` · `dir`.

## Shape tokens

`--radius-control` (buttons, chips, tabs), `--radius-field` (inputs/selects), `--radius-container` (cards, dialogs, menus),
`--radius-media` (imagery) all re-resolve per `data-radius`. **`--radius-round` never changes** — avatars, radios, switches,
spinners, sliders, progress and status dots stay circular in every shape mode.

## Interface-polish tokens

Installed from the `make-interfaces-feel-better` principles (see
`.claude/skills/make-interfaces-feel-better/FLAVOR.md` for the full mapping). Each is a fixed
threshold rather than a scale — a different number is worse, so there is nothing to ramp.

| Token | Value | Why this value |
|---|---|---|
| `--press-scale` | `0.96` | Tactile at 0.96; below 0.95 reads as exaggerated |
| `--hit-area-touch` / `--hit-area-dense` | `44px` / `40px` | Touch minimum; dense-desktop floor. Applied via `::after`, so visual size is unchanged |
| `--icon-stroke-regular/strong/bold` | `1.5` / `2` / `2.5` | Icon carries the optical weight of adjacent text (400 / 600 / 700) |
| `--image-outline` | `oklch(0 0 0 / .1)` light, `oklch(1 0 0 / .1)` dark | **Intentionally unthemed.** A ring from the ramp picks up the surface tint and reads as dirt on the image edge |
| `--shadow-border` / `-hover` | layered ring (light), single white ring (dark) | Depth that adapts to any backdrop including a photo, where a solid border cannot |
| `--radius-nested` / `-tight` | `container − space`, clamped ≥ 0 | Concentric nesting: outer = inner + padding |

`npm run lint:polish` fails on `transition: all`, `will-change: all`, a themed image outline, a press
scale below 0.95, a hardcoded transition duration, or a missing polish token.

## Figma name transform (deterministic)

`--surface-page` ⇄ `surface/page` · `--text-on-accent-subtle` ⇄ `text/on-accent-subtle` · `--success-bg` ⇄ `feedback/success/bg` ·
`--space-4` ⇄ `space/4` · `--radius-control` ⇄ `radius/control` · `--font-size-4` ⇄ `size/4`.

## Not public

`--flavor-*`, `--flavorL-*` (primitives), `--ramp-*`/`--neutral-*` (ramp selection), `--media-ink-*`, `--fds-*` (component internals).
`npm run lint:tokens` fails any reference to them outside the token layer.

## Deprecation example

v1.x: `--accent-border` → `--border-accent`? ship both (`--accent-border: var(--border-accent)`), warn in docs + changelog, remove in v2.0.
