# Checkout & Orders — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-projects:**
- [2026-07-26-foundation-auth-multitenancy-design.md](2026-07-26-foundation-auth-multitenancy-design.md)
- [2026-07-27-master-product-library-design.md](2026-07-27-master-product-library-design.md)
- [2026-07-27-reseller-catalog-sync-design.md](2026-07-27-reseller-catalog-sync-design.md)
- [2026-07-27-licensing-engine-design.md](2026-07-27-licensing-engine-design.md)
**Scope:** Sub-project 5 of the Phase 1 MVP (PRD §8). Single-product + lifetime-subscription checkout via a swappable payment-gateway interface (mock now, Razorpay later), auto-license-assignment on payment success, and DB-tracked signed download tokens.

## 1. Explicitly out of scope

- Real Razorpay SDK integration — built behind a `PaymentGateway` interface; only a `mockPaymentGateway` is wired this round.
- Invoices (PDF or otherwise) — `Order.invoiceId` does not exist this round; deferred to a later sub-project.
- A separate `Plan`/`Subscription` tracking model — a lifetime subscription is just an `Order` with `orderType='subscription'`, derived from the purchased product's `type`. Recurring billing/renewals are V2+.
- Refunds, partial refunds — `status` enum includes them for schema completeness but no endpoint mutates to those states this round.
- Real Cloudinary signed/private-delivery URLs — downloads are gated by our own `DownloadToken` model instead (see §3).
- A retry/fulfillment queue for the "payment succeeded but no license available" edge case (§5) — handled manually via the existing admin assign endpoint.

## 2. Data model (Mongoose)

### Order
- `tenantId: ObjectId` — ref Tenant, required
- `customerUserId: ObjectId` — ref User, required
- `productId: ObjectId` — ref Product, required
- `orderType: enum('single_product', 'subscription')` — derived server-side from the product's `type` (`'subscription'` type → `orderType='subscription'`, everything else → `'single_product'`)
- `amount: Number`, `currency: String` (default `'INR'`)
- `status: enum('pending', 'paid', 'failed', 'refunded', 'partial_refund')` — default `'pending'`
- `paymentGateway: String` — e.g. `'mock'`, `'razorpay'` later
- `paymentRef: String | null` — the gateway's order id
- `licenseId: ObjectId | null` — ref License; set once auto-assigned
- timestamps

### DownloadToken
- `orderId: ObjectId` — ref Order, required
- `fileUrl: String` — copied from the product's current `ProductVersion.fileUrl` at issuance
- `expiresAt: Date`
- `used: Boolean` — default `false`
- `ipAddress: String | null` — default `null`
- timestamps

## 3. Payment gateway abstraction

```ts
interface PaymentGateway {
  createOrder(input: { amount: number; currency: string; receipt: string }): Promise<{ gatewayOrderId: string }>;
  verifyAndParseWebhook(rawBody: string, signature: string): { gatewayOrderId: string; success: boolean } | null;
}
```

`mockPaymentGateway`:
- `createOrder` generates a deterministic-format fake id (`mock_order_<random>`).
- `verifyAndParseWebhook` computes an HMAC-SHA256 of `rawBody` using `MOCK_WEBHOOK_SECRET` (new required env var) and compares to `signature`; returns `null` on mismatch, otherwise parses `rawBody` as JSON (`{gatewayOrderId, success}`).

This mirrors the `consoleEmailService` → `smtpEmailService` pattern: swapping in a real `razorpayGateway` later requires zero changes to checkout/webhook logic, only a new implementation of the same interface and an env-driven selection.

## 4. Endpoints

All under `/api/v1/customer`, `requireAuth` + `requireRole('customer')` — **except** the webhook, which has no auth (the gateway calls it directly; authenticity comes from signature verification, not a JWT).

| Method | Path | Behavior |
|---|---|---|
| POST | `/checkout` | Body `{productId}`. Validates: product exists and is `published`; a `ResellerProduct` row exists for the caller's tenant with `enabled: true` (403 otherwise). Creates a `pending` Order, calls `PaymentGateway.createOrder`, stores `paymentRef`. Returns `{orderId, gatewayOrderId, amount, currency}`. |
| POST | `/checkout/webhook` | No auth. Body is the raw gateway payload; header carries the signature. Calls `verifyAndParseWebhook`; 400 if verification fails. On `success: true`: finds the Order by `paymentRef` (404 if missing), sets `status='paid'`, attempts auto-assignment (§5), sends a confirmation email. Always returns 200 once verified (gateways expect fast 2xx acks). |
| GET | `/orders` | Own orders (`customerUserId === req.user.id`), newest first |
| GET | `/downloads/:orderId` | 404 if the order doesn't belong to the caller or isn't `paid`. Issues a `DownloadToken` (`expiresAt` = now + 15 minutes, per a `DOWNLOAD_TOKEN_TTL_MINUTES` constant), returns `{fileUrl, expiresAt}`. |

## 5. Auto-assignment on payment success

Inside the webhook handler, after marking the order `paid`:
1. Find one `License` with `productId` matching the order's product and `status='available'`.
2. If found: set `assignedUserId = order.customerUserId`, `tenantId = order.tenantId`, `orderId = order._id`, `status='assigned'`; save. Set `Order.licenseId` to that license's id.
3. If none found: leave `Order.licenseId` null — no error, no retry. A master_admin fulfills it later via the existing `POST /admin/licenses/:id/assign` endpoint (already built in the Licensing Engine sub-project).

## 6. Config additions

`.env.example` and the developer's `.env` gain `MOCK_WEBHOOK_SECRET` (required string, used only by `mockPaymentGateway`). `src/config/env.ts`'s Zod schema is extended accordingly.

## 7. Testing approach

Same TDD pattern as prior sub-projects: Jest + supertest + `mongodb-memory-server`.

- Checkout: 403 if the product isn't entitled to the caller's tenant (no enabled `ResellerProduct`); happy path creates a `pending` Order with a `paymentRef`.
- Webhook: 400 on a bad/missing signature; happy path marks the order `paid`, auto-assigns an available license, and sends (mocked) confirmation email; no-license case leaves `licenseId` null without erroring.
- Downloads: 404 for another customer's order or an unpaid order; happy path returns a token with a future `expiresAt`.
- Full lifecycle integration test: checkout → webhook (mock signature) → order shows `paid` + a license → download returns a file URL.

## 8. Explicitly out of scope (future sub-projects)

- Real Razorpay SDK wiring (swap `mockPaymentGateway` → `razorpayGateway`).
- Invoices (PDF generation, `GET /customer/orders/:id/invoice`).
- Subscription renewal/expiry lifecycle (`current_period_end`, grace periods) — PRD §4.7, V2+.
- Refund processing endpoints.
