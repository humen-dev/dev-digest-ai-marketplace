# Contributing

## Add a plugin

1. Create `plugins/<plugin-name>/` following
   [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md)
   (`.claude-plugin/plugin.json`, components at the root, `README.md`).
2. Append an entry to `plugins[]` in `.claude-plugin/marketplace.json` with the
   **same** `name` and `"source": "./plugins/<plugin-name>"`.
3. Add a row to the plugin table in the root `README.md`.
4. Run the checks and try the plugin locally:

   ```bash
   node scripts/validate-marketplace.mjs
   claude plugin validate . --strict
   claude plugin marketplace add ./
   claude plugin install <plugin-name>@dev-digest-ai-marketplace
   ```

5. Open a PR; the template has the full checklist.

## Change a plugin

- Edit files under its folder; with a local marketplace run `/reload-plugins`
  to pick up changes without reinstalling.
- If the plugin pins `version`, bump it in `plugin.json` in the same PR
  ([docs/RELEASES.md](docs/RELEASES.md)).
- Changes to hooks, scripts or `.mcp.json` follow
  [docs/SECURITY.md](docs/SECURITY.md) and need a code-owner review.

## Catalog rules

- `marketplace.json` is effectively **append-only** for users: never reuse or
  silently change a published plugin name.
- Rename or remove only through `renames` (see RELEASES.md).
- Keep `version` in `plugin.json` only, never in the marketplace entry.
- No files from outside a plugin's folder, no Git LFS.

## Syncing from DevDigest

Plugins here are **copies** of skills/agents that originate in
[humen-dev/dev-digest](https://github.com/humen-dev/dev-digest). When you port
one:

- Strip references to paths that exist only in the DevDigest checkout, or make
  them relative to the user's project.
- Note the source path in the plugin README (`Ported from dev-digest: <path>`)
  so later changes can be synced back and forth.

## Commits

Short imperative subject, scoped by plugin when relevant:
`devdigest-backend: add drizzle migration skill`.
