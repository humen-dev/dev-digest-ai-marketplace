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
diff --git a/client/src/app/digests/_components/DigestCard/DigestCard.tsx b/client/src/app/digests/_components/DigestCard/DigestCard.tsx
new file mode 100644
--- /dev/null
+++ b/client/src/app/digests/_components/DigestCard/DigestCard.tsx
@@ -0,0 +1,27 @@
+'use client';
+
+import type { DigestListItem } from '@acme/shared';
+import { shortSha } from '../../../../lib/format';
+import { CardTitle } from './styles';
+
+function formatAge(createdAt: string): string {
+  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
+  return days === 0 ? 'today' : `${days}d ago`;
+}
+
+export function DigestCard({ digest }: { digest: DigestListItem }) {
+  return (
+    <article>
+      <CardTitle>{digest.title}</CardTitle>
+      <p>
+        Last updated {formatAge(digest.createdAt)} · commit {shortSha(digest.headSha)}
+      </p>
+      {digest.hot && <span>Needs attention</span>}
+    </article>
+  );
+}
+
+export default DigestCard;
diff --git a/client/src/app/digests/_components/DigestCard/index.ts b/client/src/app/digests/_components/DigestCard/index.ts
new file mode 100644
--- /dev/null
+++ b/client/src/app/digests/_components/DigestCard/index.ts
@@ -0,0 +1 @@
+export { DigestCard } from './DigestCard';
diff --git a/client/src/app/digests/_components/DigestCard/styles.ts b/client/src/app/digests/_components/DigestCard/styles.ts
new file mode 100644
--- /dev/null
+++ b/client/src/app/digests/_components/DigestCard/styles.ts
@@ -0,0 +1,3 @@
+import { styled } from '@/vendor/ui/styled';
+
+export const CardTitle = styled('h3', { fontSize: 16, fontWeight: 600 });
</diff>
