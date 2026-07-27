# Licensing Engine — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-projects:**
- [2026-07-26-foundation-auth-multitenancy-design.md](2026-07-26-foundation-auth-multitenancy-design.md)
- [2026-07-27-master-product-library-design.md](2026-07-27-master-product-library-design.md)
- [2026-07-27-reseller-catalog-sync-design.md](2026-07-27-reseller-catalog-sync-design.md)
**Scope:** Sub-project 4 of the Phase 1 MVP (PRD §8). License pool CRUD, key generation, direct assignment, and customer-facing activation — the auto-licensing V1 slice. Manual licensing (`license_requests`) and reseller `access_codes` are explicitly Phase 2+ per PRD §8 and are not built here.

## 1. Explicitly out of scope

- `license_requests` (manual approval queue) and `access_codes` (reseller quota) — PRD §8 marks both Phase 2+.
- Real order-based assignment (`orderId` populated by a checkout flow) — no Orders model exists yet. `assignedUserId` is a pragmatic stand-in (see §3).
- Device-ID tracking for activation — a simple counter is used instead (see §5).
- Reseller-facing license views (PRD §6.10 `/reseller/license-requests`, `/reseller/access-codes`) — tied to the Phase 2+ manual flow.

## 2. Data model (Mongoose)

### License
- `productId: ObjectId` — ref Product, required
- `tenantId: ObjectId | null` — null while in the master pool; set when assigned
- `orderId: ObjectId | null` — ref a future Orders model; unused until checkout exists
- `assignedUserId: ObjectId | null` — ref User; stand-in for order-based assignment until Orders exists
- `key: String` — unique, format `TZP-YYYY-XXXXXXXX`
- `status: enum('draft','available','reserved','assigned','activated','suspended','expired','revoked')` — default `'available'` on generate/import
- `activationLimit: Number` — default `1`
- `activationsUsed: Number` — default `0`
- `expiresAt: Date | null` — default `null`
- timestamps

## 3. Key generation

`generateLicenseKey(): string` produces `TZP-<currentYear>-<8-char uppercase alphanumeric>`. A `generateUniqueLicenseKey()` helper retries until the key doesn't collide with an existing `License.key`, following the same collision-check pattern as `Product`'s slug generation.

## 4. Endpoints

| Method | Path | Role | Behavior |
|---|---|---|---|
| GET | `/admin/licenses` | master_admin | List/search; filters `productId`, `tenantId`, `status`; paginated (`page`/`limit`) |
| POST | `/admin/licenses/generate` | master_admin | Body `{productId, quantity, expiresAt?}` — bulk-creates `quantity` licenses with generated keys, `status='available'`, `tenantId: null` |
| POST | `/admin/licenses/import` | master_admin | Body `{productId, keys: string[]}` — creates one `available` license per supplied key; 409 if any key already exists |
| PATCH | `/admin/licenses/:id/revoke` | master_admin | Sets `status='revoked'` unconditionally (idempotent) |
| POST | `/admin/licenses/:id/assign` | master_admin | Body `{userId}` — 409 if license isn't currently `available`; sets `assignedUserId`, `tenantId` (copied from the target user), `status='assigned'` |
| GET | `/customer/licenses` | customer | Lists licenses where `assignedUserId === req.user.id` |
| POST | `/customer/licenses/:id/activate` | customer | See §5 |

All `/admin/licenses*` routes: `requireAuth` + `requireRole('master_admin')`. All `/customer/licenses*` routes: `requireAuth` + `requireRole('customer')`.

## 5. Activation logic

`activateLicense(id, userId)`:
1. 404 if license doesn't exist.
2. 401 (`UnauthorizedError`) if `assignedUserId` doesn't match the calling user — not your license.
3. If `expiresAt` is set and in the past: set `status='expired'`, save, then 401.
4. 409 (`ConflictError`) if `activationsUsed >= activationLimit`.
5. Otherwise: increment `activationsUsed`, set `status='activated'`, save, return the license.

No device-ID list is tracked (deviates from a "real" device-binding system, matches the PRD schema literally) — re-activating from the same device still consumes a slot. This is an accepted V1 simplification.

## 6. Testing approach

Same TDD pattern as prior sub-projects: Jest + supertest + `mongodb-memory-server`.

- Key generation: uniqueness under bulk generation (no duplicate keys across a batch).
- Import: rejects when a supplied key already exists (409).
- Assign: 409 when the target license isn't `available`; success sets `tenantId` from the target user.
- Activate: 401 when the caller isn't the assigned user; 409 once `activationLimit` is reached; 401 and status flips to `expired` for a past `expiresAt`; happy path increments `activationsUsed` and sets `status='activated'`.
- RBAC: non-master_admin rejected on `/admin/licenses*`; non-customer rejected on `/customer/licenses*`.
- Full lifecycle integration test: generate → assign → activate → activate again until limit reached → 409 on one more.

## 7. Explicitly out of scope (future sub-projects)

- `license_requests` manual approval workflow, `access_codes` reseller quotas — PRD §8, Phase 2+.
- Order-based assignment via `orderId` — arrives with the Checkout/Orders sub-project; `assignedUserId` remains as a secondary reference.
- Device-ID-based activation tracking, if ever needed beyond the simple counter.
