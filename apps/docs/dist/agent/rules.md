# Flavor DS — global rules (always in effect)

These are not preferences. Each one is enforced by a check in `npm test`; a violation fails CI.

1. **Semantic tokens only.** Components, templates and product code reference `--surface-*`, `--text-*`, `--border-*`, `--accent-*`, `--success|warning|danger|info-*`, `--space-N`, `--radius-control|field|container|media|round`, `--font-*`, `--duration-N`, `--ease-*`. Never a primitive (`--flavor-*`, `--ramp-*`) and never a literal colour or px for a themable property. (lint:tokens, check-templates, adoption)
2. **Contrast is computed, never asserted.** Every text/background pairing in the semantic tier already clears WCAG AA (or AAA under `data-contrast="aaa"`); use pairings as designed — `--text-primary` on `--surface-*`, `--accent-fg` on `--accent-bg`, `--{status}-text` on `--{status}-bg`. Do not invent a pairing. (wcag-qa: 34,560 pairings, +0.05 safety margin)
3. **Theme is nine attributes on `<html>`**, nothing else: `data-hue data-sat data-mode data-contrast data-bg data-radius data-density data-font dir`. Set them; do not fork stylesheets. Defaults: hue=brand sat=regular mode=light contrast=aa bg=primary radius=rounded density=regular font=expressive dir=ltr.
4. **Radius follows the axis.** `--radius-control` (buttons, chips, tabs), `--radius-field` (inputs), `--radius-container` (cards, dialogs), `--radius-media` (imagery). Anything that must stay a circle uses `--radius-round`. Numeric `--radius-1..6` do not re-resolve and are not for product code.
5. **Logical properties only** (`inline-start`, `block-end`, `padding-inline`) so `dir="rtl"` flips layout for free. Icons that carry direction take `data-directional`.
6. **Icons come from the sprite.** `<svg class="fds-icon" data-icon><use href="/icons/sprite.svg#hi-NAME-outline"></use></svg>` (or `<Icon name>`). Never draw a glyph by hand; outline is the default state, solid marks active. Find names with `flavor_find_icon`.
7. **Motion on tokens.** `transition-property` names exact properties (never `all`); durations are `var(--duration-N)` so reduced-motion can zero them; `will-change` only for observed stutter. Press feedback is `scale(var(--press-scale))` = 0.96.
8. **Targets have a floor.** Interactive elements are ≥ 40×40 (dense desktop) / 44×44 (touch); density never takes a target below it. Small controls extend the target with the `::after` technique or `data-hit`.
9. **Behaviour comes with the component.** Menu, Tabs, Dialog, Listbox and Tooltip get their keyboard/focus contracts from `behaviors.js` (`data-fds-*`); do not reimplement key handling. (test-behaviors: 40 contracts)
10. **Rule of three before promoting** anything into the shared system; one-offs stay product-local. Deprecations alias for one minor and are removed in the next major. (GOVERNANCE.md)
11. **Media background**: `--surface-page` is transparent; text placed directly on the photo binds `text-on-media`; text in opaque panes keeps `text-primary`.
12. **Verify, don't assume.** After generating UI, run the guards (`npm test`) and, for reviewed work, read `flavor_canvas_feedback`. A green check that was never falsified is not evidence.
