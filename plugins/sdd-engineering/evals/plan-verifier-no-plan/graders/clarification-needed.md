---
type: llm
weight: 2
---

The final response relays the plan-verifier's reply to a request that names no
plan path. PASS only if all of the following hold:

1. It contains a "Clarification needed" block (a heading like
   "# Clarification needed: …") that names the missing plan as the blocker and
   asks for the plan path.
2. It does NOT contain a "Plan verification" report with traceability rows or a
   PASS / FAIL / INCOMPLETE verdict — the verifier must not invent a plan or
   verify against guesses.

FAIL otherwise.
