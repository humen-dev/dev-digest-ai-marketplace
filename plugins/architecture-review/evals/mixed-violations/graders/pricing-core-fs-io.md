---
type: llm
weight: 1
---

The report flags the filesystem I/O (`readFileSync` / `existsSync`) in `pricing-core/src/rules/load-price-rules.ts` as a finding (the pricing-core library must not do I/O).
