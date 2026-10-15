# engineering-paved-path

Paved-path engineering skills for TypeScript web projects: React, Next.js, Fastify,
Drizzle, PostgreSQL, TypeScript, Zod, testing, security, architecture and Mermaid
diagrams.

The plugin contains **skills only**. They load into the main session when a task
matches their description, you can invoke them by hand, and agents (planners,
implementers, reviewers) preload them so every step of the work follows the same
practices. Four skills are our own and project-agnostic; eight are third-party
skills (six from public skill repositories, two from the AI Agentic Engineering
workshop materials) — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Install

```bash
claude plugin marketplace add humen-dev/dev-digest-ai-marketplace   # once
claude plugin install engineering-paved-path@dev-digest-ai-marketplace
```

You usually do not need to install it yourself: `sdd-engineering` and
`architecture-review` declare it as a dependency, so installing either of them
installs this plugin automatically.

## Skills

Invoke any skill by hand with `/engineering-paved-path:<skill>`; otherwise Claude
loads it when the task matches the trigger.

### Own skills

| Skill | What it covers | Triggers when | Invoke |
|---|---|---|---|
| `security` | OWASP Top 10:2025 for web apps: auth/authz, input handling, uploads, secrets, API endpoints (React, Express, MongoDB, JWT examples) | Reviewing code for vulnerabilities, building auth, handling untrusted input or secrets | `/engineering-paved-path:security` |
| `onion-architecture` | Backend rings (domain, application, infrastructure, presentation), import direction, where ports / services / repositories / routes / mappers / adapters / DI live, transactions, optional dependency-cruiser enforcement | Creating, moving, splitting or reviewing backend code; "where should this live?" | `/engineering-paved-path:onion-architecture` |
| `frontend-ui-architecture` | React / Next.js code organization: where components, hooks, constants, helpers, styles, types and tests live, how to split a component, layer direction, server/client boundary | Creating, moving, splitting or reviewing UI code; structure-focused PR reviews | `/engineering-paved-path:frontend-ui-architecture` |
| `mermaid-diagram` | Mermaid diagrams in Markdown: flowcharts, sequence, class, ER, state and more | Visualizing workflows, architectures, API flows, data models or state machines | `/engineering-paved-path:mermaid-diagram` |

The two architecture skills use a neutral sample app (an `orders` / `customers` /
`catalog` commerce app). Each ships a `references/project-mapping.md` template: fill
it in once for your repository so agents apply the rules to your real folders.

### Third-party skills

Copied from upstream (byte-identical except one documented line in
`react-best-practices`). Source, pinned hash, copyright and licence for each are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Skills marked 📚 come from the
workshop materials and have no declared licence.

| Skill | What it covers | Triggers when | Invoke |
|---|---|---|---|
| `next-best-practices` ⚠️ | Next.js file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font, bundling | Working on a Next.js app | `/engineering-paved-path:next-best-practices` |
| `fastify-best-practices` | Fastify servers and REST APIs: routes, plugins, JSON Schema, errors, hooks, auth, CORS, logging, performance, deployment | Building, configuring or debugging a Fastify app | `/engineering-paved-path:fastify-best-practices` |
| `drizzle-orm-patterns` | Drizzle ORM schema, CRUD, relations, queries, transactions, migrations (Drizzle Kit) | Any Drizzle ORM development | `/engineering-paved-path:drizzle-orm-patterns` |
| `postgresql-table-design` | PostgreSQL schema design: data types, indexing, constraints, performance patterns, advanced features | Designing or reviewing a PostgreSQL schema | `/engineering-paved-path:postgresql-table-design` |
| `typescript-expert` | Type-level programming, performance, monorepos, migrations, modern tooling (includes a diagnostic script) | TypeScript / JavaScript type or tooling questions | `/engineering-paved-path:typescript-expert` |
| `zod` | Zod schemas: type safety, parsing, error handling, composition, performance | Defining `z.object` schemas, `safeParse`, `z.infer` | `/engineering-paved-path:zod` |
| `react-best-practices` 📚 | Modern React (2025-26) best practices and anti-pattern catalog: component design, state, hooks misuse, performance, data fetching, error boundaries | Writing, reviewing or refactoring React components, hooks or state | `/engineering-paved-path:react-best-practices` |
| `react-testing-library` 📚 | React Testing Library + Vitest: setup, query priority, `userEvent`, async patterns, MSW-first mocking, few longer user-flow tests | Writing, reviewing or setting up component and hook tests | `/engineering-paved-path:react-testing-library` |

⚠️ `next-best-practices` has no declared licence upstream and is redistributed only
while this marketplace is private. It must be replaced or removed before the
marketplace is made public — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md#next-best-practices).

## Preloading skills into agents

An agent (in any plugin, or a project-level agent definition) preloads skills from
this plugin by listing them, namespaced, in its frontmatter:

```yaml
---
name: my-reviewer
description: Reviews backend changes for placement and security.
skills:
  - engineering-paved-path:onion-architecture
  - engineering-paved-path:security
  - engineering-paved-path:typescript-expert
---
```

The full skill content is injected into the agent's context at start-up. Preload only
what the agent always needs; an agent can still `Read` other skills' `SKILL.md` on
demand.

## Configuration

None. The skills read no configuration files and no environment variables. The
architecture skills describe project-specific facts (folders, table owners, known
drift) through the `project-mapping.md` template you keep in your own repository.

## Hooks and MCP servers

None. This plugin ships no hooks, no MCP servers, no commands and no agents.

## Dependencies and dependents

- **Depends on:** nothing.
- **Used by:**
  - `architecture-review` — its `architecture-reviewer` agent preloads the
    architecture skills.
  - `sdd-engineering` — its planner and implementer agents preload or read these
    skills so plans and code follow the same practices.

## Requirements

- Claude Code with plugin support.
- `typescript-expert`'s optional diagnostic script needs Python 3.
