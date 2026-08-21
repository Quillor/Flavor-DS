# Governance

How Flavor DS changes. This is a deliverable, not a policy page: every rule below names the
mechanism that enforces it, and every metric names the script that computes it. A rule with
no mechanism is aspiration and does not belong here.

## 1. What is in the system, and what is not

Flavor DS is the **shared, stable** layer. Something is promoted into it only after the **rule of
three**: it has to be needed by three real consumers (three templates, three product surfaces, or
three teams). One consumer produces an abstraction that fits one consumer. Until then it stays in
the product as a local class — that is what the `pm-*`, `ch-*`, `mu-*` classes in the templates
are, and it is why *component usage* below is not expected to reach 100%.

Tiers, and who may reference what:

| Tier | Example | Who references it |
|---|---|---|
| Primitive | `--flavor-blue-regular-9`, `--ramp-4` | the token generator only |
| Semantic | `--text-primary`, `--accent-bg`, `--radius-control` | components, templates, products |
| Component | `.fds-button[data-variant]` | templates, products |

`npm run lint:tokens` fails any primitive reference outside `packages/tokens`.

## 2. How a change is proposed

Open a change with three things: **what**, **which consumers need it** (rule of three), and
**which tier it lands in**. Token changes go through `packages/tokens/build.mjs` — never a hand
edit to `flavor.css`. Component changes ship CSS + behaviour + docs together; a component whose
docs describe behaviour that `scripts/test-behaviors.mjs` does not assert is not done.

## 3. Who decides

One owner per tier decides; a change touching two tiers needs both. The decision is recorded in
the commit message, which in this repo carries the *why*, not just the *what* (see `git log`).
Disagreements are settled by measurement where possible — a contrast question is answered by
`scripts/wcag-qa.mjs`, a layout question by `scripts/check-template-layout.mjs` — and by the
tier owner where not.

## 4. How it ships

Nothing merges red. `npm test` runs, in order:

| Guard | Fails when |
|---|---|
| `test-tokens.mjs` | any of 336 computed selections changes, or a contrast floor regresses |
| `wcag-qa.mjs` | any of 34,560 pairings drops below AA+0.05 / AAA+0.05 (hardened margin), *or cannot be resolved* |
| `test-figma-sync.mjs` | a sync script references a variable no earlier script creates, or uses an unsupported API |
| `check-polish.mjs` | `transition: all`, `will-change: all`, a tinted image outline, a press scale below 0.95, a hardcoded duration |
| `check-templates.mjs` | a literal colour, a numeric radius token, a physical `left`/`right`, an ad-hoc icon |
| `check-tokens.mjs` (`lint:tokens`) | a primitive token referenced outside the token layer |

Four more need a running dev server and run before release as `npm run release:check`:
`test-behaviors.mjs` (36 keyboard contracts), `check-template-layout.mjs` (no in-flow overflow across
the extreme theme combinations), `check-responsive.mjs` (every template × 3 devices × 3 densities:
no clipped content, no sub-floor targets, no text under 11px, no horizontal scroll, no off-scale
spacing), and `screenshot-matrix.mjs` (99 visual baselines).

## 5. Versioning — and what "breaking" means

Semver on `@flavor-ds/tokens` and `@flavor-ds/ui`. **Breaking** is defined mechanically, not by
feel:

- a **public token** (listed in `TOKENS.md`) is removed or renamed;
- a **semantic token's meaning** changes such that a consumer's existing pairing could fail
  contrast (the golden in `test-tokens.mjs` catches this — a floor regression is breaking);
- an `fds-*` class, `data-variant` value, or React prop is removed or renamed;
- a `behaviors.js` data attribute contract changes;
- a Figma variable in the public `Background`/`Radius`/`Density`/`Typography` collections is
  removed or renamed (mode ids are preserved on rename, so pins follow — that is *not* breaking).

Adding is never breaking. Changing a primitive's hex is not breaking (nothing outside the token
layer may reference it). Re-baselining the golden with `--accept-floor` is a **major** bump and
must say why in the commit.

## 6. Deprecation and removal

A deprecated token or class keeps working for **one minor version** and is removed in the next
major. During that window it:

1. is marked in `TOKENS.md` with the replacement and the removal version;
2. still resolves — as an alias to its replacement, so nothing goes visually wrong;
3. is reported by `npm run lint:tokens` as a warning with the migration.

Worked example (`TOKENS.md`): if `--accent-border` were renamed `--border-accent`, v1.x ships both
with `--accent-border: var(--border-accent)`, warns in docs and changelog, and v2.0 removes it.

The Figma side already followed this discipline once: the `Tonal` collection was **renamed in place**
to `Background` rather than replaced, so every existing binding survived; the old `Media` collection
was removed only after every page's pins were swept off it (`08-background-public.js`), because
Figma leaves dangling mode pins behind otherwise. Renaming a mode by name (never by index) keeps
its id, so frames pinned to it follow.

## 7. How changes are communicated

`CHANGELOG.md` per package, generated from commit messages, grouped Added / Changed / Deprecated /
Removed / Fixed. Every Deprecated entry names the replacement and the removal version. The MCP's
`flavor_get_meta` returns the current version, so an agent can tell whether its cached tokens are
stale.

## 8. Adoption — the metric

A system with enforcement points but no measurement is a hobby. `scripts/adoption.mjs` computes
these from source, appends a row to `adoption.jsonl`, and `--check` fails CI if any regresses:

| Metric | Baseline (2026-08-16, docs app) | Direction |
|---|---|---|
| Token coverage — themable declarations resolving to a token | **98.6%** | → 100% |
| Hardcoded values — literal colours / px in system-owned properties | **16** | → 0 |
| Component usage — interactive elements that are `fds-*` | **67.2%** | ↑, not to 100% (rule of three) |
| Icon coverage — `<svg>` that are sprite icons or marked drawings | **99.1%** | → 100% |
| Behaviour coverage — widget markup wired to `behaviors.js` | **50%** | → 100% |

"Themable" deliberately excludes layout dimensions (a 640px measure, a 240px sidebar): there is no
token for those and there should not be, so counting them would only flatter or punish layout
choices. A product adopting Flavor points `SCAN` at its own source and keeps its own log — the
number that matters is *its* trend, not ours.

## 9. Escalation

If a guard is wrong, fix the guard — do not add an exception. Every guard in this repo has been
wrong at least once (the WCAG QA silently skipped light mode for a week; the overflow check flagged
hit-area pseudo-elements; the mode lint flagged legitimate demo tiles). Each was corrected by
making the check measure the right thing and then **falsifying it** — planting the defect and
confirming the check fires — before trusting it again. That is the bar for changing a guard.
