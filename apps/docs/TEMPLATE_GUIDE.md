# Template authoring conventions (Flavor DS docs)

Every product template is one Astro page at `apps/docs/src/pages/product/<slug>.astro`.
Copy the structure of `sign-in.astro` (the exemplar).

## Required structure

```astro
---
import DocsShell from '../../layouts/DocsShell.astro';
import TemplateFrame from '../../components/TemplateFrame.astro';
import { productNav } from '../../product/productNav';
const extraStrings = { /* template-specific keys, ALL 5 languages: en, es, zh, de, ar */ };
---
<DocsShell title="<Label>" nav={productNav}>
  <h1 style="font-family: var(--font-display); font-size: var(--font-size-9);"><Label></h1>
  <p style="color: var(--text-secondary); max-inline-size: 640px;"><one-sentence description></p>
  <TemplateFrame title="<slug>" extraStrings={extraStrings}>
    <div class="fds-statusbar" aria-hidden="true"><span>9:41</span><span>●●●</span></div>
    <!-- template markup -->
  </TemplateFrame>
  <style>/* scoped styles */</style>
</DocsShell>
```

For HTML email templates pass `native={false}` to TemplateFrame (no iOS/Android toggle).

## Hard rules

1. **Semantic tokens only.** `--surface-*`, `--text-*`, `--accent-*`, `--border-*`, `--space-*`,
   `--font-*`, `--radius-*`, `--duration-*`, `--ease-*`, `--elevation-*`, `--control-height-*`,
   feedback tokens (`--success-*` etc.). NEVER `--flavor-*` primitives and NEVER hardcoded
   colors (`#hex`, `rgb()`) — `npm run lint:tokens` fails the build. No `px` colors, spacing
   should route through `--space-*` (small 1–3px borders/offsets are fine).
2. **Logical properties only** for direction-sensitive box model: `padding-inline`,
   `margin-inline-start`, `inset-inline-end`, `border-inline-start`, `text-align: start`.
   Never left/right properties. RTL must mirror for free.
3. **Responsive via container queries**, not media queries: the frame is the container.
   `@container (max-width: 767px) { … }` for tablet-and-down, `@container (max-width: 480px)`
   for phone. Desktop is the default layout.
4. **i18n:** every user-visible string gets `data-i18n="key"` (or `data-i18n-placeholder` /
   `data-i18n-aria`). Use shared keys from `src/product/i18n.ts` where they exist; add
   template-specific keys to `extraStrings` with all 5 translations. Body/lorem copy can stay
   English if marked with a shared key is impossible — but headings, buttons, labels, nav MUST translate.
5. **Native idioms:** for app-like templates include a `.fds-statusbar` (auto-hidden on web) and,
   where a mobile app would have one, a `.fds-tabbar` with 3–5 `.fds-tabbar-item` entries
   (hidden on desktop via container query, e.g. only show under 480px). `.fds-appbar` for mobile
   headers, `.fds-fab` where Android would use one.
6. **Components:** use existing `fds-*` classes (see `packages/ui/src/styles/components.css`):
   fds-button[data-variant|data-size], fds-input/textarea/select, fds-field/label/hint,
   fds-check, fds-switch, fds-card[data-elevation], fds-badge[data-variant],
   fds-alert[data-variant], fds-tabs-list/tab, fds-avatar, fds-progress, fds-navbar/nav-link,
   fds-sidenav, fds-separator, fds-skeleton, fds-pattern-{dots,grid,diagonal,starburst}.
7. **Imagery:** photography at `/photography/{hero,collaboration,product,texture}.jpg`.
   Themed illustrations: glob-import raw SVGs like `src/pages/core/assets.astro` does
   (`import.meta.glob('../../assets/illustrations/*.svg', { query: '?raw', import: 'default', eager: true })`)
   and inline with `set:html` so they re-theme. Avatars: use `.fds-avatar` with initials, NOT images.
   Charts (dashboard): inline SVG with `stroke="var(--accent-bg)"` etc. No external images or fonts.
8. **HTML email templates:** 600px-wide table-based layout inside the frame, still themed with
   semantic vars for preview; add a note under the frame that production export inlines resolved
   hex values. Buttons = padded `<a>` with `background: var(--accent-bg); color: var(--accent-fg)`.
9. **On Media** (`data-media`): the page is a photo and `--surface-page` is transparent. Any text
   that sits directly on the page (not inside a card/surface) must be inside an element with class
   `fds-on-media` so it gets `--text-on-media` + shadow. Content inside `.fds-card`/surfaces needs nothing.
10. Keep each page self-contained; do not edit shared files (components.css, i18n.ts, layouts,
   TemplateFrame, productNav).

## Verify

From repo root: `npm run lint:tokens && npm run build:docs` must pass with zero errors.
