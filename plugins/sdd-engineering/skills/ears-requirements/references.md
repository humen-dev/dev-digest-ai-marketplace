# References

- Alistair Mavin, Philip Wilkinson, Adrian Harwood, Mark Novak — *Easy Approach
  to Requirements Syntax (EARS)*, 17th IEEE International Requirements
  Engineering Conference (RE'09), 2009, pp. 317–322. Origin of the five patterns
  and the keyword order.
- INCOSE *Guide to Writing Requirements* — the per-requirement quality
  characteristics behind the checklist (singular, unambiguous, verifiable,
  implementation-free, conforming).
- This plugin: the spec template (`templates/spec.md` in the sdd-engineering
  plugin, or the project's own `specTemplate` from `.claude/sdd.json`) is where
  EARS requirements live; `sdd-engineering:spec-creator` writes them with this
  skill preloaded; `sdd-engineering:plan-verifier` turns each one into an
  `S<NN>-AC|EC|NFR-<k>` row and checks it by the test shape in the table at the
  end of `SKILL.md`.
