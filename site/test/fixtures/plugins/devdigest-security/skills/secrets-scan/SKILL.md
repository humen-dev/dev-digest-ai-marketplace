---
name: secrets-scan
description: Scan the working tree and history for leaked credentials and explain rotation.
keywords: secrets credentials leak gitleaks scan
allowed-tools:
  - "Bash(gitleaks:*)"
---

# Secrets scan

Run `gitleaks detect` on the working tree and history. For each finding, explain how to rotate the credential.
