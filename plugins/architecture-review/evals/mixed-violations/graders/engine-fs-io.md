---
type: llm
weight: 1
---

The report flags the filesystem I/O (`readFileSync` / `existsSync`) in `engine/src/context/load-rules.ts` as a finding (the engine must not do I/O).
