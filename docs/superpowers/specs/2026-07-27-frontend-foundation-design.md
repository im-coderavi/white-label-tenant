# Frontend Foundation — Scaffold & Auth — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Parent doc:** [prd.md](../../../prd.md) (ToolzyPro V2 PRD)
**Prior sub-projects (backend):**
- [2026-07-26-foundation-auth-multitenancy-design.md](2026-07-26-foundation-auth-multitenancy-design.md)
- [2026-07-27-master-product-library-design.md](2026-07-27-master-product-library-design.md)
- [2026-07-27-reseller-catalog-sync-design.md](2026-07-27-reseller-catalog-sync-design.md)
- [2026-07-27-licensing-engine-design.md](2026-07-27-licensing-engine-design.md)
- [2026-07-27-checkout-orders-design.md](2026-07-27-checkout-orders-design.md)
- [2026-07-27-reseller-plans-billing-design.md](2026-07-27-reseller-plans-billing-design.md)
**Scope:** First frontend sub-project. A Vite + React + TypeScript SPA at `/client` (sibling to the existing `src/` backend), with Tailwind + shadcn/ui, TanStack Query + Axios, routing, and a working auth flow (login, customer self-register, reseller self-signup) with role-based route protection. No portal-specific dashboards (Master Admin, Reseller Panel, Customer Storefront) yet — this sub-project only proves the shell and auth plumbing work end-to-end against the real backend.

## 1. Explicitly out of scope

- Master Admin dashboard/panel (products, licenses, plans, reseller management UI) — later sub-project.
- Reseller Panel (branding, catalog management, onboarding wizard UI) — later sub-project.
- Customer Storefront (browsing, checkout UI, license/download pages) — later sub-project.
- httpOnly-cookie token storage — tokens live in `localStorage` this round, matching the backend's current JSON-body token response shape (see Foundation sub-project spec). Revisited only if the backend adds cookie support.
- E2E testing (Playwright/Cypress) — Vitest + React Testing Library component/unit tests only.
- Password reset / email verification UI — the backend endpoints exist (`/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`) but no frontend pages are built for them this round.

## 2. Stack

| Concern | Choice |
|---|---|
| Build tool | Vite |
| Language | TypeScript |
| Framework | React 18 |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Data fetching | TanStack Query (React Query) + Axios |
| Routing | react-router-dom v6 |
| Forms | react-hook-form + Zod resolver (reuses the same validation-shape convention as the backend) |
| Testing | Vitest + React Testing Library |

## 3. Repo structure

```
client/
  src/
    lib/
      api.ts            — Axios instance; request interceptor attaches access token; response interceptor
                           handles 401 by calling /auth/refresh once and retrying, else clears auth + redirects
      queryClient.ts    — TanStack Query QueryClient instance
    auth/
      AuthContext.tsx   — { user, accessToken, refreshToken } state; persists to localStorage; login()/logout()
      ProtectedRoute.tsx — redirects unauthenticated users to /login; wrong-role users to /unauthorized
    pages/
      LoginPage.tsx
      RegisterCustomerPage.tsx   — POST /auth/register (tenantSubdomain, email, password)
      RegisterResellerPage.tsx   — GET /plans to list options, POST /auth/register-reseller
      UnauthorizedPage.tsx
      AdminHomePage.tsx          — placeholder proving master_admin routing works
      ResellerHomePage.tsx       — placeholder proving reseller_admin routing works
      CustomerHomePage.tsx       — placeholder proving customer routing works
    App.tsx              — route tree
    main.tsx              — app entry, wraps App in QueryClientProvider + AuthProvider + BrowserRouter
  index.html, vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig.json, package.json
```

`client/` has its own `package.json`/`node_modules`, independent of the backend's. `vite.config.ts` proxies `/api` to the backend dev server (`http://localhost:4000`) so the SPA can call relative API paths in development without CORS configuration.

## 4. Auth flow

- **Login:** `LoginPage` posts `{email, password, tenantSubdomain?}` to `POST /auth/login`. On success, `AuthContext.login()` stores `{accessToken, refreshToken, user}` in React state and `localStorage`. Redirect target is derived from `user.role`: `master_admin` → `/admin`, `reseller_admin`/`reseller_staff` → `/reseller`, `customer` → `/account`.
- **Token attach:** Axios request interceptor reads the current access token from `AuthContext`/localStorage and sets `Authorization: Bearer <token>` on every request.
- **Token refresh:** Axios response interceptor catches a `401`, calls `POST /auth/refresh` once with the stored refresh token, updates stored tokens on success and retries the original request; on refresh failure, clears all auth state and redirects to `/login`.
- **Route protection:** `ProtectedRoute` wraps role-specific route subtrees. No `user` → redirect to `/login`. `user.role` not in the allowed list for that subtree → redirect to `/unauthorized`.
- **Session restore:** On app load, `AuthContext` reads `localStorage`; if a token is present, it calls `GET /auth/me` to validate it's still good (handles the case where a token was revoked server-side) before rendering protected content.

## 5. Testing approach

Vitest + React Testing Library, mirroring the backend's TDD discipline.

- `AuthContext`: persists login state to localStorage and restores it on reload; `logout()` clears both state and localStorage.
- `ProtectedRoute`: redirects an unauthenticated user to `/login`; redirects a wrong-role user to `/unauthorized`; renders children for an allowed role.
- `LoginPage`: client-side validation (empty fields rejected); successful submit calls the login API and redirects based on returned role (mocking the API call, not hitting a real backend).
- Axios interceptor: a mocked 401 response triggers exactly one `/auth/refresh` call and retries the original request; a failed refresh clears auth state.

## 6. Explicitly out of scope (future sub-projects)

- Master Admin dashboard/panel.
- Reseller Panel (including the onboarding wizard).
- Customer Storefront and purchase/download UI.
- E2E test suite.
- httpOnly cookie migration (backend + frontend both, if ever pursued).
