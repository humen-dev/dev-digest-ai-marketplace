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
- Names describe the capability, not a project (e.g. `research-tools`).
- Forbidden prefixes: `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`.
- The `name` in `plugin.json` **must equal** the `name` of its entry in
  `.claude-plugin/marketplace.json`. The linter enforces this.
- Components are namespaced by plugin: a skill `review` in `example-plugin`
  is invoked as `/example-plugin:review`.
- A plugin name is permanent once published. To rename, see
  [RELEASES.md](RELEASES.md#rename-or-remove-a-plugin).

## Manifest (`plugin.json`)

Minimum:

```json
{
  "name": "example-plugin",
  "description": "One sentence: what it adds and when to use it.",
  "author": { "name": "humen-dev" },
  "repository": "https://github.com/humen-dev/dev-digest-ai-marketplace",
  "keywords": ["example"]
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
  "name": "example-plugin",
  "source": "./plugins/example-plugin",
  "description": "Same sentence as plugin.json.",
  "category": "development",
  "tags": ["example"]
}
```

## Self-contained plugins

Installed plugins are **copied** to `~/.claude/plugins/cache/…`. Anything
outside the plugin folder is not copied.

- Never reference `../` or files elsewhere in this repo or in another project.
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
- Do not hard-code paths of any specific project; describe paths relative to
  the user's project or read them from configuration.

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

If the plugin has hooks, MCP servers or env vars, describe them in a section
named exactly `## What it runs`, with one `### <name>` sub-heading per item.
`<name>` is the hook's script basename (e.g. `validate-schema` for
`scripts/validate-schema.mjs`), the MCP server key from `.mcp.json`, or the env
var name. The first paragraph under each sub-heading is shown next to that item
in the catalog site's "What this runs on your machine" section
([spec §8.2](specs/catalog-site.md#82-author-notes)). Use it for advice that
config cannot express:

```markdown
## What it runs

### validate-schema

Runs `npx prisma validate` after every edit. Takes ~1 s; fails quietly.

### postgres

Read-only SQL access to your database.

### DATABASE_URL

Use a read-only role: the server can run any query the role allows.
```

## Before opening a PR

```bash
node scripts/validate-marketplace.mjs
claude plugin validate . --strict
claude plugin marketplace add ./
claude plugin install <plugin-name>@dev-digest-ai-marketplace
```

Then try each component in a real Claude Code session.
