# Releases

How plugin versions reach users, and how to update, rename or roll back.
Reference: [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace),
[Plugin loading](https://code.claude.com/docs/en/plugins/loading).

## How Claude Code picks a version

1. `version` in the plugin's `plugin.json`, else
2. `version` in its marketplace entry, else
3. the git commit SHA of the source.

A user gets an update only when that value changes. **If you pin `version` and
forget to bump it, users never receive new commits.**

Set `version` in `plugin.json` only — never in both places (`claude plugin
validate` warns).

## Two modes

### Mode A — commit-tracked (default while a plugin is changing fast)

- Omit `version` everywhere.
- Every merged commit to `main` is a new version.
- Use for plugins under active development.

### Mode B — SemVer (for stable plugins)

- Set `"version": "MAJOR.MINOR.PATCH"` in `plugin.json`.
  - MAJOR — removed/renamed skill, agent or command; changed hook behaviour.
  - MINOR — new component or option.
  - PATCH — fixes and wording.
- Bump it in the same PR as the change.
- After merge, tag the release:

  ```bash
  claude plugin tag plugins/<plugin-name> --dry-run
  claude plugin tag plugins/<plugin-name> --push
  ```

  Tags look like `<plugin-name>--v<version>`; dependency ranges resolve against them.

Switching a plugin from A to B is a normal PR: add `version` and note it in the
plugin README.

## How users receive updates

- Auto-update is **off** by default for this marketplace. Users either enable it
  in `/plugin` → Marketplaces, or run:

  ```text
  /plugin marketplace update dev-digest-ai-marketplace
  ```

- The running session keeps the old version until `/reload-plugins` or restart.
- Old cached versions are removed 14 days after update.

## Rollback

- **Mode A:** revert the commit on `main` (`git revert <sha>`); the revert is a
  new SHA, so users update to it.
- **Mode B:** revert the change **and bump the version forward** (e.g. 1.4.0 →
  1.4.1). Never decrease a version — clients will not "update" to a lower one.

## Rename or remove a plugin

The catalog is append-only from the user's point of view.

- **Rename:** add the new entry, remove the old one, and map it in the
  top-level `renames` object of `marketplace.json`:

  ```json
  "renames": { "old-name": "new-name" }
  ```

- **Remove:** delete the entry and map it to `null` in `renames`. Set
  `"forceRemoveDeletedPlugins": true` only if installed copies must be
  uninstalled.

## Planned automation

Not built yet. Add these when the first plugin switches to Mode B — in Mode A a
merge is the release and `git revert` is the rollback, so they add nothing.

- [ ] **`scripts/bump-version.mjs <plugin> patch|minor|major`** — bumps
  `version` in the plugin's `plugin.json` only, refuses if the marketplace entry
  also has `version`, then runs `scripts/validate-marketplace.mjs`.
- [ ] **Auto-tag workflow** (`.github/workflows/release.yml`) — on push to
  `main`, for every plugin whose `plugin.json` `version` changed, run
  `claude plugin tag plugins/<name> --push`. Needs `contents: write`.
- [ ] **`scripts/rollback.mjs <plugin> <tag>`** — restores
  `plugins/<plugin>/` from a known-good tag
  (`git restore --source=<plugin>--v<x.y.z> -- plugins/<plugin>`), bumps the
  version **forward** from the current one (never down — clients ignore lower
  versions), runs both validators and prepares a commit
  `<plugin>: roll back to v<x.y.z> content as v<new>`.

## Release checklist

- [ ] `node scripts/validate-marketplace.mjs` passes.
- [ ] `claude plugin validate . --strict` passes.
- [ ] Installed locally from `./` and tried in a session.
- [ ] Plugin README and the root README plugin table are updated.
- [ ] Mode B only: `version` bumped, tag pushed after merge.
