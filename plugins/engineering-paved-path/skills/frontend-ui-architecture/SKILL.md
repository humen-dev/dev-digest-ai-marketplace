---
name: frontend-ui-architecture
description: "Architecture and code-organization rules for a React / Next.js (App Router) frontend: where components, hooks, constants, helpers, styles, types, tests and business logic live, how to split a component, which layers may import which, and where the server/client boundary goes. Use whenever creating, moving, splitting or reviewing UI code — a new page, feature or _components/<Name> folder, a component that keeps growing, 'where should this constant/helper/hook/type go', restructuring, or a structure-focused PR review — even if the user never says 'architecture'. Not for effects/memoization/keys/a11y (react-best-practices), Next.js APIs (next-best-practices), test technique (react-testing-library), or Zod."
metadata:
  version: "2.0.0"
---

# Frontend UI Architecture

How UI code is **organized** in a React frontend (examples: Next.js App Router, React 19,
TanStack Query against a separate HTTP API): where each kind of code lives, when to split, and
which way dependencies point.

The principles are general. The paths below use a **neutral sample application** — an admin UI
for a commerce API with routes such as `app/orders/`, `app/orders/[orderId]/` and `app/customers/`,
shared UI in `src/components/`, non-visual shared code in `src/lib/`, and the design-system and
contracts packages vendored or installed as `@acme/ui` and `@acme/contracts` (placeholders for your
own). **Map them onto your project's folders** before applying a rule — see
[project-mapping](references/project-mapping.md).

Version 2.0.0 — sources, rationale and history are in [README.md](README.md).

## Scope — what this skill owns, and what it leaves to others

Restating rules that another skill already owns creates two sources of truth that
drift apart. Link instead.

| Question | Owner |
|---|---|
| Where does this file / constant / helper / hook / type / test live? How do I split it? Which layer may import which? Where does `'use client'` go? | **this skill** |
| Effects, derived state, memoization, keys, conditional rendering, a11y, error boundaries, size limits | `react-best-practices` |
| Next.js APIs: async `params`, metadata, route handlers, RSC serialization errors, image/font | `next-best-practices` |
| How to write component tests | `react-testing-library` |
| Schemas and contracts | `zod`, your shared contracts package |
| How *your* app is wired end to end | your project's UI architecture doc / agent guide, if it has one |

Precedence when guidance conflicts: your project's own written frontend rules > this skill >
generic advice.

## The six rules

1. **Colocate by default; promote on the second real consumer.** Code that changes
   together should sit together, and a `shared/` folder created "just in case"
   becomes a dumping ground. Start inside the file, then the component folder, then
   the route, then `src/components` / `src/lib`. If two uses look alike but the shared
   shape isn't obvious yet, tolerate the duplicate — a wrong abstraction costs more
   than a copy.
2. **Dependencies point one way:** packages/vendored kits ← `lib` ← `components` ← `app`. A route
   never imports another route's `_components`; if two routes need it, promote it.
   This is what keeps a feature deletable and a refactor local.
3. **Every kind of code has exactly one home** (see the table below). When each file
   type means one thing, a reader knows where to look without searching.
4. **Name by purpose, not by form.** `format-money.ts` and `order-urls.ts` tell you
   what is inside; `utils.ts`, `misc.ts`, `common/` do not, and they grow forever.
5. **Pages wire, views render, hooks and helpers decide.** Business rules in JSX are
   untestable and unreadable; in pure functions and hooks they are neither.
6. **Small public surface.** A component folder exposes one `index.ts`; nothing
   outside imports its internals. Do not add barrels that aggregate many folders.

## Where does X go?

| You have… | It goes in… |
|---|---|
| JSX used by one route | `app/<route>/_components/<Name>/` |
| JSX used by 2+ routes, no route knowledge | `src/components/<group>/<Name>/` |
| Primitive UI (button, badge, toggle) | your design-system package (`@acme/ui`) — if it is vendored, edit at the source package |
| Constant used by one component | `<Name>/constants.ts` (`UPPER_SNAKE`) |
| Constant shared across features | a purpose-named module in `src/lib/` |
| Pure function (format, map, group, pick a colour) | `<Name>/helpers.ts`; shared → `src/lib/<purpose>.ts` |
| Style objects (or class-name maps) | `<Name>/styles.ts` (exported as `s`) |
| Server data (fetch / mutate / invalidate) | `src/lib/hooks/<domain>.ts` over `src/lib/api.ts` — never in a component |
| View logic that needs React (form state, shortcuts, filtering pipeline) | a `use<Thing>` hook beside the component (`<Name>/hooks/` or `<Name>/use<Thing>.ts`) |
| Complex local state transitions | `reducer.ts` beside that hook (pure, tested alone) |
| App-wide cross-cutting state (theme, toast, current store/tenant) | provider in `src/lib/*.tsx`, mounted in `providers.tsx` |
| Contract / DTO type | your shared contracts package (`@acme/contracts`); never redeclare it |
| Component-local types | inline props; `types.ts` only when 2+ files in the folder need it |
| User-visible string (localised app) | your i18n message files (e.g. `messages/<locale>/<namespace>.json` + `useTranslations`) |
| Test | `<Name>.test.tsx` next to the component |

Details and reasoning: [references/folder-structure.md](references/folder-structure.md),
[references/component-anatomy.md](references/component-anatomy.md).

## Component folder — the template

```
_components/OrderCard/
  OrderCard.tsx      # the component; the only file that renders the main JSX
  constants.ts       # values, maps, option lists
  helpers.ts         # pure functions: no React, no I/O
  styles.ts          # style objects
  hooks/ | useX.ts   # optional: view logic that uses React
  types.ts           # optional
  _components/       # optional: pieces used only by this component
  OrderCard.test.tsx # optional
  index.ts           # export { OrderCard } from "./OrderCard"
```

Create files on demand. An empty `helpers.ts` is noise, and the point of the
taxonomy is that each file present has a reason to exist.

## When to split a component

Split by **reason to change**, not by line count (size limits live in
`react-best-practices`):

- Orchestration (data, routing, state) vs presentation → separate; the view then
  takes props and is testable without a QueryClient.
- A block with its own props that is repeated or independently meaningful → a child
  in the nested `_components/`. Keep nesting to two levels; deeper means promote or
  flatten.
- State only one subtree uses → push it into that subtree.
- Do not add a wrapper that only forwards props, and do not extract a hook nobody
  else would ever want to name.

## Where business logic lives

Each layer only calls downward; a component never calls `fetch` or `api` directly.

shared contracts → `src/lib/api.ts` → `src/lib/hooks/<domain>.ts`
(query key + fn + invalidation) → pure helpers → view hook → view → page.

State escalates in this order: local `useState` → nearest common parent → URL search
params (shareable filters) → provider (only for cross-cutting) — and server data stays
in the server-state cache (TanStack Query, SWR), never copied into `useState`. Full guide:
[references/business-logic-layers.md](references/business-logic-layers.md).

## Server / client boundary (placement only)

- `page.tsx` and `layout.tsx` stay thin; they wire, they don't hold logic.
- Put `'use client'` on the entry file of each interactive subtree (anything using
  hooks, state, or `window`); modules it imports inherit it, so do not sprinkle it on
  every file.
- Cross the boundary with serializable props and `children` slots; mount providers as
  deep as possible.

Next-specific rules and the version caveat:
[references/nextjs-app-router-architecture.md](references/nextjs-app-router-architecture.md).
Without Next.js (Vite SPA, Remix, React Router) the boundary section does not apply; every other
rule does.

## Workflow

**Creating UI** — 1) find the route and check `src/components` / `src/lib` for an
existing piece before writing one; 2) scaffold only the files you need; 3) put each
kind of code in its home; 4) run the checklist below.

**Refactoring / reviewing** — read the file top to bottom and ask the checklist
questions; report a violation with the target location, not just "move this".

### Checklist

- [ ] Page is wiring only (no filtering, sorting, or constants inline).
- [ ] No data fetching in a component body; data comes from `src/lib/hooks/*` (or your equivalent).
- [ ] Constants, pure functions and style objects are not defined inside the
      component file when they have a home (`constants.ts`, `helpers.ts`, `styles.ts`).
- [ ] Nothing imports another route's `_components` or a component's internals.
- [ ] Cross-folder imports use the path alias (`@/`); relative paths only within the same
      component folder.
- [ ] New shared module is purpose-named; no `utils.ts` / `common/`.
- [ ] Types come from the shared contracts when a contract exists.
- [ ] User-visible strings go through the i18n message files (localised apps).
- [ ] Test sits beside the component.

## Reference index — read only what the task needs

| File | Read it when |
|---|---|
| [references/folder-structure.md](references/folder-structure.md) | Deciding where a new file or module belongs; promotion; imports; barrels; naming |
| [references/component-anatomy.md](references/component-anatomy.md) | Creating or splitting a component; what belongs in each file |
| [references/business-logic-layers.md](references/business-logic-layers.md) | Moving logic out of JSX; designing hooks, reducers, view models |
| [references/nextjs-app-router-architecture.md](references/nextjs-app-router-architecture.md) | Routes, layouts, private folders, `'use client'` placement, providers |
| [references/project-mapping.md](references/project-mapping.md) | Mapping the rules onto your folders; recording drift, settled decisions and open items |
