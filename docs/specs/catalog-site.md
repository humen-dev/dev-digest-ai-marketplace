# Spec: Marketplace catalog site (GitHub Pages)

| | |
|---|---|
| Status | Draft (rev. 2: design review of catalog, plugin page and install set; see §16) |
| Owner | @humen-dev |
| Created | 2026-10-14 |
| Site URL | `https://humen-dev.github.io/dev-digest-ai-marketplace/` |
| Stack | **Vite + React SPA** in `site/` (changed 2026-10-14 from ~~Astro static output + Preact islands~~). Search uses a small in-house scorer for now; MiniSearch (§7.1) is still the plan. Not yet revised for the new stack: §5, §5.1, §9.5 (RSS), §10.1 (JS budget), §10.3 (pages need JS), §10.4 (islands), §11, §15.2. |

## 1. Summary

A static website, published to GitHub Pages from this repository, where people
can **find, understand and install** everything the marketplace offers: plugins
and the skills, agents, commands, hooks and MCP servers inside them.

The core feature is search. A user types a free-text need ("I need a skill for
writing release notes"). The site matches it against the content of every
artifact and shows the matches as cards with a ready-to-copy install command.

GitHub Pages has no backend. All indexing, parsing and analysis therefore runs
**at build time in GitHub Actions**. The browser only loads static HTML and JSON
and does search, filtering and generation locally.

## 2. Goals and non-goals

### Goals

- G1. Find a relevant artifact from a natural-language query in under 10 seconds.
- G2. Before installing, show exactly what a plugin adds and what it executes
  (hooks, MCP servers, tools).
- G3. Install one plugin, or a set of plugins, with copy-paste commands or a
  project `settings.json` snippet.
- G4. Generate the site from `plugins/` and `marketplace.json` alone. The
  catalog lives in one place and the site can never drift from it.
- G5. Make contributing easier: request a skill, scaffold a plugin, validate a
  `SKILL.md`.

### Non-goals

- User accounts, ratings, comments, usage analytics or any server-side state.
- Installing plugins from the browser (Claude Code installs; the site only
  produces commands).
- Hosting plugins from other marketplaces.
- Localising the UI. The UI is English only. Search accepts a small set of
  Ukrainian keywords (§7.3), but pages are not translated.

## 3. Prerequisites

These must be done before the first deploy (tracked in M0, §13):

1. **Make the repository public.** The site content is public anyway: every
   `SKILL.md`, agent prompt and hook command is rendered on it.
2. Before switching visibility, scan the full git history for secrets
   (`gitleaks detect` or GitHub secret scanning). Rotate anything found.
3. Settings → Pages → Source: **GitHub Actions**.
4. Update docs that assume a private repo:
   - `README.md` "Install": drop the `gh auth setup-git` requirement and add a
     link to the site.
   - `docs/SECURITY.md` "Reporting a problem": switch to GitHub private
     vulnerability reporting, enabled in repo settings.

## 4. Users and main scenarios

| Persona | Scenario |
|---|---|
| **Consumer**: a DevDigest developer using Claude Code | Search for "migration", open the `devdigest-backend` card, read what it runs, copy the install command. |
| **Team lead** | Pick 4 plugins, generate a `.claude/settings.json` snippet, commit it to the project so the whole team gets them. |
| **Contributor** | Check that no existing skill already covers an idea, scaffold a new plugin, validate its `SKILL.md`, open a PR. |
| **Requester** | Find nothing for "Grafana dashboards" and click "Request a skill"; a prefilled GitHub issue opens. |
| **Reviewer / security-minded user** | List all plugins that run hooks or start MCP servers. |

## 5. Architecture

```text
plugins/** + .claude-plugin/marketplace.json + git history
        │
        ▼  (CI, Node 22)
scripts/build-catalog.mjs ──► site/src/generated/catalog.json   (full data model)
        │
        ▼
astro build (site/)
   ├─ static pages: /, /plugins/<p>/, /plugins/<p>/<kind>/<name>/, /collections/…, /changelog/ …
   ├─ /search-index.json   (serialized MiniSearch index + card fields)
   └─ /feed.xml            (RSS)
        │
        ▼  actions/deploy-pages
GitHub Pages  ──► browser: search, filters, install set, generators (no network calls except to github.com links)
```

### 5.1 Repository layout (new files)

```text
scripts/
  build-catalog.mjs          # repo → catalog.json; no network; deterministic
  lib/
    catalog/                 # pure extractors (one module per component kind)
    rules.mjs                # naming/frontmatter rules shared with validate-marketplace.mjs
site/
  package.json               # Astro + deps live here; repo root stays dependency-free
  astro.config.mjs           # site + base: '/dev-digest-ai-marketplace'
  src/
    generated/               # gitignored; written by build-catalog.mjs
    pages/ components/ islands/ lib/
  content/
    collections/*.md         # curated scenario bundles (§9.6)
  data/
    synonyms.yml             # search synonyms and Ukrainian keywords (§7.3)
  test/
    fixtures/                # sample marketplace with plugins of every kind
.github/
  workflows/pages.yml
  ISSUE_TEMPLATE/skill-request.yml
```

- `scripts/validate-marketplace.mjs` keeps its no-dependency contract. Rules
  shared with the site validator (§9.9) move into `scripts/lib/rules.mjs`,
  which uses only `node:` built-ins and plain JS so it also runs in the browser.
- `build-catalog.mjs` takes `--root <dir>` (default: repo root) and
  `--out <file>`. Local development and tests can point it at
  `site/test/fixtures`.

## 6. Data model

`catalog.json` is the single contract between the extractor and the site.
TypeScript notation:

```ts
type Kind = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';

interface Catalog {
  schemaVersion: 1;
  generatedAt: string;            // ISO, from the HEAD commit time (deterministic)
  commit: string;                 // HEAD sha
  marketplace: { name: string; description: string; owner: string; repo: string };
  plugins: Plugin[];
  artifacts: Artifact[];          // all components of all plugins, flat
  changes: Change[];              // §9.5
  diagnostics: Diagnostic[];      // non-fatal extraction issues, shown on /stats
}

interface Plugin {
  id: string;                     // plugin name, e.g. "devdigest-backend"
  name: string;
  description: string;
  version: string | null;         // plugin.json version; null = commit-tracked
  category: string | null;        // marketplace entry
  tags: string[];                 // marketplace tags ∪ plugin.json keywords
  author: string | null;
  license: string | null;         // plugin.json `license`
  owners: string[];               // CODEOWNERS entries matching sourcePath, e.g. ["@backend-guild"]
  external: boolean;              // non-relative marketplace source; listed, not crawled
  sourcePath: string;             // "plugins/devdigest-backend"
  readmeHtml: string;             // sanitized (§10.4)
  installCommand: string;         // "/plugin install devdigest-backend@dev-digest-ai-marketplace"
  components: { kind: Kind; id: string }[];
  security: SecurityProfile;      // §8
  portedFrom: string | null;      // "Ported from dev-digest: <path>" in README
  updatedAt: string;              // last commit touching sourcePath
  addedAt: string;                // first commit touching sourcePath
}

interface Artifact {
  id: string;                     // "<plugin>/<kind>/<name>", e.g. "devdigest-review/skill/review"
  kind: Exclude<Kind, 'plugin'>;
  name: string;
  plugin: string;
  description: string;
  invocation: string | null;      // "/devdigest-review:review" for skills/commands; agent name for agents
                                  // (agent mention syntax to be verified, §15); hook/mcp: null
  path: string;                   // repo-relative file
  githubUrl: string;              // blob URL on main
  frontmatter: Record<string, unknown>;
  bodyHtml: string;               // sanitized, rendered markdown (skills/agents/commands)
  bodyText: string;               // plain text for indexing, truncated to 8,000 chars
  headings: string[];
  details: HookDetails | McpDetails | null;
  updatedAt: string;
}

interface HookDetails { event: string; matcher: string | null; type: string; command: string | null;
                        summary: string;              // templated, §8.1
                        note: string | null;          // author note from README, §8.2
                        unpinned: boolean; }
interface McpDetails  { server: string; transport: 'stdio' | 'http' | 'sse'; command: string | null;
                        args: string[]; url: string | null; env: string[] /* names only */;
                        summary: string; note: string | null; unpinned: boolean; }
// MCP tool names are NOT part of the catalog: they are only known once the server runs,
// and the build never starts servers.
```

### 6.1 Extraction rules

| Kind | Source | name | description | Notes |
|---|---|---|---|---|
| plugin | `marketplace.json` entry + `.claude-plugin/plugin.json` | entry `name` | entry, else manifest | Respect custom paths declared in `plugin.json` (`skills`, `commands`, `agents`, `hooks`, `mcpServers`). |
| skill | `skills/<dir>/SKILL.md` | frontmatter `name`, else `<dir>` | frontmatter `description` | `invocation = /<plugin>:<name>` |
| agent | `agents/*.md` | frontmatter `name`, else filename | frontmatter `description` | Keep `tools`, `model` from frontmatter. |
| command | `commands/*.md` (recursive) | filename without `.md` | frontmatter `description`, else first paragraph | Keep `argument-hint`, `allowed-tools`. |
| hook | `hooks/hooks.json` and inline `hooks` in `plugin.json` | basename of the script the command runs via `${CLAUDE_PLUGIN_ROOT}/scripts/<name>.<ext>`; otherwise `<Event>[:<matcher>]` | `summary` (§8.1) | One artifact per hook entry. The invocation column shows `<Event> · <matcher>`. |
| mcp | `.mcp.json` and inline `mcpServers` in `plugin.json` | server key | `summary` (§8.1) | **Never** copy `env` values; keep variable names only. The invocation column shows `<transport> · <package or url>`, never tool names. |

- Frontmatter is parsed with the `yaml` package. Invalid frontmatter produces a
  `Diagnostic` and the artifact is still listed with the filename as its name.
- External plugin sources (`github`, `git-subdir`) are listed from the
  marketplace entry only, marked `external: true`, and not crawled.
- The extractor fails the build only on what `validate-marketplace.mjs` already
  treats as an error. Everything else becomes a diagnostic.
- Output is deterministic: sorted arrays, no wall-clock timestamps. Two runs
  on the same commit produce byte-identical JSON.

## 7. Search

### 7.1 Index

- Library: **MiniSearch** (client-side, BM25-like scoring).
- Documents: every `Plugin` and every `Artifact`.
- Built at build time and served as `/search-index.json`. It contains the
  serialized index plus the fields needed to render cards: `id, kind, name,
  plugin, description, tags, invocation, security flags`.
- Field boosts:

  | Field | Boost |
  |---|---|
  | `name` | 5 |
  | `tags` + `keywords` (plugin tags, synonyms expansion) | 3 |
  | `description` | 2 |
  | `headings` | 1.5 |
  | `bodyText` | 1 |

- Options: `prefix: true`, `fuzzy: 0.2` for terms ≥ 5 chars, English stemming
  via a small Porter stemmer in `processTerm`, applied identically at index
  time and query time.

### 7.2 Query pipeline

For the input `I need a skill for writing release notes`:

1. **Normalise:** lowercase, NFKC, strip punctuation.
2. **Explicit filters:** `type:skill`, `plugin:devdigest-review`, `tag:git`,
   `has:hooks`, `has:mcp`, `-has:hooks`. These are removed from the free text
   and applied as filters.
3. **Kind intent:** words mapping to a kind become a *soft* filter. English:
   skill(s), agent(s)/subagent(s), command(s)/slash, hook(s), mcp/server(s),
   plugin(s). Ukrainian: скіл, навичка, агент, команда, хук, плагін.
4. **Stop words:** remove English and Ukrainian stop words and filler phrases
   ("i need", "looking for", "something to", "мені треба", "потрібен", "для").
5. **Synonyms:** expand terms via `synonyms.yml` (e.g. `pr → pull request`,
   `релiз → release`).
6. **Search:** run with `combineWith: 'AND'`. If that returns fewer than 3
   results, re-run with `'OR'` and append the extra results below.
7. **Soft kind filter:** if the kind filter leaves zero results, drop it and
   show "No skills matched — showing all artifact types".

Example result: kind = skill, terms = `writing release notes` → skills whose
name/description/body mention release notes rank first.

### 7.3 `synonyms.yml`

```yaml
# term: [equivalents]   — applied both ways, lowercase
release: [changelog, release notes, реліз, випуск]
test: [tests, testing, spec, тест, тести]
review: [code review, pr review, рев'ю, ревю]
migration: [migrate, schema change, міграція]
```

Maintained by hand, reviewed in PRs. A CI unit test checks that every entry
parses and has no duplicate keys.

### 7.4 Results UX

- Search runs on input with a 100 ms debounce. Results update without a page
  reload.
- State lives in the URL: `/?q=release+notes&type=skill&has=-hooks`. Back and
  forward work, and links can be shared.
- Matched terms are highlighted in the card name and description.
- **Kind intent is visible.** When §7.2 step 3 detects a kind, show it as an
  auto-applied, removable chip above the results: `Skills ✕ · show all types`.
- **Strong and weak matches are separated.** AND results form the main grid.
  OR-fallback results go in a separate "Related" section below, with a lighter
  header. They are never mixed into the main grid.
- Sorting dropdown: relevance (default), name, recently updated.
- Empty query: show the full catalog grouped by plugin, then "What's new" and
  "Collections".
- No results: show the "did you mean" suggestion (MiniSearch `autoSuggest`),
  popular tags, and a **Request a skill** button prefilled with the query
  (§9.7).

### 7.5 Card

```text
┌──────────────────────────────────────────────┐
│ [SKILL]  release-notes            ⚙ hooks    │
│ devdigest-release                            │
│ Drafts release notes from merged PRs since   │
│ the last tag. Use when …                     │
│ #release #git                                │
│ /devdigest-release:release-notes        [⧉]  │
│ [⧉ Copy install]  [+ Add to set]   [♡]       │
└──────────────────────────────────────────────┘
```

- Header row: kind badge, `in <plugin>`, and the version on the right
  (`v1.4.0`, or `tracks main` when `version` is null).

- Kind badge with a distinct icon and colour per kind.
- Security badges from §8, only those that apply. On an artifact card they
  describe the **parent plugin**, and the label says so: `plugin runs 1 hook ·
  1 MCP`. A skill itself never runs a hook.
- The card shows the **invocation** in monospace with its own copy icon. It
  does **not** print the install command: that string is long, identical for
  every artifact of a plugin, and gets truncated. The **Copy install** button
  copies the full `/plugin install <plugin>@dev-digest-ai-marketplace`.
- There is no separate "Details" button.
- The whole card links to the detail page. The buttons inside it do not
  navigate.

## 8. Security profile

Derived at build time for each plugin. It is informational and states facts.
It never claims a plugin is "safe".

```ts
interface SecurityProfile {
  hooks: { event: string; command: string | null }[];
  mcpServers: { name: string; transport: string; command: string | null; url: string | null }[];
  envVars: string[];              // from MCP env names + plugin.json userConfig keys
  toolsRequested: string[];       // union of allowed-tools / tools from skills, agents, commands
  flags: SecurityFlag[];
}
type SecurityFlag =
  | 'runs-hooks'                  // any hook
  | 'starts-mcp'                  // any stdio MCP server
  | 'remote-mcp'                  // any http/sse MCP server
  | 'shell-tools'                 // Bash in requested tools
  | 'network-heuristic'           // curl|wget|fetch(|https?:// found in hook commands or scripts/
  | 'unpinned-dependency';        // npx/uvx/@latest without exact version in hook or MCP command
```

- `unpinned-dependency` is evaluated per hook/MCP entry (`unpinned: true`) and
  shown as an `unpinned · heuristic` badge next to that entry on the plugin
  page and in the install-set summary. Example that must be flagged:
  `npx -y @modelcontextprotocol/server-postgres` (no `@<version>`).
- `network-heuristic` and `unpinned-dependency` are labelled **"heuristic"** in
  the UI and link to `docs/SECURITY.md`.
- `unpinned-dependency` is also emitted as a `Diagnostic`. A follow-up can
  promote it to a validator error.
- The plugin page shows a **"What this plugin runs on your machine"** section:
  every hook (event, matcher, full command) and every MCP server (command +
  args or URL, env var names), plus requested tools and env vars. It is placed
  above the README. Each row has the item's `summary` (§8.1) and, if present,
  its `note` (§8.2). A caption says "Parsed from hooks.json and .mcp.json at
  build".

### 8.1 Templated summaries

Each summary is generated from data. No free text is invented at build time.

| Input | Summary |
|---|---|
| `PreToolUse` + matcher `M` | "Runs before Claude uses `M`. Can block the call." |
| `PostToolUse` + matcher `Edit\|Write` / other matcher `M` | "Runs after every file Claude edits or writes." / "Runs after Claude uses `M`." |
| `SessionStart`, `UserPromptSubmit`, `Stop`, other events | "Runs when a session starts." / "Runs on every prompt you send." / "Runs when Claude finishes a response." / "Runs on `<Event>`." |
| stdio MCP via `npx`/`uvx`/`bunx` | "Starts with Claude Code. Downloads the package from npm/PyPI on first run." |
| stdio MCP, other command | "Starts `<command>` as a local process with Claude Code." |
| http/sse MCP | "Connects to `<host>`." |
| env var used by MCP | "Read by MCP server `<server>`." |
| `allowed-tools` / `tools` entry | "Claude can run these without asking." (pre-approved) |

The template table lives in `scripts/lib/catalog/summaries.mjs` and has unit
tests. Unknown events fall back to "Runs on `<Event>`."

### 8.2 Author notes

Advice like "Use a read-only database role" cannot be derived from config.
Authors may add it in the plugin README under a section named exactly
`## What it runs`, with `### <name>` sub-headings. `<name>` matches a hook
name (§6.1), an MCP server key or an env var name. The first paragraph under
each sub-heading becomes that item's `note` and is rendered sanitized.

Missing notes are fine. Sub-headings that match nothing produce a
`Diagnostic`. `docs/PLUGIN-GUIDELINES.md` ("Plugin README") is updated to
describe this section. That README already has to list hooks and MCP servers,
so this formalises an existing requirement.

## 9. Features and pages

All routes are under the base path `/dev-digest-ai-marketplace/`.
Priority: **P0** = MVP, **P1** = v1, **P2** = v2 (see §13).

### 9.1 Home `/` — P0

Search box (autofocused) with "Try" example chips, a left rail with filters,
results grid, result count. The rail has **Kind** (with counts) and **Executes
code**: Any / Runs hooks or MCP / **No hooks or MCP**. Do not say "Prompts
only": a skill can still request Bash. Category and tag filters are collapsible
sections. Example chips that are filters (e.g. "hooks") insert the filter
syntax (`has:hooks`) rather than a search word. When the query is empty, it shows the
catalog plus "What's new" (5 latest changes) and featured collections.

### 9.2 Plugin page `/plugins/<plugin>/` — P0 (security section P1)

Breadcrumb, header (name, description, security badges incl. `Needs <ENV>`),
"What this runs on your machine" (§8, P1), contents list (kind icon, name,
description, invocation or `<Event> · <matcher>` / `<transport> · <package>`),
rendered README, "Ported from dev-digest" link if present.

Sidebar:
- **Install** box with the full install command. It may wrap only after `@`
  (`<wbr>` there; no mid-word breaks). Below it, an "Add to install set" / "✓ In
  install set" toggle and the first-time hint `/plugin marketplace add
  humen-dev/dev-digest-ai-marketplace`.
- Metadata: version (or "tracks main"), updated, owners (from CODEOWNERS),
  license, source path linked to GitHub.
- Recent changes for this plugin (P1).

### 9.3 Artifact page `/plugins/<plugin>/<kind>/<name>/` — P1

Kind badge, name, description, invocation, parent plugin with install command,
rendered body (skill/agent/command) or details table (hook/mcp), frontmatter
table, "View source on GitHub", "Other components in this plugin".

### 9.4 Install set `/install/?set=<p1>,<p2>` — P1

A per-browser selection of plugins, kept in `localStorage` (guarded with
try/catch; the feature still works for the session if storage is
unavailable). The header always shows an **Install set (N)** button that links
to the page.

The page has its own URL. When the `set` parameter is present it is the source
of truth, so the URL can be shared. If it differs from the local selection,
opening it asks for confirmation before replacing that selection.

Left column:
- A list of plugins (name, artifact count, short component summary,
  hook/MCP icons, remove ✕).
- **Risk summary** for the whole set: "This set runs N hooks and starts M MCP
  servers. Needs `ENV_A`, `ENV_B`." It includes `unpinned` counts and has a
  "Review" link to the `/security/` page filtered to the set.
- Empty state: "Your install set is empty" with links to Catalog and
  Collections.

Right column: outputs in tabs, each with **Copy** and **Download**:

1. **Shell commands**
   ```bash
   claude plugin marketplace add humen-dev/dev-digest-ai-marketplace
   claude plugin install devdigest-backend@dev-digest-ai-marketplace
   claude plugin install devdigest-review@dev-digest-ai-marketplace
   ```
2. **In-session commands** (`/plugin marketplace add …`, `/plugin install …`).
3. **Project `settings.json` snippet** (commit to the project's
   `.claude/settings.json`):
   ```json
   {
     "extraKnownMarketplaces": {
       "dev-digest-ai-marketplace": {
         "source": { "source": "github", "repo": "humen-dev/dev-digest-ai-marketplace" }
       }
     },
     "enabledPlugins": {
       "devdigest-backend@dev-digest-ai-marketplace": true,
       "devdigest-review@dev-digest-ai-marketplace": true
     }
   }
   ```
   The keys must be checked against the current Claude Code settings reference
   during implementation.

Tabs 1 and 2 show the same commands in two forms: in a shell, and inside a
Claude Code session. The tab label says where to paste.

### 9.4a Security overview `/security/` — P1

This page serves the reviewer persona (§4). It is a table of every plugin with
columns for hooks (count + events), MCP servers (transport), env vars, `Bash`
in requested tools, and heuristic flags. It can be sorted and filtered by flag,
and accepts `?set=` to scope it to an install set. Each row links to the
plugin's "What this runs" section. "Security" is a top-level nav item.

### 9.5 What's new `/changelog/` + `/feed.xml` — P1

- Built from git history (`fetch-depth: 0` in CI). A change is a commit on
  `main` that touches `plugins/<p>/` or a marketplace entry.
- Each `Change` has a date, plugin, commit subject (the repo uses
  `<plugin>: <summary>` subjects), sha link, and type: `added` (first commit
  for the plugin), `released` (tag `<plugin>--v<version>` exists), `updated`,
  `removed` (entry removed / `renames` → null).
- The page lists changes grouped by month and can be filtered by plugin.
- The RSS feed is generated with `@astrojs/rss` and covers the latest 50 changes.

### 9.6 Collections `/collections/<slug>/` — P2

Curated bundles in `site/content/collections/*.md`:

```yaml
---
title: Ship a DevDigest release
description: Everything needed to cut, verify and announce a release.
plugins: [devdigest-release, devdigest-review]
featured: true
---
Markdown body explaining the workflow and order of use.
```

The build fails if a collection references an unknown plugin. Each collection
page has "Add all to install set".

### 9.7 Request a skill — P2

- Add `.github/ISSUE_TEMPLATE/skill-request.yml` (issue form with fields
  `need`, `example`, `kind`).
- The button opens
  `https://github.com/humen-dev/dev-digest-ai-marketplace/issues/new?template=skill-request.yml&title=…&need=<query>`.
- The user submits on GitHub. The site sends nothing itself.

### 9.8 Scaffold a plugin `/create/` — P2

A form with plugin name, description, category, tags, and components to
include (skill / agent / command / hook with Node script / MCP).

- Live validation with the shared `rules.mjs`: kebab-case, `devdigest-`
  prefix, forbidden prefixes, uniqueness against the catalog.
- Generates a ZIP in the browser (JSZip) containing
  `plugins/<name>/.claude-plugin/plugin.json`, component templates following
  `docs/PLUGIN-GUIDELINES.md`, and `README.md` with the required sections.
- It also shows the snippet for the `marketplace.json` entry and for the root
  README table row.

### 9.9 Validate `/validate/` — P2

A textarea where you paste `SKILL.md`, an agent `.md`, `plugin.json` or
`hooks.json`. The kind is auto-detected and can be overridden. The page shows
errors and warnings from the shared rules, plus the §8 heuristics for hook
commands. Everything runs locally and nothing leaves the page.

### 9.10 Stats `/stats/` — P2

Counts by kind and category, plugins added per month, plugins by security
flags, and quality checks: README missing required sections, components without
a description, diagnostics from the build.

### 9.11 Global UI — P0 unless noted

- Header: logo, nav (Catalog, Security, Collections, Changelog, Contribute),
  compact search on inner pages, **Install set (N)** (P1), theme toggle, and
  GitHub link. Nav items for P2 pages are hidden until those pages ship.
- **Ctrl/⌘+K** command palette (P2): jump to any plugin or artifact, or run
  "Copy install command".
- Favourites (♡) in `localStorage` with a "Favourites" filter (P2).
- Light/dark theme following `prefers-color-scheme`, with a manual override.
- About page `/about/`: what the marketplace is, how to add it to Claude Code,
  the security warning from README, and how to contribute.
- 404 page with a search box.
- **Empty catalog:** while `plugins[]` is empty, home shows "No plugins yet"
  with links to CONTRIBUTING.md and Request a skill.

## 10. Non-functional requirements

### 10.1 Performance budgets (measured with 200 artifacts from fixtures)

| Metric | Budget |
|---|---|
| `search-index.json` | ≤ 300 KB gzip |
| JS on home, excluding the index | ≤ 60 KB gzip |
| Search latency per keystroke | ≤ 30 ms p95 on a mid-range laptop |
| LCP (home, Fast 4G, Lighthouse mobile) | ≤ 2.0 s |
| Lighthouse Performance / Accessibility | ≥ 90 / ≥ 95 |

The index is fetched on first interaction with the search box or on idle,
whichever comes first.

### 10.2 Accessibility

- WCAG 2.2 AA contrast in both themes.
- Full keyboard use: `/` focuses search; arrow keys move through results;
  Enter opens a result.
- The results count is announced through an `aria-live="polite"` region.
- Cards are `<article>` elements with a single primary link, and the buttons
  have accessible names.

### 10.3 Compatibility

The latest two versions of Chrome, Edge, Firefox and Safari. Layout works from
360 px width with no horizontal scroll. Pages are readable without JS (static
HTML); search, filters and generators require JS.

### 10.4 Security of the site itself

- All markdown is rendered at build time and passed through `rehype-sanitize`
  (GitHub schema). Raw HTML in plugin files is not trusted, because plugins
  are contributed content.
- Relative links and images in READMEs are rewritten to GitHub blob/raw URLs
  for the same commit.
- No third-party scripts, fonts or analytics at runtime. The only external
  links go to github.com.
- A CSP `<meta>` tag allows `default-src 'self'` and `img-src 'self'
  https://raw.githubusercontent.com https://github.com`. Islands must not rely
  on `unsafe-eval`.
- The extractor never writes MCP `env` values, `userConfig` defaults marked
  sensitive, or file contents outside `plugins/` and `marketplace.json` into
  the catalog.

### 10.5 Determinism and freshness

The site always reflects `main` at the deployed commit. The footer shows
"Built from `<short sha>` on `<date>`" with a link to the commit.

## 11. CI/CD

`.github/workflows/pages.yml`:

- Triggers: `push` to `main` (paths: `plugins/**`, `.claude-plugin/**`,
  `site/**`, `scripts/**`), `workflow_dispatch`.
- Jobs:
  1. **build:** checkout with `fetch-depth: 0`; Node 22; `npm ci` in `site/`;
     `node scripts/validate-marketplace.mjs`; `node scripts/build-catalog.mjs`;
     unit tests; `astro build`; `actions/upload-pages-artifact`.
  2. **deploy:** `actions/deploy-pages`, environment `github-pages`.
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- `concurrency: { group: pages, cancel-in-progress: true }`.
- `validate.yml` gains a site job on PRs that touch `site/**` or `scripts/**`:
  build plus tests, no deploy.
- Dependency versions are pinned exactly in `site/package-lock.json`. Dependabot
  is enabled for `site/` and GitHub Actions.

## 12. Testing

| Layer | What | Tool |
|---|---|---|
| Extractor | Each kind from `site/test/fixtures`: names, descriptions, invocations, custom manifest paths, inline hooks/MCP, invalid frontmatter → diagnostic, env values never emitted, deterministic output | `node:test` |
| Security profile | Each flag set and not set; heuristics on sample commands; every §8.1 template; README `## What it runs` notes matched and unmatched | `node:test` |
| Query pipeline | Filters, kind intent (EN + UA), stop words, synonyms, AND→OR fallback, soft-filter fallback | `node:test` / Vitest |
| Relevance | Golden set `site/test/relevance.yml` (query → expected id in top 3), at least 20 cases, run against fixtures | Vitest |
| Generators | settings.json snippet is valid JSON with the expected keys; ZIP contents pass `validate-marketplace.mjs` | Vitest |
| E2E smoke | Search → card → plugin page → copy; install-set link round-trip; no console errors | Playwright (Chromium) |
| Budgets | Index size and JS size checked in CI; Lighthouse CI on home | Script + `@lhci/cli` |

## 13. Milestones

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0 — Prerequisites** | §3: secrets scan, repo public, Pages source, README/SECURITY updates; fixtures with ≥ 1 plugin per kind | Repo is public; fixtures are committed |
| **M1 — MVP (P0)** | `build-catalog.mjs`, data model, search (§7), home, cards, filters, plugin page (without security section), About, 404, empty state, Pages deploy | Site live; relevance golden set passes; budgets met |
| **M2 — v1 (P1)** | Artifact pages, security profile (§8), `/security/` overview, install set page and settings snippet, changelog and RSS | A team lead can produce a working `settings.json` from the site |
| **M3 — v2 (P2)** | Collections, request a skill, scaffold, validator, stats, Ctrl+K, favourites | All P2 acceptance tests pass |
| **Later (not in this spec)** | Semantic search: embeddings computed in CI and a multilingual model loaded on demand in the browser via transformers.js | Separate spec |

## 14. Acceptance criteria (MVP)

1. A push to `main` that adds a plugin makes it appear on the site within one
   workflow run, with no manual steps.
2. The query `I need a skill for release notes` returns the fixture
   `release-notes` skill as the first result. `мені треба скіл для релізу`
   returns it in the top 3.
3. `type:hook` returns only hooks. `-has:hooks` excludes every plugin with
   hooks and all of those plugins' artifacts.
4. **Copy install** on any card puts exactly
   `/plugin install <plugin>@dev-digest-ai-marketplace` on the clipboard. No
   card renders a truncated install command.
5. Reloading `/?q=review&type=agent` restores the same query, filters and
   results.
6. With an empty `plugins[]`, the site builds and shows the empty state.
7. No request leaves the site origin during search (verified in E2E via
   network log).
8. For the query in (2), the main grid contains only skills that match all
   terms. The "Skills" chip is shown, and weaker matches appear only under
   "Related".

## 15. Open questions

1. Can SKILL.md / agent frontmatter carry an extra `tags` key without
   `claude plugin validate --strict` warnings? If yes, per-artifact tags are
   indexed with boost 3. If not, tags exist only at plugin level plus
   `synonyms.yml`.
2. Is a custom domain wanted? It changes `site`/`base` in `astro.config.mjs`.
3. Who curates collections and `synonyms.yml`? Should CODEOWNERS cover
   `site/content/` and `site/data/`?
4. Should `unpinned-dependency` become a hard error in
   `validate-marketplace.mjs` (§8)?
5. **Verify:** the syntax for mentioning a plugin agent in Claude Code. The
   design shows `@agent-<plugin>:<agent>`. Until this is confirmed against the
   docs, show only the agent name.
6. **Verify:** the keys of the project `settings.json` snippet (§9.4) against
   the current settings reference.
7. Owners: is CODEOWNERS the right source, or should `plugin.json` `author`
   be enough?

## 16. Design review log

Decisions from reviewing the hi-fi designs (catalog/search, plugin detail,
install set). They are already applied in the sections above.

| # | Finding | Decision | Where |
|---|---|---|---|
| 1 | Sample plugins named `release-tools`, `docs-writer`, … | All designs and fixtures use `devdigest-*` names | PLUGIN-GUIDELINES, fixtures |
| 2 | Install command printed on every card and truncated | Card shows invocation; "Copy install" copies the full command | §7.5 |
| 3 | Unrelated results mixed in for a skill query | Visible kind chip; OR results in a separate "Related" section | §7.4, §14.8 |
| 4 | `1 hook` badge on a skill card reads as if the skill runs it | Artifact-card badges are labelled as plugin-level | §7.5 |
| 5 | MCP tools shown as `mcp__postgres__query` | Not shown: plugin tools are named `mcp__plugin_<plugin>_<server>__<tool>` and are unknowable at build time | §6 |
| 6 | Agent shown as `@agent-<plugin>:<agent>` | Pending verification | §15.5 |
| 7 | Hand-written explanations in "What this runs" | Templated summaries plus optional README notes | §8.1, §8.2 |
| 8 | Unpinned `npx -y @…/server-postgres` not flagged | Per-entry `unpinned · heuristic` badge | §8 |
| 9 | Hook given a friendly name not present in config | Name derived from script basename, else `<Event>:<matcher>` | §6.1 |
| 10 | Install set lives at `/install/`, set-level risk summary | Adopted | §9.4 |
| 11 | "Security" nav item | Adopted as `/security/` overview, P1 | §9.4a |
| 12 | Owner and License in plugin sidebar | Added `owners` (CODEOWNERS) and `license` | §6, §9.2 |
| 13 | "Prompts only" filter label | Renamed to "No hooks or MCP" | §9.1 |
| 14 | Install command wraps mid-word | Wrap only after `@` | §9.2 |
| 15 | Install set shows only in-session commands; no Copy/Download; no empty state | Shell and in-session tabs, Copy + Download, empty state | §9.4 |
