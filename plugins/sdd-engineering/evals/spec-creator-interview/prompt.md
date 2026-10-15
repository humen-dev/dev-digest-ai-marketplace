---
runs: 2
max_turns: 10
allowed_tools: [Agent, Read, Glob, Grep]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
tags: [smoke, spec-creator]
---

Use the sdd-engineering:spec-creator agent to start a spec for this feature.

- Feature: "Users should be able to export their data."
- Mode: create
- Design sources: none — text only, no designs, no code paths.

Relay the agent's reply to me verbatim. Do not answer its questions yourself and
do not invoke it a second time.
