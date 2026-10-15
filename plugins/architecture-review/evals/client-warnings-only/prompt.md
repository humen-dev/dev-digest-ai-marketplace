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
diff --git a/web/src/app/orders/_components/OrderCard/OrderCard.tsx b/web/src/app/orders/_components/OrderCard/OrderCard.tsx
new file mode 100644
--- /dev/null
+++ b/web/src/app/orders/_components/OrderCard/OrderCard.tsx
@@ -0,0 +1,24 @@
+'use client';
+
+import type { OrderListItem } from '@acme/contracts';
+import { formatMoney } from '../../../../lib/format-money';
+import { CardTitle } from './styles';
+
+function formatAge(placedAt: string): string {
+  const days = Math.floor((Date.now() - new Date(placedAt).getTime()) / 86_400_000);
+  return days === 0 ? 'today' : `${days}d ago`;
+}
+
+export function OrderCard({ order }: { order: OrderListItem }) {
+  return (
+    <article>
+      <CardTitle>{order.reference}</CardTitle>
+      <p>
+        Placed {formatAge(order.placedAt)} · total {formatMoney(order.totalCents, order.currency)}
+      </p>
+      {order.overdue && <span>Needs attention</span>}
+    </article>
+  );
+}
+
+export default OrderCard;
diff --git a/web/src/app/orders/_components/OrderCard/index.ts b/web/src/app/orders/_components/OrderCard/index.ts
new file mode 100644
--- /dev/null
+++ b/web/src/app/orders/_components/OrderCard/index.ts
@@ -0,0 +1 @@
+export { OrderCard } from './OrderCard';
diff --git a/web/src/app/orders/_components/OrderCard/styles.ts b/web/src/app/orders/_components/OrderCard/styles.ts
new file mode 100644
--- /dev/null
+++ b/web/src/app/orders/_components/OrderCard/styles.ts
@@ -0,0 +1,3 @@
+import { styled } from '@/vendor/ui/styled';
+
+export const CardTitle = styled('h3', { fontSize: 16, fontWeight: 600 });
</diff>
