# Catalog site

The marketplace catalog website: search, plugin pages, install set and
security view. Vite + React + TypeScript, deployed to GitHub Pages at
<https://humen-dev.github.io/dev-digest-ai-marketplace/>.

The UI follows the Claude Design explorations in [`../design/`](../design/),
which are published unchanged at `/design/`.

> The catalog data in `src/data/catalog.ts` is **sample data** from the
> design. The marketplace has no plugins yet; generating the catalog from
> `.claude-plugin/marketplace.json` and `plugins/` is the next step
> (see [docs/specs/catalog-site.md](../docs/specs/catalog-site.md) §6).

## Develop

Requires Node 22.12+.

```bash
cd site
npm install
npm run dev
```

Open <http://localhost:5173/>. The dev server reloads on save and also serves
`../design/` at <http://localhost:5173/design/>.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm test` | Unit tests (search, install set) with Vitest |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check and build to `dist/` for GitHub Pages |
| `npm run preview` | Serve the production build at `/dev-digest-ai-marketplace/` |

## Layout

```text
src/
  data/       catalog types and (sample) data
  lib/        search, install-set generators, app state (set + theme)
  components/ layout (header, footer, install-set bar) and shared UI
  pages/      Home (search), PluginPage, InstallPage, SecurityPage, NotFound
```

## GitHub Pages

- `vite.config.ts` sets `base` to `/dev-digest-ai-marketplace/` for builds.
  Override with `SITE_BASE=/other/ npm run build` (for example, a custom domain
  uses `/`).
- Pages has no SPA fallback, so the build copies `index.html` to `404.html`.
  Deep links such as `/plugins/devdigest-backend/` then load the app, which
  renders the right page.
- `.github/workflows/pages.yml` runs `npm ci`, `npm test` and `npm run build`
  on pull requests, and also deploys on pushes to `main`.
- Repository settings: Settings → Pages → Source: **GitHub Actions**.
