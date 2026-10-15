# architecture-review

A read-only **architecture reviewer** agent: it checks that a change set puts
every file in the right ring/layer and that imports point the allowed way, and
returns a verdict with `file:line` findings. It judges placement against the
`onion-architecture` (backend) and `frontend-ui-architecture` (frontend) skills
plus your project's own architecture docs, and runs your automated architecture
check only if you configured one.

| Component | Type | Invoke as |
|---|---|---|
| `architecture-reviewer` | agent | `architecture-review:architecture-reviewer` |
| Bash guard | `PreToolUse` hook (`Bash`) | automatic — see [Hook](#hook-bash-guard) |
| eval suite | `evals/` | `claude plugin eval plugins/architecture-review` |

## Install

```bash
claude plugin marketplace add humen-dev/dev-digest-ai-marketplace
claude plugin install architecture-review@dev-digest-ai-marketplace
```

This also installs and enables its dependency
[`engineering-paved-path`](../engineering-paved-path/README.md) (`^1.0.0`),
whose `onion-architecture` and `frontend-ui-architecture` skills the agent
preloads (`engineering-paved-path:onion-architecture`,
`engineering-paved-path:frontend-ui-architecture`).

## When to use it

After a feature or an implementation wave is done and before the final pre-PR
review — to catch an ORM query in a route handler, a vendor SDK outside the
adapters folder, an HTTP type in a service, `fetch` in a React component, a
reach-in to another module's internals, and similar placement problems. It does
**not** review correctness, style, tests or security exploitability.

## How to invoke

Ask in plain words:

> Use the architecture-reviewer agent to review my branch.

or call it through the Agent tool with
`subagent_type: "architecture-review:architecture-reviewer"`.

### Inputs (in the prompt)

| Input | Default | Meaning |
|---|---|---|
| `range` | `git merge-base main HEAD` .. working tree (committed + staged + unstaged + untracked) | Git range to review. |
| `paths` | — | Review these files/folders as they are now, instead of a range. |
| `plan` | — | A plan file whose unit ownership / placement columns state the intended placement. Plan-vs-skill conflicts are reported, not silently followed. |
| `previous` | — | A prior report (text or path). Switches to **re-review mode**: each previous `A-<k>` finding is marked fixed / open / withdrawn, and only the fix `range` is reviewed for new findings. |

**Interview mode:** if the scope cannot be determined (empty change set, a
missing `plan` file) the agent returns a `# Clarification needed` block with up
to 4 questions instead of a review. Relay them and re-invoke with the answers.

### Output

```markdown
## Architecture review — <range>
| Field | Value |      # Verdict · Architecture check · Scope files
### Findings (confidence ≥ 80 only)
| ID | Severity | Confidence | Rule | Location file:line | Evidence | Target location |
### Pre-existing drift touched (does not affect verdict, max 5)
### Not reviewed
```

- Severities: **CRITICAL** (confirmed rule break or a check violation),
  **WARNING** (judgement-dependent), **SUGGESTION** (a better home exists).
- Only findings with confidence ≥ 80 are reported; each has a target location.
- Verdict is a pure function of the findings: any CRITICAL → `request_changes`;
  findings without CRITICAL → `comment`; none → `approve`.
- If the review cannot be done (range does not resolve, the configured check
  fails to run, the plan is missing) the first line is `BLOCKED: …`.

## Configuration — `.claude/sdd.json`

Optional, in the root of the project being reviewed. Missing file or keys use
the defaults. The same file is shared with `sdd-engineering`.

| Key | Default | Used for |
|---|---|---|
| `architectureCheck` | none | Shell command of your automated architecture check. The agent runs it exactly as configured (it may append output flags) and reports each violation as CRITICAL. **If absent, the agent reports "Architecture check: not configured" and reviews by reading — it never assumes dependency-cruiser or any other tool.** |
| `modules` | `[{ "name": "root", "path": "." }]` | Your modules/packages. The agent groups the change set by module and picks the backend/frontend lens per module; the Bash guard allows `cd` only into these paths. |
| `agentDocs` | `AGENTS.md`, `CLAUDE.md` if present | Your architecture docs. Layer names, allowed imports, path aliases, security-critical paths and known drift written there become review criteria. |

Example:

```json
{
  "architectureCheck": "npx depcruise src --config .dependency-cruiser.cjs",
  "modules": [
    { "name": "api", "path": "packages/api", "kind": "backend" },
    { "name": "web", "path": "packages/web", "kind": "frontend" }
  ],
  "agentDocs": ["AGENTS.md", "docs/architecture.md"]
}
```

`architectureCheck` may contain several segments (e.g.
`cd packages/api && npm run lint:arch`) but must not contain redirection,
`$`, backticks, a background `&` or `tee` — the guard rejects such a config.

## Hook: Bash guard

`hooks/hooks.json` registers one hook:

| Event | Matcher | Runs |
|---|---|---|
| `PreToolUse` | `Bash` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/bash-guard.mjs"` |

Plugin agents ignore `hooks` in their frontmatter, so the guard is a
plugin-level hook. It fires for every Bash call in every session where the
plugin is enabled, but is **inert unless** the hook input's `agent_type` is
`architecture-review:architecture-reviewer`: for the main session and all other
agents it exits 0 immediately with no output.

For the reviewer it is an allow-list. The command is split on `&&`, `||`, `;`,
`|` and newlines, and **every** segment must be one of:

- `cd <path>` where `<path>` is a `modules[].path` from `.claude/sdd.json`;
- read-only git: `git status | diff | log | show | merge-base | rev-parse |
  ls-files | ls-tree | cat-file | blame | describe …`, `git branch
  [--show-current | --list | -a | -r | -v]` — no `--output`/`-o`, no
  `--ext-diff`, no `git -c …` / `git -C …`;
- the configured `architectureCheck` (token-prefix match; extra arguments may
  follow it).

Blocked before any of that, anywhere in the command: redirection (`<`, `>`),
backticks, `$` expansion/substitution, background `&`, `tee`, and `VAR=x`
prefixes. Everything else (installs, builds, tests, `rm`, `cat`, git writes …)
is blocked. A block exits with code 2 and a stderr reason that lists what the
agent may run instead. For the reviewer the guard fails closed: unreadable hook
input or an unreadable/unsafe `.claude/sdd.json` blocks the command.

The script is self-contained Node (built-ins only), reads only the hook input and
`.claude/sdd.json` (searched from the hook's `cwd` upwards to the repository
root), makes no network calls and writes nothing.

Tests:

```bash
node --test "plugins/architecture-review/scripts/*.test.mjs"
```

## Evals

`evals/` holds five `claude plugin eval` cases. Each prompt inlines a diff of a
neutral sample commerce app — the same one the architecture skills use
(`api/` backend with `src/modules/orders|payments|…`, `web/` Next.js admin UI,
`pricing-core/` pure library) — plus its architecture
notes and asks the main session to delegate to the agent; graders check:

| Case | What it checks |
|---|---|
| `server-route-drizzle` | ORM query and a business rule in a new route handler → CRITICAL, target repository, check not claimed as passed |
| `client-fetch` | `fetch` in a component → CRITICAL, target data hook; cross-route `_components` import |
| `server-service-request` | HTTP request type leaking into a service → CRITICAL; unchanged pre-existing drift ignored |
| `client-warnings-only` | judgement-level issues only → no CRITICAL, verdict `comment`/`approve` |
| `mixed-violations` | many problems at once — every CRITICAL survives (SDK outside adapters, I/O in the pure library, security-critical constant change, relative reach-in) |

Every case has one `tool_used` grader (the agent was dispatched; counted only
in the with-plugin arm) and one `llm` rubric grader per expected behaviour.

```bash
claude plugin eval plugins/architecture-review --threshold 0.7
claude plugin eval plugins/architecture-review --case client-fetch --runs 1
```

Runs cost model tokens (default 3 runs per case plus a no-plugin baseline arm;
use `--ablation none` to skip the baseline). Results are written to
`plugins/architecture-review/evals/results/` — do not commit them.

## Dependencies and dependents

- Depends on [`engineering-paved-path`](../engineering-paved-path/README.md)
  `^1.0.0` (preloaded architecture skills).
- Used by [`sdd-engineering`](../sdd-engineering/README.md): its `run-plan`
  skill dispatches `architecture-review:architecture-reviewer` in the review
  loop after the implementation waves.
