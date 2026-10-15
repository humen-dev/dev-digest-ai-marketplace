---
runs: 2
max_turns: 16
allowed_tools: [Agent, Read, Glob, Grep, Write]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
tags: [implementation-planner, cost]
---

Use the sdd-engineering:implementation-planner agent to write the plan for the
requirements below. Pass all of this to it as it is — the requirements are final
and approved by me, nothing needs to be asked:

- Execution mode: `single-agent`.
- Project: a new, empty repository. There is no existing code yet — that is
  known, not an open question. One module, `server` at `server/`: a Fastify +
  TypeScript HTTP API that follows onion architecture
  (`server/src/modules/<name>/{domain,application,infrastructure,presentation}`),
  PostgreSQL through Drizzle ORM, Zod for request validation. No UI.
- Feature "Bookmarks API":
  1. `POST /bookmarks` with `{ url, title }` stores a bookmark in a new
     `bookmarks` table (id, url, title, created_at) and returns it with 201.
  2. `url` must be an `http`/`https` URL and `title` 1–200 characters;
     otherwise the API returns 400 with the validation errors.
  3. `GET /bookmarks` returns at most 50 bookmarks, newest first.

When the agent is done, Read the plan file it wrote and reply with: the plan
path, then one line per work unit — its id, Kind and the *Skills* field copied
verbatim from the plan. Do not invoke the agent a second time.
