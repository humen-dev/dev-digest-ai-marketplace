# Catalog site

The marketplace catalog website: search, plugin pages, install set and
security view. Vite + React + TypeScript, deployed to GitHub Pages at
<https://humen-dev.github.io/dev-digest-ai-marketplace/>.

The UI follows the "Catalog Explorations" design in the
[Claude Design project](https://claude.ai/design/p/05132151-eaa3-4c14-a87d-a89c14a1b622) (access required).
The mockups are not stored in this repository.

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

Open <http://localhost:5173/>. The dev server reloads on save.

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

## Translations

All user-visible UI text lives in `src/i18n/en.ts`: a plain typed object
grouped by page or component (`home`, `install`, `plugin`, `security`, ...).
Strings that need values are small functions, for example
`matches: (n: number) => ...`. Components import `t` and render
`{t.home.title}` instead of a literal. Plugin data in `src/data/` is not
translated here.

To add a string, put it in the right group in `en.ts` and reference it from the
component. `src/i18n/no-hardcoded-text.test.ts` fails `npm test` when a
component or page has JSX text or an `aria-label`, `title`, `placeholder` or
`alt` string literal that contains letters.
