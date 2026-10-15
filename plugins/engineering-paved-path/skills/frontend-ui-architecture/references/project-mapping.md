# Mapping the rules onto your frontend

Read this before applying the rules to a real codebase. The skill uses a neutral sample app
(`src/app/orders/_components/OrderCard/…`); your frontend has its own folders, packages and
history. Map once, write the map down, and keep it next to your code (a UI architecture doc, an
agent guide such as `AGENTS.md` or `CLAUDE.md`, or `docs/architecture/ui-mapping.md`). Reviewers and
agents then apply the rules to *your* paths.

## 1. Rules → your paths

| Rule / layer | Sample app | Your project |
|---|---|---|
| Component folder with fixed files | `src/app/orders/_components/OrderCard/` (`OrderCard.tsx`, `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts`, test) | … |
| Thin page | `src/app/orders/page.tsx` renders `<OrdersListView />` only | … |
| Nested `_components` | `src/app/orders/[orderId]/_components/OrderTimelineDrawer/_components/TimelineSection/` | … |
| Route-level shared pure code | `src/app/stores/[storeId]/orders/helpers.ts` | … |
| Shared UI, promoted from routes | `src/components/{app-shell,data-table,page-header,not-found-state}` | … |
| Component-group hooks | `src/components/app-shell/hooks/*` | … |
| Server-state hooks by domain | `src/lib/hooks/{orders,customers,catalog}.ts` over `src/lib/api.ts` | … |
| Purpose-named shared modules | `src/lib/{format-money,order-urls,status-label}.ts` | … |
| Cross-cutting providers | `src/lib/{providers,theme,toast,store-context}.tsx` | … |
| Design system / contracts | `@acme/ui`, `@acme/contracts` (installed or vendored under `src/vendor/`) | … |
| Path alias | `tsconfig.json` → `"@/*": ["./src/*"]` | … |
| i18n messages | `messages/<locale>/<namespace>.json` | … |

Typical translations:

| If your project has… | Map it as |
|---|---|
| Vite / React Router SPA (`src/pages/`, `src/routes/`) | route folders = `app/<route>`; the server/client boundary section does not apply |
| Next.js Pages Router (`pages/`) | `pages/*.tsx` = thin pages; colocate feature code in `src/features/<route>/` because `pages/` cannot hold non-route files |
| A `features/` layer | sits between `components` and `app`: `lib` ← `components` ← `features` ← `app`; features never import each other |
| A monorepo `packages/ui` | the design-system package: primitives live there, not in `src/components` |
| Data via Server Components / Server Actions | the layers in `business-logic-layers.md` still apply; the transport layer becomes a server-only Data Access Layer |

## 2. Reference implementations — copy these

List 3–5 files that already have the right shape (a component folder, a thin page, a domain hook
file, a promoted shared component). New contributors and agents copy these.

## 3. Known drift — do not copy

Record places that break a rule, with the target, so nobody copies them:

| Where | Drift | Target |
|---|---|---|
| e.g. `src/app/stores/[storeId]/orders/page.tsx` | Not thin: filter/sort pipeline, counts and a mid-file `OPEN_STATUSES` constant live in the page | Pure functions in the route's `helpers.ts`, the constant in `constants.ts`, UI state in a view hook, render from `OrdersListView` in `_components/` (see [business-logic-layers.md](business-logic-layers.md)) |
| e.g. a component importing `../../../../lib/hooks/orders` | Deep relative import | `@/lib/hooks/orders` |
| e.g. hard-coded user-visible strings in a localised app | Bypasses i18n | message file + `useTranslations` |
| e.g. a static inline `style={{…}}` block | Style without a home | `styles.ts` |
| e.g. `src/lib/hooks/index.ts` barrel over all domains | Barrel above component level | Tolerated; new code imports `@/lib/hooks/<domain>` |

Fixing drift is a separate task, not a drive-by inside unrelated work.

## 4. Settled decisions

Decisions the team has made, so they are not re-litigated in every review. Common ones:

| Decision | Options | Record |
|---|---|---|
| Persistent chrome (shell, nav, breadcrumbs) | In a layout (Next.js default: preserved across navigation) **or** rendered per page (the page owns its breadcrumbs; the shell remounts on navigation) | which one, who decided, when |
| `features/` layer | None (route folders + `components` + `lib`) **or** a `features/` layer | which one, and the trigger to revisit |
| Styling | style objects in `styles.ts` / Tailwind classes / CSS modules / `cva` variants | which one goes in `styles.ts` |
| Server data | client cache (TanStack Query / SWR) **or** Server Components + DAL | pick one approach; do not mix |

## 5. Open items

Things not yet decided — typical ones:

1. **App-wide constants.** If no shared constants module exists, create a purpose-named one in
   `src/lib/` when the first cross-feature constant appears; do not pre-create it.
2. **`'use client'` on `page.tsx`.** Pages that carry it because they call hooks directly should
   become a server `page.tsx` rendering a client view; changing existing pages is a refactor, not a
   drive-by.
3. **Framework versions.** Recheck version-tied advice (e.g. `proxy.ts`, Cache Components in
   Next 16) against the version your app runs before recommending it.
4. **Cross-skill mismatches.** If another skill names helpers your codebase does not have (e.g.
   wrapper hooks over the query library), follow the code and note the mismatch here.
