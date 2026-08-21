/**
 * Recall — how an agent retrieves Flavor DS knowledge for a task.
 *
 * Deterministic and dependency-free (no embeddings) so it runs identically in the MCP
 * server, in Node tests, and in the browser on the Agent Ready page.
 *
 * The contract, in order:
 *   1. GLOBAL RULES ARE ALWAYS RETURNED, first, untouched by ranking or budget. Priority 0.
 *   2. Contract chunks (priority 1 — axes, setup, tiers, guards, mcp) are returned when
 *      the task touches them, and 'axes' + 'setup' are always included for tasks that
 *      look like they build UI, because nothing works without them.
 *   3. Everything else (tokens, components, templates) is scored against the task:
 *        score = Σ over query terms of (tag hit ×3 + title hit ×2 + summary hit ×1 +
 *                text hit ×0.5) × (1 / (1 + priority×0.25))
 *      with light stemming (plural/-ing/-ed) and a synonym map for the words people
 *      actually type ("button" ↔ "cta", "modal" ↔ "dialog", "dropdown" ↔ "menu"…);
 *      literal words weigh 1.0, synonym expansions 0.4 so they never outrank the literal.
 *   4. A token BUDGET caps the payload. Rules always fit; then chunks are added in score
 *      order until the budget is spent; the summary of every dropped chunk is listed under
 *      `omitted` with its id, so the agent can fetch it explicitly with {ids}.
 *
 * Nothing here is learned or hidden: the same task always yields the same recall, and
 * scripts/test-recall.mjs asserts the ranking on representative tasks.
 */

const SYN = {
  button: ['cta', 'action', 'submit', 'press'], cta: ['button'], modal: ['dialog', 'overlay'], dialog: ['modal'], dropdown: ['menu', 'select'], menu: ['dropdown'],
  select: ['listbox', 'dropdown', 'combobox'], form: ['input', 'field', 'button', 'submit', 'textarea', 'checkbox', 'radio', 'select', 'validation'], login: ['sign-in', 'auth', 'form', 'password', 'email'],
  signin: ['login', 'sign-in'], 'sign-in': ['login', 'auth'], dark: ['mode', 'theme'], light: ['mode', 'theme'], theme: ['axes', 'hue', 'mode', 'attributes'], color: ['colour', 'tokens', 'contrast'], colour: ['color', 'tokens', 'contrast'],
  contrast: ['wcag', 'aa', 'aaa', 'pairing', 'accessible'], accessible: ['a11y', 'accessibility', 'contrast', 'keyboard'], accessibility: ['a11y', 'keyboard', 'focus'], a11y: ['accessibility'],
  table: ['data', 'grid', 'rows'], list: ['rows', 'items'], card: ['surface', 'container', 'elevation'], nav: ['navigation', 'navbar', 'sidenav', 'tabbar', 'menu'], navigation: ['nav', 'navbar', 'sidenav', 'breadcrumb', 'tabs'],
  toast: ['notification', 'feedback', 'alert'], notification: ['toast', 'banner', 'badge'], error: ['danger', 'alert', 'validation', 'feedback'], warning: ['feedback', 'alert'], success: ['feedback', 'status'],
  spacing: ['space', 'padding', 'gap', 'margin', 'density'], padding: ['spacing', 'space'], gap: ['spacing', 'space'], radius: ['corner', 'rounded', 'pill', 'square'], corner: ['radius'], rounded: ['radius'],
  icon: ['icons', 'sprite', 'glyph'], icons: ['icon', 'sprite'], font: ['typography', 'type', 'text-styles', 'pairing'], typography: ['font', 'text', 'heading', 'type'], heading: ['typography', 'display', 'text-styles'],
  mobile: ['native', 'ios', 'android', 'responsive', 'tabbar', 'touch'], ios: ['native', 'swift', 'swiftui', 'hig'], android: ['native', 'kotlin', 'compose', 'material'], native: ['ios', 'android', 'swift', 'kotlin'],
  rtl: ['direction', 'arabic', 'logical'], arabic: ['rtl', 'direction'], animation: ['motion', 'transition', 'duration', 'easing'], motion: ['animation', 'transition'], hover: ['motion', 'transition', 'state'],
  dashboard: ['template', 'stat', 'table', 'chart'], chat: ['template', 'messages'], calendar: ['template', 'date'], checkout: ['template', 'form', 'payment'], settings: ['template', 'form', 'switch'], landing: ['template', 'marketing', 'hero'],
  install: ['setup', 'adopt', 'import'], setup: ['install', 'adopt', 'start'], adopt: ['setup', 'install'], start: ['setup'], figma: ['sync', 'variables', 'design'], review: ['canvas', 'feedback'], feedback: ['canvas', 'review', 'status'],
  test: ['guards', 'ci', 'verify', 'check'], verify: ['guards', 'test', 'check'], deprecate: ['governance', 'version'], version: ['governance', 'semver'], token: ['tokens', 'semantic'], tokens: ['token', 'semantic', 'tiers'],
};
const stem = (w) => w.replace(/(ings?|ed|es|s)$/i, (m) => (w.length - m.length >= 3 ? '' : m));
/** query → Map(term → weight): literal words weigh 1, synonym expansions 0.4 (never outrank the literal) */
const terms = (q) => {
  const raw = String(q).toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) || [];
  const out = new Map();
  const put = (t, w) => { if (t.length > 1 && !STOP.has(t)) out.set(t, Math.max(out.get(t) || 0, w)); };
  for (const w of raw) { put(w, 1); put(stem(w), 1); for (const s of SYN[w] || SYN[stem(w)] || []) { put(s, 0.4); put(stem(s), 0.4); } }
  return out;
};
const STOP = new Set(['the', 'a', 'an', 'to', 'for', 'and', 'or', 'of', 'in', 'on', 'with', 'my', 'me', 'i', 'it', 'is', 'be', 'that', 'this', 'from', 'by', 'at', 'as', 'do', 'make', 'build', 'create', 'add', 'need', 'want', 'want', 'please', 'can', 'you', 'we', 'our', 'new', 'page', 'component', 'using', 'use'].map(stem));
const BUILDS_UI = /\b(build|create|make|add|design|implement|layout|page|screen|form|component|template|ui|view)\b/i;

/** Score one chunk against prepared query terms. */
export function score(chunk, qterms) {
  const tags = new Set(chunk.tags.map(stem)); const title = chunk.title.toLowerCase(); const summary = (chunk.summary || '').toLowerCase(); const text = (chunk.text || '').toLowerCase();
  let s = 0;
  for (const [t, w] of qterms) {
    if (tags.has(t) || tags.has(stem(t))) s += 3 * w;
    if (title.includes(t)) s += 2 * w;
    if (summary.includes(t)) s += 1 * w;
    if (text.includes(t)) s += 0.5 * w;
  }
  return s / (1 + (chunk.priority || 0) * 0.25);
}

/** approx tokens: 4 chars ≈ 1 token */
export const tokensOf = (s) => Math.ceil(String(s).length / 4);

/**
 * recall(index, { task, ids, kinds, budget, limit })
 *   task   free text describing what the agent is about to do
 *   ids    explicit chunk ids to fetch (bypasses ranking; rules still prepended)
 *   kinds  restrict ranked results to these kinds
 *   budget max approx tokens for the whole payload (default 6000)
 *   limit  max ranked chunks (default 8)
 */
export function recall(index, { task = '', ids = [], kinds = null, budget = 6000, limit = 8 } = {}) {
  const chunks = index.chunks;
  const rules = chunks.find((c) => c.id === 'rules');
  const out = { task, rules: rules ? { id: rules.id, title: rules.title, text: rules.text } : null, always: [], matches: [], omitted: [], budget, used: 0 };
  out.used += tokensOf(out.rules?.text || '');
  const take = (c, why, sc) => { const t = tokensOf(c.text); if (out.used + t > budget) { out.omitted.push({ id: c.id, title: c.title, summary: c.summary, why: 'over budget — fetch with {ids:["' + c.id + '"]}' }); return; } out.used += t; (why === 'always' ? out.always : out.matches).push({ id: c.id, kind: c.kind, title: c.title, priority: c.priority, score: sc, path: c.path, summary: c.summary, text: c.text }); };
  const picked = new Set(['rules']);
  if (ids.length) { for (const id of ids) { const c = chunks.find((x) => x.id === id); if (c && !picked.has(id)) { picked.add(id); take(c, 'match', null); } else if (!c) out.omitted.push({ id, why: 'unknown id' }); } return out; }
  // contract chunks that any UI-building task needs
  if (BUILDS_UI.test(task)) for (const id of ['axes', 'setup']) { const c = chunks.find((x) => x.id === id); if (c) { picked.add(id); take(c, 'always', null); } }
  const q = terms(task);
  const ranked = chunks.filter((c) => !picked.has(c.id) && c.priority > 0 && (!kinds || kinds.includes(c.kind))).map((c) => ({ c, s: score(c, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.c.priority - b.c.priority || a.c.title.localeCompare(b.c.title));
  for (const { c, s } of ranked.slice(0, limit)) take(c, 'match', Math.round(s * 10) / 10);
  for (const { c, s } of ranked.slice(limit, limit + 12)) out.omitted.push({ id: c.id, title: c.title, summary: c.summary, score: Math.round(s * 10) / 10, why: 'below limit — fetch with {ids}' });
  return out;
}

/** Render a recall payload as the markdown an agent reads. */
export function render(r) {
  const L = [];
  L.push(r.rules?.text || '');
  if (r.always.length) { L.push('\n# Contract (always relevant to building UI)\n'); for (const c of r.always) L.push(`## ${c.title}  [${c.id}]\n${c.text}\n`); }
  if (r.matches.length) { L.push(`\n# Relevant to: "${r.task}"\n`); for (const c of r.matches) L.push(`## ${c.title}  [${c.kind} · ${c.id}${c.score != null ? ` · score ${c.score}` : ''}]${c.path ? `\nsource: ${c.path}` : ''}\n${c.text}\n`); }
  if (r.omitted.length) L.push('\n# Also available (not loaded)\n' + r.omitted.map((o) => `- ${o.id}${o.title ? ` — ${o.title}` : ''}${o.summary ? `: ${o.summary}` : ''} (${o.why})`).join('\n'));
  L.push(`\n_~${r.used} of ${r.budget} token budget used._`);
  return L.join('\n');
}
