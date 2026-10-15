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
diff --git a/api/src/modules/orders/routes.ts b/api/src/modules/orders/routes.ts
new file mode 100644
--- /dev/null
+++ b/api/src/modules/orders/routes.ts
@@ -0,0 +1,34 @@
+import type { FastifyPluginAsync } from 'fastify';
+import { eq, desc } from 'drizzle-orm';
+import { db } from '../../db/client';
+import { orders } from '../../db/schema/orders';
+import { OrderListResponse } from '@acme/contracts';
+
+export const orderRoutes: FastifyPluginAsync = async (app) => {
+  app.get('/customers/:customerId/orders', async (req) => {
+    const { customerId } = req.params as { customerId: string };
+    const rows = await db
+      .select()
+      .from(orders)
+      .where(eq(orders.customerId, customerId))
+      .orderBy(desc(orders.placedAt))
+      .limit(50);
+
+    // an order is "overdue" when it has been awaiting shipment for more than 3 days
+    const items = rows.map((r) => ({
+      id: r.id,
+      reference: r.reference,
+      overdue: r.status === 'awaiting_shipment' && Date.now() - r.placedAt.getTime() > 3 * 24 * 3600 * 1000,
+    }));
+
+    return OrderListResponse.parse({ items });
+  });
+
+  app.post('/orders/:id/cancel', async (req) => {
+    const { id } = req.params as { id: string };
+    await app.container.orders.cancel(id);
+    return { ok: true };
+  });
+};
+
+export default orderRoutes;
diff --git a/api/src/modules/orders/service.ts b/api/src/modules/orders/service.ts
new file mode 100644
--- /dev/null
+++ b/api/src/modules/orders/service.ts
@@ -0,0 +1,11 @@
+import type { OrderRepository } from './ports';
+
+export class OrderService {
+  constructor(private readonly repo: OrderRepository) {}
+
+  async cancel(id: string): Promise<void> {
+    const order = await this.repo.findById(id);
+    if (!order) throw new Error(`order ${id} not found`);
+    await this.repo.setStatus(id, 'cancelled');
+  }
+}
</diff>
