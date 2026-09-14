/**
 * Agent index — the machine-readable memory of Flavor DS.
 *
 *   node scripts/build-agent-index.mjs      (part of npm run build:tokens)
 *
 * Emits packages/tokens/dist/agent/:
 *   rules.md        the GLOBAL RULES — short, always retrieved, never ranked away
 *   index.json      every retrievable unit of the system as a chunk with id, kind, title,
 *                   summary, tags, priority, source path and text — tokens, axes, components,
 *                   templates, guards, native exports, behaviours, governance
 *   llms.txt        the standard AI-crawler entry point (also copied to the docs root)
 *   llms-full.txt   the same, with every chunk inlined
 *
 * Every chunk is DERIVED from the same sources the site renders — componentDocs.ts,
 * meta.json, figma.json, TOKENS.md, GOVERNANCE.md, package.json — so the index cannot say
 * something the docs do not. Retrieval (packages/mcp/src/recall.mjs) layers rules over
 * task-ranked chunks; scripts/test-recall.mjs asserts that layering.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'packages/tokens/dist');
const OUT = join(DIST, 'agent');
mkdirSync(OUT, { recursive: true });
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const meta = JSON.parse(read('packages/tokens/dist/meta.json'));
const figma = JSON.parse(read('packages/tokens/dist/figma.json'));
const { COMPONENT_DOCS } = await import(join(ROOT, 'apps/docs/src/core/componentDocs.ts'));
const { TEMPLATES } = await import(join(ROOT, 'apps/docs/src/product/productNav.ts'));
const pkg = JSON.parse(read('package.json'));
const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* ─────────────────────────────────────────────── global rules (P0, always) */
const RULES = `# Flavor DS — global rules (always in effect)

These are not preferences. Each one is enforced by a check in \`npm test\`; a violation fails CI.

1. **Semantic tokens only.** Components, templates and product code reference \`--surface-*\`, \`--text-*\`, \`--border-*\`, \`--accent-*\`, \`--success|warning|danger|info-*\`, \`--space-N\`, \`--radius-control|field|container|media|round\`, \`--font-*\`, \`--duration-N\`, \`--ease-*\`. Never a primitive (\`--flavor-*\`, \`--ramp-*\`) and never a literal colour or px for a themable property. (lint:tokens, check-templates, adoption)
2. **Contrast is computed, never asserted.** Every text/background pairing in the semantic tier already clears WCAG AA (or AAA under \`data-contrast="aaa"\`); use pairings as designed — \`--text-primary\` on \`--surface-*\`, \`--accent-fg\` on \`--accent-bg\`, \`--{status}-text\` on \`--{status}-bg\`. Do not invent a pairing. (wcag-qa: 34,560 pairings, +0.05 safety margin)
3. **Theme is nine attributes on \`<html>\`**, nothing else: \`data-hue data-sat data-mode data-contrast data-bg data-radius data-density data-font dir\`. Set them; do not fork stylesheets. Defaults: ${Object.entries(meta.defaults).map(([k, v]) => `${k}=${v}`).join(' ')}.
4. **Radius follows the axis.** \`--radius-control\` (buttons, chips, tabs), \`--radius-field\` (inputs), \`--radius-container\` (cards, dialogs), \`--radius-media\` (imagery). Anything that must stay a circle uses \`--radius-round\`. Numeric \`--radius-1..6\` do not re-resolve and are not for product code.
5. **Logical properties only** (\`inline-start\`, \`block-end\`, \`padding-inline\`) so \`dir="rtl"\` flips layout for free. Icons that carry direction take \`data-directional\`.
6. **Icons come from the sprite.** \`<svg class="fds-icon" data-icon><use href="/icons/sprite.svg#hi-NAME-outline"></use></svg>\` (or \`<Icon name>\`). Never draw a glyph by hand; outline is the default state, solid marks active. Find names with \`flavor_find_icon\`.
7. **Motion on tokens.** \`transition-property\` names exact properties (never \`all\`); durations are \`var(--duration-N)\` so reduced-motion can zero them; \`will-change\` only for observed stutter. Press feedback is \`scale(var(--press-scale))\` = 0.96.
8. **Targets have a floor.** Interactive elements are ≥ 40×40 (dense desktop) / 44×44 (touch); density never takes a target below it. Small controls extend the target with the \`::after\` technique or \`data-hit\`.
9. **Behaviour comes with the component.** Menu, Tabs, Dialog, Listbox and Tooltip get their keyboard/focus contracts from \`behaviors.js\` (\`data-fds-*\`); do not reimplement key handling. (test-behaviors: 40 contracts)
10. **Rule of three before promoting** anything into the shared system; one-offs stay product-local. Deprecations alias for one minor and are removed in the next major. (GOVERNANCE.md)
11. **Media background**: \`--surface-page\` is transparent; text placed directly on the photo binds \`text-on-media\`; text in opaque panes keeps \`text-primary\`.
12. **Verify, don't assume.** After generating UI, run the guards (\`npm test\`) and, for reviewed work, read \`flavor_canvas_feedback\`. A green check that was never falsified is not evidence.
`;
writeFileSync(join(OUT, 'rules.md'), RULES);

/* ─────────────────────────────────────────────── chunks */
const chunks = [];
const add = (c) => chunks.push({ priority: 2, ...c, tags: [...new Set((c.tags || []).map((t) => t.toLowerCase()))] });

// P0: rules as one chunk (so it appears in llms-full and can be fetched by id) — recall ALWAYS prepends it
add({ id: 'rules', kind: 'rules', title: 'Global rules', priority: 0, tags: ['rules', 'always', 'constraints', 'governance'], summary: 'The twelve always-on rules, each backed by a guard.', path: 'packages/tokens/dist/agent/rules.md', text: RULES });

// P1: contract — axes, token tiers, setup
add({ id: 'axes', kind: 'contract', title: 'Theme axes', priority: 1, tags: ['theme', 'axes', 'hue', 'saturation', 'mode', 'dark', 'light', 'contrast', 'aa', 'aaa', 'background', 'radius', 'density', 'font', 'rtl', 'direction', 'setup', 'html', 'attributes'],
  summary: 'Nine html attributes select one of 1,152 colour themes × radius × density × type pairing × direction.',
  text: Object.entries(meta.axes).map(([k, v]) => `data-${k}: ${v.join(' | ')}`).join('\n') + `\ndir: ltr | rtl\nDefaults: ${JSON.stringify(meta.defaults)}\nSet on <html>. Every semantic token re-resolves per combination; nothing else changes.\ndata-bg: primary | secondary (light or dark with the mode) · dark-primary | dark-secondary (ALWAYS dark — dark surface steps in light mode, one step deeper in dark mode; use for headers, players, code panes that must stay dark) · accent (the hue's most-saturated step is the page) · media (white UI on a photo).\nBrand themes are hue PAIRS: ${Object.entries(meta.brands || {}).map(([k, b]) => `${k} = ${b.primary} (accent) + ${b.secondary} (--secondary-*, focus ring)`).join(' · ')}. Single hues use the neutral ramp as secondary.\nContrast: every pairing is computed with a +0.05 margin over WCAG (AA ≥ 4.55, AAA ≥ 7.05, UI ≥ 3.05).` });
add({ id: 'setup', kind: 'contract', title: 'Adopt Flavor in a project', priority: 1, tags: ['setup', 'install', 'adopt', 'import', 'css', 'react', 'astro', 'next', 'vue', 'html', 'mcp', 'start'],
  summary: 'Load flavor.css first, then components.css (+ platform.css for native previews), set the axes on <html>, load behaviors.js, serve the icon sprite.',
  text: `1. flavor.css (tokens, all themes) as the first stylesheet; components.css second; platform.css if previewing iOS/Android.\n2. <html ${Object.entries(meta.defaults).map(([k, v]) => `${k === 'dir' ? 'dir' : `data-${k}`}="${v}"`).join(' ')}>\n3. Root element carries class fds-app.\n4. import { upgrade } from '@flavor-ds/ui/behaviors'; upgrade(document) — or the React wrappers, which call it.\n5. Serve packages/ui/dist/icons/sprite.svg at /icons/sprite.svg.\n6. Native: FlavorTokens.swift / FlavorTokens.kt from packages/tokens/dist/native.\nMCP: flavor_adapt_project(stack) returns these steps tailored to a stack. Register the MCP: hosted Streamable HTTP https://flavor-ds.vercel.app/api/mcp (claude mcp add --transport http flavor-ds <url>) or local stdio node packages/mcp/src/server.mjs.` });
add({ id: 'tiers', kind: 'contract', title: 'Token tiers and naming', priority: 1, tags: ['tokens', 'tier', 'primitive', 'semantic', 'naming', 'figma', 'transform'],
  summary: 'Primitive → semantic → component. Only semantic is public. Figma name = CSS name with / for -.',
  text: read('TOKENS.md').slice(0, 6000) });

// P2: semantic tokens, grouped by role, with the pairing they are safe with
const NAMES = figma.allNames;
const roleOf = (n) => n.startsWith('surface') ? 'surface' : n.startsWith('text') ? 'text' : n.startsWith('border') || n === 'focus-ring' ? 'border' : n.startsWith('accent') ? 'accent' : n.startsWith('secondary') ? 'secondary' : 'feedback';
const PAIR = { 'text-primary': 'on surface-page / surface-1 / surface-2 / surface-3', 'text-secondary': 'on any surface-*', 'text-tertiary': 'on any surface-*', 'text-accent': 'on any surface-* (links)', 'accent-fg': 'on accent-bg / accent-bg-hover / accent-bg-active', 'text-on-accent-subtle': 'on accent-subtle / accent-subtle-hover', 'secondary-fg': 'on secondary-bg / -hover / -active', 'text-on-secondary-subtle': 'on secondary-subtle / -hover', 'secondary-text': 'on any surface-* (secondary-coloured text/links)', 'text-on-media': 'directly on a photo (Media background)', 'text-on-media-secondary': 'directly on a photo' };
for (const role of ['surface', 'text', 'border', 'accent', 'secondary', 'feedback']) {
  const names = NAMES.filter((n) => roleOf(n) === role);
  add({ id: `tokens-${role}`, kind: 'tokens', title: `${role[0].toUpperCase() + role.slice(1)} tokens`, tags: ['tokens', 'color', 'colour', role, ...names, ...(role === 'feedback' ? ['success', 'warning', 'danger', 'error', 'info', 'status', 'alert', 'toast'] : []), ...(role === 'text' ? ['typography', 'ink', 'foreground'] : []), ...(role === 'accent' ? ['primary', 'brand', 'button', 'link', 'focus'] : []), ...(role === 'secondary' ? ['brand', 'brand2', 'orange', 'cyan', 'two-colour', 'tone', 'second'] : []), ...(role === 'surface' ? ['background', 'card', 'page', 'elevation'] : [])],
    summary: `${names.length} ${role} tokens; each resolves per theme axes and every documented pairing clears AA/AAA.`,
    text: names.map((n) => `--${n}${PAIR[n] ? `  → safe ${PAIR[n]}` : ''}`).join('\n') + (role === 'feedback' ? '\nPairs: {status}-text on {status}-bg · {status}-solid-fg on {status}-solid · {status}-text on any surface · {status}-border for outlines.\nTonal (data-bg="accent"): all four statuses resolve to TONES of the page hue and --feedback-tonal is 1 — components (alert, badge, toast, banner, status-text) render a status ICON so meaning never rides on hue alone.' : '') + (role === 'secondary' ? '\nThe second brand colour: Brand = blue + ORANGE, Brand 2 = magenta + CYAN; single-hue themes get a neutral secondary so it always resolves. Use via data-tone="secondary" on button / badge / link. Every pairing above is contrast-walked against the surfaces it sits on (incl. tonal + media).' : '') });
}
add({ id: 'tokens-space', kind: 'tokens', title: 'Spacing, radius, motion, type scales', tags: ['spacing', 'space', 'gap', 'padding', 'margin', 'radius', 'corner', 'motion', 'duration', 'easing', 'transition', 'font-size', 'line-height', 'type', 'scale', 'density', 'elevation', 'shadow'],
  summary: '--space-1..12 (2..80px, ×0.75/1/1.25 by density) · --radius-control/field/container/media/round · --duration-1..5 · --ease-standard/emphasized/exit/spring · --font-size-1..12 · --elevation-1..3.',
  text: `space: 2 4 8 12 16 20 24 32 40 48 64 80 (px at regular; compact ×0.75, comfy ×1.25)\nradius (rounded): control 6 · field 6 · container 12 · media 8 · round 9999; square: all 0; pill: control 9999 · field 20 · container 20 · media 12\nduration: 75 150 250 400 600ms (0 under prefers-reduced-motion)\neasing: standard cubic-bezier(.2,0,0,1) · emphasized · exit · spring\nfont-size: 11 12 14 16 18 20 24 30 36 48 60 72 (rem) with line-heights 16 16 20 24 26 28 32 38 44 54 66 78\nelevation: 1 (card) 2 (drawer/menu) 3 (dialog); dark elevations get lighter, not a naive inversion\npolish: --press-scale .96 · --hit-area-touch 44 · --hit-area-dense 40 · --icon-stroke-regular 1.5 / strong 2 / bold 2.5 · --image-outline · --shadow-border` });
add({ id: 'text-styles', kind: 'tokens', title: 'Text styles', tags: ['typography', 'text', 'style', 'heading', 'display', 'body', 'label', 'mono', 'font', 'weight', 'pairing'],
  summary: '17 named styles (Display/2XL … Label/S, Mono/M, Mono/S) bound to the type scale; families switch per data-font.',
  text: figma.typography.textStyles.map((t) => `${t.name}: --font-${t.family === 'mono' ? 'mono' : t.family === 'display' ? 'display' : 'text'} ${t.weight}, size/${t.step} (${figma.typography.sizes[t.step - 1]}px / ${figma.typography.lineHeights[t.step - 1]}px)`).join('\n') + `\nPairings (data-font): ${Object.entries(meta.fontPairs).map(([k, v]) => `${k}=${v.label}`).join(' · ')}` });

// P2: components — the richest chunks; tags from group/title/summary/id + curated aliases
// (the words people type that the doc summary doesn't contain — kept small and obvious)
const STOP = new Set('and or the a an of to in for with one per is are as by on at from that this it its into via when not use'.split(' '));
const keywords = (s) => (s.toLowerCase().match(/[a-z][a-z-]{2,}/g) || []).filter((w) => !STOP.has(w));
const COMPONENT_ALIASES = {
  button: ['cta', 'submit', 'primary', 'action'], 'icon-button': ['icon', 'toolbar'], input: ['form', 'field', 'login', 'sign-in', 'email', 'password', 'search', 'textarea'], select: ['dropdown', 'form', 'listbox', 'combobox'],
  'checkbox-radio': ['form', 'checkbox', 'radio', 'option'], switch: ['toggle', 'settings', 'form'], slider: ['range', 'form'], segmented: ['toggle', 'view-switch'], chip: ['tag', 'filter', 'pill'], 'input-group': ['form', 'search', 'addon'],
  dropzone: ['upload', 'file', 'form'], calendar: ['date', 'picker', 'schedule'], alert: ['error', 'warning', 'success', 'info', 'message'], banner: ['announcement', 'notice'], toast: ['notification', 'snackbar', 'feedback'],
  badge: ['status', 'count', 'label'], progress: ['loading', 'bar'], spinner: ['loading'], skeleton: ['loading', 'placeholder'], empty: ['empty-state', 'zero'], card: ['container', 'panel', 'surface'], stat: ['metric', 'kpi', 'dashboard', 'number'],
  table: ['data', 'grid', 'rows', 'sort', 'sorting'], list: ['rows', 'items'], avatar: ['user', 'profile', 'image'], rating: ['stars', 'review'], timeline: ['activity', 'history'], code: ['pre', 'snippet', 'mono'], kbd: ['shortcut', 'keyboard'],
  navbar: ['header', 'top-nav', 'navigation'], sidenav: ['sidebar', 'navigation', 'menu'], tabs: ['navigation', 'panels'], breadcrumb: ['navigation', 'path'], pagination: ['pages', 'navigation'], stepper: ['wizard', 'steps', 'checkout'],
  tree: ['hierarchy', 'folders', 'nested'], tabbar: ['mobile', 'bottom-nav', 'ios', 'android'], command: ['palette', 'search', 'cmd-k'], dialog: ['modal', 'confirm', 'overlay'], drawer: ['sheet', 'panel', 'overlay', 'mobile'],
  popover: ['dropdown', 'menu', 'overlay'], tooltip: ['hint', 'hover'], accordion: ['collapse', 'expand', 'faq', 'disclosure'], menu: ['dropdown', 'context', 'actions'], link: ['anchor', 'navigation'], 'button-group': ['toolbar', 'segmented'],
};
for (const d of COMPONENT_DOCS) {
  const words = keywords(`${d.title} ${d.summary} ${d.group}`);
  add({ id: `component-${d.id}`, kind: 'component', title: d.title, tags: ['component', d.group.toLowerCase(), d.id, ...(COMPONENT_ALIASES[d.id] || []), ...words],
    summary: strip(d.summary), path: `apps/docs/src/pages/core/components/[id].astro#${d.id}`,
    text: [`# ${d.title} (${d.group}) — /core/components/${d.id}/`, `Class: .fds-${d.id}`, `Summary: ${strip(d.summary)}`, d.notFor ? `Don't use for: ${strip(d.notFor)}` : null,
      `Content: ${d.content.map(strip).join(' · ')}`, `Design: ${d.design.map(strip).join(' · ')}`, `Code: ${d.code.map(strip).join(' · ')}`, `Accessibility: ${d.a11y.map(strip).join(' · ')}`,
      `Preview markup:\n${d.preview.replace(/\{\{[A-Z_]+\}\}/g, '').trim().slice(0, 1200)}`].filter(Boolean).join('\n') });
}

// P3: templates (examples), native, canvas, guards, governance
const TEMPLATE_ALIASES = {
  'sign-in': ['login', 'auth', 'form', 'password'], feed: ['social', 'posts', 'timeline'], dashboard: ['admin', 'stats', 'table', 'chart', 'analytics'], canvas: ['flow', 'builder', 'nodes', 'diagram'], chat: ['messages', 'messaging'],
  'ai-chat': ['assistant', 'claude', 'chatgpt', 'llm', 'prompt', 'chat'], projects: ['project-management', 'task', 'tasks', 'kanban', 'board', 'timeline', 'gantt', 'asana', 'list', 'todo'], calendar: ['schedule', 'events', 'google-calendar', 'week', 'month'],
  map: ['locations', 'apple-maps', 'pins', 'places', 'directions'], music: ['spotify', 'player', 'audio', 'playlist', 'now-playing'], reader: ['audible', 'audiobook', 'book', 'library', 'player'], email: ['inbox', 'mail', 'client'],
  ecommerce: ['shop', 'store', 'product', 'cart', 'catalog'], 'image-gallery': ['photos', 'grid', 'lightbox'], 'video-gallery': ['videos', 'player', 'grid'], landing: ['marketing', 'hero', 'homepage', 'pricing'],
  'email-marketing': ['newsletter', 'html-email', 'campaign'], 'email-notification': ['transactional', 'html-email', 'receipt'], checkout: ['payment', 'cart', 'form', 'stepper', 'order'], settings: ['preferences', 'account', 'profile', 'form', 'switch'],
};
for (const t of TEMPLATES) {
  let desc = '';
  const p = join(ROOT, `apps/docs/src/pages/product/${t.slug}.astro`);
  if (existsSync(p)) { const m = readFileSync(p, 'utf8').match(/<p style="color: var\(--text-secondary\)[^>]*>([\s\S]*?)<\/p>/); if (m) desc = strip(m[1]); }
  add({ id: `template-${t.slug}`, kind: 'template', title: `${t.label} template`, priority: 3, tags: ['template', 'example', 'page', 'product', t.slug, ...(TEMPLATE_ALIASES[t.slug] || []), ...t.label.toLowerCase().split(/[^a-z]+/).filter(Boolean), ...keywords(desc).slice(0, 24)],
    summary: desc || `${t.label} product template.`, path: `apps/docs/src/pages/product/${t.slug}.astro`,
    text: `${t.label} — /product/${t.slug}/\n${desc}\nResponsive via @container queries; language + RTL via data-i18n; native chrome via data-platform. Copy from the source file; every value is a semantic token.` });
}
add({ id: 'icons', kind: 'component', title: 'Icons (Heroicons sprite)', priority: 2, tags: ['icon', 'icons', 'heroicons', 'sprite', 'svg', 'glyph', 'symbol', 'outline', 'solid', 'mini', 'micro', 'component'],
  summary: '324 Heroicons × outline/solid/mini/micro as one SVG sprite; <Icon name> in React, <svg class="fds-icon"><use href="/icons.svg#hero-name"/></svg> in HTML; find names with flavor_find_icon.', path: 'packages/ui/src/icons/',
  text: `# Icons — /core/icons/
Set: Heroicons (324 names) in four styles: outline (24px stroke, default/resting), solid (24px fill, active state), mini (20px), micro (16px). One sprite: /icons/sprite.svg (+ manifest.json with names and keywords).
HTML:  <svg class="fds-icon" data-icon aria-hidden="true"><use href="/icons/sprite.svg#hi-magnifying-glass-outline"></use></svg>   (ids: hi-{name}-{outline|solid|mini|micro})
React: import { Icon } from '@flavor-ds/ui'; <Icon name="magnifying-glass" variant="outline" size={24} label="Search" directional />   (label → role=img + aria-label; omit for decorative)
CSS:   .fds-icon is 1em square, currentColor; size via font-size / the size prop. Icons that carry direction (arrows, chevrons) take data-directional so dir="rtl" mirrors them.
Find:  MCP flavor_find_icon({query}) searches names + keywords and returns exact HTML/React usage. Never draw a glyph by hand or inline a third-party SVG — adoption counts icon coverage (baseline 99%).`,
});

add({ id: 'native', kind: 'contract', title: 'Native (iOS · Android)', priority: 2, tags: ['native', 'ios', 'android', 'swift', 'swiftui', 'kotlin', 'compose', 'mobile', 'platform', 'hig', 'material'],
  summary: 'FlavorTokens.swift / .kt resolve the same hex as the web for the same axes; data-platform applies HIG / M3 chrome and metrics.',
  text: (read('apps/docs/src/pages/product/native.astro').match(/const SPEC = \[[\s\S]*?\];/)?.[0]?.slice(0, 3000) || '') + `
Dynamic type: every --font-size-N/--line-height-N multiplies by --type-scale-N. import { applyTypeScale, stepsFor } from '@flavor-ds/ui/type-scale'; applyTypeScale(root, { platform: 'ios', step: 'ax2' }) or { platform: 'android', step: '1.5' } — iOS: 12 Dynamic Type categories (xSmall…large(default)…xxxLarge, ax1…ax5) with HIG anchors (Caption2 11 / Body 17 / Large Title 34 pt); Android: 0.85 1.0 1.15 1.3 (linear) 1.5 1.8 2.0 (Android 14 non-linear tables). Truncation: data-fds-truncate → ellipsis + tooltip with full text only when overflowing (hover + focus); full text stays in DOM for screen readers.` });
add({ id: 'behaviors', kind: 'contract', title: 'Behaviours (keyboard/focus contracts)', priority: 2, tags: ['behavior', 'behaviour', 'keyboard', 'focus', 'a11y', 'accessibility', 'menu', 'tabs', 'dialog', 'modal', 'listbox', 'select', 'tooltip', 'aria'],
  summary: 'behaviors.js upgrades [data-fds-tabs|menu|dialog|listbox|tooltip|truncate] with the WAI-ARIA APG pattern; React wrappers call the same functions.',
  text: read('packages/ui/src/behaviors.js').split('*/')[0] });
add({ id: 'canvas', kind: 'contract', title: 'Canvas design review + feedback', priority: 3, tags: ['canvas', 'review', 'feedback', 'comments', 'design review', 'qa'],
  summary: 'The EthiGov review board ported: live frames, selector-scoped comments, token-only tweaks; feedback in .canvas/feedback.json and via flavor_canvas_feedback.',
  text: 'Open /canvas/ (dev server). Comment mode → click → Save. Export block: route, device, selector, box, text, tweak lines (token names; DETACHED flagged), note. Apply tweaks with the named tokens; a token override is a request to change packages/tokens/build.mjs.' });
add({ id: 'guards', kind: 'contract', title: 'Guards (what npm test enforces)', priority: 1, tags: ['test', 'ci', 'guard', 'lint', 'check', 'verify', 'wcag', 'qa'],
  summary: 'Every rule has a check: ' + Object.keys(pkg.scripts).filter((k) => /^(test|lint|check|adoption)/.test(k)).join(', '),
  text: Object.entries(pkg.scripts).filter(([k]) => /^(test|lint|check|adoption|release)/.test(k)).map(([k, v]) => `${k}: ${v}`).join('\n') });
add({ id: 'governance', kind: 'contract', title: 'Governance', priority: 3, tags: ['governance', 'contribute', 'breaking', 'deprecate', 'version', 'semver', 'adoption', 'process'],
  summary: 'How a change is proposed, decided, shipped, versioned, deprecated and measured.', text: read('GOVERNANCE.md').slice(0, 8000) });
add({ id: 'workflow', kind: 'contract', title: 'Workflow (agent loop + release loop)', priority: 1, tags: ['workflow', 'process', 'flow', 'lifecycle', 'release', 'update', 'ci', 'how', 'steps', 'order'],
  summary: 'A: connect → recall → fetch → adapt → build → verify (gate) → canvas review (loop) → ship. B: proposal → source → generate → guards (gate) → version → publish → agents see it → feedback.', path: 'apps/docs/src/pages/workflow.astro',
  text: `# Workflow — /workflow/
A · An agent via MCP: 1 connect (npx -y @flavor-ds/mcp) · 2 flavor_recall({task}) — rules first, ranked chunks, budget · 3 fetch specifics (flavor_recall({ids}), flavor_get_component, flavor_find_icon, flavor_get_theme, flavor_get_contrast_pairs) · 4 adapt (flavor_adapt_project, flavor_get_tokens) · 5 build — semantic tokens, nine <html> attributes, documented markup, behaviors.js · 6 GATE npm test (red → back to 5) · 7 LOOP flavor_canvas_feedback (apply reviewer tweaks by selector + token) · 8 ship.
B · How the system updates: 1 proposal (rule of three, GOVERNANCE.md) · 2 edit the single source (packages/tokens/build.mjs, packages/ui/src, componentDocs.ts/productNav.ts) · 3 generate (build:tokens → flavor.css, tokens.json, contrast.json, meta.json, figma.json, i18n, Swift/Kotlin, agent index; build:icons) · 4 GATE npm test · 5 version + deprecate (semver, alias one minor, remove next major) · 6 publish (npm run ci; docs, packages, flavor_figma_sync) · 7 agents see it on the next recall · 8 LOOP canvas feedback + adoption metrics → next proposal.
The two loops share the index (B3 writes, A2 reads), the guards (same npm test), Canvas (A7 tweaks that need a token change become B1 proposals) and adoption.mjs.` });

add({ id: 'mcp', kind: 'contract', title: 'MCP tools', priority: 1, tags: ['mcp', 'tools', 'agent', 'api', 'recall', 'index'],
  summary: 'flavor_recall(task) is the entry point: global rules + task-ranked chunks. Then flavor_get_theme, flavor_get_component, flavor_find_icon, flavor_get_contrast_pairs, flavor_adapt_project, flavor_figma_sync, flavor_get_text_styles, flavor_canvas_feedback.',
  text: `Call order for a task: 1) flavor_recall({task}) → rules + relevant chunks (budget-limited). 2) fetch specifics: flavor_get_component(id), flavor_find_icon(query), flavor_get_theme(axes), flavor_get_contrast_pairs(hue). 3) build against semantic tokens only. 4) run npm test. 5) if reviewed on Canvas, read flavor_canvas_feedback and apply. flavor_index({kind}) lists chunk ids; flavor_recall({ids}) fetches by id.` });

const index = { name: meta.name, version: meta.version, generated: new Date().toISOString().slice(0, 10), priorities: { 0: 'global rules — always returned', 1: 'contract — axes, setup, tiers, guards, mcp', 2: 'tokens + components — returned when the task matches', 3: 'templates, governance, canvas — examples, returned on match' }, count: chunks.length, chunks };
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));

/* ─────────────────────────────────────────────── llms.txt */
const llms = `# Flavor DS

> An agent-ready design system delivered over MCP: 1,152 computed colour themes (16 hues incl. Brand + Brand 2 × 3 saturations × light/dark × AA/AAA × 6 backgrounds incl. always-dark), radius/density/type/direction axes, 47 CSS-first components with keyboard contracts, 20 product templates, native token exports, and a design-review canvas whose feedback comes out agent-actionable.

Start with the global rules — they are always in effect: /agent/rules.md
Then retrieve only what the task needs: MCP flavor_recall({task}) or /agent/index.json (${chunks.length} chunks, priority 0–3, keyword tags).

## Contract
- /core/tokens/ — semantic tokens (public API); TOKENS.md
- /core/colors/ — computed AA/AAA pairings
- /agent-ready/ — how the index and retrieval work
- /mcp/ — the MCP tools

## Components (47)
${COMPONENT_DOCS.map((d) => `- /core/components/${d.id}/ — ${d.title}: ${strip(d.summary).slice(0, 90)}`).join('\n')}

## Templates (${TEMPLATES.length})
${TEMPLATES.map((t) => `- /product/${t.slug}/ — ${t.label}`).join('\n')}

## Native
- /product/native/ — SwiftUI + Compose exports, HIG/M3 platform spec

## Review
- /canvas/ — live design-review board; feedback via flavor_canvas_feedback
`;
writeFileSync(join(OUT, 'llms.txt'), llms);
writeFileSync(join(OUT, 'llms-full.txt'), llms + '\n\n---\n\n' + chunks.map((c) => `## [${c.kind}] ${c.title} (id: ${c.id}, priority ${c.priority})\n${c.text}`).join('\n\n---\n\n'));
// publish to the docs site
const PUB = join(ROOT, 'apps/docs/public');
mkdirSync(join(PUB, 'agent'), { recursive: true });
for (const f of readdirSync(OUT)) writeFileSync(join(PUB, 'agent', f), readFileSync(join(OUT, f)));
writeFileSync(join(PUB, 'llms.txt'), llms);
writeFileSync(join(PUB, 'llms-full.txt'), readFileSync(join(OUT, 'llms-full.txt')));
console.log(`agent index: ${chunks.length} chunks (${chunks.filter((c) => c.kind === 'component').length} components, ${chunks.filter((c) => c.kind === 'template').length} templates, ${chunks.filter((c) => c.kind === 'tokens').length} token groups) → dist/agent + docs/public/agent, llms.txt`);
