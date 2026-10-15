---
name: release-notes
description: Draft user-facing release notes from merged PRs and conventional commits, grouped by impact.
keywords: changelog announce version реліз нотатки випуск
allowed-tools:
  - "Bash(git log:*)"
  - "Bash(gh pr list:*)"
---

# Release notes

## Steps

1. List merged pull requests since the last tag with `gh pr list`.
2. Group them by impact: breaking, features, fixes.
3. Draft one line per change in plain language.

## Output

A Markdown section ready to paste into the GitHub release.
