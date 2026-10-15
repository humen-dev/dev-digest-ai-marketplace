# Cost baseline — sdd-engineering

What one successful SDD planning workflow costs, the optimization shipped in
`sdd-engineering` 1.1.0, and the gate every later release must pass.

## Method

- **Workflow measured:** one planning round trip with
  `sdd-engineering:implementation-planner` (Opus), as two eval cases:
  1. `planner-interview`: a vague request ("Add CSV export of invoices to our API.")
     → a *Requirements review* with the execution-mode question;
  2. `planner-fast-path`: approved requirements + `single-agent` mode (Fastify +
     Drizzle + Zod "Bookmarks API") → a written plan whose units list the right
     paved-path *Skills*.

  The planner is the most expensive manual step of the flow (Opus, largest
  preloaded context) and runs at least twice per feature, so it is where a
  saving shows first.
- **Success** = an eval run that passes every grader of its case (the case files
  in `plugins/sdd-engineering/evals/` are the definition).
- **Cost per successful workflow** = Σ over the two cases of
  *(agent cost of all runs ÷ passed runs)*. Agent cost is the list-price
  estimate `claude plugin eval` reports per run; judge (grader) calls are
  excluded — they price the test, not the workflow. A failed run still counts in
  the numerator, so flakiness raises the cost.
- **Setup:** Claude Code 2.1.300, 3 runs per case, `--ablation none`, all four
  marketplace plugins loaded from this checkout (the case `plugins:` field),
  default models from the agents' frontmatter (planner = opus).
- **Reproduce:**

  ```bash
  claude plugin eval . --eval-dir plugins/sdd-engineering/evals --tag cost \
    --runs 3 --ablation none --allow-tools Write --trust-plugin --json results.json
  node scripts/cost-report.mjs results.json --baseline 1.408
  ```

  Raw per-run numbers: [`docs/cost/`](cost/) (written by `cost-report.mjs --summary`).

## Baseline — sdd-engineering 1.0.0

Run 2026-10-15 ([summary](cost/2026-10-15-sdd-engineering-1.0.0.json)).

| Case | Passed | Run costs | Cost / success |
|---|---|---|---|
| `planner-interview` | 3/3 | $0.466 · $0.465 · $0.492 | $0.474 |
| `planner-fast-path` | 3/3 | $0.816 · $1.047 · $0.940 | $0.934 |
| **Workflow** | | | **$1.408** |

Where the money goes: the planner preloaded **12 skills** —
`ears-requirements` plus the whole `engineering-paved-path` coding set, ≈127 KB
(≈32k tokens) of Opus context on **every** planner call, before it read a single
line of the request. Eight of those skills are stack practice (Fastify,
Drizzle, PostgreSQL, React, Next.js, React Testing Library, TypeScript, Zod)
that the planner only has to *name* in each unit's *Skills* field — the
implementer is the one who applies them.

## Optimization — lazy stack skills in the planner (1.1.0)

`implementation-planner` now preloads 4 skills: `ears-requirements`,
`onion-architecture`, `frontend-ui-architecture` (they decide where every file
lives) and `security` (a feasibility check on every plan). The 8 stack skills
(≈77 KB, −61% of the preloaded context) are listed by name and scope in the
planner prompt; it `Read`s one `SKILL.md` only when a plan decision depends on
that skill's specific rule. Change: `plugins/sdd-engineering/agents/implementation-planner.md`
(frontmatter `skills:` and Hard rule 4).

Run 2026-10-15 ([summary](cost/2026-10-15-sdd-engineering-1.1.0.json)).

| Case | Passed | Run costs | Cost / success | vs 1.0.0 |
|---|---|---|---|---|
| `planner-interview` | 3/3 | $0.327 · $0.311 · $0.301 | $0.313 | **−34%** |
| `planner-fast-path` | 3/3 | $0.933 · $0.851 · $0.880 | $0.888 | −5% |
| **Workflow** | | | **$1.201** | **−14.7%** |

Reading the numbers:

- The interview call is almost pure context load, so cutting the preload shows
  in full (−$0.16 per call).
- The plan-writing call is dominated by output (the plan itself, ~200 s per
  run), so the same saving is a smaller share; it also took one more turn in the
  1.1.0 runs. Variance between runs (±$0.12) is close to the saving here — treat
  the fast-path delta as "no worse", not as a measured gain.
- Quality held: 6/6 workflow runs passed before and after, including the
  `planner-fast-path` grader that checks every backend unit still lists
  `onion-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`, `zod`
  and (for the table) `postgresql-table-design`, and no UI skill.

The same 1.1.0 run also passed the rest of the smoke suite, 3/3 each:
`spec-creator-interview` ($0.404 / success), `plan-verifier-no-plan` ($0.141),
`active-version` ($0.083 — the new trace hook; it adds one line of context per
session).

## Quality gate

A release of `sdd-engineering` ships (to latest) and is promoted (to the stable
channel, see [RELEASES.md](RELEASES.md#release-channels)) only when all of these
hold on a fresh run:

1. **Smoke green:**
   `claude plugin eval . --eval-dir plugins/sdd-engineering/evals --tag smoke --ablation none --threshold 1.0`
   exits 0 — every smoke case scores 1.0.
2. **Workflow quality:** `planner-interview` and `planner-fast-path` pass every
   run (3/3) — a cheaper planner that drops a *Skills* entry or skips the
   interview fails here.
3. **Cost:** `node scripts/cost-report.mjs results.json --baseline 1.201 --max-increase 0.10`
   exits 0 — the cost per successful workflow is at most **$1.321** (current
   baseline $1.201 + 10% for run-to-run variance). A release that needs more
   must say why in its `RELEASES.md` entry and reset the baseline here.

When a release lowers the cost and passes 1–2, record its run in the tables
above and lower the `--baseline` value.
