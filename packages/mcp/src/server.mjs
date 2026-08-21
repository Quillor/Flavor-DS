#!/usr/bin/env node
/**
 * Flavor DS MCP server (stdio).
 *
 * Serves the design system to agents so any project can adopt it:
 *   - flavor_get_meta            theme axes contract + defaults
 *   - flavor_get_tokens          full token CSS or DTCG JSON
 *   - flavor_get_theme           minimal setup for one theme combination
 *   - flavor_get_contrast_pairs  approved AA/AAA pairs (computed ratios) for a ramp
 *   - flavor_list_components     component inventory
 *   - flavor_get_component       CSS + React source + usage contract for one component
 *   - flavor_adapt_project       stack-aware adoption instructions (the "make it your own" logic)
 *   - flavor_figma_sync          ordered use_figma scripts to push tokens into Figma
 *   - flavor_get_text_styles     curated typography contract
 *   - flavor_find_icon           search the Heroicons set; exact HTML/React/CSS usage
 *   - flavor_canvas_feedback     design-review comments from the Canvas board (.canvas/feedback.json)
 *   - flavor_recall              MEMORY: global rules (always) + the chunks ranked for a task, under a token budget
 *   - flavor_index               MEMORY: the table of contents of the agent index (ids, kinds, priorities, summaries)
 *
 * Memory model (see /agent-ready/ on the docs site): the build emits packages/tokens/dist/agent/index.json —
 * ~85 chunks with priority 0 (global rules), 1 (theme contract), 2 (tokens + components), 3 (templates,
 * governance, canvas). flavor_recall runs packages/mcp/src/recall.mjs over it: rules are always returned first,
 * then task-ranked chunks until the budget is spent, with everything dropped listed by id for explicit fetch.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recall, render } from './recall.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve sibling packages through Node resolution (works installed from npm AND in the monorepo).
const pkgDir = (name, fallback) => { try { return dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`))); } catch { return join(__dirname, fallback); } };
const TOKENS_DIST = join(pkgDir('@flavor-ds/tokens', '../../tokens'), 'dist');
const UI_SRC = join(pkgDir('@flavor-ds/ui', '../../ui'), 'src');

const read = (p) => readFileSync(p, 'utf8');
const meta = JSON.parse(read(join(TOKENS_DIST, 'meta.json')));
const contrast = JSON.parse(read(join(TOKENS_DIST, 'contrast.json')));
const ramps = JSON.parse(read(join(TOKENS_DIST, 'ramps.json')));
const AGENT_INDEX = join(TOKENS_DIST, 'agent', 'index.json');
const agentIndex = () => JSON.parse(read(AGENT_INDEX));

const COMPONENTS = {
  button: { css: '.fds-button', react: 'Button', a11y: 'Native <button>; focus ring via :focus-visible; disabled uses opacity + cursor.' },
  input: { css: '.fds-input', react: 'Input', a11y: 'Pair with Field/label; aria-invalid drives error styling.' },
  textarea: { css: '.fds-textarea', react: 'Textarea', a11y: 'Same contract as input.' },
  select: { css: '.fds-select', react: 'Select', a11y: 'Native select for full keyboard/screen-reader support.' },
  checkbox: { css: '.fds-check', react: 'Checkbox', a11y: 'Native input wrapped in label.' },
  radio: { css: '.fds-check', react: 'Radio', a11y: 'Native input wrapped in label.' },
  switch: { css: '.fds-switch', react: 'Switch', a11y: 'input[type=checkbox] with role=switch.' },
  card: { css: '.fds-card', react: 'Card', a11y: 'Elevation 1-3 maps to surface tokens; dark mode lightens surfaces.' },
  badge: { css: '.fds-badge', react: 'Badge', a11y: 'Text badge; color pairs are contrast-approved.' },
  alert: { css: '.fds-alert', react: 'Alert', a11y: 'role=alert for warning/danger, role=status otherwise.' },
  tabs: { css: '.fds-tab', react: 'Tabs', a11y: 'role=tablist/tab/tabpanel with aria-selected.' },
  dialog: { css: '.fds-dialog', react: null, a11y: 'Use native <dialog>; backdrop + elevation-3 surface.' },
  progress: { css: '.fds-progress', react: 'Progress', a11y: 'role=progressbar with aria-valuenow.' },
  avatar: { css: '.fds-avatar', react: 'Avatar', a11y: 'img alt required when src given.' },
  navbar: { css: '.fds-navbar', react: null, a11y: 'aria-current=page marks the active link; fully RTL-safe via logical properties.' },
  sidenav: { css: '.fds-sidenav', react: null, a11y: 'aria-current=page; group headings are non-interactive.' },
  // ---- extended library ----
  accordion: { css: '.fds-accordion', react: 'Accordion', a11y: 'Native <details>/<summary> per item (AccordionItem); keyboard + SR for free; [open] drives the marker.' },
  breadcrumb: { css: '.fds-breadcrumb', react: 'Breadcrumb', a11y: '<nav aria-label> wrapping <ol>; last item is aria-current=page; separators are CSS-only.' },
  pagination: { css: '.fds-pagination', react: 'Pagination', a11y: '<nav aria-label>; native buttons; aria-current=page on active; prev/next have aria-labels and use disabled at bounds.' },
  table: { css: '.fds-table', react: 'Table', a11y: 'Native <table> in TableWrap (overflow-x scroll); th text-align start; sortable headers are <button.fds-th-sort> with aria-sort on <th>; aria-selected on rows.' },
  menu: { css: '.fds-menu', react: 'Menu', a11y: 'role=menu container with role=menuitem buttons; aria-disabled for disabled; data-variant=danger for destructive; MenuLabel/MenuSeparator are non-interactive.' },
  popover: { css: '.fds-popover', react: 'Popover', a11y: 'Anchor wrapper positions .fds-menu / .fds-popover-panel; trigger owns aria-expanded + aria-haspopup; consumer manages focus return.' },
  toast: { css: '.fds-toast', react: 'Toast', a11y: 'ToastRegion is aria-live=polite; each toast is role=status (alert for warning/danger); dismiss button has aria-label.' },
  drawer: { css: '.fds-drawer', react: 'Drawer', a11y: 'Native <dialog> (showModal for focus trap + Escape); data-side=start|end|bottom; title is <h2.fds-drawer-title>.' },
  slider: { css: '.fds-slider', react: 'Slider', a11y: 'input[type=range]; label via Field or aria-label; thumb shows focus ring on :focus-visible.' },
  segmented: { css: '.fds-segmented', react: 'Segmented', a11y: 'role=radiogroup with role=radio buttons and aria-checked; single-select only.' },
  chip: { css: '.fds-chip', react: 'Chip', a11y: 'Toggle chips are <button aria-pressed>; removable chips render a separate remove button with aria-label.' },
  stepper: { css: '.fds-stepper', react: 'Stepper', a11y: '<ol> of steps; data-state=complete|current|upcoming; current step is aria-current=step; index glyph is aria-hidden.' },
  spinner: { css: '.fds-spinner', react: 'Spinner', a11y: 'role=status with aria-label (default "Loading"); purely decorative motion.' },
  kbd: { css: '.fds-kbd', react: 'Kbd', a11y: 'Native <kbd>; text content is the shortcut.' },
  empty: { css: '.fds-empty', react: 'EmptyState', a11y: 'Heading (.fds-empty-title) + optional illustration (aria-hidden) + one primary action.' },
  stat: { css: '.fds-stat', react: 'Stat', a11y: 'Label precedes value in DOM order; delta trend conveyed by text/icon, not color alone (data-trend=up|down).' },
  rating: { css: '.fds-rating', react: 'Rating', a11y: 'role=img with aria-label "N out of M"; individual stars are aria-hidden; data-empty marks unfilled.' },
  timeline: { css: '.fds-timeline', react: 'Timeline', a11y: '<ol> of TimelineItem; markers/lines are decorative (aria-hidden); title + meta are text.' },
  banner: { css: '.fds-banner', react: 'Banner', a11y: 'role=status (alert for warning); data-variant=subtle|solid|warning; action button sits at inline-end.' },
  dropzone: { css: '.fds-dropzone', react: 'Dropzone', a11y: '<label> wrapping a real input[type=file] (visually hidden, still focusable); data-active on drag-over; FileItem lists results.' },
  code: { css: '.fds-code', react: 'CodeBlock', a11y: '<pre><code> block, overflow-x scroll; CodeInline for inline <code>.' },
  link: { css: '.fds-link', react: 'Link', a11y: 'Native <a>; underline always present (not color-only); accent text meets AA.' },
  'input-group': { css: '.fds-input-group', react: 'InputGroup', a11y: 'Flex row of Input + InputAddon/Button; addons are presentational, label the input itself.' },
  'avatar-group': { css: '.fds-avatar-group', react: 'AvatarGroup', a11y: 'Overlapping Avatars; each img needs alt; data-size=sm|lg on .fds-avatar.' },
  list: { css: '.fds-list', react: 'List', a11y: 'Native <ul>/<li> (ListItem) with title/description; leading/trailing slots for avatar/actions.' },
  command: { css: '.fds-command', react: 'CommandPalette', a11y: 'role=dialog with combobox input + role=listbox results; consumer manages active option (aria-activedescendant).' },
  calendar: { css: '.fds-calendar', react: 'Calendar', a11y: 'role=grid with columnheader day names and gridcell buttons; aria-selected, data-today, data-muted, data-in-range; presentational (consumer supplies days).' },
  tree: { css: '.fds-tree', react: 'Tree', a11y: 'role=tree > treeitem, groups via nested <ul role=group> inside native <details>; aria-selected on the item; caret is aria-hidden.' },
  meter: { css: '.fds-meter', react: 'Meter', a11y: 'role=meter with aria-valuenow/min/max; data-level=weak|ok|strong recolors filled segments (pair with text label).' },
  'divider-label': { css: '.fds-divider-label', react: 'DividerLabel', a11y: 'role=separator with visible text; lines are CSS pseudo-elements.' },
  'icon-button': { css: '.fds-icon-button', react: 'IconButton', a11y: 'Icon-only <button> — aria-label is REQUIRED (label prop); aria-pressed for toggles; data-variant=ghost|outline.' },
  'button-group': { css: '.fds-button-group', react: 'ButtonGroup', a11y: 'role=group of .fds-button; give the group an aria-label when the purpose is not obvious.' },
};

/** Build a fully-registered McpServer. Called once per stdio process, or per request over HTTP
 *  (stateless Streamable HTTP on Vercel: api/mcp.js). */
export function createServer() {
  const server = new McpServer({ name: 'flavor-ds', version: meta.version });

  server.registerTool('flavor_get_meta', {
    description: 'Flavor DS theme contract: axes (hue/sat/mode/contrast/density/dir), defaults, html attributes, theme count. Call this first.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }],
  }));

  server.registerTool('flavor_get_tokens', {
    description: 'Full token layer. format=css returns flavor.css (drop into any project, theme via html attributes). format=json returns DTCG tokens. format=ramps returns raw hex ramps.',
    inputSchema: { format: z.enum(['css', 'json', 'ramps']).default('css') },
  }, async ({ format }) => {
    const file = format === 'css' ? 'flavor.css' : format === 'json' ? 'tokens.json' : 'ramps.json';
    return { content: [{ type: 'text', text: read(join(TOKENS_DIST, file)) }] };
  });

  server.registerTool('flavor_get_theme', {
    description: 'Setup for one theme combination. Returns the html attributes to set and a summary of resolved semantic tokens for that combination.',
    inputSchema: {
      hue: z.enum(meta.axes.hue).default(meta.defaults.hue),
      sat: z.enum(meta.axes.sat).default(meta.defaults.sat),
      mode: z.enum(meta.axes.mode).default(meta.defaults.mode),
      contrast: z.enum(meta.axes.contrast).default(meta.defaults.contrast),
      bg: z.enum(meta.axes.bg).default(meta.defaults.bg),
      radius: z.enum(meta.axes.radius).default(meta.defaults.radius),
      density: z.enum(meta.axes.density).default(meta.defaults.density),
      font: z.enum(meta.axes.font).default(meta.defaults.font),
      dir: z.enum(meta.axes.dir).default(meta.defaults.dir),
    },
  }, async (axes) => {
    const attrs = `<html data-hue="${axes.hue}" data-sat="${axes.sat}" data-mode="${axes.mode}" data-contrast="${axes.contrast}" data-bg="${axes.bg}" data-radius="${axes.radius}" data-density="${axes.density}" data-font="${axes.font}" dir="${axes.dir}">`;
    const fam = contrast.modes[axes.mode].families[axes.sat];
    const hueKey = axes.hue === 'brand' ? 'blue' : axes.hue;
    const sel = axes.bg === 'accent' ? fam.perRamp[hueKey][axes.contrast].tonal
      : axes.bg === 'secondary' ? fam.selectionsSecondary[axes.contrast]
      : fam.selections[axes.contrast];
    const ramp = ramps[axes.hue === 'brand' ? 'neutral' : axes.hue][axes.sat][axes.mode];
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          htmlAttributes: attrs,
          note: 'Include flavor.css once (flavor_get_tokens format=css). All 96 combinations resolve from attributes — no per-theme CSS files.',
          resolved: {
            accentRamp: ramp,
            textSteps: sel,
            surfaceSteps: sel.surfaces,
            fontPair: meta.fontPairs[axes.font],
          },
        }, null, 2),
      }],
    };
  });

  server.registerTool('flavor_get_contrast_pairs', {
    description: 'STRICT approval list: which step-on-step pairings are approved for text (AA >= 4.5, AAA >= 7) or UI components (>= 3.0) in a given ramp, with computed ratios. Pairings not in this list are not approved.',
    inputSchema: {
      hue: z.enum(meta.axes.hue),
      sat: z.enum(meta.axes.sat).default('regular'),
      mode: z.enum(meta.axes.mode).default('light'),
    },
  }, async ({ hue, sat, mode }) => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        thresholds: contrast.thresholds,
        pairs: contrast.modes[mode].approvedPairs[`${hue}-${sat}`],
      }, null, 2),
    }],
  }));

  server.registerTool('flavor_list_components', {
    description: 'Component inventory with CSS class, React export, and accessibility contract.',
    inputSchema: {},
  }, async () => ({
    content: [{ type: 'text', text: JSON.stringify(COMPONENTS, null, 2) }],
  }));

  server.registerTool('flavor_get_component', {
    description: 'Source for one component: its CSS rules (extracted from components.css) plus React wrapper source and usage rules. Components reference ONLY semantic tokens.',
    inputSchema: { name: z.enum(Object.keys(COMPONENTS)) },
  }, async ({ name }) => {
    const info = COMPONENTS[name];
    const cssAll = read(join(UI_SRC, 'styles/components.css'));
    // Extract the section between this component's banner comment and the next banner.
    const sections = cssAll.split(/\/\* -{4,} /);
    const section = sections.find((s) => s.toLowerCase().startsWith(name)) ||
      sections.find((s) => s.includes(info.css + ' ')) || '';
    const reactSrc = info.react ? read(join(UI_SRC, 'components.tsx')) : null;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name,
          cssClass: info.css,
          a11y: info.a11y,
          css: section ? `/* ---- ${section}`.trim() : '(see components.css)',
          react: info.react ? `Exported as <${info.react}> from @flavor-ds/ui (full source in components.tsx)` : 'CSS-only component',
          reactSource: reactSrc && info.react ? reactSrc.split(`\n`).length + ' lines total — request via flavor_get_tokens? No: import from @flavor-ds/ui.' : null,
        }, null, 2),
      }],
    };
  });

  server.registerTool('flavor_adapt_project', {
    description: 'The adaptation brain. Given a project stack description, returns concrete adoption steps: what to install, where to put flavor.css, how to wire theme attributes, what to skip (e.g., skip React wrappers in a Vue app), and the tier rules agents must follow when generating UI.',
    inputSchema: {
      stack: z.string().describe('e.g. "Next.js 15 + Tailwind 4", "Vue 3 + Vite", "plain HTML", "Rails + Hotwire"'),
      features: z.array(z.enum(['components', 'themes', 'density', 'rtl', 'high-contrast', 'patterns', 'illustrations'])).optional()
        .describe('Subset of features to adopt; omit for all'),
    },
  }, async ({ stack, features }) => {
    const s = stack.toLowerCase();
    const isReact = /react|next|remix|gatsby/.test(s);
    const isTailwind = /tailwind/.test(s);
    const isVue = /vue|nuxt/.test(s);
    const isSvelte = /svelte/.test(s);
    const wanted = features?.length ? features : ['components', 'themes', 'density', 'rtl', 'high-contrast'];
    const steps = [
      '1. Fetch flavor.css via flavor_get_tokens(format=css) and add it as the FIRST stylesheet (before any app CSS).',
      '2. Set theme attributes on <html>: data-hue, data-sat, data-mode, data-contrast, data-density, dir. Defaults apply when omitted.',
      isReact
        ? '3. Install component layer: copy components.css + components.tsx from @flavor-ds/ui, or use the CSS classes directly.'
        : isVue || isSvelte
          ? `3. Skip the React wrappers. Use the fds-* CSS classes directly in your ${isVue ? 'Vue' : 'Svelte'} templates — they are framework-agnostic.`
          : '3. Use the fds-* CSS classes directly in your markup; no framework required.',
      isTailwind
        ? '4. Tailwind coexistence: keep Tailwind for layout utilities; map colors via CSS vars (e.g. bg-[var(--surface-1)]). NEVER hardcode hex — the theme axes stop working.'
        : '4. Reference ONLY semantic tokens in app code: --surface-*, --text-*, --accent-*, --border-*, --space-*, --font-*, --radius-*, --duration-*. Primitive tokens (--flavor-hue-sat-N) are off-limits outside the token layer.',
      '5. Theme switching: change html attributes at runtime (one line of JS). Persist to localStorage; respect prefers-color-scheme and prefers-contrast for defaults.',
      wanted.includes('rtl') ? '6. RTL: use CSS logical properties (padding-inline, margin-inline-start) in app code; set dir="rtl" and everything flips.' : null,
      wanted.includes('high-contrast') ? '7. High contrast: data-contrast="aaa" remaps text/accent tokens to AAA-approved steps. No component changes needed.' : null,
      '8. Verify: run the tier guard (grep for --flavor- outside the token file) in CI. Text/background pairs outside flavor_get_contrast_pairs approval lists are defects.',
    ].filter(Boolean);
    return { content: [{ type: 'text', text: JSON.stringify({ stack, adopted: wanted, steps }, null, 2) }] };
  });

  server.registerTool('flavor_figma_sync', {
    description: 'Code→Figma sync. Returns the ordered list of IDEMPOTENT `use_figma` scripts generated from the current token build (Background/Contrast/Primitives/Saturation/Hue chain + Radius, Density, Typography, Language, and the typography TEXT STYLES). Call with no args for the run order, then with {script} to fetch one script body and execute it verbatim via use_figma. Re-running updates values in place and preserves existing bindings.',
    inputSchema: { script: z.string().optional().describe('File name from the order, e.g. "04-hue-leaves-primary.js". Omit to list.') },
  }, async ({ script }) => {
    const dir = join(TOKENS_DIST, 'figma-sync');
    if (!existsSync(dir)) return { content: [{ type: 'text', text: 'Not generated yet — run `npm run build:tokens` (which runs figma-sync/plan.mjs).' }] };
    if (!script) {
      const order = JSON.parse(read(join(dir, 'ORDER.json')));
      return { content: [{ type: 'text', text: JSON.stringify({ ...order, howTo: 'For each file in `order`: flavor_figma_sync({script}) → run the returned body with use_figma (fileKey = target file). Then optionally verify.js and 99-lint-modes.js.', gotchas: ['Only the frame you toggle may carry explicit variable modes — inner nodes must inherit (99-lint-modes.js reports offenders).', 'Layout-only frames need fills = [] (Figma defaults them to white).', 'Load fonts before any text mutation; bind text via the Typography text styles.'] }, null, 2) }] };
    }
    const safe = script.replace(/[^a-zA-Z0-9._-]/g, '');
    const p2 = join(dir, safe);
    if (!existsSync(p2)) return { content: [{ type: 'text', text: `Unknown script: ${safe}` }] };
    return { content: [{ type: 'text', text: read(p2) }] };
  });

  server.registerTool('flavor_get_text_styles', {
    description: 'Typography contract: the curated text styles (name → scale step, family role, weight) that Figma binds to Typography variables, plus the size/line-height scales. Use when generating UI so text uses a named style instead of raw sizes.',
    inputSchema: {},
  }, async () => {
    const f = JSON.parse(read(join(TOKENS_DIST, 'figma.json')));
    return { content: [{ type: 'text', text: JSON.stringify({ textStyles: f.typography.textStyles, sizes: f.typography.sizes, lineHeights: f.typography.lineHeights, pairs: Object.fromEntries(Object.entries(f.typography.pairs).map(([k, v]) => [k, v.label])) }, null, 2) }] };
  });

  server.registerTool('flavor_find_icon', {
    description: 'Icons: search the Heroicons set (324 names × outline/solid/mini/micro) by keyword and get the exact HTML/React/CSS usage. Outline is the default state, solid marks active/selected; colour is currentColor; direction-bearing glyphs take data-directional so they mirror in RTL. Never draw icons by hand — the template guard rejects ad-hoc <svg><path>.',
    inputSchema: {
      query: z.string().describe('keyword(s), e.g. "arrow", "user", "trash", "chevron down"'),
      variant: z.enum(['outline', 'solid', 'mini', 'micro']).optional().describe('default outline'),
      limit: z.number().int().min(1).max(50).optional(),
    },
  }, async ({ query, variant = 'outline', limit = 12 }) => {
    const m = JSON.parse(read(join(UI_SRC, '..', 'dist', 'icons', 'manifest.json')));
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const joined = words.join('-');
    // exact hyphenated match ("arrow right" → arrow-right) outranks partials; then shorter names first
    const scored = m.names.map((n) => ({ n, s: (n === joined ? 100 : 0) + words.reduce((a, w) => a + (n === w ? 5 : n.split('-').includes(w) ? 3 : n.includes(w) ? 1 : 0), 0) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.n.length - b.n.length || a.n.localeCompare(b.n)).slice(0, limit);
    const directionalHint = (n) => /arrow|chevron|backward|forward|uturn|login|logout|speaker|paper-airplane/.test(n);
    return { content: [{ type: 'text', text: JSON.stringify({
      query, variant, matches: scored.map(({ n }) => ({
        name: n, directional: directionalHint(n),
        html: `<svg class="fds-icon" data-icon data-variant="${variant}"${directionalHint(n) ? ' data-directional' : ''} aria-hidden="true"><use href="/icons/sprite.svg#hi-${n}-${variant}"></use></svg>`,
        react: `<Icon name="${n}"${variant !== 'outline' ? ` variant="${variant}"` : ''}${directionalHint(n) ? ' directional' : ''} />`,
        cssMask: `mask-image: url(/icons/${variant}/${n}.svg);`,
      })),
      variants: m.variants, contract: m.contract, license: m.license,
      setup: 'Serve packages/ui/dist/icons/sprite.svg at /icons/sprite.svg (or set IconSprite.href). Sizes: 24 default, 20 (mini) dense UI, 16 (micro) inline with text.',
    }, null, 2) }] };
  });

  server.registerTool('flavor_canvas_feedback', {
    description: 'Design-review feedback from the Canvas board (/canvas/ on the docs site): every page rendered as live device frames, reviewers pin selector-scoped comments with token-constrained tweaks. Returns the AI-actionable export — for each numbered entry: route, device, CSS selector, bounding box, quoted text, tweak lines (token names, DETACHED raw values flagged), free-text note; plus the active theme axes and any token overrides. Apply tweaks with the named tokens; a token override is a request to change packages/tokens/build.mjs, not to hardcode. Reads .canvas/feedback.json at the repo root (written by the dev server; travels with the branch).',
    inputSchema: { format: z.enum(['markdown', 'json']).optional().describe('markdown (default) is the same block "Copy feedback" produces; json is the raw file') },
  }, async ({ format = 'markdown' }) => {
    const file = join(pkgDir('@flavor-ds/tokens', '../../tokens'), '..', '..', '.canvas', 'feedback.json');
    if (!existsSync(file)) return { content: [{ type: 'text', text: 'No Canvas feedback yet. Open /canvas/ on the docs dev server (npm run dev:docs), pin comments in Comment mode, and they are written to .canvas/feedback.json.' }] };
    const d = JSON.parse(read(file));
    if (format === 'json') return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }] };
    const axes = d.axes ? Object.entries(d.axes).map(([k, v]) => `${k}=${v}`).join(' ') : 'defaults';
    const lines = [
      `# Flavor DS Canvas feedback (${d.comments.length} comment${d.comments.length === 1 ? '' : 's'})`,
      'Each numbered entry is a comment on the docs app UI. @N references resolve to those entries.',
      'For each: open the file behind the route, locate the element by selector / visible text / bounding box for the given device, apply the tweak lines exactly.',
      'Token-referenced values MUST use the token, never a hand-rolled value. Lines marked DETACHED are deliberate one-offs. "(full page)" means the page root.',
      'Semantic tokens are computed in packages/tokens/build.mjs — a token override is a request to change the SOURCE.',
      `Active theme axes: ${axes}`,
      Object.keys(d.overrides || {}).length ? 'Token overrides in effect:\n' + Object.entries(d.overrides).map(([k, v]) => `  ${k}: ${v}`).join('\n') : 'Token overrides: none',
      '',
    ];
    const specOf = (t = {}) => {
      const L = []; const det = t.detached || {};
      if (t.type) L.push(`type: ${t.type}`);
      if (t.textColor) L.push(`color: ${det.textColor ? t.textColor + ' — DETACHED' : '--' + t.textColor}`);
      if (t.bg) L.push(`background: ${det.bg ? t.bg + ' — DETACHED' : '--' + t.bg}`);
      const sides = ['block-start', 'inline-end', 'block-end', 'inline-start'];
      for (const k of ['padding', 'margin']) (t[k] || []).forEach((v, i) => { if (v) L.push(`${k}-${sides[i]}: ${det[k + i] ? v + ' — DETACHED' : '--' + v}`); });
      if (t.gap) L.push(`gap: ${det.gap ? t.gap + ' — DETACHED' : '--' + t.gap}`);
      if (t.radius) L.push(`border-radius: ${det.radius ? t.radius + ' — DETACHED' : '--radius-' + t.radius}`);
      if (t.layout) for (const [k, v] of Object.entries(t.layout)) L.push(`${k}: ${v}`);
      return L;
    };
    for (const c of d.comments) {
      lines.push(`## ${c.id}. ${c.note ? c.note.slice(0, 15) + (c.note.length > 15 ? '…' : '') : '(untitled)'} — ${c.author || 'Anonymous'}`);
      lines.push(`route: ${c.route}   device: ${c.device}`);
      lines.push(`selector: ${c.page ? '(full page)' : c.selector}   [${c.kind}]`);
      lines.push(`box: ${c.box.w}×${c.box.h} at (${c.box.x}, ${c.box.y})`);
      if (c.text) lines.push(`text: "${c.text}"`);
      for (const l of specOf(c.tweaks)) lines.push(`tweak: ${l}`);
      if (c.note) lines.push(`note: ${c.note}`);
      lines.push('');
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  server.registerTool('flavor_recall', {
    description: 'MEMORY. Call this before starting any task with Flavor DS. Returns (1) the global rules — always, first, unranked; (2) the theme contract when the task builds UI; (3) the index chunks (tokens, components, templates, native, behaviours, guards…) ranked for the task by tag/title/summary/text match, weighted by priority, until the token budget is spent; (4) the ids of everything omitted so you can fetch it with ids=[…]. Deterministic — same task, same recall. Prefer this over reading llms-full.txt: it prioritises what matters for THIS task while still enforcing the global rules.',
    inputSchema: {
      task: z.string().optional().describe('What you are about to do, in plain words — e.g. "build a login form", "add dark mode to a settings screen", "port the button to SwiftUI"'),
      ids: z.array(z.string()).optional().describe('Fetch these chunk ids exactly (from flavor_index or a previous recall\'s "omitted" list). Rules are still prepended.'),
      kinds: z.array(z.string()).optional().describe('Restrict ranked results to these kinds: contract, tokens, component, template, native, behaviors, canvas, guards, governance, mcp'),
      budget: z.number().int().min(500).max(40000).optional().describe('Approximate token budget for the whole payload (default 6000). Rules always fit.'),
      limit: z.number().int().min(1).max(40).optional().describe('Max ranked chunks (default 8)'),
      format: z.enum(['markdown', 'json']).optional().describe('markdown (default) is what you read; json is the structured payload with scores'),
    },
  }, async ({ task = '', ids = [], kinds, budget = 6000, limit = 8, format = 'markdown' }) => {
    if (!existsSync(AGENT_INDEX)) return { content: [{ type: 'text', text: 'Agent index missing — run `npm run build:tokens` (scripts/build-agent-index.mjs).' }] };
    const r = recall(agentIndex(), { task, ids, kinds: kinds || null, budget, limit });
    return { content: [{ type: 'text', text: format === 'json' ? JSON.stringify(r, null, 1) : render(r) }] };
  });

  server.registerTool('flavor_index', {
    description: 'MEMORY table of contents: every chunk in the agent index with id, kind, priority (0 rules → 3 reference), tags and one-line summary. Use it to see what exists, then flavor_recall({ids}) to load specific chunks. kind filters (component, template, tokens, …).',
    inputSchema: { kind: z.string().optional().describe('Only chunks of this kind') },
  }, async ({ kind }) => {
    if (!existsSync(AGENT_INDEX)) return { content: [{ type: 'text', text: 'Agent index missing — run `npm run build:tokens`.' }] };
    const idx = agentIndex();
    const rows = idx.chunks.filter((c) => !kind || c.kind === kind).map((c) => `${c.priority} · ${c.kind.padEnd(10)} ${c.id.padEnd(28)} ${c.title} — ${c.summary}${c.tags?.length ? '  [' + c.tags.slice(0, 6).join(', ') + ']' : ''}`);
    return { content: [{ type: 'text', text: `${idx.name} ${idx.version} — ${rows.length}${kind ? ' ' + kind : ''} chunks (generated ${idx.generated})
  priority · kind · id · title — summary [tags]

  ${rows.join('\n')}

  ${Object.entries(idx.priorities || {}).map(([k, v]) => `priority ${k}: ${v}`).join('\n')}` }] };
  });


  return server;
}

// stdio entry point (npx -y @flavor-ds/mcp / bin). Not run when imported by the HTTP function.
const isMain = typeof process !== 'undefined' && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
}
