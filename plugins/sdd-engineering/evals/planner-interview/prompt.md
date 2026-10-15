---
runs: 2
max_turns: 10
allowed_tools: [Agent, Read, Glob, Grep]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
tags: [smoke, implementation-planner, cost]
---

Use the sdd-engineering:implementation-planner agent to plan this change.

- Request: "Add CSV export of invoices to our API."
- Source: this request only — no spec file, no design brief.
- Execution mode: not chosen yet.

Relay the agent's reply to me verbatim. Do not answer its questions yourself and
do not invoke it a second time.
