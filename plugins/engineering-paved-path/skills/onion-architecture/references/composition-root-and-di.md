# Composition root and dependency injection

Read this when replacing a `Container` parameter, adding a container getter, or wiring a new
service, repository or adapter.

## What the container is — and is not

The container (`src/platform/container.ts` in the sample app) is the **composition root**: the one
place where concrete classes meet the abstractions that rings 1–2 declare (Graça 1.4: "configure
which adapter implements which port at the composition root"). It constructs lazily, resolves
secrets, and accepts `overrides` so tests inject fakes instead of monkey-patching. A DI library
(tsyringe, InversifyJS, awilix, NestJS modules) can play the same role; the rules below still apply.

It is **not** a bag every service reaches into. Passing the whole `Container` to a service is a
service locator: the constructor signature no longer says what the use case depends on, and any test
must build a container to run it. If existing services do this, record it as drift in your project
mapping and migrate them one by one (below).

## Target shape

```ts
// modules/orders/service.ts — depends on what it uses, nothing else
export interface OrdersServiceDeps {
  orders: OrderRepository;                         // port (ports.ts)
  payments: () => Promise<PaymentGateway>;         // lazily resolved: may be missing / rotated
  jobs: Pick<JobRunner, 'enqueue'>;
}
export class OrdersService {
  constructor(private readonly deps: OrdersServiceDeps) {}
}

// platform/container.ts — the only place that builds it
get ordersService(): OrdersService {
  return (this._ordersService ??= new OrdersService({
    orders: this.overrides.ordersRepo ?? new DrizzleOrderRepository(this.db),
    payments: () => this.paymentGateway(),
    jobs: this.jobs,
  }));
}

// routes.ts — consumes, never constructs
const service = app.container.ordersService;
```

Two details worth keeping:

- **Async deps as functions.** Clients that read secrets (`paymentGateway()`, `mailer()`, `llm(id)`)
  may throw `ConfigError`, and are typically cached until the secret changes (an
  `invalidateSecretCaches()`-style hook). Injecting the *function* keeps that behaviour; injecting
  the resolved client would freeze a stale one.
- **`Pick<…>` for wide collaborators** (`JobRunner`) so the service declares the slice it uses.

## Migrating a service off `Container`

1. List what the service actually reads from `container` (`db`, `jobs`, `paymentGateway()`, `secrets`, …).
2. Declare `<Name>Deps` with exactly those, as ports or `Pick<>`s.
3. Put persistence behind a port (`ports.ts`) if the service builds a repository itself
   (`new OrderRepository(container.db)` inside the constructor is the tell).
4. Add the container getter; delete the `new Service(container)` calls in routes.
5. Tests: construct the service with fakes directly — no app bootstrap, no database container.
6. Run the import-rule check, regenerate the baseline, confirm it shrank ([enforcement](enforcement.md)).

Do this **per service, when you are already changing it** — not as a sweep. The hard case is a
service that the container builds with `this` (a container ↔ service import cycle): the fix is the
same — pass deps instead of `this`.

## Rules

- `new <Adapter>()` and `new <Repository>(db)` appear only in the composition root and tests.
- Rings 1–2 never import the `Container` type. Routes reach it as `app.container` (or via the
  framework's DI).
- Getters stay logic-free: construct, cache, return. Anything with branching or I/O belongs in an
  adapter.
- Every adapter getter honours its `overrides` key first, so a test can replace it. A service getter
  does the same for the **repository port** it builds: add a `<name>Repo?: <Name>Repository` key to
  `ContainerOverrides` and write `this.overrides.<name>Repo ?? new Drizzle<Name>Repository(this.db)`.
  Tests then swap the port, not the service (`buildApp({ overrides: { ordersRepo: fake } })`).
- Adding a dependency to a service means adding it to `Deps` and to the getter — one visible diff.

## Job handlers

Handlers are registered on the job runner by kind (e.g. `registerSendReceiptJob`,
`registerReindexCatalogJobs`). Keep the handler body in the service (a use case), keep the payload
type in `types.ts`, and enqueue by kind from wherever the trigger is. The queue library (BullMQ,
p-queue, pg-boss, …) stays behind a `JobRunner` port.
