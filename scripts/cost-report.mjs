#!/usr/bin/env node
// Cost per successful workflow from a `claude plugin eval --json` result, and
// the cost quality gate from docs/COST-BASELINE.md. No dependencies.
//
// Usage:
//   node scripts/cost-report.mjs <results.json> [--workflow case1,case2]
//        [--baseline <usd>] [--max-increase <fraction>] [--summary <out.json>]
//
// Per case: agent cost of every run (judge calls excluded — they price the
// test, not the workflow) divided by the number of passed runs. A workflow is
// the chain of cases in --workflow (default: planner-interview,planner-fast-path,
// one planning round trip); its cost per success is the sum over those cases.
// Exit 1 when a workflow case has a failed run, or when --baseline is given and
// the cost per successful workflow exceeds baseline × (1 + max-increase).

import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!file) {
  console.error('usage: node scripts/cost-report.mjs <results.json> [--workflow a,b] [--baseline usd] [--max-increase 0.1] [--summary out.json]');
  process.exit(2);
}

const result = JSON.parse(readFileSync(file, 'utf8'));
const workflow = opt('--workflow', 'planner-interview,planner-fast-path').split(',');
const baseline = opt('--baseline') === undefined ? null : Number(opt('--baseline'));
const maxIncrease = Number(opt('--max-increase', '0.1'));

const round = (n) => Math.round(n * 10000) / 10000;
const cases = result.cases.map((c) => {
  const runs = c.arms.with;
  const passed = runs.filter((r) => r.passed).length;
  const agentCost = runs.reduce((sum, r) => sum + r.costUsd, 0);
  return {
    name: c.name,
    runs: runs.length,
    passed,
    score: round(c.aggregates.score),
    agentCostUsd: round(agentCost),
    costPerSuccessUsd: passed ? round(agentCost / passed) : null,
    runCostsUsd: runs.map((r) => round(r.costUsd)),
    turns: runs.map((r) => r.turns),
  };
});

const steps = workflow.map((name) => cases.find((c) => c.name === name));
const missing = workflow.filter((_, i) => !steps[i]);
const failing = steps.filter((c) => c && c.passed < c.runs).map((c) => c.name);
const perWorkflow = missing.length || steps.some((c) => c && c.costPerSuccessUsd === null)
  ? null
  : round(steps.reduce((sum, c) => sum + c.costPerSuccessUsd, 0));

const summary = {
  claudeVersion: result.claudeVersion,
  startedAt: result.startedAt,
  plugins: result.suite.plugins.map((p) => `${p.name}@${p.version}`),
  suiteCostUsd: round(result.costUsd),
  partial: result.partial,
  workflow,
  costPerSuccessfulWorkflowUsd: perWorkflow,
  cases,
};

console.log(`${summary.plugins.join(', ')} — ${summary.startedAt}`);
console.log('CASE                     PASS   COST/SUCCESS  RUN COSTS');
for (const c of cases) {
  const per = c.costPerSuccessUsd === null ? 'n/a' : `$${c.costPerSuccessUsd.toFixed(3)}`;
  console.log(`${c.name.padEnd(24)} ${`${c.passed}/${c.runs}`.padEnd(6)} ${per.padEnd(13)} ${c.runCostsUsd.map((v) => `$${v.toFixed(3)}`).join(' ')}`);
}
console.log(`cost per successful workflow (${workflow.join(' → ')}): ${perWorkflow === null ? 'n/a' : `$${perWorkflow.toFixed(3)}`}`);

const problems = [];
if (result.partial) problems.push('partial run');
if (missing.length) problems.push(`workflow cases missing: ${missing.join(', ')}`);
if (failing.length) problems.push(`workflow cases with failed runs: ${failing.join(', ')}`);
if (baseline !== null && perWorkflow !== null) {
  const limit = baseline * (1 + maxIncrease);
  const delta = (perWorkflow - baseline) / baseline;
  console.log(`baseline $${baseline.toFixed(3)} → ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}% (limit $${limit.toFixed(3)})`);
  if (perWorkflow > limit) problems.push(`cost per successful workflow $${perWorkflow.toFixed(3)} exceeds $${limit.toFixed(3)}`);
}

const out = opt('--summary');
if (out) writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);

if (problems.length) {
  console.log(`✗ cost gate: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('✓ cost gate passed');
