# Third-party notices — engineering-paved-path

This plugin redistributes eight skills written by third parties:

- six skills installed from public skill repositories, copied **byte-identical**
  from the copies pinned in the source project's `skills-lock.json` (the
  `computedHash` below is the hash recorded there for each skill);
- two skills that came with the *AI Agentic Engineering* workshop materials from
  [burnjohn/ai-demo-marketplace](https://github.com/burnjohn/ai-demo-marketplace)
  (see [Workshop material](#workshop-material-burnjohnai-demo-marketplace)).

Local edits are listed under the skill's entry; any future local edit must be
listed there too.

The four skills authored or rewritten for this plugin (`security`,
`onion-architecture`, `frontend-ui-architecture`, `mermaid-diagram`) are not
third-party.

| Skill | Upstream repository | Upstream path | Licence |
|---|---|---|---|
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) | `skills/next-best-practices/SKILL.md` | **none declared** — see below |
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) | `skills/fastify/SKILL.md` | MIT |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) | `plugins/developer-kit-typescript/skills/drizzle-orm-patterns/SKILL.md` | MIT |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) | `plugins/database-design/skills/postgresql/SKILL.md` | MIT |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | `skills/typescript-expert/SKILL.md` | MIT |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) | `skills/.curated/zod/SKILL.md` | MIT |
| `react-best-practices` | [burnjohn/ai-demo-marketplace](https://github.com/burnjohn/ai-demo-marketplace) | `plugins/frontend-skills/skills/react-best-practices/SKILL.md` | **none declared** — workshop material |
| `react-testing-library` | [burnjohn/ai-demo-marketplace](https://github.com/burnjohn/ai-demo-marketplace) | `plugins/testing-skills/skills/react-testing-library/` | **none declared** — workshop material |

---

## next-best-practices

- **Upstream repository:** https://github.com/vercel-labs/next-skills
- **Upstream path:** `skills/next-best-practices/SKILL.md` (with its sibling reference files)
- **computedHash (skills-lock.json):** `f4678aef4ffc10a5ea64a91e57abe5a5081af813b06d58d565caf3e8ef56e26c`
- **Copyright holder:** Vercel, Inc. (repository owner `vercel-labs`)
- **Licence:** **none declared.** The repository has no licence file (the GitHub
  licence API returns 404), so no redistribution right is granted by default.

**Status — blocker for a public release.** The upstream README states that the
Next.js agent skills have moved into the Next.js repository
([vercel/next.js `skills/`](https://github.com/vercel/next.js/tree/canary/skills),
MIT-licensed). However, it also states that `next-best-practices` itself is
**no longer a skill** there: its knowledge is now delivered through the docs bundled
with Next.js and the `AGENTS.md` / `CLAUDE.md` that `next dev` generates (Next.js
16.3+), or via `npx @next/codemod@canary agents-md` on older versions. At the time
of writing, `vercel/next.js/skills` contains only workflow skills
(`next-bundle-optimizer`, `next-cache-components-*`, `next-dev-loop`,
`next-partial-prefetching-*`) and no `next-best-practices`.

This copy is therefore redistributed **only while the marketplace is private**.
Before the marketplace is made public, this copy must be replaced by an
MIT-licensed version from vercel/next.js — and since no such version of this
skill currently exists there, the owner must choose one of:

1. remove `next-best-practices` from this plugin and point users to the Next.js
   bundled docs / generated agent rules instead;
2. replace it with an MIT-licensed skill from `vercel/next.js/skills` that covers
   the needed ground; or
3. obtain written permission from Vercel to redistribute this copy.

---

## fastify-best-practices

- **Upstream repository:** https://github.com/mcollina/skills
- **Upstream path:** `skills/fastify/SKILL.md` (with `rules/*.md` and `tile.json`)
- **computedHash (skills-lock.json):** `269924684709b8c6f50a569ef988e66031efb822ef92cba6c8dfa160e54ed4d4`
- **Copyright holder:** Matteo Collina
- **Licence:** MIT

```text
MIT License

Copyright (c) 2026 Matteo Collina

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## drizzle-orm-patterns

- **Upstream repository:** https://github.com/giuseppe-trisciuoglio/developer-kit
- **Upstream path:** `plugins/developer-kit-typescript/skills/drizzle-orm-patterns/SKILL.md` (with `references/*.md`)
- **computedHash (skills-lock.json):** `d63e6d73a9f579b505a5694af2f3b3200c2b5eeea147e88b9b6d1e5fce23bcbb`
- **Copyright holder:** Giuseppe Trisciuoglio
- **Licence:** MIT

```text
MIT License

Copyright (c) 2025 Giuseppe Trisciuoglio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## postgresql-table-design

- **Upstream repository:** https://github.com/wshobson/agents
- **Upstream path:** `plugins/database-design/skills/postgresql/SKILL.md`
- **computedHash (skills-lock.json):** `dcace78e5cef7d8dce8ffef7ebee146e6c83a438aa4cf80bf502730e870c02d4`
- **Copyright holder:** Seth Hobson
- **Licence:** MIT

```text
MIT License

Copyright (c) 2024 Seth Hobson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. 
```

---

## typescript-expert

- **Upstream repository:** https://github.com/sickn33/antigravity-awesome-skills
- **Upstream path:** `skills/typescript-expert/SKILL.md` (with `references/` and `scripts/`)
- **computedHash (skills-lock.json):** `525e74a7220ed67832001ca89b46deae8f2bab1abc9d25c56c8716d6550c795f`
- **Copyright holder:** "Antigravity User" (as written in the upstream licence; repository owner `sickn33`)
- **Licence:** MIT

```text
MIT License

Copyright (c) 2026 Antigravity User

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## zod

- **Upstream repository:** https://github.com/pproenca/dot-skills
- **Upstream path:** `skills/.curated/zod/SKILL.md` (with `AGENTS.md`, `README.md`, `assets/` and `references/`)
- **computedHash (skills-lock.json):** `c69b5133b65643317236707f2cd3e521b4fc6e5ee5fd6c6c00cf62a37dfd0144`
- **Copyright holder:** not named in the upstream licence ("Copyright (c) 2025"); repository owner `pproenca`
- **Licence:** MIT

```text
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Workshop material (burnjohn/ai-demo-marketplace)

- **Upstream repository:** https://github.com/burnjohn/ai-demo-marketplace —
  "a Claude Code plugin catalog for the AI Agentic Engineering workshop".
- **Copyright holder:** burnjohn (repository owner; author of the workshop).
- **Licence:** **none declared** — no licence file, no `license` field in its
  `plugin.json`. No redistribution right is granted by default. Used here as
  workshop material in a private marketplace; **get the author's permission (or a
  licence) before this marketplace is made public**, or replace these skills.
- **Provenance check (2026-10-14):** the source project's copies are byte-identical
  to the upstream `SKILL.md` files. The same upstream repository also ships
  `next-best-practices` (identical to the copy listed above) and
  `typescript-expert` (identical; original author listed above).

### react-best-practices

- **Upstream path:** `plugins/frontend-skills/skills/react-best-practices/SKILL.md`
- **Local edit (1 line):** the bullet recommending the source project's own
  `useApiQuery` / `useApiMutation` hooks was replaced with generic guidance to
  build on the project's data-fetching library or its own query wrapper hooks.

### react-testing-library

- **Upstream path:** `plugins/testing-skills/skills/react-testing-library/`
  (`SKILL.md`, `README.md`)
- **Local edits:** none. The skill's `README.md` describes it as a rewrite of an
  earlier "original skill" ("3-6 tests per component"); that earlier version is
  not published, and the rewrite as distributed is the workshop author's.

---

## Notes

- **Updating a third-party skill:** re-copy the whole folder from upstream, update
  the hash in this file, and keep the copy byte-identical. Record any unavoidable
  local edit under the skill's entry above.
