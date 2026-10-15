# Ports and adapters for external tools

Read this when adding, replacing or wrapping an external tool: a payment provider, email, object
storage, search, an LLM, git, a tokenizer, a job queue.

## The tools and their seams (sample app)

| Tool (package) | Port | Adapter (`src/adapters/…`) | Test double | Notes |
|---|---|---|---|---|
| Payments (`stripe`) | `PaymentGateway` | `payments/stripe.ts` | `FakePaymentGateway` | Key via `secrets.get('PAYMENTS_API_KEY')`; `container.paymentGateway()` is async and throws `ConfigError` when unset |
| Email (`nodemailer`, an email API SDK) | `Mailer` | `mail/smtp.ts` | `FakeMailer` (records sent messages) | Templates rendered in the service or a pure `domain/` function, sent by the adapter |
| Object storage (`@aws-sdk/client-s3`) | `FileStore` | `storage/s3.ts` | `InMemoryFileStore` | Signed URLs are an adapter concern; the port returns a plain URL string |
| Search (`@elastic/elasticsearch`, Meilisearch) | `ProductSearch` | `search/elastic.ts` | `FakeProductSearch` | Fallback when the index is degraded (see facade below) |
| LLM (`openai`, `@anthropic-ai/sdk`) | `LlmClient` | `llm/openai.ts`, `llm/anthropic.ts` | `FakeLlmClient` | Fixture-driven responses; cost/usage reported as plain numbers |
| git (`simple-git`) | `GitClient` | `git/simple-git.ts` | `FakeGitClient` | Parsing output is pure and lives in `domain/` |
| secrets / auth | `SecretsProvider`, `AuthProvider` | `secrets/env.ts`, `auth/jwt.ts` | `FakeSecretsProvider`, `FakeAuthProvider` | Secrets **only** via `SecretsProvider` |
| job queue (`bullmq`, `pg-boss`, `p-queue`) | `JobRunner` (`platform/jobs.ts`) | — | inline runner | Services enqueue by *kind*; nobody imports the queue library outside it |
| pure maths (`decimal.js`, `graphology`) | none — pure computation | — | — | Allowed wherever the caller is |

Keep vendor SDK imports confined to `src/adapters/`; an `sdk-only-in-adapters` import rule keeps it
that way ([enforcement](enforcement.md)).

## Designing a port

- Name the **conversation the use case needs**, not the SDK call: `chargeOrder`, `sendReceipt`, not
  `stripe.paymentIntents.create` (Cockburn 1.6, Graça 1.4).
- Parameters and results are shared contracts or plain data. **No SDK type in a signature** — if you
  cannot express it without one, the port is too close to the tool.
- Failures cross as `ExternalServiceError` / `ConfigError`, or as an explicit degraded result
  (see below) — never as a raw vendor exception.
- Secrets are read in the adapter/container, never passed through a service.
- One port per purpose; do not build a generic "ExternalService".

Where the port lives: shared across modules → `src/shared/ports.ts` (if your shared contracts are a
separate package, edit them at the source); used by one module → that module's `ports.ts`. Prefer
the module-local port unless two modules really need it.

## The facade pattern

When several tools serve one capability, give features **one interface** and keep the libraries
behind it. Example: a `catalog-intel` module whose `types.ts` exports a `CatalogIntel` facade
(`similarProducts`, `rankBySales`, `tokenCount`) implemented with a search engine, a graph library
and a tokenizer — features import the `CatalogIntel` interface, never the libraries. Such a
`types.ts` is the typical **published exception** to rule 11; record it in your project mapping.

A good facade also defines a **degraded contract**: object results carry `degraded?: boolean`,
array results return `[]`, and the reason is observable (e.g. `getIndexState()`). Use the same idea
whenever a tool can be unavailable: let the consumer fall back instead of throwing.

## Adding an adapter — checklist

1. Port (interface) in the right place; contract types only.
2. Real adapter in `src/adapters/<tool>/`, the **only** file that imports the SDK.
3. Fake (deterministic, no network) — e.g. in `src/adapters/mocks.ts` — and a contract test that runs
   the same assertions against the fake (and, where feasible, the real adapter with a fake transport).
4. Container getter + an `overrides` key in `ContainerOverrides` so tests inject the fake
   ([composition-root-and-di](composition-root-and-di.md)).
5. If it needs a secret: add the key to the secrets type, read it through `SecretsProvider`, and clear
   its cache when the secret changes.
6. Run the import-rule check — `sdk-only-in-adapters` and `adapters-not-into-modules` must stay green.

## Replacing a tool

Change the adapter and the container line that constructs it. If a service or route has to change,
the port leaked the old tool — fix the port first.
