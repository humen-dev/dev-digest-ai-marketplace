# Drizzle / Postgres — the persistence side of ring 3

Read this for repositories, row ↔ contract mapping, transactions, raw SQL and migrations.
Query, relation and migration *syntax* belongs to `drizzle-orm-patterns`; table/index design to
`postgresql-table-design`. Another ORM (Prisma, Kysely, TypeORM, MikroORM) changes the syntax, not
the rules.

## A repository implements a port

The port lives in the module's `ports.ts` (ring 2) and speaks in business operations and contract
types; the Drizzle class in `repository.ts` (ring 3) implements it and is the **only** place that
imports `drizzle-orm`, `db/schema`, row types or `sql`.

```ts
// modules/orders/ports.ts — no ORM imports
export interface OrderRepository {
  listByCustomer(tenantId: string, customerId: string): Promise<OrderSummary[]>;
  upsertMany(tenantId: string, orders: OrderInput[], tx?: Tx): Promise<void>;
}

// modules/orders/repository.ts — Drizzle lives here
export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly db: Db) {}
  async listByCustomer(tenantId: string, customerId: string) {
    const rows = await this.db.select().from(t.orders).where(/* … */);
    return rows.map(toOrderSummary); // mappers.ts
  }
}
```

Method names are **business operations** (`listOpenForCustomer`, `findLatestPayment`), not table
operations (`selectWhere`) — source 4.4. One repository per feature slice, **not one per table**; a
repository that spans the tables a use case touches together is fine (`orders` + `order_lines`).

Good shape to aim for: tenant-scoped, no HTTP, one owner for its tables (e.g. `catalog` owning
`products`, `product_variants` and the `product_categories` link).

## Table ownership

Every table has **one owning module** — the module whose feature the table stores. Only the owner's
repository may `insert`, `update` or `delete` its rows; that is what keeps invariants (status
transitions, cached counters, cascades the owner relies on) in one place.

| Table(s) (sample app) | Owner |
|---|---|
| `customers`, `addresses` | `customers` |
| `orders`, `order_lines` | `orders` |
| `payments`, `refunds` | `payments` |
| `products`, `product_variants` | `catalog` |
| a new table | the module that introduces it (`db/schema/<module>.ts`) |

Keep the real list for your project in your [project mapping](project-mapping.md).

- **Reads:** a read-only join onto a foreign table inside your own repository is fine (it returns
  *your* contract). Prefer the owner's port when you need the owner's contract as is.
- **Writes:** call the owner's port (e.g. `OrdersPort.setStatus(...)`), exposed through the owner's
  `index.ts`/`ports.ts` and injected via the `Container`. If the operation must be atomic with your own
  writes, the **service** opens the transaction and passes `tx` to both repositories.
- **Deciding *what* to write** (which rows to delete, which status to set) is a rule → `domain/`, not
  the repository.
- **Why a reviewer must check this:** import linters see only imports, and every repository
  legitimately imports `db/schema`. Grep the diff: `rg -n "\.(insert|update|delete)\(t\." src/modules/<m>`
  and compare each table with the owner list.

Smell → fix: `notifications/repository.ts` runs `db.update(t.orders).set({ status })` → add
`setStatus` to the `orders` port and call it from the notifications **service**.

## Rows stay inside

| Type | Where it may appear |
|---|---|
| `typeof t.x.$inferSelect` / named row types (`OrderRow`) | repository and mappers only |
| Shared contracts (`Order`, `Customer`, `Payment`) | everywhere |
| Module-local read models (`types.ts`) | the module's rings 1–4 |

Map at the edge of the repository (`mappers.ts` beside it): `orderRowToDto`-style functions belong
here, not in `helpers.ts`, because they know the row shape. A mapper may `import type` the row
(`typeof t.orders.$inferSelect` via `db/schema`, or a row-types file) but must not import the ORM
library or run a query — an import linter can enforce both (see `orm-only-in-repositories`,
`mappers-no-orm-library` in [enforcement](enforcement.md)). Reason: schema changes must not ripple
into services or the API (Martin 1.7, Stemmler 4.5).

If existing repositories return rows and services import row types, baseline that drift and return
contracts from new code.

## Read models that aggregate

A list screen often enriches each item with aggregates (an order list with the payment status,
total refunded and item count). Do it with one `IN (…ids)` query per aggregate plus in-memory
grouping (or a single SQL query with joins/`GROUP BY`) inside **one repository method that returns
the assembled read model**; the service composes it, the route returns it. Do not spread the queries
over the route, and do not issue one query per row (N+1).

## Tenant scoping

In a multi-tenant app every query is scoped by `tenantId` (workspace, organisation, account). It is a
parameter of the port method, passed down from the route's request context — never read from ambient
state inside the repository. (Row-level security in Postgres is a good second line of defence, not a
replacement.)

## Transactions

Drizzle: `db.transaction(async (tx) => …)`; `tx` has the same query interface as `db`; nested
transactions become savepoints (source 4.1). Ownership rule (sources 4.3, 4.4):
**the service owns the boundary**, repositories accept an optional `tx`.

```ts
// platform/transaction.ts — no ORM types; `Tx` is opaque to rings 1–2
declare const txBrand: unique symbol;
export type Tx = { readonly [txBrand]: true };
export interface TransactionRunner { run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>; }

// modules/orders/service.ts
await this.deps.tx.run(async (tx) => {
  await this.deps.orders.upsertMany(tenantId, orders, tx);
  await this.deps.inventory.reserve(tenantId, lines, tx);
});
```

The Drizzle-backed `TransactionRunner` and the one helper that unwraps `tx ?? db` live in
`src/db/`. **Create these when the first use case genuinely needs atomic multi-writes** — do not
pre-build them.

### Transaction trace

A transaction may contain **only database work through repositories that take `tx`**. Why: the pooled
connection is held for the whole callback (a slow payment/LLM call starves the pool), a network call
cannot be rolled back (rollback leaves a captured payment / a sent email behind), and a job runner that
writes its job row with **its own connection** can start the job before the commit (it reads data that
is not there yet) and the job survives a rollback.

The offending call is rarely written inside the callback itself. Trace it:

1. **Find every boundary** in the change: `.transaction(`, `tx.run(`, any `TransactionRunner`, and every
   method that *receives* a `tx: Tx` (it runs inside someone else's transaction).
2. **List every call inside the callback** — awaited or not, including calls made through `this.<field>`,
   destructured deps, closures and callbacks passed in as arguments.
3. **Follow each call to a leaf**, file by file: private methods, module helper classes (`*.ts` next to
   the service that wrap a port), constructor-injected collaborators (resolve what the `Container` passes
   in), `domain/` functions that receive a callback. Stop when you reach:
   - a repository method called with `tx` → fine;
   - a pure function → fine;
   - a port implemented by an adapter (`PaymentGateway`, `Mailer`, `LlmClient`, object storage, search
     index, URL fetcher, filesystem), `jobs.enqueue`, an event emit, `setTimeout`/sleep,
     `withRetry`/`withTimeout` → **violation**.
4. **Also flag** a repository write *inside* the callback that is called **without** `tx` (it escapes the
   transaction and commits on its own), and a `withRetry` that wraps a whole transaction body containing
   any of the above.
5. **Report the chain**, not just the leaf: `CheckoutService.place → PricingHelper.quote → TaxApi.rate`
   (`service.ts:41 → pricing.ts:18`), so the author sees where to cut.

Fix shape: **read & fetch → decide (pure) → `tx.run` with repository writes only → after commit:
network calls, `jobs.enqueue`, events.** When the external effect must happen exactly when the writes
commit, write an intent row inside the transaction (outbox) and let a job perform the call.

A method that fetches first and opens the transaction afterwards is the **correct** pattern — do not
flag it just because both appear in one method.

## Raw `sql`, extensions and special operators

Raw `sql` templates, extension operators (pgvector distance, full-text search, PostGIS) and
index-specific queries stay inside the repository. Ports expose intent
(`similarProducts(tenantId, embedding, k)`), never operators.

## Adding a table

1. `src/db/schema/<name>.ts` (tenant FK with `onDelete: 'cascade'` where the tenant owns the data,
   `created_at` defaulting to `now()`); re-export it from the schema barrel **and** register it wherever
   your Drizzle setup collects the schema object.
2. Enum-like columns: import the literal list from the module's `constants.ts` (`text('status', { enum: ORDER_STATUSES })`).
   That is ring 3 depending on ring 1 — the allowed direction — and it keeps one source of truth for the
   contract and the column.
3. Generate the migration (`drizzle-kit generate --name <name>`, or your project's script wrapping it). It
   only writes files; nothing is applied until you run the migrate step. Read the SQL before committing it.

## Migrations

Migration files are append-only history — never edit or delete an applied one; add a new migration.
Decide explicitly whether they run on boot or as a separate deploy step, and document it. A new
column/table changes `db/schema/*` and the repository/mapper; it must not change a service.

## Construction

Most Postgres drivers (`postgres`, `pg` pools) connect lazily, so constructing a repository performs no
I/O — keep constructors free of it (this is what lets route smoke tests run without a database).
