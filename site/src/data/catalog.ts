import data from '@catalog-data';
import type { Catalog } from './types';

// The catalog is generated at build time by scripts/build-catalog.mjs from
// .claude-plugin/marketplace.json, plugins/ and git history
// (docs/specs/catalog-site.md §6). `@catalog-data` resolves in vite.config.ts:
//   npm run dev / build  → src/generated/catalog.json (this repository)
//   npm run dev:fixtures → src/generated/catalog.fixtures.json (test/fixtures)
//   npm test             → src/generated/catalog.fixtures.json
// Hooks and MCP servers are listed as config; their catalog entries, names and
// summaries are derived in src/lib/catalog.ts (§6.1, §8.1).
export const catalog: Catalog = data;
