# Reseller Plans & Self-Signup Billing — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-projects:**
- [2026-07-26-foundation-auth-multitenancy-design.md](2026-07-26-foundation-auth-multitenancy-design.md)
- [2026-07-27-master-product-library-design.md](2026-07-27-master-product-library-design.md)
- [2026-07-27-reseller-catalog-sync-design.md](2026-07-27-reseller-catalog-sync-design.md)
- [2026-07-27-licensing-engine-design.md](2026-07-27-licensing-engine-design.md)
- [2026-07-27-checkout-orders-design.md](2026-07-27-checkout-orders-design.md)
**Scope:** Sub-project 6. Master-admin-managed reseller subscription plans (fully dynamic — no hardcoded tiers) and public reseller self-signup: pick a plan, pay via the existing mock payment gateway, and the tenant + reseller_admin account go live on payment success.

## 1. Explicitly out of scope

- Customer-facing plans (`Plan.scope = 'customer'`) — this sub-project only creates reseller-scope plans. Customer subscription purchases already exist via the Checkout & Orders sub-project (`Order.orderType = 'subscription'`).
- Plan enforcement — `featureFlagsJson`/`limitsJson` are stored but nothing reads them yet (e.g. capping how many products a Starter reseller can enable). That's future work once there's a feature to gate.
- Renewal billing, grace-period expiry jobs, dunning — `Subscription.status` includes `grace`/`expired`/`cancelled` for schema completeness, but nothing transitions a subscription into those states automatically. A cron/expiry sub-project handles that later.
- Real Razorpay wiring — reuses `mockPaymentGateway` exactly as Checkout & Orders does.
- Reseller onboarding wizard (branding, domain, SMTP, gateway config beyond this) — PRD §4.2, a separate future sub-project. This sub-project only gets the tenant + account into an `active` state; the onboarding wizard would run after.

## 2. Data model (Mongoose)

### Plan
- `scope: enum('reseller', 'customer')` — this sub-project only creates `'reseller'` plans, but the field supports both per the PRD schema
- `name: String` — free text, fully admin-defined (no fixed tier enum)
- `price: Number`, `currency: String` (default `'INR'`)
- `billingCycle: enum('monthly', 'annual', 'lifetime')`
- `featureFlagsJson: Mixed` (default `{}`), `limitsJson: Mixed` (default `{}`) — free-form, admin-defined, unread by any enforcement logic yet
- `status: enum('active', 'archived')` — default `'active'`
- timestamps

### Subscription
- `tenantId: ObjectId` — ref Tenant, required
- `planId: ObjectId` — ref Plan, required
- `status: enum('pending', 'active', 'grace', 'expired', 'cancelled')` — default `'pending'`
- `currentPeriodEnd: Date | null` — computed on activation from `billingCycle` (see §4); `null` for `lifetime`
- `paymentRef: String | null`
- timestamps

## 3. Endpoints

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/admin/plans` | master_admin | List all plans (including archived), paginated |
| POST | `/admin/plans` | master_admin | Create a plan — `{scope, name, price, currency?, billingCycle, featureFlagsJson?, limitsJson?}` |
| PATCH | `/admin/plans/:id` | master_admin | Update editable fields |
| DELETE | `/admin/plans/:id` | master_admin | Soft-archive (`status='archived'`), matching the products module's convention |
| GET | `/plans` | public | Lists `status='active'` AND `scope='reseller'` plans — what a signup wizard displays |
| POST | `/auth/register-reseller` | public | Body `{businessName, subdomain, email, password, planId}`. See §4 |
| POST | `/auth/register-reseller/webhook` | public (signature-verified) | See §4 |

## 4. Reseller self-signup flow

**`POST /auth/register-reseller`:**
1. Validate `planId` refers to an `active`, `scope='reseller'` Plan (404 otherwise).
2. Validate `subdomain` isn't already taken (409, reusing the same check `createTenant` already does).
3. Create `Tenant` (`status: 'pending'`), `User` (`role: 'reseller_admin'`, `tenantId` set, `status: 'pending'`, password hashed), `Subscription` (`status: 'pending'`, `tenantId`, `planId`).
4. Call `mockPaymentGateway.createOrder({amount: plan.price, currency: plan.currency, receipt: subscription._id})`; store the returned id on `Subscription.paymentRef`.
5. Return `{tenantId, userId, subscriptionId, gatewayOrderId, amount, currency}`.

No email-verification token is issued for this flow — successful payment (confirmed via the webhook) is treated as sufficient proof of intent, avoiding a redundant verification step on top of a payment confirmation.

**`POST /auth/register-reseller/webhook`:** same signature-verification pattern as the checkout webhook (raw body + `x-webhook-signature` header, `mockPaymentGateway.verifyAndParseWebhook`). On `success: true`:
1. Find the `Subscription` by `paymentRef` (404 if missing).
2. Set `Subscription.status = 'active'`; compute `currentPeriodEnd`: `null` if the plan's `billingCycle` is `'lifetime'`, otherwise `now + 1 month` (`monthly`) or `now + 1 year` (`annual`).
3. Set the associated `Tenant.status = 'active'` and `User.status = 'active'`.
4. Send a welcome email via `smtpEmailService`.
On `success: false`: set `Subscription.status = 'cancelled'`; tenant/user stay `pending`.

## 5. Testing approach

Same TDD pattern as prior sub-projects: Jest + supertest + `mongodb-memory-server`.

- Plan CRUD: RBAC (non-master_admin rejected), archive doesn't hard-delete, `GET /plans` only returns active reseller-scope plans (a customer-scope or archived plan must not appear).
- Register-reseller: 404 for an unknown/inactive/wrong-scope plan; 409 for a taken subdomain; happy path creates the pending trio + gateway reference.
- Webhook: 400 on bad signature; happy path activates tenant/user/subscription and computes `currentPeriodEnd` correctly for `annual` vs `lifetime`; failure path cancels the subscription without activating tenant/user.
- Full lifecycle integration test: master_admin creates a plan → reseller registers → webhook fires → tenant/user/subscription all active, `currentPeriodEnd` set appropriately.

## 6. Explicitly out of scope (future sub-projects)

- Plan enforcement (limits/feature flags actually gating behavior).
- Subscription renewal/expiry/grace-period automation.
- Reseller onboarding wizard (branding, domain, SMTP, payment gateway config, SEO, legal pages, go-live checklist) — PRD §4.2.
- Customer-scope plans / recurring customer subscription billing beyond the existing one-time `Order`-based purchase.
