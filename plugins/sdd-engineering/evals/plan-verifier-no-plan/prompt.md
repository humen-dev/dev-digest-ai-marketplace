---
runs: 2
max_turns: 8
allowed_tools: [Agent, Read, Glob, Grep]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
tags: [smoke, plan-verifier]
---

Use the sdd-engineering:plan-verifier agent to verify that the latest wave was
implemented correctly. I don't have a plan path handy — just pass the request on
as it is.

Relay the agent's reply to me verbatim. Do not search for a plan yourself and do
not invoke the agent a second time.
