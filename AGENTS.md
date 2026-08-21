# Flavor DS — for agents

Read `packages/tokens/dist/agent/rules.md` first (12 global rules; every one is enforced by `npm test`).
Then retrieve only what the task needs — not the whole repo:

- With MCP (hosted: `claude mcp add --transport http flavor-ds https://flavor-ds.vercel.app/api/mcp` · local: `node packages/mcp/src/server.mjs`): `flavor_recall({ task })` → rules + the chunks ranked for the task under a token budget; `flavor_recall({ ids })` for anything it listed as omitted; `flavor_index()` for the table of contents.
- Without MCP: `packages/tokens/dist/agent/index.json` (86 chunks: id · kind · priority 0–3 · tags · summary · text) or `apps/docs/public/llms-full.txt`.

Priorities: 0 rules (always) · 1 contract (theme axes, setup, token tiers, guards, MCP call order) · 2 tokens + components · 3 templates, governance, canvas.
The ranking is deterministic and tested (`scripts/test-recall.mjs`); the index is rebuilt by `npm run build:tokens` (`scripts/build-agent-index.mjs`) — never edit it by hand.

Build against semantic tokens only, theme via the nine `<html>` attributes, then run `npm test`. For reviewed work read `flavor_canvas_feedback`.
How this works, in full: `/agent-ready/` on the docs site.
