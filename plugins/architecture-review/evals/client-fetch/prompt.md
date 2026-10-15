---
max_turns: 4
timeout_seconds: 600
allowed_tools: [Agent]
---

Use the `architecture-review:architecture-reviewer` agent to review the change set below for architecture (file placement and import direction). Pass it the project notes and the complete diff verbatim, and tell it that it has no repository access in this session: it cannot run git or any architecture check, and the diff against main below is the whole change set. When it returns, reply with its report verbatim and nothing else.

<project-notes>
Project architecture notes (the sample commerce app's AGENTS.md; there is no .claude/sdd.json, so no automated architecture check is configured):

- Modules: `api/` (backend), `web/` (frontend, an admin UI for the API), `pricing-core/` (library). Shared contracts come from `@acme/contracts`, design-system primitives from `@acme/ui`; packages import each other only through tsconfig path aliases `@acme/<package>` (e.g. `@acme/pricing-core`), never by relative paths into another package.
- api/ follows onion architecture: feature modules in `src/modules/<name>/` (`orders`, `customers`, `catalog`, `payments`, `notifications`) with `routes.ts` (HTTP only), `service.ts` (use cases), `repository.ts` (the only place that touches Drizzle/the DB), `ports.ts`, `mappers.ts`, `constants.ts`; vendor SDKs (Stripe, the email provider, S3) only in `src/adapters/<tool>/`; wiring in `src/platform/container.ts`.
- web/ is a Next.js App Router app: route-private components in `src/app/<route>/_components/<Name>/` (e.g. `src/app/orders/_components/OrderCard/`); data fetching only through hooks in `src/lib/hooks/<domain>.ts` (e.g. `src/lib/hooks/orders.ts`) that call `src/lib/api.ts`; shared UI in `src/components/`; purpose-named helpers in `src/lib/<purpose>.ts`; `@/` alias for cross-folder imports; user-facing strings in `messages/<locale>/<namespace>.json`.
- pricing-core/ is a pure pricing library: no DB, network or filesystem I/O in `pricing-core/src`; callers pass data (order lines, price rules) in. The refund permission list `REFUND_ALLOWED_ROLES` in `api/src/modules/payments/constants.ts` is security-critical: any change needs explicit sign-off.
</project-notes>

<diff>
diff --git a/web/src/app/orders/_components/OrderList/OrderList.tsx b/web/src/app/orders/_components/OrderList/OrderList.tsx
new file mode 100644
--- /dev/null
+++ b/web/src/app/orders/_components/OrderList/OrderList.tsx
@@ -0,0 +1,37 @@
+'use client';
+
+import { useEffect, useState } from 'react';
+import { useTranslations } from 'next-intl';
+import type { OrderListItem } from '@acme/contracts';
+import { CustomerBadge } from '../../../customers/[customerId]/_components/CustomerCard/CustomerBadge';
+
+const PAGE_SIZE = 20;
+
+export function OrderList({ customerId }: { customerId: string }) {
+  const t = useTranslations('orders');
+  const [items, setItems] = useState<OrderListItem[]>([]);
+  const [page, setPage] = useState(0);
+
+  useEffect(() => {
+    fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerId}/orders?offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`)
+      .then((r) => r.json())
+      .then((body) => setItems(body.items));
+  }, [customerId, page]);
+
+  return (
+    <section>
+      <h2>{t('title')}</h2>
+      <ul>
+        {items.map((o) => (
+          <li key={o.id}>
+            <CustomerBadge customerId={customerId} />
+            {o.reference}
+          </li>
+        ))}
+      </ul>
+      <button onClick={() => setPage((p) => p + 1)}>{t('more')}</button>
+    </section>
+  );
+}
+
+export default OrderList;
diff --git a/web/src/app/orders/_components/OrderList/index.ts b/web/src/app/orders/_components/OrderList/index.ts
new file mode 100644
--- /dev/null
+++ b/web/src/app/orders/_components/OrderList/index.ts
@@ -0,0 +1 @@
+export { OrderList } from './OrderList';
</diff>
