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

## Release channels

Reference: [Run release channels](https://code.claude.com/docs/en/plugins/host-marketplace#run-release-channels).
Claude Code has no channel concept; a channel is a second marketplace with its
own `name` whose entries point at release tags.

| Channel | Marketplace name | Catalog | What it serves |
|---|---|---|---|
| latest | `dev-digest-ai-marketplace` | `.claude-plugin/marketplace.json` | `main` — every merged release |
| stable | `dev-digest-ai-marketplace-stable` | `channels/stable/.claude-plugin/marketplace.json` | each plugin pinned to a verified `<plugin>--v<x.y.z>` tag (`git-subdir` source with `ref` + `sha`) |

Add the stable channel (it lives on `main`, so the raw URL is stable too):

```bash
claude plugin marketplace add https://raw.githubusercontent.com/humen-dev/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json
claude plugin install sdd-engineering@dev-digest-ai-marketplace-stable
```

Or in a project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "dev-digest-ai-marketplace-stable": {
      "source": {
        "source": "github",
        "repo": "humen-dev/dev-digest-ai-marketplace",
        "path": "channels/stable/.claude-plugin/marketplace.json"
      }
    }
  },
  "enabledPlugins": { "sdd-engineering@dev-digest-ai-marketplace-stable": true }
}
```

Rules:

- A stable entry only ever points at a **tag** that passed the smoke evals
  (`ref` = tag, `sha` = the tagged commit). `scripts/validate-marketplace.mjs`
  enforces the shape.
- Dependencies resolve inside the channel: `sdd-engineering`'s `^1.0.0` ranges
  install the highest matching `<dep>--v*` tag, so every dependency must be
  tagged.
- **Promote** a release to stable: after its eval run is green, change that
  entry's `ref` and `sha` in a PR.
- **Roll back** a user: switch them from latest to stable (below). The two
  channels are different marketplaces, so this is a fresh install, not a
  version decrease — the "never decrease a version" rule does not apply.

### Roll back to the stable channel

```bash
claude plugin uninstall sdd-engineering@dev-digest-ai-marketplace
claude plugin install sdd-engineering@dev-digest-ai-marketplace-stable
claude plugin list --json   # sdd-engineering … "version": "1.0.0", enabled
```

`claude plugin list --json` shows which copy is active (`version`, `enabled`,
the `installPath` under `cache/dev-digest-ai-marketplace-stable/`). From 1.1.0
on, the trace hook also tells every session
`Active plugin: sdd-engineering@<marketplace> version <x.y.z>.`

Re-run the smoke evals on exactly the tagged content. An eval of the installed
copy loads no other installed plugins, so run from a worktree of the tag with the
current smoke cases (they load the dependencies through `plugins:`):

```bash
git worktree add ../mp-stable sdd-engineering--v1.0.0
cp -r plugins/sdd-engineering/evals/{spec-creator-interview,plan-verifier-no-plan,planner-interview} ../mp-stable/plugins/sdd-engineering/evals/
cd ../mp-stable
claude plugin eval . --eval-dir plugins/sdd-engineering/evals --tag smoke --ablation none --threshold 1.0
```

(`active-version` is left out for 1.0.0: that release has no trace hook.)

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
- [ ] `sdd-engineering`: the quality gate in [COST-BASELINE.md](COST-BASELINE.md#quality-gate)
  passes (smoke green, workflow 3/3, cost within the limit).
- [ ] Stable channel: promote only after the gate — update `ref` + `sha` in
  `channels/stable/.claude-plugin/marketplace.json`.
