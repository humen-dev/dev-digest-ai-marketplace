---
name: ears-requirements
description: "Write and review testable requirements with EARS (Easy Approach to Requirements Syntax). Use whenever acceptance criteria, edge-case rules, NFRs or untrusted-input rules are written or reviewed for a spec (the project's specs folder, written by sdd-engineering:spec-creator), when a requirement sounds vague ('should work well', 'handle errors properly'), or when checking that a criterion can be verified by a test. Covers the five EARS patterns plus complex combinations, choosing system names from the project's own glossary, a vague-word blacklist, rewrite rules and a per-requirement quality checklist. Not for implementation plans (sdd-engineering:implementation-planner) or test code."
---

# EARS requirements

EARS constrains every requirement to one sentence template so that the
**condition** (when it applies) is separated from the **response** (what the
system observably does). A requirement written this way can be read by a human,
planned by `sdd-engineering:implementation-planner` and checked by
`sdd-engineering:plan-verifier` without interpretation. See `examples.md` for
bad → good rewrites on a neutral sample application and `references.md` for sources.

## The five patterns (+ complex)

| Pattern | Keyword | Template | Use for |
|---|---|---|---|
| Ubiquitous | — | The `<system>` shall `<response>`. | invariants that always hold (rare — most behaviour has a trigger) |
| Event-driven | **WHEN** | WHEN `<trigger>`, the `<system>` shall `<response>`. | a reaction to a discrete event (click, request, webhook, job finished) |
| State-driven | **WHILE** | WHILE `<state>`, the `<system>` shall `<response>`. | behaviour that lasts as long as a state holds (upload in progress, offline) |
| Unwanted behaviour | **IF … THEN** | IF `<unwanted condition>`, THEN the `<system>` shall `<response>`. | errors, failures, invalid or hostile input, timeouts, limits exceeded |
| Optional feature | **WHERE** | WHERE `<feature/config is present>`, the `<system>` shall `<response>`. | behaviour that exists only with a flag, setting, provider or integration |
| Complex | combined | WHERE … , WHILE … , WHEN/IF … , the `<system>` shall `<response>`. | several conditions at once — keep the keyword order **WHERE → WHILE → WHEN / IF** |

- **Trigger vs state.** A trigger is an instant (`WHEN the user clicks Pay`); a
  state is a duration (`WHILE a payment is pending`). Mixing them is the
  most common pattern error.
- **WHEN vs IF.** Expected events → `WHEN`. Anything the system must survive
  rather than serve (failure, invalid input, attack, limit) → `IF … THEN`.
- The EARS keywords are written in **English capitals** (whatever language the
  rest of the spec uses) and `shall` marks the mandatory verb — one `shall` per
  requirement.

## System names

Use exactly one subject per requirement, taken from **the project's own system
names**, so every requirement points at one module. Where to find them, in order:

1. the spec's own glossary / *Module interactions* section (the spec template
   has one — define the names there first);
2. the project's agent docs (`AGENTS.md`, `CLAUDE.md`, … as listed in
   `agentDocs` of `.claude/sdd.json`) and module READMEs;
3. the `modules` list in `.claude/sdd.json` — one subject per module.

Typical shape (a sample application with a web client, an API and a worker):

| Subject | Module |
|---|---|
| the web app | the browser client |
| the API | the HTTP backend |
| the worker | the background job runner |
| `<product name>` | cross-module behaviour only — prefer splitting into per-module requirements when the response belongs to one module |

Name a subject once in the glossary, then use it verbatim; never alternate
synonyms ("the server", "the backend", "the API") for one module.

## Writing rules

1. **One requirement, one response.** No `and` / `or` joining two behaviours —
   split into two IDs. (`and` inside one object, e.g. "the counts and their
   labels", is fine.)
2. **Observable response.** Something a test, a user or a log can see: a value,
   a message, a state, an HTTP status, a stored row, a rendered element, a call
   that is *not* made. Not an intention ("try to", "aim to").
3. **Measurable qualities.** Numbers with units and conditions — `within 2 s for
   an invoice of ≤ 500 line items on the seeded dataset`, `at most 1 call to the
   payment provider per checkout`. No number → it is an *Open question*, not a requirement.
4. **No implementation.** No component, hook, file, library, table design or
   algorithm in the response. Existing external contracts (an endpoint path, a
   CLI flag, an error code) may be named because other modules depend on them.
5. **No escape clauses.** Never `if possible`, `as appropriate`, `where
   feasible`, `etc.`, `and so on`, `TBD`.
6. **Prefer positive responses.** `shall not` is allowed only when the forbidden
   outcome is itself observable (`shall not send the card number to the analytics service`); otherwise
   state what happens instead.
7. **Active voice, explicit subject.** "The API shall reject …", never "the
   request shall be rejected".
8. **Defined terms only.** Use domain words exactly as the code/contracts name
   them (e.g. order, invoice, status `draft | paid | void`). A new term is
   defined once in the spec before it is used.
9. **Scope universal words.** `always`, `never`, `all`, `every` need a scope
   (`every line item of the selected invoice`).

## Vague-word blacklist

Replace on sight — each one hides an untestable requirement:

`fast, quick, responsive, efficient, performant` → a time/size bound ·
`user-friendly, intuitive, nice, clean, easy` → the concrete interaction ·
`properly, correctly, appropriately, gracefully, robust, reliable` → the exact
response per failure · `handle, support, manage, deal with, process` → what is
returned/shown/stored · `should, may, might, could, can, will` → `shall` (or move
to *Non-goals* / *Open questions*) · `some, several, many, large, small, minimal`
→ a number · `etc., and so on, and/or, TBD, if possible, as needed`.

## Turning other spec sections into EARS

- **Edge case** → usually an `IF … THEN` requirement, or a `WHILE` for a
  lasting state (empty list, offline).
- **NFR** → a ubiquitous or event-driven requirement with a measured bound and
  the measurement condition.
- **Untrusted input** → `IF <input> contains <hostile shape>, THEN the
  <system> shall <neutralising response>` — one per input × threat (prompt
  injection, HTML/Markdown injection, path traversal, SSRF, oversized payload).
- **Optional/config behaviour** → `WHERE` — and write the behaviour for the
  disabled case too, or state it is unchanged.
- **UI state** (loading / empty / error / partial) → `WHILE` for the state,
  `IF … THEN` for the error, each with what the user sees and can do next.

## Quality checklist (per requirement)

- [ ] exactly one EARS pattern, correct keyword order, exactly one `shall`
- [ ] subject is one of the project's system names (defined in the spec)
- [ ] trigger is an event (WHEN/IF) or the precondition is a state (WHILE)
- [ ] response is observable and singular; no blacklisted word
- [ ] numbers have units and measurement conditions
- [ ] implementation-free (no files, components, libraries, SQL)
- [ ] traceable — has an ID (`AC-n`, `EC-n`, `NFR-n`) and a story/source
- [ ] verifiable — you can name the test shape (see below)

## How each pattern is verified

| Pattern | Test shape `plan-verifier` expects |
|---|---|
| Ubiquitous | invariant / property test over all relevant inputs |
| Event-driven | arrange state → fire the trigger → assert the response |
| State-driven | put the system in the state → assert the response, then leave the state → assert it stops |
| Unwanted behaviour | fault injection (stubbed failure, hostile fixture, timeout) → assert the response |
| Optional feature | run twice — feature on (response present) and off (unchanged behaviour) |

If you cannot name the test, the requirement is not finished.
