---
runs: 2
max_turns: 3
allowed_tools: []
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
tags: [smoke, trace]
---

Which version of the sdd-engineering plugin is active in this session? Answer
from what this session was told at start — do not run any tools. Reply with
exactly one line: `sdd-engineering <version>`, or `sdd-engineering unknown` if
you were not told.
