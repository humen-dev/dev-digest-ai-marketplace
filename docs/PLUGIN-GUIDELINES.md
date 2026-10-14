# Plugin guidelines

Rules for every plugin in this marketplace. Reference:
[Plugins reference](https://code.claude.com/docs/en/plugins/manifest-reference),
[Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference).

## Layout

```text
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json          # ONLY the manifest lives here
├── skills/<skill>/SKILL.md  # one folder per skill
├── agents/<agent>.md
├── commands/<command>.md
├── hooks/hooks.json         # top-level "hooks" key
├── scripts/                 # helpers called by hooks
├── .mcp.json
└── README.md                # required
```

Components (`skills/`, `agents/`, `commands/`, `hooks/`, …) sit at the
**plugin root**, never inside `.claude-plugin/`.

## Naming

- kebab-case: letters, digits, `-`; start with a letter or digit.
- Prefix DevDigest plugins with `devdigest-` (e.g. `devdigest-backend`).
- Forbidden prefixes: `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`.
- The `name` in `plugin.json` **must equal** the `name` of its entry in
  `.claude-plugin/marketplace.json`. The linter enforces this.
- Components are namespaced by plugin: a skill `review` in `devdigest-review`
  is invoked as `/devdigest-review:review`.
- A plugin name is permanent once published. To rename, see
  [RELEASES.md](RELEASES.md#rename-or-remove-a-plugin).

## Manifest (`plugin.json`)

Minimum:

```json
{
  "name": "devdigest-example",
  "description": "One sentence: what it adds and when to use it.",
  "author": { "name": "humen-dev" },
  "repository": "https://github.com/humen-dev/dev-digest-ai-marketplace",
  "keywords": ["devdigest"]
}
```

- Set `version` in **one place only** — `plugin.json` — or omit it. See
  [RELEASES.md](RELEASES.md).
- Do not list `skills`/`commands`/`agents` paths unless you need a non-default
  location: `commands` and `agents` **replace** the default folder scan.
- Component paths start with `./`, use forward slashes, and never contain `..`.

## Marketplace entry

Append to `plugins[]` in `.claude-plugin/marketplace.json`:

```json
{
  "name": "devdigest-example",
  "source": "./plugins/devdigest-example",
  "description": "Same sentence as plugin.json.",
  "category": "development",
  "tags": ["devdigest"]
}
```

## Self-contained plugins

Installed plugins are **copied** to `~/.claude/plugins/cache/…`. Anything
outside the plugin folder is not copied.

- Never reference `../` or files elsewhere in this repo or in `dev-digest`.
- Reference plugin files via `${CLAUDE_PLUGIN_ROOT}` (quoted).
- Persistent state goes to `${CLAUDE_PLUGIN_DATA}`; `${CLAUDE_PLUGIN_ROOT}`
  changes on every update.
- No Git LFS: clones receive pointer files, not content.
- To share a file between plugins, use a symlink inside this marketplace (it is
  dereferenced on install). On Windows symlinks need Developer Mode.

## Skills, agents, commands

- Each `SKILL.md` has YAML frontmatter with `name` and a `description` that
  states **when** to use it (that is what triggers it).
- Skills live at `skills/<name>/SKILL.md` — a `SKILL.md` at the plugin root
  turns the whole plugin into a single skill.
- Do not hard-code paths of the DevDigest checkout; describe paths relative to
  the user's project.

## Hooks

- `hooks/hooks.json` must have a top-level `"hooks"` object.
- Call scripts through an interpreter so the execute bit does not matter:
  `bash "${CLAUDE_PLUGIN_ROOT}/scripts/check.sh"` or
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs"`.
- Prefer Node scripts: they behave the same on Windows, macOS and Linux.
- Shell scripts must use LF line endings (`.gitattributes` enforces it).
- Follow [SECURITY.md](SECURITY.md).

## Plugin README

Every plugin has a `README.md` with: what it adds (list of skills / agents /
commands / hooks), install command, any hooks or MCP servers and what they run,
and requirements (tools, env vars).

## Before opening a PR

```bash
node scripts/validate-marketplace.mjs
claude plugin validate . --strict
claude plugin marketplace add ./
claude plugin install <plugin-name>@dev-digest-ai-marketplace
```

Then try each component in a real Claude Code session.
