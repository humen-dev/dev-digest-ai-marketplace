#!/usr/bin/env node
/**
 * sdd-engineering PreToolUse guard for Write|Edit — wired in hooks/hooks.json:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/write-guard.mjs"
 *
 * Acts only when the hook payload's `agent_type` is one of this plugin's
 * write-restricted agents; the main session and every other agent (including
 * other plugins' agents and sdd-engineering:implementer, whose scope is the
 * plan's file ownership) pass through untouched.
 *
 *   sdd-engineering:spec-creator           → only *.md under `specsDir` or a
 *                                            module's `specsDir` (never the spec
 *                                            template, never `_TEMPLATE.md`)
 *   sdd-engineering:implementation-planner → only *.md directly in `plansDir`
 *   sdd-engineering:plan-verifier          → nothing (read-only)
 *
 * Directories come from the project's `.claude/sdd.json` (defaults: `specs/`,
 * `docs/plans/`). Paths are resolved against the hook's `cwd`; anything outside
 * the project (`..`, absolute paths elsewhere) is blocked. Fail-closed: a
 * malformed sdd.json, a missing file_path or unreadable input blocks the write.
 */
import { allow, agentType, block, isUnder, projectRelative, projectRoot, readPayload, samePath } from './lib/guard-io.mjs';
import { loadConfig, normalizeDir, specDirs } from './lib/sdd-config.mjs';

const GUARD = 'write-guard';
const SPEC = 'sdd-engineering:spec-creator';
const PLANNER = 'sdd-engineering:implementation-planner';
const VERIFIER = 'sdd-engineering:plan-verifier';
const GUARDED = new Set([SPEC, PLANNER, VERIFIER]);

const payload = readPayload(GUARD);
const agent = agentType(payload);
if (!agent || !GUARDED.has(agent)) allow();

const name = agent.slice('sdd-engineering:'.length);

if (agent === VERIFIER) {
  block(GUARD, `${name} is read-only — it may not write or edit files. Report the finding with file:line evidence instead.`);
}

const { config, error } = loadConfig(projectRoot(payload));
if (error) block(GUARD, `${error} — fix the project config before ${name} writes anything.`);

const filePath = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
if (typeof filePath !== 'string' || !filePath.trim()) block(GUARD, `${name} may not write without a file_path — refusing the write.`);

const rel = projectRelative(payload, filePath);
const isMd = (p) => /\.md$/i.test(p);

if (agent === SPEC) {
  const dirs = specDirs(config);
  const shown = dirs.map((d) => (d ? `${d}/` : './')).join(', ');
  const instead = `write only Markdown specs under ${shown}; put code, plan or test changes into the spec as requirements or open questions instead of making them.`;
  if (!rel) block(GUARD, `${name} may not write outside the project (${filePath}); ${instead}`);
  const template = config.specTemplate ? normalizeDir(config.specTemplate) : null;
  if (/(^|\/)_TEMPLATE\.md$/i.test(rel) || (template && samePath(rel, template))) {
    block(GUARD, `${name} may not edit the spec template (${rel}); ${instead}`);
  }
  if (!isMd(rel) || !dirs.some((d) => isUnder(rel, d))) block(GUARD, `${name} may not write ${rel}; ${instead}`);
  allow();
}

if (agent === PLANNER) {
  const plans = normalizeDir(config.plansDir) ?? 'docs/plans';
  const shown = plans ? `${plans}/` : './';
  const instead = `implementation-planner writes only Markdown plans directly in ${shown} — put a code change into the plan as a work unit and a spec change under "Spec follow-ups".`;
  if (!rel) block(GUARD, `${name} may not write outside the project (${filePath}); ${instead}`);
  const inside = isUnder(rel, plans) && !rel.slice(plans ? plans.length + 1 : 0).includes('/');
  if (!isMd(rel) || !inside) block(GUARD, `${name} may not write ${rel}; ${instead}`);
  allow();
}

block(GUARD, `no rule for ${agent} — refusing the write.`);
