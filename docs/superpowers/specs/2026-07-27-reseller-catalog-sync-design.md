# Reseller Catalog & Sync Propagation — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-projects:**
- [2026-07-26-foundation-auth-multitenancy-design.md](2026-07-26-foundation-auth-multitenancy-design.md)
- [2026-07-27-master-product-library-design.md](2026-07-27-master-product-library-design.md)
**Scope:** Sub-project 3 of the Phase 1 MVP (PRD §8). `reseller_products` model plus the master-admin-side sync propagation engine (PRD §4.5, §5, §6.3) — the two deferred endpoints (`PATCH /:id/sync-mode` tenant assignment, `POST /:id/sync` force re-sync) finally get real behavior.

## 1. Explicitly out of scope

- Reseller self-service endpoints: `GET /reseller/products`, `PATCH /reseller/products/:id` (enable/disable, custom price/discount), `PATCH /reseller/products/:id/feature` — PRD §4.2/§6.9, belongs to a later Reseller Panel sub-project. This sub-project only ensures `reseller_products` rows exist and are correctly entitled; reseller-initiated changes to those rows are future work.
- Categories (`categoryId` on `ResellerProduct` stays nullable, unvalidated — no categories module exists yet).
- Storefront-facing endpoints (`/store/products`).
- Coupons, bundles.

## 2. Data model (Mongoose)

### ResellerProduct
- `tenantId: ObjectId` — ref Tenant, required
- `productId: ObjectId` — ref Product, required
- `enabled: Boolean` — default `false` (set explicitly `true` by propagation when granting access)
- `customPrice: Number | null` — default `null`
- `discountPercent: Number | null` — default `null`
- `isFeatured: Boolean` — default `false`
- `categoryId: ObjectId | null` — default `null`, no ref validation yet
- timestamps
- Compound unique index on `(tenantId, productId)` — one entitlement row per tenant per product.

## 3. Propagation logic

A single function, `syncProductToTenants(product: ProductDocument): Promise<void>`, encodes all sync-mode semantics:

- **`global`**: fetch all tenants; for each, upsert a `ResellerProduct` row with `enabled: true` (create if missing, set `enabled: true` if it existed disabled).
- **`optional`**: no-op. Rows are never auto-created or auto-disabled for this mode — reseller opt-in is future work.
- **`private` / `exclusive`** (identical behavior for V1 — see §6): the product's `tenantId` field (new column, see below) identifies the sole entitled tenant.
  - Upsert that tenant's row with `enabled: true`.
  - Disable (`enabled: false`, never delete) every other tenant's existing row for this product.
- Switching a product **away** from a mode that had granted broader access (e.g. `global` → `private`) disables the now-unentitled tenants' rows via the same rule above — global's "every tenant" set, minus the new mode's entitled set, all get disabled.

### Product model addition
`Product` gains `tenantId: ObjectId | null` (default `null`) — the single entitled tenant when `syncMode` is `private`/`exclusive`. Ignored/cleared when `syncMode` is `global`/`optional`.

## 4. Endpoints

All under `/api/v1/admin/products`, `requireAuth` + `requireRole('master_admin')` (inherited from the products router).

| Method | Path | Behavior |
|---|---|---|
| PATCH | `/:id/sync-mode` | Body `{ syncMode, tenantId? }`. `tenantId` required (400 if missing) when `syncMode` is `private`/`exclusive`; ignored/cleared for `global`/`optional`. Updates the product's `syncMode`/`tenantId`, then calls `syncProductToTenants`. |
| POST | `/:id/sync` | Force re-sync: calls `syncProductToTenants` again against the product's *current* `syncMode`/`tenantId` and the *current* full tenant list — catches up tenants created after the product's last sync. |
| GET | `/:id/resellers` | Lists tenants currently entitled (`enabled: true`) to this product — read-only visibility for master_admin. Returns tenant summaries (`_id`, `name`, `subdomain`), not full `ResellerProduct` rows. |

## 5. Tenant-creation hook

`src/modules/tenants/tenants.service.ts`'s `createTenant` is extended: after creating the tenant, it creates `enabled: true` `ResellerProduct` rows for every product currently `syncMode='global'`. This keeps new resellers current with the global catalog without a manual force-sync.

## 6. Private vs exclusive

Per brainstorm decision: **no behavioral difference in V1.** Both mean "assigned to exactly one tenant, disabled for everyone else." The distinction exists in the schema/enum only, for future storefront-visibility rules once a storefront module exists.

## 7. Testing approach

Same TDD pattern as prior sub-projects: Jest + supertest + `mongodb-memory-server`.

- `ResellerProduct` model test: compound unique index enforcement.
- Propagation unit tests (via the service, not just HTTP): global mode creates rows for all tenants; optional mode is a no-op; private mode creates one row and disables others; switching private tenant A→B disables A's row, enables B's.
- Tenant-creation hook test: creating a tenant with an existing `global` product results in an enabled `ResellerProduct` row for it immediately.
- Endpoint tests: `PATCH /:id/sync-mode` 400s when `private`/`exclusive` without `tenantId`; `POST /:id/sync` catches up a tenant created after the product; `GET /:id/resellers` lists only enabled tenants; RBAC rejects non-master_admin on all three routes.

## 8. Explicitly out of scope (future sub-projects)

- Reseller Panel catalog endpoints (enable/disable, pricing, featured) — PRD §4.2/§6.9.
- Categories module.
- Storefront-facing catalog reads.
