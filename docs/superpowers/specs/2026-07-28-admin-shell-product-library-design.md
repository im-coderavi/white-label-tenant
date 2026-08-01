# Master Admin — Shell & Product Library Screen — Design Spec

**Date:** 2026-07-28
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-projects:**
- Backend: foundation, master product library, reseller catalog sync, licensing engine, checkout & orders, reseller plans & billing
- Frontend: [2026-07-27-frontend-foundation-design.md](2026-07-27-frontend-foundation-design.md)
**Scope:** Sub-project 8. Admin layout shell (sidebar/topbar/logout) plus a full-featured Product Library management screen — list/filter, create, edit, archive, publish, version management, and sync-mode assignment. Includes one small backend addition (`GET /admin/tenants`) needed to make the sync-mode tenant picker usable.

## 1. Explicitly out of scope

- Dashboard/KPIs screen — no `GET /admin/dashboard/kpis` backend endpoint exists yet.
- Reseller management screen (approve/suspend/impersonate) — PRD endpoints beyond basic create/get were never built on the backend; a later sub-project.
- Licenses management screen, Plans management screen — later sub-projects, even though their backends already exist.
- Reseller Panel, Customer Storefront frontends — later sub-projects.
- Pagination on `GET /admin/tenants` — not needed at expected tenant counts for V1.

## 2. Backend addition

`GET /admin/tenants` — `requireAuth` + `requireRole('master_admin')`, added to the existing `tenants` module. `listTenants(): Promise<TenantDocument[]>` added to `tenants.service.ts` alongside `createTenant`/`getTenantById`/`getTenantBySubdomain`. Response: `{ tenants: [{_id, name, subdomain, status}, ...] }`, no pagination.

## 3. Frontend structure

```
client/src/pages/admin/
  AdminLayout.tsx        — sidebar (Products link now, room for more later) + topbar (user email + logout) + <Outlet/>
  ProductsListPage.tsx   — table (name, type, status, basePrice, syncMode), filters (search/type/status), pagination, "New Product" button
  ProductFormPage.tsx    — create form (name, type, description, basePrice, currency, thumbnail file) → POST /admin/products, navigates to the new product's detail page on success
  ProductDetailPage.tsx  — editable info form (PATCH); Publish button; Archive button; sync-mode section; versions section
```

Routing: `/admin` nests under `AdminLayout` (react-router-dom nested routes via `<Outlet/>`). `/admin` index redirects to `/admin/products`. Routes: `/admin/products`, `/admin/products/new`, `/admin/products/:id`. The existing `AdminHomePage` placeholder from the Frontend Foundation sub-project is removed — `AdminLayout` + these three pages replace it as the `/admin/*` route tree's content, still wrapped in the existing `ProtectedRoute allowedRoles={['master_admin']}`.

### ProductDetailPage sections
- **Info form:** name, description, basePrice, currency, thumbnail (optional re-upload) — `PATCH /admin/products/:id`.
- **Publish:** button calling `POST /admin/products/:id/publish`; on a 409 response, shows "Add a version before publishing" inline rather than a generic error.
- **Archive:** button calling `DELETE /admin/products/:id` (soft archive per existing backend behavior).
- **Sync mode:** a `<select>` for `global | optional | private | exclusive`. When `private` or `exclusive` is selected, a tenant `<select>` appears, populated from `GET /admin/tenants`. Submits `PATCH /admin/products/:id/sync-mode` with `{syncMode, tenantId?}`.
- **Versions:** list from `GET /admin/products/:id/versions` (version, changelog, createdAt); add-version form (version string, changelog, optional file) submitting `POST /admin/products/:id/versions` as multipart; form resets and the list refetches on success.

## 4. Data fetching

TanStack Query throughout, consistent with the Frontend Foundation sub-project's `RegisterResellerPage` pattern:
- `['admin-products', filters]` — list query, refetches when filters/page change.
- `['admin-product', id]` — detail query.
- `['admin-product-versions', id]` — versions list query.
- `['admin-tenants']` — tenant picker query, fetched once (long `staleTime` acceptable since tenant list changes rarely).
- Mutations (create, update, archive, publish, sync-mode, add-version) call `queryClient.invalidateQueries` on the relevant keys after success so the UI reflects changes without manual refetch plumbing.

## 5. Testing approach

Same Vitest + React Testing Library pattern as the Frontend Foundation sub-project (mock `api`, no real network calls).

- `AdminLayout`: renders the user's email, logout button calls `useAuth().logout()` and navigates to `/login`.
- `ProductsListPage`: renders fetched rows; typing in the search filter and selecting a type/status re-triggers the query with the right params.
- `ProductFormPage`: validation errors for empty/invalid fields; successful submit calls `POST /admin/products` and navigates to `/admin/products/:newId`.
- `ProductDetailPage`: info form submits a `PATCH`; publish button shows the 409-specific message; archive button calls `DELETE`; sync-mode form shows the tenant dropdown only for `private`/`exclusive` and submits the right payload; versions list renders fetched versions and the add-version form resets after a successful submit.
- Backend: `GET /admin/tenants` — RBAC test (non-master_admin rejected), returns all created tenants.

## 6. Explicitly out of scope (future sub-projects)

- Dashboard/KPIs.
- Reseller management screen (and its missing approve/suspend/impersonate backend endpoints).
- Licenses and Plans admin screens.
- Reseller Panel and Customer Storefront frontends.
