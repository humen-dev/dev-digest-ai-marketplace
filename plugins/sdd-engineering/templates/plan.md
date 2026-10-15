# <Feature name> — development plan

> Template for the `sdd-engineering:implementation-planner` agent. Copy to
> `<plansDir>/<kebab-slug>.md` (`plansDir` from `.claude/sdd.json`) and fill
> every section; write "none" instead of deleting a section. `/sdd-engineering:run-plan`
> executes the plan only when *Status* contains `approved`. Delete this
> blockquote in the copy.

| Field | Value |
|---|---|
| Status | draft · approved · in-progress · done |
| Goal | <one sentence: what the user can do after this ships — taken from the requirements, not invented> |
| Requirements source | <spec path(s) (`SPEC-NN`) · design brief · request> (input — this plan never edits it) |
| Execution mode | multi-agent (parallel waves) · single-agent (sequential pass) — chosen by the user |
| Modules touched | <names from `modules` in .claude/sdd.json — only the touched ones> |

## 1. Context
What exists today (with `path:line` evidence), why it is not enough, and a short
summary of the requirements with a link to their source. Link the specs and
agent-doc entries you relied on. Do not restate or extend a spec here.

### Requirements review
Findings from the review (unclear / conflict / infeasible / untestable / gap) and
how each was resolved. Recommendations, each marked **accepted** or **rejected**
by the user. "none" if none.

### Decisions
Numbered, each with the alternative that was rejected and why.

### Open questions
Questions the user must answer before approval (including a missing
`checkCommand`). "none" if none.

## 2. Affected modules
| Module | Touched? | Why / what changes | Architecture rule that applies |
|---|---|---|---|
| <module> | yes / no | … | onion-architecture ring(s) · frontend-ui-architecture layer(s) · agent-doc rule |
| shared / duplicated contracts | | | edited identically in every copy, Wave 0 only |

## 3. Contracts (the interfaces every unit agrees on)
Exact schemas / types / endpoints (method, path, request, response, error
codes) / DB tables / CLI flags. Written as code, not prose, numbered §3.1, §3.2 …
Implementers must not change these — a unit that needs a different contract
stops and reports it as `BLOCKED:` in its result.

### 3.1 <contract name>
```ts
// exact contract
```

## 4. Work units
One block per unit. A unit is the smallest change that carries its own tests
and can be verified alone. **No two units in the same wave may own the same file.**
Keep each block ≤ ~60 lines — every implementer reads it; code belongs in §3 only.

### U<n> — <short title>
| Field | Value |
|---|---|
| Kind | <free-form per project: backend · ui · engine · e2e · cli · …> (→ `sdd-engineering:implementer`) · `orchestrator` (done by run-plan itself) |
| Skills | `engineering-paved-path:<skill>`, … — the skills the implementer must read for this unit (security and typescript-expert are always preloaded) · "none" |
| Module | <module name from `modules`> |
| Wave | 0 · 1 · 2 … |
| Depends on | U… (or "none") |
| Owns (create/modify) | exact paths, incl. tests |
| Must not touch | anything notable the unit might be tempted to edit |
| Consumes | contracts/units it reads from (§3 names) |
| Produces | contracts/symbols other units rely on |
| Checks | `<checkCommand with {module} and {files} filled in>` · `<architectureCheck>` if it covers the module (full suite: plan-verifier, once per wave) |

**Steps**
1. …

**Acceptance criteria**
- [ ] observable behaviour, testable — SPEC-NN AC-n, EC-n

## 5. Waves (execution order)
| Wave | Units | Runs | Why this order |
|---|---|---|---|
| 0 | contracts, schema + migration, dependencies, shared registries, moves/deletes | sequential, by the orchestrator | everything else builds on it |
| 1 | … | parallel | disjoint files |

In **single-agent** mode every wave runs `sequential` (one unit per wave, in
order); disjoint ownership across waves is not required.

Serialized files that must belong to Wave 0 or to exactly one unit:
<module registries, central API client, i18n catalogs, DI container, migrations
(one new migration per wave), vendored / generated folders, agent docs>.

## 6. Test plan
| Module | Tests | Owner (unit) | Needs a running stack? |
|---|---|---|---|
| <module> | unit · integration · component · e2e flow | U… | no / Docker / DB / full stack |

## 7. Verification (orchestrator, after the last wave)
1. `checkCommand` per touched module, full (no files).
2. `architectureCheck`, if configured.
3. e2e flows / manual checks that need a running stack.
4. The project's pre-PR checks, if any.

## 8. Risks
What could go wrong, how it would show up, mitigation. Always check: migration
numbering, duplicated-contract drift, the architecture-check baseline,
security-sensitive paths.

## 9. Out of scope

### Spec follow-ups (owner: user / spec author)
Spec changes the accepted requirements need — never a work unit of this plan.
"none" if none.
