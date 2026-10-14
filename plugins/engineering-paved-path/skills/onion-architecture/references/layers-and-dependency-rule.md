# Layers and the dependency rule

Read this when you are unsure which ring a file belongs to, or whether an import is allowed.
Paths use the sample app from `SKILL.md` (`src/modules/<name>/…`); translate them with your
[project mapping](project-mapping.md).

## The rule

Source dependencies point **inward only**. Code in an inner ring must not mention the name
of anything declared in an outer ring — not a class, a type, a function or a constant
(Palermo, Martin: sources 1.1, 1.7 in the [README](../README.md#sources)).
Type-only imports count: `import type { OrderRow }` is still a dependency on the
infrastructure ring, and an import linter should be configured to see it (in dependency-cruiser:
`tsPreCompilationDeps: true`).

When an inner ring needs something an outer ring provides, it declares a **port** (an
interface it owns) and the outer ring implements it. Control flow goes outward at runtime;
source dependencies still point inward.

## What each ring may contain

| Ring | May contain | Must not contain |
|---|---|---|
| **1 Domain** | Zod contracts and inferred types, pure functions, constants, discriminated unions, small value helpers | the HTTP framework, the ORM, the DB driver, any vendor SDK, `fs`/network, `process.env`, `Container`, rows |
| **2 Application** | Use-case classes/functions, port interfaces, orchestration, transaction boundary, `AppError` throws | HTTP objects, SQL, `db/schema`, row types, SDK types, `new Adapter()` |
| **3 Infrastructure** | ORM repositories, mappers, SDK adapters, job runner, event bus, file/process access | Business decisions, HTTP concerns, imports from `routes.ts` |
| **4 Presentation & composition** | Framework plugins/routers, zod route schemas, request-context resolution, the DI container, app bootstrap | SQL, business rules, direct `new` of repositories in a route |

## Allowed imports

Rows = the importing ring, columns = what it may import. "own" = the same module; other modules
only through `index.ts` (see Barrels) and `ports.ts`; another module's `types.ts` is private except
a recorded published exception (rule 11).

| Importer ↓ / imports → | 1 Domain | 2 Application | 3 Infrastructure | 4 Presentation |
|---|---|---|---|---|
| **1 Domain** | ✅ | ❌ | ❌ | ❌ |
| **2 Application** | ✅ | ✅ own | ❌ (ports only) | ❌ |
| **3 Infrastructure** | ✅ | ✅ (implements ports) | ✅ own | ❌ |
| **4 Presentation** | ✅ | ✅ | ❌ (reached via the container) | ✅ own |
| **Composition root** (`container.ts`, `app.ts`) | ✅ | ✅ | ✅ | ✅ |

Outer rings may skip intermediate rings (a route may use a contract directly). Inner rings
never reach outward.

## Barrels

A typical cross-module import rule whitelists `src/modules/*/index.ts`, and barrels often re-export
everything (`export { OrdersService } from './service.js'`, `export { OrdersRepository } …`,
mappers, routes). So `import { CustomersService } from '../customers/index.js'` passes the linter
while being exactly the coupling rule 7 forbids. Judge the **symbol**, not the path:

| Imported through `../<other>/index.js` | Verdict |
|---|---|
| an interface / type from `ports.ts`; a shared contract re-exported by it | fine |
| anything that comes from the other module's `types.ts` (request schemas, payloads, input shapes) | **violation** (rule 11) — unless it is a recorded published exception |
| constant, pure `domain/` function (no I/O, no rows) | fine |
| `*Service` / `*Repository` class — even `import type` for a constructor dep | **violation** → declare the port you need in your `ports.ts`; the `Container` adapts the other module's service to it |
| mapper (`toXDto`, `toXRecord`) — it takes the other module's rows | **violation** → ask the port for the contract you need; mapping stays in the owner |
| routes plugin, `helpers.ts` export | **violation** |

Search: `rg -n "from '\.\./[a-z-]+(/index)?\.js'" src/modules/<m>` → for each hit open the
other module's `index.ts`, find where the symbol really lives (`service.ts`, `repository.ts`,
`mappers.ts` …) and classify it with the table above. Report the import line **and** the file the
symbol resolves to.

Fix shape: `ports.ts` — `export interface CustomerNames { namesFor(tenantId, ids): Promise<Map<string, string>> }`
style, shaped for *your* use case and returning contracts; the `Container` getter builds it from the
other module's service (`{ namesFor: (t, ids) => customersService.namesByIds(t, ids) }`).

## Borderline cases

| Case | Decision |
|---|---|
| `platform/errors.ts` (`AppError`, `NotFoundError`, …) | Shared kernel: pure, so rings 1–2 may import it. |
| Other `platform/*` files | Often mixed (`jobs.ts`, `events.ts` are infrastructure; a pure `money.ts` or `prompt.ts` is kernel). Classify each file; until you do, never import `platform/container.ts` from rings 1–2 and treat the rest case by case. |
| `zod` | Allowed in ring 1: it is a schema library with no I/O. |
| Pure computation libraries (graph maths, date maths, decimal arithmetic) | Allowed wherever the caller is — they do no I/O. |
| A pure domain engine consumed as a package or workspace source | Ring-1 dependency. If it also ships an SDK-backed provider class, that class is an adapter the container instantiates. |
| `helpers.ts` | If it only transforms contracts/plain data → ring 1 in spirit. If it maps a **row** or imports `db/schema` → it is a mapper: move it beside the repository. |
| Shared row-type files (e.g. `db/rows.ts`) | Infrastructure. They usually appear so one module avoids importing another module's repository; the onion answer is a contract type instead. Do not add new uses. |
| `Logger` | Depend on a small `Logger` interface, not on the framework's logger type (`app.log`). |
| Clock, IDs, randomness | Inject when a test needs determinism; otherwise call directly — do not add ceremony. |

## Smell → fix

| You see | Do this |
|---|---|
| `container.db.select()…` in a route | Add a repository method behind a port; the route calls a service. |
| `await container.paymentGateway()` inside a service | Inject `payments: () => Promise<PaymentGateway>` in the service deps. |
| Service signature `(container: Container)` | Replace with a `<Name>Deps` interface — see [composition-root-and-di](composition-root-and-di.md). |
| Service imports `OrderRow` | Repository returns a contract type; map the row in `mappers.ts`. |
| Helper imports `db/schema` | It is a mapper or query — move to the repository. |
| Adapter imports a module's `constants.ts` | Move the constant to the shared contracts or a domain file both can import. |
| Container ↔ service import cycle | The service takes deps; only the container constructs it. |
| Route imports another module's `helpers.ts` | Promote the function to a contract-level helper or call that module's service via a port. |

## Why this shape

The point is not the diagram. It is that the code that decides things can be run and tested
without the HTTP framework, the database or the network, and that swapping an SDK or a table touches
one ring. Palermo frames it as suited to long-lived, complex applications — for a tiny CRUD route
keep the ceremony proportionate; a port for a repository with one caller is still worth it when the
service must be testable with a fake.
