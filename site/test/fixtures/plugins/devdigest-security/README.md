# DevDigest security

Audits and guards for day-to-day work. The PreToolUse hook inspects every Bash command before it runs.

## What it adds

- Skills: `secrets-scan`
- Agents: `security-auditor`
- Commands: `audit-deps`

## Install

```text
/plugin install devdigest-security@dev-digest-ai-marketplace
```

## What it runs

### block-dangerous

Blocks rm -rf, force-push and similar commands before they run.
