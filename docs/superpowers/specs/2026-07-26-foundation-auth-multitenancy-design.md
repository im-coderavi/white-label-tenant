# Foundation: Auth, Multi-Tenancy & DB — Design Spec

**Date:** 2026-07-26
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Scope:** Sub-project 1 of the Phase 1 MVP (PRD §8). Everything downstream (products, licensing, billing, storefront, reseller panel) depends on this foundation. No other module is built in this sub-project.

## 1. Stack decisions

Deviates from PRD §3 (which specifies NestJS + PostgreSQL) per explicit user request:

| Concern | Decision |
|---|---|
| Runtime/language | Node.js + Express + TypeScript |
| Database | MongoDB + Mongoose |
| Validation | Zod |
| Auth tokens | JWT (short-lived access + rotating refresh) |
| Password hashing | bcrypt |
| Local infra | No Docker — assumes a reachable MongoDB connection string via `.env` |
| Repo layout | Single backend app at repo root; a `/client` React app is a later sub-project |
| Testing | Jest + supertest + `mongodb-memory-server` |

## 2. Architecture

Layered: `routes → controllers → services → models`. Controllers are thin (parse request, call service, shape response); services hold business logic and are unit-testable without HTTP.

Tenant isolation: a middleware reads `tenantId` from the verified JWT and attaches it to `req.tenantId`. Services accept `tenantId` as an explicit parameter from `req.tenantId` only — no controller or service may read a `tenant_id`/`tenantId` from client-supplied body/query/params for scoping reads or writes (PRD §7). Master Admin routes (role `master_admin`, `tenantId = null`) are the only ones allowed cross-tenant access, and only via routes explicitly designed for it (none exist yet in this sub-project — reserved for later).

RBAC: a `requireRole(...roles)` middleware checks the JWT's `role` claim. Roles: `master_admin | reseller_admin | reseller_staff | customer` (PRD §2, §4.1).

## 3. Data models (Mongoose)

### Tenant
- `name: String`
- `subdomain: String` — unique, required
- `customDomain: String` — unique, sparse, optional
- `plan: enum('starter','premium','enterprise')`
- `status: enum('pending','active','suspended')`
- `brandingJson: Mixed`
- `smtpConfigJson: Mixed`
- `paymentGatewayJson: Mixed`
- timestamps

### User
- `tenantId: ObjectId | null` — ref Tenant, null for `master_admin`
- `role: enum('master_admin','reseller_admin','reseller_staff','customer')`
- `email: String` — unique **compound with tenantId** (same email may exist under different tenants, and once for master admin where tenantId is null)
- `passwordHash: String`
- `status: enum('pending','active','suspended')`
- `lastLoginAt: Date | null`
- timestamps

### RefreshToken
- `userId: ObjectId` — ref User
- `tokenHash: String` — raw token never stored, only its hash
- `expiresAt: Date`
- `revoked: Boolean` — default false
- timestamps

### PasswordResetToken / EmailVerificationToken
- `userId: ObjectId`
- `tokenHash: String`
- `expiresAt: Date`
- `used: Boolean` — default false

All other PRD §5 tables (products, orders, licenses, etc.) are explicitly **out of scope** for this sub-project.

## 4. Auth flow (PRD §6.1)

Base path: `/api/v1`.

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/auth/register` | Creates a `User` (customer or reseller_admin signup, tenant-scoped via subdomain/host resolution or explicit tenant identifier in body for reseller signup — resolved to `tenantId` server-side, never trusted raw). Hashes password, sets status `pending` if email verification is required, issues verification token. |
| POST | `/auth/login` | Validates credentials, issues access + refresh token pair, updates `lastLoginAt`. |
| POST | `/auth/refresh` | Validates refresh token against stored hash + expiry + revoked flag, rotates it (issues new refresh token, revokes old one), issues new access token. |
| POST | `/auth/logout` | Revokes the presented refresh token. |
| POST | `/auth/forgot-password` | Issues a single-use, short-TTL `PasswordResetToken`; sends via stub email service (logs to console in this sub-project). |
| POST | `/auth/reset-password` | Validates reset token (hash match, not expired, not used), updates password, marks token used. |
| POST | `/auth/verify-email` | Validates verification token, marks user `active`. |
| GET | `/auth/me` | Returns current user profile + role + tenant context, from JWT + DB lookup. |

**Token design:**
- Access token: 15 min TTL, payload `{ sub: userId, role, tenantId }`, signed with `JWT_ACCESS_SECRET`.
- Refresh token: 7–30 day TTL (configurable via env), opaque random value; only its SHA-256 hash is persisted. Rotated on every `/auth/refresh` call (old token marked revoked). Enables full logout/revocation and detects reuse of a revoked token (can be logged as a security event — not alerting in this sub-project, just detection).

**Email service:** defined as an interface (`sendEmail(to, template, data)`) with a console-log stub implementation, so it's swappable later for Resend/Postmark (PRD §3) without touching auth logic.

**Rate limiting:** `/auth/login` and `/auth/register` are rate-limited per IP (PRD §7).

## 5. Error handling & validation

- Zod schemas define request bodies per route; a validation middleware parses `req.body` and returns `400` with field-level errors on failure.
- `AppError` base class with subclasses: `NotFoundError` (404), `UnauthorizedError` (401), `ForbiddenError` (403), `ConflictError` (409), `ValidationError` (400).
- Centralized error-handling middleware (last in the chain) maps `AppError` subclasses to their status codes + a consistent JSON shape (`{ error: { message, code, details? } }`); anything else is logged and returned as a generic 500 without leaking internals.

## 6. Folder structure

```
src/
  config/          env loading (dotenv + validation), db connection (mongoose.connect)
  models/          Tenant.ts, User.ts, RefreshToken.ts, PasswordResetToken.ts, EmailVerificationToken.ts
  modules/
    auth/          auth.routes.ts, auth.controller.ts, auth.service.ts, auth.validators.ts
    users/         users.routes.ts, users.controller.ts, users.service.ts
    tenants/       tenants.routes.ts, tenants.controller.ts, tenants.service.ts
  middleware/      auth.middleware.ts (JWT verify + attach req.user/req.tenantId), rbac.middleware.ts, error.middleware.ts, validate.middleware.ts, rateLimit.middleware.ts
  common/          errors.ts (AppError classes), jwt.ts, password.ts, logger.ts, email.ts (stub interface)
  app.ts           express app wiring (middleware, routes)
  server.ts        entrypoint (loads config, connects DB, starts app.listen)
.env.example
```

## 7. Testing approach

- Jest + supertest for integration tests against the Express app.
- `mongodb-memory-server` spins up an in-memory MongoDB for tests — no external dependency required to run the suite.
- Core test: full auth lifecycle (register → verify → login → `GET /auth/me` → refresh → logout, and confirming the refresh token is rejected after logout).
- Tenant isolation test: two tenants, two users; confirm a JWT issued for tenant A cannot be used to fetch/act on tenant B's user records via any endpoint that exists in this sub-project.
- RBAC test: confirm a `customer`-role JWT is rejected by a route guarded with `requireRole('master_admin')`.

## 8. Explicitly out of scope (future sub-projects)

- Products, marketplace, licensing, billing/checkout, notifications, support tickets, audit logs — all later PRD modules.
- Real email delivery (Resend/Postmark integration) — stubbed only.
- Domain/subdomain DNS verification, SSL provisioning (Cloudflare for SaaS).
- React frontend.
- Docker/local infra automation.
