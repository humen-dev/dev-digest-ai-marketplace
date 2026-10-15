export type Kind = 'skill' | 'agent' | 'command' | 'hook' | 'mcp';

export interface Hook {
  event: string;
  matcher: string | null;
  command: string;
}

export interface McpServer {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command: string;
  env: string[];
}

export interface Artifact {
  kind: Kind;
  name: string;
  description: string;
  /** Extra search words: synonyms, Ukrainian keywords. */
  keywords: string;
}

export interface Plugin {
  name: string;
  /** null = tracks main (no pinned version). */
  version: string | null;
  description: string;
  /** ISO date of the last change. */
  updated: string;
  owner: string;
  license: string;
  tools: string[];
  hooks: Hook[];
  mcp: McpServer[];
  artifacts: Artifact[];
  readme: { title: string; body: string[] };
  changes: { version: string; text: string }[];
}

export interface Catalog {
  marketplace: string;
  repo: string;
  /** True while the catalog is sample data rather than built from plugins/. */
  sample: boolean;
  plugins: Plugin[];
}
