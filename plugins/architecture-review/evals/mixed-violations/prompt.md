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
diff --git a/api/src/modules/payments/routes.ts b/api/src/modules/payments/routes.ts
new file mode 100644
--- /dev/null
+++ b/api/src/modules/payments/routes.ts
@@ -0,0 +1,13 @@
+import type { FastifyPluginAsync } from 'fastify';
+import { eq } from 'drizzle-orm';
+import { db } from '../../db/client';
+import { payments } from '../../db/schema/payments';
+
+export const paymentRoutes: FastifyPluginAsync = async (app) => {
+  app.get('/orders/:orderId/payments', async (req) => {
+    const { orderId } = req.params as { orderId: string };
+    return db.select().from(payments).where(eq(payments.orderId, orderId));
+  });
+
+  app.post('/orders/:orderId/payments/capture', async (req) => app.container.payments.capture((req.params as { orderId: string }).orderId));
+};
diff --git a/api/src/modules/payments/service.ts b/api/src/modules/payments/service.ts
new file mode 100644
--- /dev/null
+++ b/api/src/modules/payments/service.ts
@@ -0,0 +1,16 @@
+import Stripe from 'stripe';
+import { applyPriceRules } from '../../../../pricing-core/src/rules';
+import type { PaymentRepository } from './ports';
+
+export class PaymentService {
+  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
+
+  constructor(private readonly repo: PaymentRepository) {}
+
+  async capture(orderId: string): Promise<void> {
+    const order = await this.repo.findOrder(orderId);
+    const priced = applyPriceRules(order.lines, order.priceRules);
+    const intent = await this.stripe.paymentIntents.create({ amount: priced.totalCents, currency: order.currency });
+    await this.repo.savePayment(orderId, intent.id, priced.totalCents);
+  }
+}
diff --git a/pricing-core/src/rules/load-price-rules.ts b/pricing-core/src/rules/load-price-rules.ts
new file mode 100644
--- /dev/null
+++ b/pricing-core/src/rules/load-price-rules.ts
@@ -0,0 +1,8 @@
+import { readFileSync, existsSync } from 'node:fs';
+import { join } from 'node:path';
+
+/** Load the store's price rules straight from disk so callers don't have to pass them in. */
+export function loadPriceRules(storeRoot: string): string {
+  const file = join(storeRoot, '.acme', 'price-rules.json');
+  return existsSync(file) ? readFileSync(file, 'utf8') : '';
+}
diff --git a/api/src/modules/payments/constants.ts b/api/src/modules/payments/constants.ts
--- a/api/src/modules/payments/constants.ts
+++ b/api/src/modules/payments/constants.ts
@@ -13,4 +13,5 @@ import type { Role } from '@acme/contracts';
 export const REFUND_ALLOWED_ROLES: readonly Role[] = [
   'owner',
   'finance-admin',
+  'support-agent',
 ];
diff --git a/web/src/app/orders/[orderId]/payments/_components/PaymentHistory/PaymentHistory.tsx b/web/src/app/orders/[orderId]/payments/_components/PaymentHistory/PaymentHistory.tsx
new file mode 100644
--- /dev/null
+++ b/web/src/app/orders/[orderId]/payments/_components/PaymentHistory/PaymentHistory.tsx
@@ -0,0 +1,22 @@
+'use client';
+
+import { useEffect, useState } from 'react';
+import { useTranslations } from 'next-intl';
+import type { Payment } from '@acme/contracts';
+
+const MAX_VISIBLE = 8;
+
+export function PaymentHistory({ orderId }: { orderId: string }) {
+  const t = useTranslations('payments');
+  const [items, setItems] = useState<Payment[]>([]);
+
+  useEffect(() => {
+    fetch(`/api/orders/${orderId}/payments`).then((r) => r.json()).then(setItems);
+  }, [orderId]);
+
+  return (
+    <ul aria-label={t('title')}>
+      {items.slice(0, MAX_VISIBLE).map((p) => <li key={p.id}>{p.status}</li>)}
+    </ul>
+  );
+}
</diff>
