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
diff --git a/server/src/modules/reviews/service.ts b/server/src/modules/reviews/service.ts
--- a/server/src/modules/reviews/service.ts
+++ b/server/src/modules/reviews/service.ts
@@ -1,9 +1,10 @@
+import type { FastifyRequest } from 'fastify';
 import type { ReviewRepository } from './ports';
 import { toReviewSummary } from './mappers';

 export class ReviewService {
   constructor(private readonly repo: ReviewRepository) {}

-  async rerun(reviewId: string, userId: string) {
+  async rerun(req: FastifyRequest<{ Params: { id: string } }>) {
+    const reviewId = req.params.id;
+    const userId = (req as any).user.id as string;
     const review = await this.repo.findById(reviewId);
     if (!review) throw new Error('review not found');
     await this.repo.markQueued(reviewId, userId);
diff --git a/server/src/modules/reviews/routes.ts b/server/src/modules/reviews/routes.ts
--- a/server/src/modules/reviews/routes.ts
+++ b/server/src/modules/reviews/routes.ts
@@ -1,6 +1,6 @@
 import type { FastifyPluginAsync } from 'fastify';
 import { sql } from 'drizzle-orm';
 import { db } from '../../db/client';

 export const reviewRoutes: FastifyPluginAsync = async (app) => {
   app.get('/reviews/stats', async () => db.execute(sql`select count(*) from reviews`));
-  app.post('/reviews/:id/rerun', async (req) => app.container.reviews.rerun(req.params.id, req.user.id));
+  app.post('/reviews/:id/rerun', async (req) => app.container.reviews.rerun(req));
 };
diff --git a/server/src/modules/reviews/utils.ts b/server/src/modules/reviews/utils.ts
new file mode 100644
--- /dev/null
+++ b/server/src/modules/reviews/utils.ts
@@ -0,0 +1,3 @@
+export function formatReviewTitle(prNumber: number, title: string): string {
+  return `#${prNumber} — ${title.trim()}`;
+}
</diff>
