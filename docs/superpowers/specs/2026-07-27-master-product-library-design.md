# Master Product Library — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-project:** [2026-07-26-foundation-auth-multitenancy-design.md](2026-07-26-foundation-auth-multitenancy-design.md)
**Scope:** Sub-project 2 of the Phase 1 MVP (PRD §8). Master-level product catalog CRUD, versioning, publish workflow, and sync-mode flag (PRD §4.1, §6.3) — master_admin only. Also includes two small upgrades to the foundation sub-project: real SMTP email delivery and Cloudinary-backed file uploads.

## 1. Explicitly out of scope

- Reseller-side catalog (`reseller_products`), pricing overrides, featured flags — a later "Marketplace / Reseller Catalog" sub-project.
- Sync propagation: `POST /admin/products/:id/sync` (force re-sync) has nothing to propagate to until `reseller_products` exists. Deferred entirely.
- Storefront-facing product endpoints (`/store/products`) — later sub-project.
- Coupons, bundles, categories — later sub-project(s).

## 2. Data models (Mongoose)

### Product
- `name: String` (required)
- `slug: String` — unique, derived from `name` (kebab-case, collision-suffixed if needed)
- `type: enum('software','ai_tool','theme','plugin','script','template','landing_page','bundle','course','digital_download','subscription')` (required)
- `description: String`
- `basePrice: Number` (required, >= 0)
- `currency: String` (default `'INR'`)
- `currentVersion: String | null`
- `changelogJson: Mixed` — mirrors the latest `ProductVersion`'s changelog for quick reads without a join
- `status: enum('draft','published','archived')` (default `'draft'`)
- `thumbnailUrl: String | null`, `thumbnailPublicId: String | null` — Cloudinary
- `syncMode: enum('global','optional','private','exclusive')` (default `'optional'`)
- timestamps

No `tenantId` — master-level per PRD §5.

### ProductVersion
- `productId: ObjectId` — ref Product
- `version: String` (required, e.g. `'1.2.0'`)
- `changelog: String`
- `fileUrl: String | null`, `filePublicId: String | null` — Cloudinary
- timestamps (createdAt used for "newest first" ordering)

## 3. Endpoints

Base path `/api/v1/admin/products`. All routes: `requireAuth` + `requireRole('master_admin')`.

| Method | Path | Behavior |
|---|---|---|
| GET | `/` | List with pagination (`page`, `limit` query params, defaults 1/20) and filters (`type`, `status`, `search` — case-insensitive name match) |
| POST | `/` | Create in `draft` status. Multipart: body fields (`name`, `type`, `description`, `basePrice`, `currency?`) + optional `thumbnail` file |
| GET | `/:id` | Detail; 404 if not found |
| PATCH | `/:id` | Update `name`, `description`, `basePrice`, `currency`, and optionally replace `thumbnail` (multipart) |
| DELETE | `/:id` | Archive (soft: `status='archived'`); not a hard delete |
| POST | `/:id/publish` | Sets `status='published'`; 409 if `currentVersion` is null (no version exists yet) |
| POST | `/:id/versions` | Multipart: `version`, `changelog` fields + optional `file`. Uploads file to Cloudinary if present, creates a `ProductVersion`, updates the parent Product's `currentVersion`/`changelogJson` |
| GET | `/:id/versions` | Version history, newest first |
| PATCH | `/:id/sync-mode` | Body `{ syncMode }`; updates only that field |

## 4. File uploads (Cloudinary)

- `multer` with memory storage parses `multipart/form-data`; files arrive as in-memory buffers (no disk writes).
- `src/common/cloudinary.ts` configures the SDK from env (`CLOUDINARY_URL`, or discrete `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`) and exports `uploadBuffer(buffer: Buffer, folder: string): Promise<{ secureUrl: string; publicId: string }>`, wrapping `cloudinary.uploader.upload_stream`.
- Product/version services call `uploadBuffer` directly — thin enough that tests `jest.mock('../../common/cloudinary')` and never hit the real Cloudinary API.
- Thumbnails go in a `toolzypro/product-thumbnails` folder; version files go in `toolzypro/product-files`.

## 5. Email → real SMTP

- New `src/common/smtpEmail.ts` exports `smtpEmailService: EmailService` (same interface as the existing stub), built on `nodemailer.createTransport` reading `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` from env.
- `src/modules/auth/auth.service.ts` swaps its `consoleEmailService` import for `smtpEmailService` — no other changes, since both satisfy `EmailService`.
- The stub (`consoleEmailService`) stays in the codebase (harmless, still exported) in case a future environment needs a no-op fallback; not deleted.
- Tests inject a mock `EmailService` (via `jest.mock('../../common/smtpEmail')`) — the suite never sends real email.

## 6. Config additions

`.env.example` (documented, placeholder values) and the developer's real `.env` (gitignored, not committed) both gain:
```
MONGO_URI=<mongodb atlas connection string>
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@toolzypro.local
```
`src/config/env.ts`'s Zod schema is extended to validate these as required strings (SMTP_PORT coerced to number).

## 7. Testing approach

- Same TDD pattern as the foundation sub-project: Jest + supertest + `mongodb-memory-server` for all DB-backed tests.
- RBAC test: non-`master_admin` roles rejected on every route.
- Full lifecycle test: create product (draft) → add version → publish → verify `status='published'` and `currentVersion` set → archive → verify `status='archived'`.
- Pagination/filter test: seed several products, verify `type`/`status`/`search` filters and `page`/`limit` behave correctly.
- Cloudinary upload calls mocked via `jest.mock('../../src/common/cloudinary')`; SMTP calls mocked via `jest.mock('../../src/common/smtpEmail')` in auth tests that exercise register/forgot-password.

## 8. Explicitly out of scope (future sub-projects)

- Reseller catalog, sync propagation, storefront, categories, coupons, bundles — per PRD §4.5, later sub-project(s).
- Real virus/malware scanning of uploaded files — not in V1 scope per PRD.
