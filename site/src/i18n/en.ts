/**
 * Every user-visible string in the site, in English.
 *
 * Components and pages import `t` from here instead of hardcoding text
 * (src/i18n/no-hardcoded-text.test.ts enforces this). Strings that need
 * values are small functions. Plugin data in src/data/ is not translated here.
 */
import type { Kind } from '../data/types';
import type { SecurityFlag } from '../lib/catalog';

const plural = (n: number, one: string, many: string = `${one}s`) => (n === 1 ? one : many);

export const en = {
  brand: 'DevDigest Marketplace',

  nav: {
    label: 'Main',
    catalog: 'Catalog',
    security: 'Security',
    contribute: 'Contribute',
  },

  header: {
    searchPlaceholder: 'Search catalog',
    searchLabel: 'Search catalog',
    installSet: 'Install set',
    installSetLabel: (n: number) => `Install set, ${n} plugins`,
    themeLabel: 'Theme',
    lightTheme: 'Light theme',
    darkTheme: 'Dark theme',
    repoLabel: 'Repository on GitHub',
  },

  setBar: {
    label: 'Install set',
    count: (n: number) => `${n} ${plural(n, 'plugin')} in set`,
    generate: 'Generate install',
    clearLabel: 'Clear install set',
    clearTitle: 'Clear set',
  },

  footer: {
    sample: 'Preview with sample plugins: the marketplace has no published plugins yet.',
    builtFrom: 'Built from',
  },

  kinds: {
    label: {
      skill: 'Skill',
      agent: 'Agent',
      command: 'Command',
      hook: 'Hook',
      mcp: 'MCP server',
    } satisfies Record<Kind, string>,
    plural: {
      skill: 'Skills',
      agent: 'Agents',
      command: 'Commands',
      hook: 'Hooks',
      mcp: 'MCP',
    } satisfies Record<Kind, string>,
  },

  flags: {
    'runs-hooks': 'Runs hooks',
    'starts-mcp': 'Starts MCP',
    'remote-mcp': 'Remote MCP',
    'shell-tools': 'Bash tools',
    'network-heuristic': 'Network · heuristic',
    'unpinned-dependency': 'Unpinned · heuristic',
  } satisfies Record<SecurityFlag, string>,

  /** Templated summaries built in src/lib/catalog.ts (§8.1). */
  summaries: {
    hookBeforeTool: (matcher: string) => `Runs before Claude uses ${matcher}. Can block the call.`,
    hookBeforeEveryTool: 'Runs before every tool call. Can block the call.',
    hookAfterEdit: 'Runs after every file Claude edits or writes.',
    hookAfterTool: (matcher: string) => `Runs after Claude uses ${matcher}.`,
    hookSessionStart: 'Runs when a session starts.',
    hookPromptSubmit: 'Runs on every prompt you send.',
    hookStop: 'Runs when Claude finishes a response.',
    hookOther: (event: string) => `Runs on ${event}.`,
    mcpConnects: (host: string) => `Connects to ${host}.`,
    mcpConnectsRemote: 'Connects to a remote server.',
    mcpDownloads: (registry: string) => `Starts with Claude Code. Downloads the package from ${registry} on first run.`,
    mcpStartsLocal: (command: string) => `Starts ${command} as a local process with Claude Code.`,
    mcpACommand: 'a command',
    runsHooks: (n: number) => `${n} ${plural(n, 'hook')}`,
    runsMcp: (n: number) => `${n} MCP`,
    tracksMain: 'tracks main',
    skillRequestTitle: (q: string) => `Skill request: ${q}`,
  },

  ui: {
    inSetLong: 'In install set',
    inSet: 'In set',
    addToSetLong: 'Add to install set',
    addToSet: 'Add to set',
    copied: 'Copied',
    copiedToClipboard: 'Copied to clipboard',
    unpinnedTitle: 'npx/uvx/bunx package without an exact version. Heuristic: see docs/SECURITY.md',
    unpinnedBadge: 'unpinned · heuristic',
  },

  home: {
    /** Example chips under the search box; each is search syntax the user can add. */
    examples: ['type:agent', 'has:mcp', '-has:hooks', 'тести'],
    sorts: {
      relevance: 'Relevance',
      name: 'Name',
      updated: 'Recently updated',
    },
    sortPrefix: 'Sort:',
    stats: (plugins: number, artifacts: number, updated: string) =>
      `${plugins} ${plural(plugins, 'plugin')} · ${artifacts} ${plural(artifacts, 'artifact')}${updated ? ` · updated ${updated}` : ''}`,
    title: 'Describe the job. Get the plugin that does it.',
    lede: 'Search skills, agents, commands, hooks and MCP servers. See what a plugin runs before you install it.',
    searchPlaceholder: 'e.g. I need a skill for writing release notes',
    searchLabel: 'Search the catalog',
    clearSearch: 'Clear search',
    refine: 'Refine',
    allArtifacts: 'All artifacts',
    matches: (n: number) => `${n} ${plural(n, 'match', 'matches')}`,
    noAllWords: 'No result has all your words',
    noMatches: 'No matches',
    auto: 'AUTO',
    removeFilter: (kinds: string) => `Remove ${kinds} filter`,
    autoFrom: (word: string) => `from “${word}” in your query · `,
    showAllTypesLower: 'show all types',
    showAllTypes: 'Show all types',
    filterByKind: 'Filter by kind',
    all: 'All',
    emptyTitle: 'No plugins yet',
    emptyText: 'The marketplace is empty. Add the first plugin or ask for one.',
    contributingGuide: 'Contributing guide',
    requestSkill: 'Request a skill',
    hiddenBy: (kinds: string, n: number) => `Hidden by the ${kinds} filter${n > 1 ? ` · ${n}` : ''}`,
    related: 'Related',
    relatedHelp: 'match some of your words',
    notWhatYouNeed: 'Not what you need?',
    prefilled: ' · prefilled with this search',
    nothingCovers: (q: string) => `Nothing covers “${q}” yet`,
    nothingText: 'Open a request and the maintainers will triage it. The issue is prefilled with your search.',
    in: 'in',
    pluginRuns: (runs: string) => `plugin runs ${runs}`,
    copyInstall: 'Copy install',
    copyInvocation: (invocation: string) => `Copy ${invocation}`,
  },

  install: {
    title: 'Install set',
    tabs: {
      shell: { label: 'Terminal', help: 'Run in a terminal where the claude CLI is installed.' },
      session: { label: 'In Claude Code', help: 'Paste into a Claude Code session, one line at a time.' },
      settings: { label: '.claude/settings.json', help: 'Commit to the project so everyone on the team gets the same plugins.' },
    },
    emptyTitle: 'Your install set is empty',
    emptyText: 'Add plugins from the catalog with “Add to set”, then come back here for the commands and a settings file for your team.',
    browse: 'Browse the catalog',
    linkHas: 'This link has',
    plugins: (n: number) => `${n} ${plural(n, 'plugin')}`,
    savedSet: (n: number, names: string) => `. Your saved set has ${n}: ${names}.`,
    replaceSet: 'Replace my set',
    keepSet: 'Keep my set',
    lede: "Share this page's URL, or commit the settings file so the whole team gets the same plugins.",
    artifactsSummary: (n: number, description: string) => `${n} artifacts · ${description}`,
    hookTitle: 'hook',
    mcpTitle: 'MCP server',
    runsHooks: 'Runs hooks',
    startsMcp: 'Starts MCP servers',
    remove: (name: string) => `Remove ${name}`,
    setRuns: 'This set runs',
    hooks: (n: number) => `${n} ${plural(n, 'hook')}`,
    andStarts: 'and starts',
    mcpServers: (n: number) => `${n} ${plural(n, 'MCP server')}`,
    needs: 'Needs',
    unpinned: (n: number) => `${n} unpinned (heuristic).`,
    review: 'Review',
    copyShareLink: 'Copy share link',
    outputLabel: 'Output',
    download: 'Download',
    copy: 'Copy',
  },

  plugin: {
    notFound: (name: string) => `plugin “${name}”`,
    runKinds: {
      hook: 'Hook',
      mcp: 'MCP server',
      env: 'Env var',
      tools: 'Allowed tools',
    },
    envMeta: 'read by MCP server',
    envSummary: (servers: string) => `Read by MCP server ${servers}.`,
    toolsMeta: 'pre-approved',
    toolsSummary: 'Claude can run these without asking.',
    crumbsCatalog: 'Catalog',
    crumbsPlugins: 'Plugins',
    hooks: (n: number) => `${n} ${n > 1 ? 'hooks' : 'hook'}`,
    mcpServers: (n: number) => `${n} ${n > 1 ? 'MCP servers' : 'MCP server'}`,
    needs: (v: string) => `Needs ${v}`,
    noHooksOrMcp: 'No hooks or MCP',
    runsTitle: 'What this runs on your machine',
    runsSource: 'Parsed from hooks.json and .mcp.json at build',
    runsNone: 'No hooks, MCP servers or pre-approved tools. This plugin only adds instructions.',
    contents: (n: number) => `Contents · ${n}`,
    readmeLabel: 'README',
    readmeFile: 'README.md',
    install: 'Install',
    copyInstallCommand: 'Copy install command',
    firstTime: 'First time? Run',
    facts: {
      version: 'Version',
      updated: 'Updated',
      owners: 'Owners',
      license: 'License',
      source: 'Source',
    },
    sourcePath: (name: string) => `plugins/${name}`,
    recentChanges: 'Recent changes',
  },

  security: {
    title: 'What runs on your machine',
    lede: 'Every hook and MCP server in the marketplace, read from the plugin manifests at build time.',
    execCount: (exec: number, total: number, quiet: number) => `${exec} of ${total} plugins execute code; ${quiet} have no hooks or MCP.`,
    scope: (n: number) => `Install set · ${n}`,
    showAll: 'Show all plugins',
    filterByFlag: 'Filter by flag',
    noHooksOrMcp: 'No hooks or MCP',
    sort: 'Sort',
    sortName: 'Name',
    sortFlags: 'Most flags',
    tableLabel: 'Plugins and what they run',
    columns: {
      plugin: 'Plugin',
      hooks: 'Hooks',
      mcp: 'MCP servers',
      env: 'Env vars',
      bash: 'Bash',
      flags: 'Flags',
    },
    cellLabels: {
      hooks: 'Hooks',
      mcp: 'MCP',
      env: 'Env',
      bash: 'Bash',
    },
    yes: 'yes',
    none: 'none',
    noMatch: 'No plugin matches these filters.',
    disclaimer: 'Informational, not a safety rating. Heuristic flags can be wrong; see',
    securityDoc: 'docs/SECURITY.md',
  },

  notFound: {
    page: 'page',
    title: (what: string) => `No such ${what}`,
    text: 'It may have been renamed or removed from the marketplace. Search the catalog instead:',
    searchPlaceholder: 'e.g. release notes',
    searchLabel: 'Search the catalog',
    back: 'Back to the catalog',
  },

  /** Shown for empty values in tables and fact lists. */
  empty: '—',
};

export type Strings = typeof en;

export const t: Strings = en;
