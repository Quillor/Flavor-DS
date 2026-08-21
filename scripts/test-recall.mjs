#!/usr/bin/env node
/**
 * test-recall — the memory layer's contract, asserted.
 *
 * 1. Global rules come back for EVERY recall — including empty tasks, id fetches, tiny budgets.
 * 2. Task ranking is sane on representative asks (the top hits are the chunks a human would pick).
 * 3. The token budget is honoured and every dropped chunk is listed under `omitted` with its id.
 * 4. Recall is deterministic (same task → identical payload).
 * 5. The index itself is well-formed: unique ids, every priority in the legend, rules chunk present,
 *    every component/template on the docs site is indexed.
 * Fails loudly (exit 1) — a silently degraded memory is worse than none.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recall, render, tokensOf } from '../packages/mcp/src/recall.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(ROOT, 'packages/tokens/dist/agent/index.json'), 'utf8'));
let fails = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fails++; console.log('  ✗ ' + msg); } };

console.log('index shape');
const ids = index.chunks.map((c) => c.id);
ok(new Set(ids).size === ids.length, `ids unique (${ids.length})`);
ok(index.chunks.some((c) => c.id === 'rules' && c.priority === 0), 'rules chunk present at priority 0');
ok(index.chunks.every((c) => c.priority in index.priorities), 'every priority is in the legend');
ok(index.chunks.every((c) => c.title && c.summary && c.text && Array.isArray(c.tags)), 'every chunk has title/summary/text/tags');
ok(index.chunks.filter((c) => c.kind === 'component').length >= 40, 'components indexed (≥40)');
ok(index.chunks.filter((c) => c.kind === 'template').length >= 18, 'templates indexed (≥18)');
ok(['axes', 'setup', 'tiers', 'guards', 'mcp', 'native', 'behaviors', 'canvas', 'governance'].every((id) => ids.includes(id)), 'contract + reference chunks present');

console.log('rules always');
for (const [label, opts] of [['empty task', {}], ['id fetch', { ids: ['component-button'] }], ['tiny budget', { task: 'build a dashboard', budget: 500 }], ['kinds filter', { task: 'toast', kinds: ['template'] }]]) {
  const r = recall(index, opts);
  ok(r.rules && r.rules.id === 'rules' && r.rules.text.includes('semantic'), `${label} → rules first`);
}

console.log('ranking');
const top = (task, n = 5, o = {}) => recall(index, { task, ...o }).matches.slice(0, n).map((m) => m.id);
const expect = (task, wanted, n = 6, o = {}) => { const t = top(task, n, o); ok(wanted.every((w) => t.includes(w)), `"${task}" → ${wanted.join(', ')}   (got ${t.join(', ')})`); };
expect('build a login form with email and password', ['component-input', 'component-button'], 8);
{ const r = recall(index, { task: 'dark mode contrast for a settings screen' }); ok([...r.always, ...r.matches].some((c) => c.id === 'axes') && r.matches.slice(0, 4).some((c) => c.id === 'template-settings'), '"dark mode contrast for a settings screen" → axes (contract) + settings template'); }
expect('add a modal dialog', ['component-dialog']);
expect('data table with sorting', ['component-table']);
expect('spacing and padding scale', ['tokens-space']);
expect('port the button to swiftui on ios', ['native']);
expect('which icons are available', ['icons']);
expect('what tests run in ci', ['guards']);
expect('build a kanban board like asana', ['template-projects'], 4);
expect('deprecate a token', ['governance', 'tiers'], 8);
expect('what is the release process', ['workflow', 'governance'], 6);
const ui = recall(index, { task: 'build a checkout page' });
ok(ui.always.map((c) => c.id).join() === 'axes,setup', 'UI-building tasks always get axes + setup');
ok(recall(index, { task: 'what is the semver policy' }).always.length === 0, 'non-UI tasks do not force the contract');

console.log('budget');
const small = recall(index, { task: 'build a dashboard with table, cards, tabs and toasts', budget: 1500, limit: 20 });
ok(small.used <= 1500, `used ${small.used} ≤ 1500`);
ok(small.omitted.some((o) => o.why.startsWith('over budget')), 'over-budget chunks listed under omitted');
ok(small.omitted.every((o) => o.id), 'every omitted entry has an id');
const big = recall(index, { task: 'build a dashboard with table, cards, tabs and toasts', budget: 40000, limit: 20 });
ok(big.matches.length > small.matches.length, `bigger budget loads more (${big.matches.length} vs ${small.matches.length})`);
const rendered = render(big);
ok(Math.abs(tokensOf(rendered) - big.used) / big.used < 0.5, `render size tracks the accounted budget (~${tokensOf(rendered)} vs ${big.used})`);
const fetched = recall(index, { ids: ['component-button', 'nope'] });
ok(fetched.matches.length === 1 && fetched.omitted.some((o) => o.why === 'unknown id'), 'id fetch returns exactly the ids; unknown ids reported');

console.log('determinism');
ok(JSON.stringify(recall(index, { task: 'toast notifications' })) === JSON.stringify(recall(index, { task: 'toast notifications' })), 'same task → identical payload');

if (fails) { console.error(`\ntest-recall: ${fails} failure(s)`); process.exit(1); }
console.log(`\ntest-recall: all passed (${index.chunks.length} chunks)`);
