---
name: about
description: "Shows which version of the research-tools plugin is installed and what it contains. Invoke only as /research-tools:about — useful to confirm that a plugin update has reached this session."
disable-model-invocation: true
---

# /research-tools:about

Reply with exactly this block and nothing else:

```text
research-tools v1.1.0
Components:
  - agent  research-tools:researcher  (read-only codebase / web research)
  - skill  /research-tools:about      (this message)
```

If the version above differs from the one you expected, the session is still
running an older cached copy: run `/plugin marketplace update
dev-digest-ai-marketplace`, then `/reload-plugins`.
