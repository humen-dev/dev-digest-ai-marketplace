---
description: Dry-run pending migrations against a shadow database.
keywords: migration check database міграція
allowed-tools:
  - "Bash(npx prisma:*)"
---

Run `npx prisma migrate diff` against a shadow database and report the pending statements and their lock impact.
