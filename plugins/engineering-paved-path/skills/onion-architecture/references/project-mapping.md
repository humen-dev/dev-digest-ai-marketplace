# Mapping the rings onto your project

Read this before applying the rules to a real codebase. The skill uses a neutral sample app
(`src/modules/orders/…`); your project has its own folders, names and history. Map once, write the
map down, and keep it next to your code (an architecture doc, an agent guide such as `AGENTS.md` or
`CLAUDE.md`, or a `docs/architecture/onion-mapping.md`). Reviewers and agents then apply the rules
to *your* paths.

## 1. Rings → your paths

Fill this table for your backend. One row per ring; list concrete globs.

| Ring | Sample app | Your project |
|---|---|---|
| 1 Domain | `src/shared/contracts/**` · `src/modules/*/domain/**` · `src/modules/*/{constants,types}.ts` · `platform/errors.ts` · pure engines/libraries | … |
| 2 Application | `src/modules/*/service.ts` · `src/modules/*/ports.ts` · `src/shared/ports.ts` | … |
| 3 Infrastructure | `src/modules/*/repository.ts` (or `repository/`) · `src/modules/*/mappers.ts` · `src/db/**` · `src/adapters/**` · `platform/{jobs,events}.ts` | … |
| 4 Presentation & composition | `src/modules/*/routes.ts` · shared route helpers (request context, common schemas) · `src/modules/index.ts` · `app.ts` · `platform/container.ts` | … |

Typical translations:

| If your project has… | Map it as |
|---|---|
| `controllers/` + `services/` + `repositories/` (layer-first) | Same rings; slices are implicit. Consider grouping by feature over time — the rules work either way. |
| NestJS `*.controller.ts` / `*.service.ts` / `*.module.ts` | controller → 4, service → 2, `*.module.ts` → composition root, providers that wrap SDKs → 3 |
| `handlers/` (serverless) | 4 — each handler resolves context and calls one use case |
| `lib/` or `utils/` | split: pure transforms → 1; anything with I/O → 3 behind a port |
| A shared contracts **package** (monorepo `packages/contracts`) | 1 — edit at source; never patch a vendored/built copy |
| Prisma `schema.prisma` + generated client | the client is the ORM: allowed only in repositories |

## 2. Reference implementations

List 3–5 files in your codebase that already have the right shape, so contributors copy them:
a thin route, a service with a `Deps` interface, a repository that returns contracts, an adapter with
a fake, the error handler. Example (sample app):

- `modules/catalog/repository.ts` — tenant-scoped, no HTTP, single owner of its tables.
- `adapters/mocks.ts` + `ContainerOverrides` — every port has a deterministic fake and an injection point.
- `platform/errors.ts` + the error handler in `app.ts` — services throw, one place maps.

## 3. Table ownership

| Table(s) | Owning module |
|---|---|
| … | … |

Every new table gets a row here when it is introduced (rule 8).

## 4. Published `types.ts` exceptions (rule 11)

| File | Why it is published | Consumers |
|---|---|---|
| … (e.g. `modules/catalog-intel/types.ts` — the `CatalogIntel` facade) | facade interface + result types | … |

Keep this list short. Everything not listed is private.

## 5. Known drift and migration order

Run the import-rule check without the baseline (`-T err`) and record what exists, grouped by rule:

| Rule | Count | Where |
|---|---|---|
| … | … | … |

Also note drift the linter cannot see: services constructed in routes, repositories without a port,
writes to tables another module owns, barrels that re-export services/repositories/mappers.

A migration order that works on most codebases (separate tasks — never inside an unrelated change):

1. **Small routes → repository methods.** Routes that query the database directly; lowest risk.
2. **Move shared constants inward** where adapters or other modules import a module's `constants.ts`.
3. **The biggest route-heavy module:** introduce its repository port + service, move the queries and
   external calls out of its routes. Biggest single win; keep read-time aggregation in one repository method.
4. **Services off `Container`,** smallest first; the one the container builds with `this` last (it
   breaks the container ↔ service cycle).
5. **Helpers that touch the schema** → mappers beside the repository.
6. Introduce a `TransactionRunner` the first time a use case needs atomic multi-writes.

Each step ends with regenerating the baseline ([enforcement](enforcement.md)); it should only shrink.

## 6. Settled decisions

Record decisions so they are not re-litigated in every review. Defaults this skill recommends:

| Decision | Default | Why |
|---|---|---|
| Domain depth | **Pragmatic**: contracts + pure functions; entity classes/aggregates only where the domain is genuinely complex | Most service backends are orchestration around I/O |
| Enforcement | Skill **and** import rules in CI | Review alone lets drift accumulate |
| Legacy code | Rules bind new and touched code; existing drift frozen in a baseline and migrated in separate tasks | Scope discipline |
| Repository interfaces | Application ring (`ports.ts`) | The domain should not know persistence exists |
| Layout | Feature slices with the onion inside; no big-bang directory renames | Slices talk through small public surfaces |
| Transaction owner | The service, via a `TransactionRunner` port | One use case = one boundary |
| Row types | Infrastructure-only; new code returns contracts | Schema changes must not ripple inward |

Add a row (with the date and who decided) whenever you scope an exception into a rule.

## 7. Open items

Things you have not classified yet — typical ones:

- **`platform/*` (or `lib/`)** mixes pure kernel (`errors`, formatting) and infrastructure (`jobs`,
  `events`, logging sinks); split it so the rules can cover it.
- **`helpers.ts`** mixes pure transforms and row mappers; rename the mappers to `mappers.ts` so a rule
  can distinguish them.
- **Shared row-type files** — decide whether contracts fully replace them.
- **Where `TransactionRunner` lives** — prefer `src/platform/transaction.ts`; avoid the shared contracts
  package unless a second package needs the port.
