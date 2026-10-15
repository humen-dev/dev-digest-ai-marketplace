---
description: Generate notes for the range since the last tag.
keywords: tag range
allowed-tools:
  - "Bash(git log:*)"
---

Generate release notes for $ARGUMENTS, defaulting to the range from the last tag to HEAD.

Use `git log` to collect commits and group them by conventional-commit type.
