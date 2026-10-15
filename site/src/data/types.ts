export type Kind = 'skill' | 'agent' | 'command' | 'hook' | 'mcp';

/** A hook entry from hooks/hooks.json (or inline in plugin.json). */
export interface Hook {
  event: string;
  matcher: string | null;
  command: string;
}

/** An MCP server from .mcp.json (or inline in plugin.json). */
export interface McpServer {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  /** stdio: the command line; http/sse: null. */
  command: string | null;
  /** http/sse: the server URL; stdio: null. */
  url: string | null;
  /** Variable names only; values are never part of the catalog. */
  env: string[];
}

/** Skills, agents and commands. Hooks and MCP servers are derived from config. */
export interface Artifact {
  kind: 'skill' | 'agent' | 'command';
  name: string;
  description: string;
  /** Extra search words: synonyms, Ukrainian keywords (frontmatter `keywords`). */
  keywords: string;
  /** File the artifact was read from, relative to the marketplace root. */
  path?: string;
  /** Markdown headings of the body, for search. */
  headings?: string[];
  /** Plain text of the body, truncated to 8,000 characters, for search. */
  body?: string;
}

export interface Plugin {
  name: string;
  /** null = tracks main (no pinned version). */
  version: string | null;
  description: string;
  /** ISO date of the last change. */
  updated: string;
  /** CODEOWNERS entries matching the plugin folder. */
  owners: string[];
  license: string | null;
  /** allowed-tools / tools requested by the plugin's skills, agents and commands. */
  tools: string[];
  hooks: Hook[];
  mcp: McpServer[];
  artifacts: Artifact[];
  /**
   * Author notes from the README "## What it runs" section (§8.2),
   * keyed by hook name, MCP server key or env var name.
   */
  notes: Record<string, string>;
  readme: { title: string; body: string[] };
  /** Generated catalogs: recent commits touching the plugin folder; `version` holds the commit date (YYYY-MM-DD). */
  changes: { version: string; text: string }[];
  /** Non-relative marketplace source (github, git, npm …): listed from the marketplace entry, not crawled. */
  external?: boolean;
  /** Folder relative to the marketplace root ("plugins/<name>"), or the URL of an external source. */
  source?: string;
}

/** A non-fatal extraction issue (invalid frontmatter, unknown README note, …). */
export interface Diagnostic {
  path: string;
  message: string;
}

export interface Catalog {
  marketplace: string;
  repo: string;
  /** True while the catalog is sample data rather than built from plugins/. */
  sample: boolean;
  plugins: Plugin[];
  /** Non-fatal issues found while generating the catalog. */
  diagnostics?: Diagnostic[];
}
