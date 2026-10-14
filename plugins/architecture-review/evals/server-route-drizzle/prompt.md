---
max_turns: 4
timeout_seconds: 600
allowed_tools: [Agent]
---

Use the `architecture-review:architecture-reviewer` agent to review the change set below for architecture (file placement and import direction). Pass it the project notes and the complete diff verbatim, and tell it that it has no repository access in this session: it cannot run git or any architecture check, and the diff against main below is the whole change set. When it returns, reply with its report verbatim and nothing else.

<project-notes>
Project architecture notes (the sample project's AGENTS.md; there is no .claude/sdd.json, so no automated architecture check is configured):

- Modules: `server/` (backend), `client/` (frontend), `engine/` (library). Shared contracts come from `@acme/shared`; packages import each other only through tsconfig path aliases `@acme/<package>` (e.g. `@acme/engine`), never by relative paths into another package.
- server/ follows onion architecture: feature modules in `src/modules/<name>/` with `routes.ts` (HTTP only), `service.ts` (use cases), `repository.ts` (the only place that touches Drizzle/the DB), `ports.ts`, `mappers.ts`; vendor SDKs only in `src/adapters/`; wiring in `src/platform/container.ts`.
- client/ is a Next.js App Router app: route-private components in `src/app/<route>/_components/<Name>/`; data fetching only through hooks in `src/lib/hooks/<domain>.ts` that call `src/lib/api.ts`; shared UI in `src/components/`; helpers in `src/lib/`; `@/` alias for cross-folder imports; user-facing strings in `messages/<locale>/*.json`.
- engine/ is a pure review library: no DB, GitHub, filesystem or network I/O in `engine/src`; callers pass data in. The prompt-injection guard `INJECTION_GUARD` in `engine/src/prompt.ts` is security-critical: any change needs explicit sign-off.
</project-notes>

<diff>
diff --git a/server/src/modules/digests/routes.ts b/server/src/modules/digests/routes.ts
new file mode 100644
--- /dev/null
+++ b/server/src/modules/digests/routes.ts
@@ -0,0 +1,34 @@
+import type { FastifyPluginAsync } from 'fastify';
+import { eq, desc } from 'drizzle-orm';
+import { db } from '../../db/client';
+import { digests } from '../../db/schema/digests';
+import { DigestListResponse } from '@acme/shared';
+
+export const digestRoutes: FastifyPluginAsync = async (app) => {
+  app.get('/repos/:repoId/digests', async (req) => {
+    const { repoId } = req.params as { repoId: string };
+    const rows = await db
+      .select()
+      .from(digests)
+      .where(eq(digests.repoId, repoId))
+      .orderBy(desc(digests.createdAt))
+      .limit(50);
+
+    // a digest is "hot" when it has 3+ critical findings in the last 7 days
+    const items = rows.map((r) => ({
+      id: r.id,
+      title: r.title,
+      hot: r.criticalCount >= 3 && Date.now() - r.createdAt.getTime() < 7 * 24 * 3600 * 1000,
+    }));
+
+    return DigestListResponse.parse({ items });
+  });
+
+  app.post('/repos/:repoId/digests/:id/pin', async (req) => {
+    const { id } = req.params as { id: string };
+    await app.container.digests.pin(id);
+    return { ok: true };
+  });
+};
+
+export default digestRoutes;
diff --git a/server/src/modules/digests/service.ts b/server/src/modules/digests/service.ts
new file mode 100644
--- /dev/null
+++ b/server/src/modules/digests/service.ts
@@ -0,0 +1,12 @@
+import type { DigestRepository } from './ports';
+
+export class DigestService {
+  constructor(private readonly repo: DigestRepository) {}
+
+  async pin(id: string): Promise<void> {
+    const digest = await this.repo.findById(id);
+    if (!digest) throw new Error(`digest ${id} not found`);
+    await this.repo.setPinned(id, true);
+  }
+}
</diff>
