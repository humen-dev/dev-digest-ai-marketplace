# Testing by layer

Read this to pick the right kind of test for the code you wrote. Technique for React tests lives in
`react-testing-library`; this is the server side. If your project has a cross-package testing guide,
it takes precedence for commands and CI job names.

## One kind of test per ring

| Ring | What you test | How | Typical file / CI job |
|---|---|---|---|
| **1 Domain** | Pure functions: status derivation, pricing, parsing, mappers over plain data | Plain unit tests, no mocks, table-driven | `test/*.test.ts` — unit job |
| **2 Application** | A service's decisions and orchestration | Construct the service with **fake ports** (adapter fakes + in-memory repository fakes). No DB, no HTTP framework | `test/*.test.ts` — unit job |
| **3 Infrastructure — repositories** | Real SQL against a real database (same engine and extensions as production) | Testcontainers / a disposable DB via a shared helper (e.g. `test/helpers/pg.ts`) | a distinct name such as `*.it.test.ts` — integration job |
| **3 Infrastructure — adapters** | Contract of one adapter (parsing, error mapping) with a fake transport | Unit test around the adapter; the fake must satisfy the same port | `test/adapters.test.ts` |
| **4 Presentation** | Route wiring: schema → 400/422, error envelope, status codes | `buildApp({ config, overrides })` + `app.inject()` (or supertest); DB-free when the route does not hit the DB | `test/routes-smoke.test.ts` pattern |
| **Architecture** | Dependency direction | `depcruise --ignore-known` (or your import linter) | unit / lint job |

## Where the fakes live

- **Adapter fakes** (payments, mailer, LLM, git, …) → next to the real adapters (e.g. `src/adapters/mocks.ts`).
- **Repository-port fakes** (an in-memory `OrderRepository`) are test code → `test/helpers/<module>.ts`.
  They must be tenant-scoped like the real repository, so a service test also proves tenancy is passed through.
- **Route tests without a DB** usually need two overrides, not one: the repository port (`<name>Repo`)
  **and** the auth provider. If request-context resolution looks up the user or tenant in the database,
  forgetting the auth override is the usual reason a "DB-free" route test suddenly needs a database.

## Rules

- **Fake the port, not the vendor.** Inject `FakePaymentGateway`, not a stubbed Stripe SDK. You own the
  port; you do not own the SDK, and a stub of it tests your guess about it.
- **A service test that needs a `Container` or `buildApp` is a smell** — it means the service is a
  service locator ([composition-root-and-di](composition-root-and-di.md)). Fix the constructor, not the test.
- **Separate DB-backed tests by name** (e.g. `*.it.test.ts`) and import the shared DB helper, so the unit
  job never tries to run them without a database.
- **Fakes satisfy the real port.** `FakeLlmClient implements LlmClient`; if the port changes the fake
  stops compiling, which is the point.
- **Do not test the wrong ring.** Business rules through `app.inject()` are slow and hide the failure
  location; keep them in ring 1–2 tests and use `inject` only for the HTTP contract.
- **Determinism:** fakes return caller-supplied fixtures; no network in unit or route tests.
- New repository method → integration test. New pure rule → unit test next to the existing ones. New
  route → a smoke test that at least covers validation (400/422) and one happy path.

## Commands (sample, Vitest)

```bash
npx vitest run --exclude '**/*.it.test.ts'   # unit (ring 1, 2, 4, adapters)
npx vitest run .it.test                       # integration (needs Docker / a database)
npx tsc --noEmit                              # typecheck
npx depcruise src --config .dependency-cruiser.cjs --ignore-known
```

Use your project's own scripts if it has them.
