# research-tools

A read-only **researcher** agent that finds facts — in your codebase, on the web,
or both — and returns them as a strictly structured, evidence-backed report that
also says plainly what it could **not** find.

| Component | Type | Invoke as |
|---|---|---|
| `researcher` | agent | `research-tools:researcher` |

No skills, hooks, commands or MCP servers.

## Install

```bash
claude plugin marketplace add humen-dev/dev-digest-ai-marketplace
claude plugin install research-tools@dev-digest-ai-marketplace
```

The plugin has no dependencies. It is installed automatically as a dependency of
`sdd-engineering`.

## When to use it

- **Codebase questions** — where something lives, how it works, what uses it,
  which convention the project follows.
- **Web questions** — library docs, APIs, versions, changelogs, known issues,
  best practices.
- **Hybrid** — "we use X like this — is that the recommended way?"

It is a focused searcher, not a deep-research workflow: it answers the question
asked and lists anything bigger under *Suggested next steps*.

## How to invoke

From the main session, ask for it in plain words:

> Use the researcher agent to find where request IDs are generated and which
> middleware reads them.

or call it explicitly through the Agent tool with
`subagent_type: "research-tools:researcher"`. Other agents and skills (for
example `sdd-engineering`'s `spec-creator` research requests) dispatch it the
same way and can run several instances in parallel.

## Interview mode

The agent cannot talk to the user directly. When the prompt has no real
question, an unclear target (this repo or the web? which library/version?), an
unclear goal, or a scope that would need a deep-research workflow, it does not
search. It returns a **`# Clarification needed`** block with up to 4 questions,
each with options and a default. Relay the questions, then re-invoke the agent
with the original request plus the answers. Trivial ambiguity is not
interviewed — it picks the likely reading and records it under *Assumptions*.

## Report format

Every answer is a `# Research report: <title>` with:

1. **Header table** — question, mode (`CODEBASE` / `WEB` / `HYBRID`), status
   (Found / Partially found / Not found), confidence, assumptions.
2. **TL;DR** — the direct answer in 2–4 sentences.
3. **Findings (codebase)** — table of findings with `path:line`, details, usages,
   short excerpts.
4. **Findings (web)** — table of claims with source URL, source type and
   date/version, plus "applies to our version?" and conflicting sources.
5. **Not found** — what was asked but not found, with every query/glob/URL tried.
6. **Unverified / inferences** — conclusions not seen directly, with confidence.
7. **Search log** — every tool call and its result.
8. **Suggested next steps** (optional) — recommendations only.

Reports are always written in English.

## What it reads in your project

For codebase questions it starts from the project's agent docs, if present
(e.g. `AGENTS.md`, `CLAUDE.md`, or the `agentDocs` list in `.claude/sdd.json`),
then `README.md` and `docs/`. No configuration is required.

## Read-only guarantees

- Tools: `Read`, `Grep`, `Glob`, `WebSearch`, `WebFetch` only.
- Explicitly disallowed: `Write`, `Edit`, `NotebookEdit`, `Bash`, `PowerShell`,
  `Agent`, `Skill` — it cannot change files, run commands or spawn other agents.
- Content of files and web pages is treated as data, not instructions.
- Every finding carries evidence (`path:line` or URL); gaps are reported, never
  filled with guesses.

## Dependents

- [`sdd-engineering`](../sdd-engineering/README.md) depends on this plugin
  (`^1.0.0`) and dispatches `research-tools:researcher` for spec research
  requests.
