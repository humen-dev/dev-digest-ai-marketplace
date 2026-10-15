# Folder structure

Where files live in a Next.js App Router frontend (`src/` of the sample app), how code moves
between layers, and how to import it. Use this when the question is "where does this new file or
module belong?". Translate the paths with your [project mapping](project-mapping.md).

## The layers

```
src/
  app/                          # routes: thin page.tsx / layout.tsx + colocated private code
    <route>/
      page.tsx                  # wiring only
      _components/<Name>/       # views/components used by THIS route
      constants.ts, helpers.ts, styles.ts   # route-level code shared by the route's components
  components/                   # shared UI used by 2+ routes (app-shell, data-table, page-header, …)
    <group>/<Name>/
  lib/                          # non-visual shared code
    api.ts                      # transport (the only place that talks HTTP)
    hooks/<domain>.ts           # server-state hooks (orders.ts, customers.ts, …)
    <purpose>.ts                # format-money.ts, order-urls.ts, status-label.ts, …
    *.tsx                       # cross-cutting providers: theme, toast, store-context, providers
  vendor/                       # optional: vendored design system / contracts — never edit here
messages/<locale>/<namespace>.json   # if the app is localised
```

**Dependency direction:** packages / `vendor/*` ← `lib` ← `components` ← `app`. Each layer may
import only from layers to its left.

Why it matters: when dependencies point one way, deleting or moving a feature cannot
break something that "reached in" from the side. Bulletproof React states the same
rule as `shared → features → app` and enforces it with ESLint
`import/no-restricted-paths`; in this layout there is no separate `features/` layer, so the route
folder plays that role. You can enforce the direction the same way (ESLint
`import/no-restricted-paths`, `eslint-plugin-boundaries`, or dependency-cruiser forbid rules such as
"`src/lib` must not import `src/components` or `src/app`" and "`app/<a>/_components` must not be
imported from `app/<b>`").

Extra rule inside `app/`: a route never imports from another route's `_components`.
If two routes need it, promote it (next section).

## Promotion ladder

Move code up only when a **second real consumer** appears:

1. inside the component file →
2. a sibling file in the component folder (`constants.ts`, `helpers.ts`, …) →
3. route level (`app/<route>/helpers.ts`, `app/<route>/_components/`) — shared by
   several components of one route →
4. `src/components/<group>/` (UI) or `src/lib/<purpose>.ts` (non-UI) — shared by
   several routes.

The rule of thumb from the sources: if exactly one feature uses a util it lives inside
that feature; once two or more need it, it moves to the shared layer (Robin Wieruch).
Kent C. Dodds adds the counterweight (AHA — avoid hasty abstractions): duplication is
cheaper than the wrong abstraction, so if the two uses only look alike, wait for the
third before extracting.

## Organizing by route vs by feature

Next.js documents three strategies and calls the choice a matter of preference — the
only rule is to pick one and stay consistent: files outside `app/`, top-level folders
inside `app/`, or **splitting by feature or route**. This skill uses the third, plus a
shared `components/` and `lib/`. Josh Comeau's function-based layout (`components/`,
`hooks/`, `helpers/`, constants) is the model for the *shared* layers. A separate
`features/` layer (Bulletproof, Feature-Sliced Design) is **optional**: start without it, and
introduce it only when several routes start sharing a domain (e.g. order editing used by both
`app/orders` and `app/customers/[id]`). Record the choice in your
[project mapping](project-mapping.md).

## Naming

| Thing | Convention |
|---|---|
| Component folder | `PascalCase/` with `Name.tsx` and `index.ts` |
| Hook file | `useThing.ts` (one hook) or `<domain>.ts` in `lib/hooks` (a domain's hooks) |
| Constants | `UPPER_SNAKE` values in `constants.ts` |
| Shared non-UI module | kebab-case, named by what it does: `format-money.ts` |
| Tests | `Name.test.tsx` / `thing.test.ts` beside the file |

**Purpose over form.** Feature-Sliced Design warns that segment names like
`components`, `hooks`, `types` "aren't that helpful when you're looking for code". Apply
that to *shared* modules: prefer `format-money.ts` to `utils.ts`. Inside a component
folder the fixed names (`constants.ts`, `helpers.ts`, `styles.ts`) are fine because the
folder already tells you the domain.

**Helper vs utility.** Josh Comeau separates a *helper* (specific to this project) from
a *utility* (a generic function). Here that maps to: project/domain logic →
`helpers.ts` beside its consumer; generic and reusable → a purpose-named module in
`src/lib/`.

## Barrels (`index.ts`)

- Keep **one `index.ts` per component folder** as its public API
  (`export { OrderCard } from "./OrderCard"`).
- Do **not** add barrels that gather many folders (`components/index.ts`) or chains of
  `export *`. Bulletproof React drops feature-level barrels because they hurt tree
  shaking and dev performance; Comeau and Wieruch keep them at the component-folder level.
  Both positions agree on this split.
- If a `src/lib/hooks/index.ts` barrel already exists, tolerate it, but have new code import the
  domain file directly (`@/lib/hooks/orders`) so the dependency is explicit.

## Import rules

- Anything that leaves the component's own folder uses the path alias
  (`@/lib/hooks/orders`, `@/components/app-shell`), configured in `tsconfig.json`
  (`"paths": { "@/*": ["./src/*"] }`). Deep relative chains like
  `../../../../lib/hooks/orders` break silently when a folder moves.
- Relative imports (`./`, one `../`) only within the same component folder.
- Import from another folder through its `index.ts`, never into its internals.
- Do not mass-rewrite existing relative imports as part of unrelated work.

## Anti-patterns

| Smell | Why it hurts | Instead |
|---|---|---|
| `utils.ts` / `common/` / `misc` | Grows without limit; nothing says what belongs | Purpose-named module |
| Route A imports `app/routeB/_components/X` | Hidden coupling between routes | Promote X to `src/components` |
| Shared folder for a single consumer | Speculative; hides who owns it | Keep it beside the consumer |
| Flat `components/` with dozens of files | Nothing groups related code | `components/<group>/<Name>/` |
| One `types/` folder for everything | Types get separated from what they describe | Colocate; contracts in the shared contracts package |
| Barrel of barrels | Cycles, slow dev server | One `index.ts` per component |

## Sources

Next.js — [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) ·
[Bulletproof React — project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) ·
[Robin Wieruch — React folder structure](https://www.robinwieruch.de/react-folder-structure/) ·
[Josh Comeau — file structure](https://www.joshwcomeau.com/react/file-structure/) ·
[Feature-Sliced Design — slices and segments](https://feature-sliced.design/docs/reference/slices-segments) ·
[Kent C. Dodds — Colocation](https://kentcdodds.com/blog/colocation) ·
[Kent C. Dodds — AHA Programming](https://kentcdodds.com/blog/aha-programming).
Full list with verification status: [README.md](../README.md#sources).
