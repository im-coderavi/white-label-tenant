# Reseller Catalog & Pricing — Design Spec

## Goal

Give reseller admins/staff a working storefront-management screen: browse the products the sync engine has already assigned to their tenant, turn optional products on or off, set their own price (flat override or percentage discount), and mark products as featured. This replaces the placeholder `ResellerHomePage` as the reseller's landing screen.

## Context

- The sync engine (built in the "Reseller Catalog Sync" sub-project) already creates `ResellerProduct` rows per tenant for global, optional, private, and exclusive products. Global rows are always `enabled: true`; optional rows start `enabled: false` until the reseller opts in; private/exclusive rows are pre-assigned to one tenant.
- No reseller-facing API routes exist today beyond auth/registration — resellers can log in but have no working screens.
- `checkout.service.ts` currently computes order price as `entitlement.customPrice ?? product.basePrice`, silently ignoring `discountPercent`. This is a pre-existing bug that this sub-project's pricing UI would otherwise write data into and have it do nothing at checkout, so fixing it is in scope.

## Out of scope (deferred to future sub-projects)

- Reseller order history / sales dashboard.
- Reseller license lookups.
- Product categories (`ResellerProduct.categoryId` — no `Category` model exists yet).
- Reseller storefront branding/theming.

## Backend

### New module: `src/modules/resellerCatalog/`

Files: `resellerCatalog.routes.ts`, `resellerCatalog.controller.ts`, `resellerCatalog.service.ts`, `resellerCatalog.validators.ts`.

Mounted in `src/app.ts` as:
```ts
app.use('/api/v1/reseller/products', resellerCatalogRouter);
```

All routes: `requireAuth, requireRole('reseller_admin', 'reseller_staff')`. Tenant scoping always comes from `req.tenantId` (set by `auth.middleware.ts` from the JWT) — never from a client-supplied id or param.

**`GET /reseller/products`**
- Query: `ResellerProduct.find({ tenantId: req.tenantId }).populate('productId')`, filtered to rows whose populated product has `status: 'published'`.
- Response shape:
  ```ts
  {
    items: Array<{
      _id: string;            // ResellerProduct id
      product: {
        _id: string;
        name: string;
        type: string;
        basePrice: number;
        currency: string;
      };
      syncMode: 'global' | 'optional' | 'private' | 'exclusive'; // from product.syncMode
      enabled: boolean;
      customPrice: number | null;
      discountPercent: number | null;
      isFeatured: boolean;
    }>
  }
  ```
  `syncMode` is read off the populated product so the frontend can disable the toggle for global rows without a second lookup.

**`PATCH /reseller/products/:resellerProductId`**
- Body (Zod-validated):
  ```ts
  {
    enabled?: boolean;
    pricingMode?: 'default' | 'custom' | 'discount';
    customPrice?: number;   // required if pricingMode === 'custom'
    discountPercent?: number; // required if pricingMode === 'discount', 0-100
    isFeatured?: boolean;
  }
  ```
- Validation rules (Zod `.refine`):
  - `pricingMode: 'custom'` requires `customPrice` (number, min 0).
  - `pricingMode: 'discount'` requires `discountPercent` (number, 0-100 inclusive).
  - `pricingMode: 'default'` requires neither.
- Service behavior:
  - Look up the `ResellerProduct` by `_id` AND `tenantId: req.tenantId` (404 if not found or belongs to another tenant — never leak existence across tenants).
  - Populate the product to check `syncMode`. If `syncMode === 'global'` and the request tries to set `enabled: false`, throw a `ValidationError` ("Global products cannot be disabled").
  - Apply `pricingMode`: `'custom'` sets `customPrice` and nulls `discountPercent`; `'discount'` sets `discountPercent` and nulls `customPrice`; `'default'` nulls both.
  - Apply `enabled`/`isFeatured` if present.
  - Save and return the updated row in the same shape as the list endpoint's `items[]` entries.

### Bug fix: `src/modules/checkout/checkout.service.ts`

Replace:
```ts
const amount = entitlement.customPrice ?? product.basePrice;
```
with:
```ts
const amount =
  entitlement.customPrice ??
  (entitlement.discountPercent
    ? Number((product.basePrice * (1 - entitlement.discountPercent / 100)).toFixed(2))
    : product.basePrice);
```

## Frontend

### `client/src/api/resellerCatalog.ts`
Typed wrapper mirroring `adminProducts.ts`'s style:
```ts
export interface ResellerCatalogItem {
  _id: string;
  product: { _id: string; name: string; type: string; basePrice: number; currency: string };
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
}

export interface UpdateCatalogItemInput {
  enabled?: boolean;
  pricingMode?: 'default' | 'custom' | 'discount';
  customPrice?: number;
  discountPercent?: number;
  isFeatured?: boolean;
}

export async function listCatalog(): Promise<ResellerCatalogItem[]>;
export async function updateCatalogItem(id: string, input: UpdateCatalogItemInput): Promise<ResellerCatalogItem>;
```

### `client/src/pages/reseller/ResellerLayout.tsx`
Same structure as `AdminLayout.tsx`: header with user email + logout, nav with a "Catalog" link, `<Outlet/>`.

### `client/src/pages/reseller/CatalogPage.tsx`
- `useQuery(['reseller-catalog'], listCatalog)`.
- Table columns: Name, Type, Base price, Sync mode, Enabled (checkbox, disabled+checked when `syncMode === 'global'`), Pricing mode (select: default/custom/discount) with the matching number input shown conditionally, Featured (checkbox), and a per-row "Save" button.
- Each row holds its own local form state (react-hook-form instance per row would be overkill; plain `useState` per row is fine given the small, flat field set) and calls `updateCatalogItem` on save, then invalidates `['reseller-catalog']`.
- Inline error message per row on save failure (same `role="alert"` pattern used in `ProductDetailPage.tsx`).

### Routing (`client/src/App.tsx`)
Replace the single `/reseller` route with a nested block, mirroring the admin routes:
```tsx
<Route path="/reseller" element={<ProtectedRoute allowedRoles={['reseller_admin','reseller_staff']}><ResellerLayout/></ProtectedRoute>}>
  <Route index element={<Navigate to="/reseller/catalog" replace />} />
  <Route path="catalog" element={<CatalogPage />} />
</Route>
```
Delete `client/src/pages/ResellerHomePage.tsx`.

## Error Handling

- 404 on PATCH for a `ResellerProduct` id not belonging to the caller's tenant (not 403 — avoids confirming the id exists elsewhere).
- 400 (Zod) for invalid `pricingMode`/missing paired field/out-of-range `discountPercent`.
- 400 (`ValidationError`) for attempting to disable a global product.
- Frontend shows an inline `role="alert"` message per row on any failure; no toast system exists yet, consistent with the admin panel's pattern.

## Testing

**Backend** (Jest + Supertest + mongodb-memory-server, following existing test patterns in `tests/modules/tenants.test.ts`):
- RBAC: master_admin and customer get 403 on both routes; reseller_admin/staff from a different tenant get 404 on PATCH for another tenant's row.
- `GET /reseller/products` returns only the caller's tenant's rows, only for published products, with correct `syncMode`.
- `PATCH`: toggling `enabled` on an optional row; rejecting `enabled: false` on a global row; each `pricingMode` branch sets/nulls the right fields; `isFeatured` toggles independently of pricing.
- `checkout.service.ts`: existing customPrice test still passes; new test confirms a `discountPercent`-only entitlement produces the discounted amount; a test with neither set falls back to `basePrice`.

**Frontend** (Vitest + RTL, following `ProductsListPage.test.tsx` / `ProductDetailPage.test.tsx` patterns):
- `ResellerLayout` renders nav + outlet + logout, same shape as `AdminLayout.test.tsx`.
- `CatalogPage`: renders fetched rows; global row's enable checkbox is disabled; toggling enabled on an optional row and saving calls `updateCatalogItem` with `{ enabled: true }`; switching pricing mode to "custom" reveals the price input and saves `{ pricingMode: 'custom', customPrice }`; save failure shows an inline alert.
- `App.test.tsx`: update the reseller login test to expect landing on the catalog screen instead of the old placeholder text.
