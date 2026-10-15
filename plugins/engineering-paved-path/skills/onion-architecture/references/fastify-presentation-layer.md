# Fastify — the presentation ring

Read this when writing or slimming a `routes.ts`. For Fastify API details (hooks, options,
serialization tuning) use `fastify-best-practices`; this file only says what belongs in the route.
The same shape applies to Express, Hono, NestJS controllers or any other HTTP layer.

## A route is a driving adapter

It translates HTTP into a plain call on the application ring and the result back into a response.
Four steps, nothing else:

1. **Validate** — zod `params` / `body` / `querystring` in the route `schema` (invalid → 400/422 before the handler).
2. **Resolve context** — e.g. `getRequestContext(app.container, req)` → `{ tenantId, userId }`.
3. **Call one service method** with plain arguments.
4. **Return a contract** — typed by the shared contracts, optionally with a `response` schema.

```ts
export default async function ordersRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = app.container.ordersService; // a container getter (see composition-root-and-di.md)

  app.get('/orders/:id', { schema: { params: IdParams, response: { 200: Order } } }, async (req) => {
    const { tenantId } = await getRequestContext(app.container, req);
    return service.get(tenantId, req.params.id);
  });
}
```

No SQL, no branching on business state, no `try/catch` whose only job is to turn an error into a
status code.

## What stays out of a route

| Not in the route | Why | Goes to |
|---|---|---|
| ORM library, `db/schema`, `container.db` | Ring 3 knowledge in ring 4 | repository behind a port |
| Filtering, pricing, grouping, status derivation | Untestable without HTTP | service / `domain/` |
| `Schema.parse(req.body)` | Double validation; skips the type provider | route `schema` |
| `reply.status(404).send({…})` for known failures | Duplicates the error envelope | service throws `NotFoundError` |
| Another module's `helpers.ts` / `service.ts` | Cross-module reach-through | a port, or promote the function |
| Passing `req` / `reply` into a service | Framework type enters ring 2 | extract the few plain values needed |

## Plugin scope and decorators (Fastify docs 3.1–3.4)

- Every module is an **encapsulated plugin**: `register` creates a child context; children inherit
  the parent's decorators/hooks, parents and siblings do not see the child's. That is why
  `app.ts` registers security headers, CORS, rate limiting, streaming support and the **error
  handler before** the modules.
- `app.decorate('container', container)` is done on the root, so every module sees it. If a plugin
  ever needs to expose a decorator to its siblings, wrap it with `fastify-plugin`.
- **Never decorate `request`/`reply` with a reference value** (object/array): it is shared across
  requests. Per-request data comes from an `onRequest` hook or is passed as an argument.
- Bootstrap async resources (db handle) in the app factory (`buildApp`), not lazily inside handlers.

## Errors

Services throw `AppError` and its subclasses (e.g. `NotFoundError`, `ValidationError`,
`ExternalServiceError`, `ConfigError` in `platform/errors.ts`); a single error handler registered in
`app.ts` maps them to one envelope (e.g. `{ error: { code, message, details } }`), plus schema
validation → 400/422 and response serialization failures → generic 500. A route never builds an
error body by hand.

## Response contracts

Declare `response` schemas from the shared contracts where practical. The serializer validates the
outgoing value, which is a cheap guard against a DB row leaking through a route (rule 3). Keep the
zod type provider and the zod major version in lockstep — check the provider's compatibility table
before upgrading either.

## Long-running work and streaming

- Enqueue background work through the service (the job runner); the route returns the job/run id.
- Live progress (SSE, WebSocket) uses an event bus in infrastructure (`platform/events.ts`). The
  **route** owns the stream/reply lifecycle; the **service** publishes domain events. The service
  never touches `reply`.

## Checklist for a route file

- [ ] Only imports: framework types, the type provider, contracts, shared route helpers, its own service/types.
- [ ] Each handler is a few lines: context → service → return.
- [ ] No status/error body construction for expected failures.
- [ ] Nothing here would break if the database were replaced.
