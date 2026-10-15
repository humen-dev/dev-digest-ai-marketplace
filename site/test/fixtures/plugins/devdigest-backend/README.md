# DevDigest backend conventions

Installs the patterns the backend guild reviews against. Migrations must be reversible and announce their lock time; endpoints validate at the edge and map domain errors to problem+json.

Setup: export a read-only DATABASE_URL before starting Claude Code so the postgres server can connect.

## What it adds

- Skills: `db-migration`, `api-endpoint`
- Agents: `backend-reviewer`
- Commands: `migrate-check`

## Install

```text
/plugin install devdigest-backend@dev-digest-ai-marketplace
```

## What it runs

### DATABASE_URL

Use a read-only role; the server can run any query the role allows.
