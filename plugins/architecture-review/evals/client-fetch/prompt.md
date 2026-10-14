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
diff --git a/client/src/app/digests/_components/DigestList/DigestList.tsx b/client/src/app/digests/_components/DigestList/DigestList.tsx
new file mode 100644
--- /dev/null
+++ b/client/src/app/digests/_components/DigestList/DigestList.tsx
@@ -0,0 +1,37 @@
+'use client';
+
+import { useEffect, useState } from 'react';
+import { useTranslations } from 'next-intl';
+import type { DigestListItem } from '@acme/shared';
+import { RepoBadge } from '../../../repos/[repoId]/_components/RepoCard/RepoBadge';
+
+const PAGE_SIZE = 20;
+
+export function DigestList({ repoId }: { repoId: string }) {
+  const t = useTranslations('digests');
+  const [items, setItems] = useState<DigestListItem[]>([]);
+  const [page, setPage] = useState(0);
+
+  useEffect(() => {
+    fetch(`${process.env.NEXT_PUBLIC_API_URL}/repos/${repoId}/digests?offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`)
+      .then((r) => r.json())
+      .then((body) => setItems(body.items));
+  }, [repoId, page]);
+
+  return (
+    <section>
+      <h2>{t('title')}</h2>
+      <ul>
+        {items.map((d) => (
+          <li key={d.id}>
+            <RepoBadge repoId={repoId} />
+            {d.title}
+          </li>
+        ))}
+      </ul>
+      <button onClick={() => setPage((p) => p + 1)}>{t('more')}</button>
+    </section>
+  );
+}
+
+export default DigestList;
diff --git a/client/src/app/digests/_components/DigestList/index.ts b/client/src/app/digests/_components/DigestList/index.ts
new file mode 100644
--- /dev/null
+++ b/client/src/app/digests/_components/DigestList/index.ts
@@ -0,0 +1 @@
+export { DigestList } from './DigestList';
</diff>
