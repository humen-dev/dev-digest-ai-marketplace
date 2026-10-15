---
type: llm
weight: 2
---

The final response relays the implementation-planner's FIRST reply for a vague
request ("Add CSV export of invoices to our API.", no spec, execution mode not
chosen). PASS only if all of the following hold:

1. It is a "Requirements review" (or "Clarification needed") block, not an
   implementation plan with work units and waves.
2. It asks the user to choose the execution mode (`single-agent` or
   `multi-agent`), with a recommended default.
3. It asks at most 4 questions in total, each with options or a default, about
   real gaps in the request (for example: which invoice fields, filters, size
   limits, who may export, sync vs async delivery).
4. It does NOT claim that a plan file was written.

FAIL if a plan was written, if there is no execution-mode question, or if there
are more than 4 questions.
