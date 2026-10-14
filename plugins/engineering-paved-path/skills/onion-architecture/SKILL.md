---
name: onion-architecture
description: "Onion-architecture rules for a TypeScript backend (written for Fastify + Drizzle/Postgres, applicable to any Node HTTP framework and ORM): which ring a file belongs to (domain, application, infrastructure, presentation), which way imports may point, and where ports, services, repositories, routes, mappers, adapters and DI wiring live; optionally enforced in CI with dependency-cruiser. Use whenever creating, moving, splitting or reviewing backend code — a new feature module, a route that queries the database, a service that keeps growing, 'where should this live', adding an SDK/adapter/port, wiring the DI container, transactions, or a structure-focused PR review — even if the user never says 'architecture' or 'onion'. Not for Fastify API usage (fastify-best-practices), Drizzle query syntax (drizzle-orm-patterns), table design (postgresql-table-design), schemas (zod), or vulnerabilities (security)."
metadata:
  version: "2.0.0"
---

# Onion Architecture (backend)

How a TypeScript backend (examples: Fastify 5, Drizzle + Postgres) is **organized**: which ring
each file belongs to, which way dependencies point, and where each kind of code lives.

The principles are general. The paths below use a **neutral sample application** — a small
commerce API with feature modules such as `orders`, `customers`, `catalog`, `payments` and
`notifications` under `src/modules/<name>/`, shared contracts in `src/shared/contracts/`, adapters in
`src/adapters/` and a DI container in `src/platform/container.ts`. **Map them onto your project's
folders** before applying a rule — see [project-mapping](references/project-mapping.md).

Version 2.0.0 — sources, rationale and history are in [README.md](README.md).

## Scope — what this skill owns, and what it leaves to others

Link instead of restating rules another skill owns; two copies drift apart.

| Question | Owner |
|---|---|
| Which ring does this file belong to? What may it import? Where do ports / services / repositories / routes / adapters live? Who wires them? Who owns the transaction? | **this skill** |
| Fastify API: hooks, plugin options, serialization, logging, deployment | `fastify-best-practices` |
| Drizzle query / relation / migration syntax | `drizzle-orm-patterns` |
| Table and index design | `postgresql-table-design` |
| Zod schema technique | `zod` |
| Authz, injection, secrets handling | `security` |
| Type-level TypeScript | `typescript-expert` |
| How *your* app is wired end to end | your project's architecture doc / agent guide, if it has one |

Precedence when guidance conflicts: your project's own written architecture rules > this skill >
generic advice.

## The four rings

Dependencies point **inward only**. The inner ring never names anything from an outer one.

| Ring | What it is | Files in the sample app |
|---|---|---|
| **1 Domain** | Vocabulary and pure rules. No I/O, no framework. | shared contracts (`src/shared/contracts/`) · `modules/<m>/domain/` · `constants.ts` · `types.ts` · any pure engine/library the app consumes |
| **2 Application** | Use cases and the ports they need. | `modules/<m>/service.ts` · `modules/<m>/ports.ts` · cross-module infra ports in `src/shared/ports.ts` |
| **3 Infrastructure** | Implements ports with real tools. | `modules/<m>/repository.ts` (Drizzle) · `src/db/**` · `src/adapters/**` (payment gateway, mailer, object storage, search, LLM SDKs) · `platform/jobs.ts`, `platform/events.ts` |
| **4 Presentation & composition** | HTTP in, wiring. | `modules/<m>/routes.ts` · `app.ts` · `platform/container.ts` · `modules/index.ts` |

Test for any file: *could it run without the HTTP framework, the database and the network?* Yes →
rings 1–2. No → ring 3 or 4, and something inner must own the interface it implements or calls.

## The eleven rules

1. **Dependencies point inward only** (4 and 3 → 2 → 1). Reversal is done with a port.
2. **The core owns its ports; adapters implement them.** A port describes the *conversation the
   use case needs* (`chargeOrder`), not the tool's API (`stripe.paymentIntents.create`).
3. **Framework, ORM and SDK types stop at their ring.** `FastifyRequest`, Drizzle rows/`sql`, and
   vendor SDK types never enter rings 1–2. Cross a boundary with plain data or a shared contract.
4. **A service receives narrow dependencies through its constructor** — the ports it uses — not the
   whole `Container` (that is a service locator: it hides what the use case depends on).
5. **Each layer does one job.** Routes: HTTP ↔ plain arguments. Services: orchestrate, decide, own the
   transaction. Repositories: SQL and row ↔ contract mapping. Domain functions: pure rules.
6. **Wire in the composition root only.** `new SomeAdapter()` / `new SomeRepository(db)` appear in
   the composition root (`platform/container.ts`) and tests, nowhere else.
7. **A module's public surface is small.** Other modules may import only `index.ts` (rule 10) and
   `ports.ts` — `types.ts` only where rule 11 publishes it. Slice by feature, layer *inside* each slice
   (sliced onion).
8. **Every table has one owning module; only the owner's repository writes to it.** The owner is the
   module whose feature the table stores (`orders` → `orders`, `payments` → `payments`, `customers` →
   `customers`). Another module that must change that data calls the owner's port, exposed through the
   owner's `index.ts`/`ports.ts` and wired in the `Container`. Read-only joins onto a foreign table
   inside your own repository are fine. Import linters **cannot** see this (every repository imports
   the schema), so reviewers must check it by hand — see
   [drizzle-persistence-layer § Table ownership](references/drizzle-persistence-layer.md#table-ownership).
9. **A transaction holds only database work.** Nothing reachable from inside a transaction callback may
   call the network, an LLM, git, the filesystem, `jobs.enqueue`, an event stream, or sleep/retry. The
   violation is usually **not on the line that opens the transaction** — it hides two or three calls
   deeper (a private method, a module helper class, an injected collaborator, a callback). Find it with
   the **transaction trace** in
   [drizzle-persistence-layer § Transaction trace](references/drizzle-persistence-layer.md#transaction-trace),
   and report the whole call chain.
10. **A barrel is not a loophole.** Importing through another module's `index.ts` is allowed only for
    what may cross a module boundary: contract **types**, **ports** (interfaces), **constants** and
    **pure `domain/` functions**. A *class or function that does I/O or knows rows* — another module's
    `*Service`, `*Repository`, mapper (`toXDto`, `toXRecord`), routes plugin, helpers — is still an
    internal import when it arrives via `../<other>/index.js`. Depend on a port declared in **your**
    `ports.ts` (or the other module's `ports.ts`) and let the `Container` pass the implementation.
    Import linters usually whitelist every `index.ts`, so they **cannot** see this — check it by hand
    ([layers-and-dependency-rule § Barrels](references/layers-and-dependency-rule.md#barrels)).
11. **Another module's `types.ts` is private.** It holds that module's request/response zod schemas,
    job payloads and internal input shapes; importing it ties your routes, ports or domain to another
    module's HTTP surface and storage inputs. A type that must cross modules lives in the shared
    contracts or in the owner's `ports.ts`. If a module deliberately publishes its `types.ts` (e.g. a
    facade interface and its result types — see
    [ports-and-adapters-for-tools § The facade pattern](references/ports-and-adapters-for-tools.md#the-facade-pattern)),
    record it as a **published exception** in your project mapping; keep that list short and explicit.
    Anything else imported from `../<other>/types.js` (directly or re-exported through its `index.ts`)
    is a violation, even `import type`. Check by hand:
    `rg -n "from '\.\./(\.\./)?[a-z-]+/types\.js'" src/modules/<m>`.

## Where does X go?

| You have… | It goes in… |
|---|---|
| Route path, zod `params`/`body`, status code | `routes.ts` (thin: schema → request context → service → contract) |
| Multi-step operation, a decision, calls to several ports | `service.ts` |
| Repository interface | `ports.ts` (application ring) |
| Drizzle query, `sql`, `db/schema`, row ↔ contract mapping | `repository.ts` (+ `mappers.ts` beside it); returns **contract types, never rows** |
| Pure rule (derive status, compute a total, group, parse) | `domain/<purpose>.ts` — no I/O, unit-tested alone |
| Literals, option lists | `constants.ts` |
| Zod schema / type used only by this module (request body, query, response shape) | `types.ts` — zod is allowed in ring 1; derive types with `z.infer`. **Private** — other modules never import it (rule 11) |
| A type or schema you found in another module's `types.ts` and want to reuse | copy the shape into **your** `types.ts`, or move it to the shared contracts / the owner's `ports.ts` with its owner — never import it (unless it is a recorded published exception) |
| Contract the **frontend** (or another service) also needs | the shared contracts package — edit at its source. If that source lives outside this repository, plan the change with its owner; until it lands keep the schema in `types.ts` |
| New table / column | `db/schema/<name>.ts` + barrel export (+ the schema object your ORM setup uses) + a **generated** migration (e.g. `drizzle-kit generate --name <name>`); never edit an applied migration |
| External system (payment provider, email, object storage, search, LLM, git, …) | port → adapter in `src/adapters/<tool>/` → fake in `src/adapters/mocks.ts` → wired in `Container` |
| Secret or token | a `SecretsProvider` port (or your config/secrets layer) only — never read ad hoc from env/db inside a service |
| Background work | handler registered on the job runner from the service; payload type in `types.ts` |
| Tenant / user scope | resolved in the **route** (e.g. `getRequestContext(req)`); pass `tenantId` to the service as a plain argument |
| Failure | throw `AppError` / `NotFoundError` from the service; the global error handler maps it |
| Something another module already does (its service, repository, mapper) | a port in **your** `ports.ts` shaped for your use case, implemented by the `Container` (adapting the other module's service/repository there) — never `import { XService \| XRepository \| toXDto } from '../x/index.js'` |
| Change rows of a table another module owns (`orders`, `payments`, `customers`, …) | the **owner's** repository, reached through the owner's port (`index.ts`/`ports.ts`, wired in `Container`) — never `insert`/`update`/`delete` on it from your repository |
| External call or job that belongs to an atomic use case | **outside** the transaction: fetch/compute before `tx.run`, call the network / `jobs.enqueue` / events **after commit**; if the side effect must be atomic with the writes, write an intent (outbox) row inside the transaction and let a job perform it |
| Atomic multi-write | the **service** opens the transaction (see [drizzle-persistence-layer](references/drizzle-persistence-layer.md)) |
| Test | per ring — [testing-by-layer](references/testing-by-layer.md) |

Details: [layers-and-dependency-rule](references/layers-and-dependency-rule.md),
[ports-and-adapters-for-tools](references/ports-and-adapters-for-tools.md).

## Module template

```
src/modules/<name>/
  routes.ts        # 4  HTTP plugin/router; the only file that knows HTTP
  service.ts       # 2  use cases; constructor(deps: <Name>Deps)
  ports.ts         # 2  <Name>Repository + any port only this module needs
  repository.ts    # 3  ORM implementation of the ports
  mappers.ts       # 3  row → contract; may import row TYPES, not the ORM
  domain/          # 1  optional: pure rules
  constants.ts     # 1
  types.ts         # 1  module-local zod schemas + inferred types, payloads
  index.ts         # public facade for OTHER modules, only if they need one
```

Create files on demand. If your project already uses other names (`*.controller.ts`,
`*.handler.ts`, `*.dao.ts`), keep them and map each onto a ring once, in your project mapping; the
rules are about rings and direction, not file names (but import linters match by name, so be
consistent).

## Workflow

**New module** — `constants.ts` + `types.ts` (zod contracts) → `domain/` rules → `ports.ts` →
`service.ts` (constructor deps) → table in `db/schema/` + generated migration → `mappers.ts` +
`repository.ts` → `routes.ts` → register in `modules/index.ts` → wire in `Container`
(getter + a `<name>Repo` override key) → tests per ring → import-rule check (below).

**Touching an existing module** — do not make it worse and do not grow the baseline. Fix the
violations in the code you are changing when it is cheap (move the query into the repository;
pass a narrow dep instead of `Container`); otherwise leave a one-line note. Do **not** start a
module-wide refactor inside an unrelated change. Record known drift and a migration order in your
project mapping ([project-mapping](references/project-mapping.md)).

**Reviewing** — read top to bottom and ask the checklist; run the transaction trace for every
transaction in the change; report each violation with the target location ("move this query to
`OrderRepository.listByCustomer`"), not just "wrong layer".

## Enforcement (optional, recommended)

The rules that are about **imports** can be checked mechanically. One option is
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser): forbid rules in a config file,
existing drift frozen in a baseline file, a new violation fails CI.

```bash
npx depcruise src --config .dependency-cruiser.cjs --ignore-known
```

When you fix a baselined violation, regenerate the baseline so it shrinks. Never add a violation to
the baseline to make CI pass. A generic rule set and the procedure are in
[enforcement](references/enforcement.md). Rules 8–11 are not import-shaped and stay review-only.

## Checklist

- [ ] `routes.ts` has no ORM, no SQL, no business rule; it calls a service.
- [ ] Service takes narrow deps (ports), not `Container`; no `FastifyRequest` (or other framework type) inside.
- [ ] Nothing outside `repository*` imports the ORM library, `db/schema` or row types (only
      `mappers.ts` may import row **types**, never the ORM).
- [ ] Repositories return contract types; rows do not escape.
- [ ] New external tool sits behind a port + adapter + mock; its SDK is imported only in `src/adapters/`.
- [ ] Adapters are constructed only in the composition root (and tests).
- [ ] No import of another module's routes/service/helpers/constants/repository.
- [ ] No import of another module's `types.ts` (direct or via its barrel) except a recorded
      published exception (rule 11).
- [ ] Every `from '../<other>/index.js'` (and `../<other>'`) imports only types, ports, constants or pure
      domain functions — no `*Service`, `*Repository`, mapper or routes symbol, even as `import type`
      used for a constructor dependency.
- [ ] Every `insert`/`update`/`delete` targets a table this module owns; writes to another module's
      table go through the owner's port (grep the diff for `.insert(t.` / `.update(t.` / `.delete(t.`).
- [ ] Multi-write use case has one transaction opened by the service.
- [ ] Transaction trace done for every `transaction(` / `tx.run(` in the change: every call inside the
      callback followed to a leaf; no port to an external system, no `jobs.enqueue`, no event emit, no
      sleep/retry is reachable (report violations with the full chain `a → b → port.method`).
- [ ] Import-rule check passes (if configured); the baseline did not grow.
- [ ] Tests exist at the right ring (pure / fakes / DB integration / HTTP inject).

## Reference index — read only what the task needs

| File | Read it when |
|---|---|
| [references/layers-and-dependency-rule.md](references/layers-and-dependency-rule.md) | Deciding a file's ring; the import matrix; barrels; borderline cases |
| [references/fastify-presentation-layer.md](references/fastify-presentation-layer.md) | Writing or slimming a `routes.ts`; plugin scope, decorators, error mapping, streaming |
| [references/drizzle-persistence-layer.md](references/drizzle-persistence-layer.md) | Repositories, row ↔ contract mapping, table ownership, transactions + transaction trace, raw SQL, migrations |
| [references/ports-and-adapters-for-tools.md](references/ports-and-adapters-for-tools.md) | Adding or replacing a payment / email / storage / search / LLM / git / job-queue integration |
| [references/composition-root-and-di.md](references/composition-root-and-di.md) | Replacing `Container` params, container getters, overrides |
| [references/testing-by-layer.md](references/testing-by-layer.md) | Choosing the right kind of test for the code you wrote |
| [references/enforcement.md](references/enforcement.md) | Setting up import rules; a rule fired; updating the baseline; adding a rule or an exception |
| [references/project-mapping.md](references/project-mapping.md) | Mapping the rings onto your folders; recording drift, published exceptions, settled decisions |
