# Enforcement — import rules (dependency-cruiser)

Read this when you want to enforce the rings mechanically, when a rule fired, when you fixed a
baselined violation, or when you want to add a rule or an exception.

Enforcement is **optional**: the skill works as a review checklist without it. But the import-shaped
rules (1, 3, 4, 6, 7) drift quickly on a live codebase unless CI checks them. This page uses
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser); ESLint
`import/no-restricted-paths`, `eslint-plugin-boundaries` or Nx module-boundary rules can express the
same intent.

## What is where (suggested)

| File | Role |
|---|---|
| `.dependency-cruiser.cjs` (in the backend package root) | The rules (`forbidden`) and cruise options |
| `.dependency-cruiser-known-violations.json` | Baseline: existing drift, ignored via `--ignore-known` |
| A CI step (e.g. "Architecture rules") | Runs the check on every backend change |

```bash
npx depcruise src --config .dependency-cruiser.cjs --ignore-known        # what CI runs
npx depcruise src --config .dependency-cruiser.cjs -T err                # include the baselined ones
```

The check typically takes a few seconds. Calling `depcruise` directly in the CI step (rather than via
a package script) is fine and keeps the step self-describing.

## A generic rule set

Adjust the path regexes to your layout ([project mapping](project-mapping.md)) and the package lists
to your stack.

```js
// .dependency-cruiser.cjs — rings for src/modules/<m>/… (see the onion-architecture skill)
/** Match npm packages on the resolved path (works with pnpm's layout too). */
const npm = (names) => `(^|/)node_modules/(${names.join('|')})(/|$)`;

const ORM = ['drizzle-orm', 'postgres', 'pg', 'drizzle-kit'];
const HTTP_FRAMEWORK = ['fastify', 'fastify-plugin', 'fastify-type-provider-zod', '@fastify/[^/]+'];
const SDKS = ['stripe', 'nodemailer', '@aws-sdk/[^/]+', 'openai', '@anthropic-ai/sdk', 'simple-git'];

const DOMAIN_FILES = [
  '^src/shared/contracts/',
  '^src/modules/[^/]+/domain/',
  '^src/modules/[^/]+/(constants|types)\\.ts$',
];
const PORT_FILES = ['^src/modules/[^/]+/ports\\.ts$', '^src/shared/ports\\.ts$'];
const SERVICE_FILES = ['^src/modules/[^/]+/(service|[^/]+\\.service)\\.ts$'];
const REPOSITORY = '^src/modules/[^/]+/repository(\\.ts$|/)';
const MAPPERS = '^src/modules/[^/]+/mappers\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error',
      comment: 'Cycles make the dependency direction unknowable. Break them with a port or move the shared piece inward.',
      from: { path: '^src' }, to: { circular: true } },
    { name: 'domain-is-pure', severity: 'error',
      comment: 'Ring 1 and ports know no framework, ORM or SDK.',
      from: { path: [...DOMAIN_FILES, ...PORT_FILES] },
      to: { path: [npm(HTTP_FRAMEWORK), npm(ORM), npm(SDKS)] } },
    { name: 'domain-no-outer-layers', severity: 'error',
      comment: 'Inner contracts may not import db, adapters, the container, routes, services or repositories. Depend on a port.',
      from: { path: [...DOMAIN_FILES, ...PORT_FILES] },
      to: { path: ['^src/db/', '^src/adapters/', '^src/platform/container\\.ts$',
                   '^src/modules/[^/]+/(routes|service|repository)'] } },
    { name: 'service-no-http-framework', severity: 'error',
      comment: 'Services are use cases: no request/reply types. The route translates HTTP to plain arguments.',
      from: { path: SERVICE_FILES }, to: { path: npm(HTTP_FRAMEWORK) } },
    { name: 'orm-only-in-repositories', severity: 'error',
      comment: 'Only repositories (and mappers, for row types) touch db/; only repositories touch the ORM.',
      from: { path: '^src/modules/', pathNot: [REPOSITORY, MAPPERS] },
      to: { path: ['^src/db/', npm(ORM)] } },
    { name: 'mappers-no-orm-library', severity: 'error',
      comment: 'mappers.ts knows the row shape (type imports) but never runs queries.',
      from: { path: MAPPERS }, to: { path: npm(ORM) } },
    { name: 'inner-not-to-container', severity: 'error',
      comment: 'Passing the Container into a service is a service locator. Inject narrow ports.',
      from: { path: '^src/modules/', pathNot: ['^src/modules/[^/]+/routes\\.ts$', '^src/modules/index\\.ts$'] },
      to: { path: '^src/platform/container\\.ts$' } },
    { name: 'inner-not-to-routes', severity: 'error',
      comment: 'Application and infrastructure never import presentation.',
      from: { path: ['^src/modules/[^/]+/(service|repository|ports)', '^src/modules/[^/]+/domain/'] },
      to: { path: '^src/modules/[^/]+/routes\\.ts$' } },
    { name: 'no-import-of-module-registry', severity: 'error',
      comment: 'Only app.ts imports the module registry.',
      from: { path: '^src/modules/', pathNot: '^src/modules/index\\.ts$' },
      to: { path: '^src/modules/index\\.ts$' } },
    { name: 'sdk-only-in-adapters', severity: 'error',
      comment: 'Vendor SDKs live behind a port in src/adapters/.',
      from: { path: '^src', pathNot: '^src/adapters/' }, to: { path: npm(SDKS) } },
    { name: 'adapters-not-into-modules', severity: 'error',
      comment: 'Infrastructure implements core ports; it does not reach into feature modules.',
      from: { path: '^src/adapters/' }, to: { path: '^src/modules/' } },
    { name: 'no-cross-module-internals', severity: 'error',
      comment: "Another module's public surface is index.ts / ports.ts (types.ts only if published).",
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/',
            pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/(index|ports)\\.ts$'] } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,   // see `import type` edges
    preserveSymlinks: true,       // stable npm paths across OSes (baseline is keyed on paths)
    moduleSystems: ['es6', 'cjs'],
  },
};
```

If one module legitimately publishes its `types.ts` (rule 11), add exactly that file to the
`no-cross-module-internals` `pathNot` list with a comment — do not whitelist every `types.ts`.

## The rules

| Rule | Protects | Typical fix |
|---|---|---|
| `no-circular` | Knowable dependency direction | Break the cycle with a port, or move the shared piece inward |
| `domain-is-pure` | Ring 1/2 contracts (`shared/contracts`, `domain/`, `constants.ts`, `types.ts`, `ports.ts`) know no framework, ORM or SDK | Remove the import; express it as a port |
| `domain-no-outer-layers` | Same files may not import `db`, `adapters`, `container`, routes/service/repository | Depend on a port |
| `service-no-http-framework` | Services stay free of the HTTP framework | The route extracts plain values |
| `orm-only-in-repositories` | Only `repository*` and a module's `mappers.ts` touch `db/`; only `repository*` touches the ORM | Move the query into the repository behind a port |
| `mappers-no-orm-library` | `mappers.ts` knows the row *shape* (type imports) but never the ORM | Move the query into `repository.ts` |
| `inner-not-to-container` | No service locator | Inject narrow deps ([composition-root-and-di](composition-root-and-di.md)) |
| `inner-not-to-routes` | Application/infrastructure never import presentation | Invert the dependency |
| `no-import-of-module-registry` | Nobody but `app.ts` imports `modules/index.ts` | Import the module you need |
| `sdk-only-in-adapters` | Vendor SDKs only in `src/adapters/` | Add a port + adapter |
| `adapters-not-into-modules` | Infrastructure does not import feature modules | Move the shared constant/type inward |
| `no-cross-module-internals` | Other modules see only `index.ts` / `ports.ts` | Use the port, or promote the piece |

How the rules read files: by **name convention** — `service.ts` / `*.service.ts` are services,
`repository.ts` or `repository/` are repositories, `mappers.ts` is the row mapper beside them,
`ports.ts`, `domain/`, `constants.ts`, `types.ts` are inner contracts. Name files accordingly or the
rules cannot see them.

## When a rule fires on your change

1. Read the rule's `comment` (printed with the violation) — it states the intent.
2. Fix the code. The "typical fix" column above is the default.
3. Do **not** add the violation to the baseline to get green. New code must not grow it.

## Adopting on an existing codebase — the baseline

Run once without `--ignore-known`, then freeze what exists:

```bash
npx depcruise src --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json
```

After you fix a baselined violation, regenerate the same way and review the diff — it must only
**remove** entries:

```bash
git diff --stat .dependency-cruiser-known-violations.json
```

Version note: older dependency-cruiser releases ship a separate `depcruise-baseline` command; newer
ones use `--output-type baseline`. Check `npx depcruise --help` for your installed version and use the
same form in CI and in your docs.

## Adding or changing a rule

- Prefer **forbid** rules (name what must not happen): they tolerate rings you have not yet classified,
  whereas allow-lists fail on everything unlisted.
- Give it a kebab-case `name`, `severity: 'error'`, and a `comment` that says *why* — it is what an
  agent reads when it fires.
- Match npm packages with an `npm([...])` helper as above: it matches the resolved
  `…/node_modules/<pkg>/…` path, which also works for pnpm's nested layout.
- Keep `preserveSymlinks: true` so an npm package always resolves to `node_modules/<pkg>/…`. Without it
  the path differs between machines (e.g. `node_modules/.pnpm/<pkg>@<ver>/…` on one OS), and because the
  **baseline is keyed on the resolved path**, baselined npm edges look new in CI and fail it. After any
  change to the baseline or the options, confirm on CI, not only locally.
- Keep `tsPreCompilationDeps: true` so that `import type` edges are seen. A type leak (`OrderRow` in a
  service) is exactly what the rules should catch.
- **Prove it**: create a throw-away probe file that violates the rule, run without `--ignore-known`,
  confirm the failure, delete the probe. Then regenerate the baseline if the rule catches existing code.

## Exceptions

Prefer fixing. If an exception is genuinely right, scope it narrowly in the rule (`pathNot` with a
comment naming the file and the reason) and record it under *Settled decisions* in your
[project mapping](project-mapping.md). "It was already like that" is what the baseline is for; it is
not an exception.

## What the check cannot see

- **Logic in a route** — it checks imports, not what a handler does. The reviewer checklist covers it.
- **Table ownership, barrels re-exporting services, published `types.ts`** (rules 8, 10, 11) — review by hand.
- **Unclassified files** — `helpers.ts` and miscellaneous `platform/*` files have no ring until you give them one.
- **Whether a port is well designed** — SDK-shaped ports pass the linter and still leak.
- **Files outside `src/`** — tests are usually not cruised.
