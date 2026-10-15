# sdd-engineering — releases

SemVer (Mode B in the marketplace's `docs/RELEASES.md`): `version` lives in
`.claude-plugin/plugin.json` only; each release is tagged
`sdd-engineering--v<version>` after merge. MAJOR — a removed or renamed agent,
skill or `.claude/sdd.json` key, or changed hook behaviour; MINOR — a new
component or option; PATCH — fixes and wording.

## 1.0.0 — 2026-10-14

Initial release: the Spec-Driven Development workflow as a plugin.

### Contents

- **Agents:** `spec-creator` (EARS spec, interview first), `implementation-planner`
  (plan of units and waves, interview first), `implementer` (one work unit;
  replaces the three Kind-specific implementers — preloads only
  `engineering-paved-path:security` and `engineering-paved-path:typescript-expert`
  and reads the unit's *Skills* from absolute paths), `plan-verifier`
  (read-only plan/spec compliance gate).
- **Skills:** `/sdd-engineering:run-plan` (renamed from `/impl`; manual only),
  `/sdd-engineering:workflow-retro` (manual only), `ears-requirements`
  (project-neutral system names and examples).
- **Hooks:** `PreToolUse` `Write|Edit` → `scripts/write-guard.mjs`,
  `PreToolUse` `Bash` → `scripts/bash-guard.mjs`. Active only for
  `sdd-engineering:*` agents; inert for the main session and other plugins.
- **Templates:** `templates/spec.md`, `templates/plan.md`.
- **Configuration:** optional `.claude/sdd.json` (`specsDir`, `specTemplate`,
  `plansDir`, `checkCommand`, `architectureCheck`, `modules`, `agentDocs`,
  `runStateDir`) with `{module}` / `{files}` command placeholders.
- **Run state** moved out of the project's Claude config folder to
  `<runStateDir>/run-plan/<slug>/` and `<runStateDir>/retro/` (default `.sdd/`).
- **Review loop v1:** `plan-verifier` after every wave,
  `architecture-review:architecture-reviewer` and a bugs review by a
  `general-purpose` subagent. No security reviewer.
- **Evals:** smoke suite in `claude plugin eval` format
  (`spec-creator-interview`, `plan-verifier-no-plan`).
- **Docs:** `README.md` (flow diagram, agents, skills, hooks, artifacts,
  worked example, troubleshooting), this file.

### Required dependencies

| Plugin | Range |
|---|---|
| `engineering-paved-path` | `^1.0.0` |
| `research-tools` | `^1.0.0` |
| `architecture-review` | `^1.0.0` |

### Known limitations

- The guards rely on `agent_type` in the hook input (`sdd-engineering:<agent>`
  inside plugin subagents — verified on Claude Code 2.1.299). A Claude Code
  version that omits it leaves the guards inert (fail open for the agents,
  never blocking anyone else).
- The implementer is not write-guarded; its file scope is the plan's ownership,
  checked after the fact by `plan-verifier`.
- Skill paths for the implementer are resolved by walking the plugin cache
  layout (`<cache>/<marketplace>/<plugin>/<version>/`) with a `Glob` fallback;
  a different cache layout needs the fallback.
- The Bash guard's built-in test runners are JavaScript ones
  (`pnpm|npm|yarn`, `vitest`); other stacks must configure `checkCommand`.
  Configured commands may not contain redirection, `$`, backticks or `&` —
  wrap them in a script.
- No security reviewer in the `run-plan` review loop (candidate for a future
  `security-review` dependency); the project's pre-PR checks are optional and
  only run if configured.
- `next-best-practices` (in `engineering-paved-path`) declares no licence
  upstream; see that plugin's `THIRD_PARTY_NOTICES.md` — it must be replaced by
  the MIT skill from `vercel/next.js` before the marketplace goes public.
