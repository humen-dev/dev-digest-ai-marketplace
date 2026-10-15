---
name: db-migration
description: Reversible Postgres migrations with rollback plan and lock-time estimate.
keywords: migration database postgres schema sql rollback міграція
---

# Postgres migrations

## Rules

- Every migration has an up and a down step.
- Estimate lock time for each statement on large tables.
- Prefer `CREATE INDEX CONCURRENTLY`.

## Rollback plan

State how to revert and what data is lost.
