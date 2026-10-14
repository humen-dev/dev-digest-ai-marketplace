---
type: llm
weight: 2
---

The final response relays the spec-creator's FIRST reply for a vague feature
request ("Users should be able to export their data.", no designs). PASS only if
all of the following hold:

1. It contains a "Spec review" block (a heading like "# Spec review: …") — or,
   acceptable alternative, a "Clarification needed" block — rather than a
   finished specification.
2. It asks the user concrete questions about the vague request (for example:
   which data, which format, who may export, size limits, delivery method), each
   with options or a proposed default.
3. It does NOT claim that a spec file was written or created, and it does not
   contain a full specification with numbered EARS acceptance criteria presented
   as final (proposals inside the review are fine).

FAIL if a spec file was written, if the reply is a complete spec, or if there
are no questions.
