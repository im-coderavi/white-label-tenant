# Reseller Catalog & Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give reseller admins/staff a working catalog screen: browse the products the sync engine has assigned to their tenant, enable/disable optional ones, set a custom price or discount, and mark items as featured. Fix a pre-existing checkout pricing bug where `discountPercent` was silently ignored.

**Architecture:** Backend: a new `resellerCatalog` module (`GET /reseller/products`, `PATCH /reseller/products/:id`) scoped by `req.tenantId` from the JWT, plus a one-line fix to `checkout.service.ts`'s price calculation. Frontend: a new `pages/reseller/` directory with a `ResellerLayout` wrapping a `CatalogPage`, and a typed `api/resellerCatalog.ts` wrapper, following the exact same patterns as the Master Admin Product Library sub-project.

**Tech Stack:** Same as prior sub-projects — Express/TypeScript/Mongoose/Jest on the backend; Vite/React/TypeScript/TanStack Query/react-hook-form+Zod/Vitest+RTL on the frontend.

## Global Constraints

- New routes mount at `/api/v1/reseller/products` in `src/app.ts`. (Spec: Backend section)
- All reseller-catalog routes require `requireAuth, requireRole('reseller_admin', 'reseller_staff')` and scope every query/update by `req.tenantId` — never a client-supplied tenant id or route param. (Spec: Backend section)
- `GET /reseller/products` only returns rows whose populated product has `status: 'published'`. (Spec: Backend section)
- A `ResellerProduct` row with `syncMode: 'global'` (read off its populated product) cannot be disabled — attempting `enabled: false` throws a 400 `ValidationError`. (Spec: Backend section)
- `pricingMode` is mutually exclusive: `'custom'` sets `customPrice` and nulls `discountPercent`; `'discount'` sets `discountPercent` and nulls `customPrice`; `'default'` nulls both. (Spec: Backend section)
- `checkout.service.ts` price calculation must apply `discountPercent` when `customPrice` is null, rounded to 2 decimals. (Spec: Bug fix section)
- `categoryId` is out of scope (no `Category` model exists). (Spec: Out of scope)
- All new frontend API calls go through the existing `api` Axios instance (`client/src/lib/api.ts`). (Established convention)
- Every mutation invalidates its `['reseller-catalog']` TanStack Query key on success. (Spec: Frontend section)

---

## Task 1: Backend — List Catalog Endpoint

**Files:**
- Create: `src/modules/resellerCatalog/resellerCatalog.service.ts`
- Create: `src/modules/resellerCatalog/resellerCatalog.controller.ts`
- Create: `src/modules/resellerCatalog/resellerCatalog.routes.ts`
- Modify: `src/app.ts` (mount the router)
- Test: `tests/modules/resellerCatalog.list.test.ts`

**Interfaces:**
- Consumes: `ResellerProduct` model (`src/models/ResellerProduct.ts`), `Product` model (`src/models/Product.ts`), `req.tenantId` (set by `src/middleware/auth.middleware.ts`).
- Produces: `listCatalog(tenantId: string): Promise<CatalogItemView[]>` and the `CatalogItemView` interface, both consumed by Task 2's update endpoint and Task 4's frontend wrapper. Response shape: `{ items: CatalogItemView[] }`.

```ts
export interface CatalogItemView {
  _id: string;
  product: { _id: string; name: string; type: string; basePrice: number; currency: string };
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
}
```

- [ ] **Step 1: Write the failing test**

Create `tests/modules/resellerCatalog.list.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerCatalogRouter } from '../../src/modules/resellerCatalog/resellerCatalog.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/products', resellerCatalogRouter);
  app.use(errorMiddleware);
  return app;
}

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe('resellerCatalog module — list', () => {
  const app = buildTestApp();

  it('rejects non-reseller roles', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app)
      .get('/api/v1/reseller/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists only the caller tenant published catalog rows', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-catalog' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-catalog' });
    const published = await Product.create({
      name: 'Published Tool',
      slug: 'published-tool',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const draft = await Product.create({
      name: 'Draft Tool',
      slug: 'draft-tool',
      type: 'software',
      basePrice: 50,
      status: 'draft',
      syncMode: 'optional',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: published._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenant._id, productId: draft._id, enabled: false });
    await ResellerProduct.create({ tenantId: otherTenant._id, productId: published._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get('/api/v1/reseller/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product.name).toBe('Published Tool');
    expect(res.body.items[0].syncMode).toBe('optional');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/resellerCatalog.list.test.ts`
Expected: FAIL — `Cannot find module '../../src/modules/resellerCatalog/resellerCatalog.routes'`

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/resellerCatalog/resellerCatalog.service.ts`:

```ts
import { ResellerProduct, ResellerProductDocument } from '../../models/ResellerProduct';
import { ProductDocument } from '../../models/Product';
import { NotFoundError, ValidationError } from '../../common/errors';

export interface CatalogItemView {
  _id: string;
  product: { _id: string; name: string; type: string; basePrice: number; currency: string };
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
}

type PopulatedRow = ResellerProductDocument & { productId: ProductDocument };

function toView(row: PopulatedRow): CatalogItemView {
  const product = row.productId;
  return {
    _id: row._id.toString(),
    product: {
      _id: product._id.toString(),
      name: product.name,
      type: product.type,
      basePrice: product.basePrice,
      currency: product.currency,
    },
    syncMode: product.syncMode,
    enabled: row.enabled,
    customPrice: row.customPrice,
    discountPercent: row.discountPercent,
    isFeatured: row.isFeatured,
  };
}

export async function listCatalog(tenantId: string): Promise<CatalogItemView[]> {
  const rows = await ResellerProduct.find({ tenantId }).populate<{ productId: ProductDocument }>('productId');
  return rows
    .filter((row): row is PopulatedRow => Boolean(row.productId) && row.productId.status === 'published')
    .map(toView);
}

export async function updateCatalogItem(
  tenantId: string,
  resellerProductId: string,
  input: {
    enabled?: boolean;
    pricingMode?: 'default' | 'custom' | 'discount';
    customPrice?: number;
    discountPercent?: number;
    isFeatured?: boolean;
  }
): Promise<CatalogItemView> {
  const row = await ResellerProduct.findOne({ _id: resellerProductId, tenantId }).populate<{
    productId: ProductDocument;
  }>('productId');
  if (!row || !row.productId) {
    throw new NotFoundError('Catalog item not found');
  }
  const populated = row as PopulatedRow;

  if (input.enabled === false && populated.productId.syncMode === 'global') {
    throw new ValidationError('Global products cannot be disabled');
  }

  if (input.enabled !== undefined) {
    populated.enabled = input.enabled;
  }

  if (input.pricingMode === 'custom') {
    populated.customPrice = input.customPrice as number;
    populated.discountPercent = null;
  } else if (input.pricingMode === 'discount') {
    populated.discountPercent = input.discountPercent as number;
    populated.customPrice = null;
  } else if (input.pricingMode === 'default') {
    populated.customPrice = null;
    populated.discountPercent = null;
  }

  if (input.isFeatured !== undefined) {
    populated.isFeatured = input.isFeatured;
  }

  await populated.save();
  return toView(populated);
}
```

Create `src/modules/resellerCatalog/resellerCatalog.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express';
import * as resellerCatalogService from './resellerCatalog.service';

export async function listCatalogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await resellerCatalogService.listCatalog(req.tenantId as string);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

export async function updateCatalogItemHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await resellerCatalogService.updateCatalogItem(
      req.tenantId as string,
      req.params.id,
      req.body
    );
    res.status(200).json({ item });
  } catch (err) {
    next(err);
  }
}
```

Create `src/modules/resellerCatalog/resellerCatalog.routes.ts`:

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listCatalogHandler } from './resellerCatalog.controller';

export const resellerCatalogRouter = Router();

resellerCatalogRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));

resellerCatalogRouter.get('/', listCatalogHandler);
```

Modify `src/app.ts` — add the import near the other module imports:

```ts
import { resellerCatalogRouter } from './modules/resellerCatalog/resellerCatalog.routes';
```

and add the mount line near the other `app.use('/api/v1/...')` lines:

```ts
app.use('/api/v1/reseller/products', resellerCatalogRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/modules/resellerCatalog.list.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/modules/resellerCatalog/resellerCatalog.service.ts src/modules/resellerCatalog/resellerCatalog.controller.ts src/modules/resellerCatalog/resellerCatalog.routes.ts src/app.ts tests/modules/resellerCatalog.list.test.ts
git commit -m "feat: add reseller catalog list endpoint"
```

---

## Task 2: Backend — Update Catalog Item Endpoint

**Files:**
- Create: `src/modules/resellerCatalog/resellerCatalog.validators.ts`
- Modify: `src/modules/resellerCatalog/resellerCatalog.routes.ts` (add `PATCH /:id`)
- Test: `tests/modules/resellerCatalog.update.test.ts`

**Interfaces:**
- Consumes: `updateCatalogItem` and `CatalogItemView` from Task 1's `resellerCatalog.service.ts`; `updateCatalogItemHandler` from Task 1's `resellerCatalog.controller.ts`.
- Produces: `updateCatalogItemSchema` (Zod), consumed by the route's `validateBody` call. Response shape: `{ item: CatalogItemView }`, consumed by Task 4's frontend wrapper.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/resellerCatalog.update.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerCatalogRouter } from '../../src/modules/resellerCatalog/resellerCatalog.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/reseller/products', resellerCatalogRouter);
  app.use(errorMiddleware);
  return app;
}

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe('resellerCatalog module — update', () => {
  const app = buildTestApp();

  it('404s for a catalog row belonging to another tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-1' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-update-1' });
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-update-1',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: otherTenant._id, productId: product._id, enabled: false });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(404);
  });

  it('rejects disabling a global product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-2' });
    const product = await Product.create({
      name: 'Global Tool',
      slug: 'global-tool-update-2',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'global',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });
    expect(res.status).toBe(400);
  });

  it('enables an optional product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-3' });
    const product = await Product.create({
      name: 'Optional Tool',
      slug: 'optional-tool-update-3',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: false });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.item.enabled).toBe(true);
  });

  it('sets a custom price and nulls any existing discount', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-4' });
    const product = await Product.create({
      name: 'Priced Tool',
      slug: 'priced-tool-update-4',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({
      tenantId: tenant._id,
      productId: product._id,
      enabled: true,
      discountPercent: 10,
    });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pricingMode: 'custom', customPrice: 75 });
    expect(res.status).toBe(200);
    expect(res.body.item.customPrice).toBe(75);
    expect(res.body.item.discountPercent).toBeNull();
  });

  it('rejects pricingMode custom without a customPrice', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-5' });
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-update-5',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pricingMode: 'custom' });
    expect(res.status).toBe(400);
  });

  it('toggles isFeatured independently of pricing', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-update-6' });
    const product = await Product.create({
      name: 'Tool',
      slug: 'tool-update-6',
      type: 'software',
      basePrice: 100,
      status: 'published',
      syncMode: 'optional',
    });
    const row = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: 'reseller-1',
      role: 'reseller_admin',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .patch(`/api/v1/reseller/products/${row._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isFeatured: true });
    expect(res.status).toBe(200);
    expect(res.body.item.isFeatured).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/resellerCatalog.update.test.ts`
Expected: FAIL — all requests 404 (no `PATCH /:id` route registered yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/resellerCatalog/resellerCatalog.validators.ts`:

```ts
import { z } from 'zod';

export const updateCatalogItemSchema = z
  .object({
    enabled: z.boolean().optional(),
    pricingMode: z.enum(['default', 'custom', 'discount']).optional(),
    customPrice: z.coerce.number().min(0).optional(),
    discountPercent: z.coerce.number().min(0).max(100).optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((data) => data.pricingMode !== 'custom' || data.customPrice !== undefined, {
    message: 'customPrice is required when pricingMode is custom',
    path: ['customPrice'],
  })
  .refine((data) => data.pricingMode !== 'discount' || data.discountPercent !== undefined, {
    message: 'discountPercent is required when pricingMode is discount',
    path: ['discountPercent'],
  });
```

Modify `src/modules/resellerCatalog/resellerCatalog.routes.ts` — replace its full contents with:

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { updateCatalogItemSchema } from './resellerCatalog.validators';
import { listCatalogHandler, updateCatalogItemHandler } from './resellerCatalog.controller';

export const resellerCatalogRouter = Router();

resellerCatalogRouter.use(requireAuth, requireRole('reseller_admin', 'reseller_staff'));

resellerCatalogRouter.get('/', listCatalogHandler);
resellerCatalogRouter.patch('/:id', validateBody(updateCatalogItemSchema), updateCatalogItemHandler);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/modules/resellerCatalog.update.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/modules/resellerCatalog/resellerCatalog.validators.ts src/modules/resellerCatalog/resellerCatalog.routes.ts tests/modules/resellerCatalog.update.test.ts
git commit -m "feat: add reseller catalog update endpoint"
```

---

## Task 3: Backend — Fix Checkout Discount Pricing Bug

**Files:**
- Modify: `src/modules/checkout/checkout.service.ts:38`
- Test: `tests/modules/checkout.create.test.ts` (append 2 tests)

**Interfaces:**
- Consumes: `ResellerProduct` model's `customPrice`/`discountPercent` fields (unchanged).
- Produces: no new exports — same `createCheckout` signature, corrected pricing behavior.

- [ ] **Step 1: Write the failing test**

Append to `tests/modules/checkout.create.test.ts`, inside the existing `describe('checkout module — create checkout', ...)` block, right after the last `it(...)`:

```ts
  it('applies a discountPercent when no customPrice is set', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout-discount' });
    const product = await Product.create({
      name: 'P',
      slug: 'p-discount',
      type: 'software',
      basePrice: 500,
      status: 'published',
    });
    await ResellerProduct.create({
      tenantId: tenant._id,
      productId: product._id,
      enabled: true,
      discountPercent: 20,
    });

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(400);
  });

  it('falls back to basePrice when neither customPrice nor discountPercent is set', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout-neither' });
    const product = await Product.create({
      name: 'P',
      slug: 'p-neither',
      type: 'software',
      basePrice: 500,
      status: 'published',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(500);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/checkout.create.test.ts`
Expected: FAIL — the discount test gets `amount: 500` instead of `400` (discountPercent currently ignored)

- [ ] **Step 3: Write minimal implementation**

In `src/modules/checkout/checkout.service.ts`, replace:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/modules/checkout.create.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/modules/checkout/checkout.service.ts tests/modules/checkout.create.test.ts
git commit -m "fix: apply reseller discountPercent at checkout"
```

---

## Task 4: Frontend — Reseller Catalog API Wrapper

**Files:**
- Create: `client/src/api/resellerCatalog.ts`

**Interfaces:**
- Consumes: the existing `api` Axios instance (`client/src/lib/api.ts`).
- Produces: `ResellerCatalogItem`, `UpdateCatalogItemInput` types and `listCatalog`, `updateCatalogItem` functions, consumed by Task 6's `CatalogPage.tsx`.

This task has no independent test — it's exercised through `CatalogPage.test.tsx`'s mocks in Task 6, matching the existing convention (`adminProducts.ts`/`adminTenants.ts` have no dedicated test files either).

- [ ] **Step 1: Write the file**

Create `client/src/api/resellerCatalog.ts`:

```ts
import { api } from '../lib/api';

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

export async function listCatalog(): Promise<ResellerCatalogItem[]> {
  const res = await api.get<{ items: ResellerCatalogItem[] }>('/reseller/products');
  return res.data.items;
}

export async function updateCatalogItem(
  id: string,
  input: UpdateCatalogItemInput
): Promise<ResellerCatalogItem> {
  const res = await api.patch<{ item: ResellerCatalogItem }>(`/reseller/products/${id}`, input);
  return res.data.item;
}
```

- [ ] **Step 2: Verify the build still compiles**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors (file isn't imported anywhere yet, so this just checks its own syntax)

- [ ] **Step 3: Commit**

```bash
git add client/src/api/resellerCatalog.ts
git commit -m "feat: add reseller catalog API wrapper"
```

---

## Task 5: Frontend — ResellerLayout

**Files:**
- Create: `client/src/pages/reseller/ResellerLayout.tsx`
- Test: `client/src/pages/reseller/ResellerLayout.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `client/src/auth/AuthContext.tsx` (existing).
- Produces: default-exported `ResellerLayout` component, consumed by Task 8's `App.tsx` wiring.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/reseller/ResellerLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResellerLayout from './ResellerLayout';
import * as AuthContextModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../auth/AuthContext')>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

describe('ResellerLayout', () => {
  it('shows the user email, renders nested content, and logs out on click', async () => {
    const logout = vi.fn();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'reseller@example.com', role: 'reseller_admin', tenantId: 'tenant-1' },
      isLoading: false,
      login: vi.fn(),
      logout,
    });

    render(
      <MemoryRouter initialEntries={['/reseller']}>
        <Routes>
          <Route path="/reseller" element={<ResellerLayout />}>
            <Route index element={<div>Nested content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('reseller@example.com')).toBeInTheDocument();
    expect(screen.getByText('Nested content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/reseller/ResellerLayout.test.tsx`
Expected: FAIL — `Cannot find module './ResellerLayout'`

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/reseller/ResellerLayout.tsx`:

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/button';

export default function ResellerLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <header>
        <span>{user?.email}</span>
        <Button variant="outline" onClick={handleLogout}>
          Log out
        </Button>
      </header>
      <nav>
        <NavLink to="/reseller/catalog">Catalog</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/reseller/ResellerLayout.test.tsx`
Expected: PASS — 1 test

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/reseller/ResellerLayout.tsx client/src/pages/reseller/ResellerLayout.test.tsx
git commit -m "feat: add reseller layout shell"
```

---

## Task 6: Frontend — CatalogPage (List & Enable Toggle)

**Files:**
- Create: `client/src/pages/reseller/CatalogPage.tsx`
- Test: `client/src/pages/reseller/CatalogPage.test.tsx`

**Interfaces:**
- Consumes: `listCatalog`, `updateCatalogItem`, `ResellerCatalogItem` from Task 4's `api/resellerCatalog.ts`; `Button` from `client/src/components/ui/button.tsx`.
- Produces: default-exported `CatalogPage` component, consumed by Task 8's `App.tsx` wiring. This task's version of the component only handles the enable/disable toggle; Task 7 extends it with pricing mode and featured controls.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/reseller/CatalogPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CatalogPage from './CatalogPage';
import * as resellerCatalogApi from '../../api/resellerCatalog';
import type { ResellerCatalogItem } from '../../api/resellerCatalog';

vi.mock('../../api/resellerCatalog', () => ({
  listCatalog: vi.fn(),
  updateCatalogItem: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CatalogPage />
    </QueryClientProvider>
  );
}

const globalItem: ResellerCatalogItem = {
  _id: 'rp-1',
  product: { _id: 'p-1', name: 'Global Tool', type: 'software', basePrice: 100, currency: 'INR' },
  syncMode: 'global',
  enabled: true,
  customPrice: null,
  discountPercent: null,
  isFeatured: false,
};

const optionalItem: ResellerCatalogItem = {
  _id: 'rp-2',
  product: { _id: 'p-2', name: 'Optional Tool', type: 'software', basePrice: 200, currency: 'INR' },
  syncMode: 'optional',
  enabled: false,
  customPrice: null,
  discountPercent: null,
  isFeatured: false,
};

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.mocked(resellerCatalogApi.listCatalog).mockReset();
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockReset();
  });

  it('shows a disabled, checked toggle for global products and an editable one for optional products', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([globalItem, optionalItem]);
    renderPage();

    const globalRow = (await screen.findByText('Global Tool')).closest('tr') as HTMLElement;
    const globalToggle = within(globalRow).getByRole('checkbox', { name: 'Enabled' });
    expect(globalToggle).toBeChecked();
    expect(globalToggle).toBeDisabled();

    const optionalRow = screen.getByText('Optional Tool').closest('tr') as HTMLElement;
    const optionalToggle = within(optionalRow).getByRole('checkbox', { name: 'Enabled' });
    expect(optionalToggle).not.toBeChecked();
    expect(optionalToggle).not.toBeDisabled();
  });

  it('enables an optional product and saves', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({ ...optionalItem, enabled: true });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ enabled: true })
      )
    );
  });

  it('shows an inline error when saving fails', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockRejectedValueOnce(new Error('network error'));
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'Could not save changes. Please try again.'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/reseller/CatalogPage.test.tsx`
Expected: FAIL — `Cannot find module './CatalogPage'`

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/reseller/CatalogPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listCatalog, updateCatalogItem } from '../../api/resellerCatalog';
import type { ResellerCatalogItem } from '../../api/resellerCatalog';
import { Button } from '../../components/ui/button';

interface RowState {
  enabled: boolean;
}

function toRowState(item: ResellerCatalogItem): RowState {
  return { enabled: item.enabled };
}

export default function CatalogPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({ queryKey: ['reseller-catalog'], queryFn: listCatalog });
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items) return;
    setRowStates((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!next[item._id]) {
          next[item._id] = toRowState(item);
        }
      });
      return next;
    });
  }, [items]);

  const updateRow = (id: string, patch: Partial<RowState>): void => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (item: ResellerCatalogItem): Promise<void> => {
    const state = rowStates[item._id] ?? toRowState(item);
    setRowErrors((prev) => ({ ...prev, [item._id]: '' }));
    try {
      await updateCatalogItem(item._id, { enabled: state.enabled });
      await queryClient.invalidateQueries({ queryKey: ['reseller-catalog'] });
    } catch {
      setRowErrors((prev) => ({ ...prev, [item._id]: 'Could not save changes. Please try again.' }));
    }
  };

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Catalog</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Base price</th>
            <th>Sync mode</th>
            <th>Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item) => {
            const state = rowStates[item._id] ?? toRowState(item);
            return (
              <tr key={item._id}>
                <td>{item.product.name}</td>
                <td>{item.product.type}</td>
                <td>{item.product.basePrice}</td>
                <td>{item.syncMode}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Enabled"
                    checked={state.enabled}
                    disabled={item.syncMode === 'global'}
                    onChange={(e) => updateRow(item._id, { enabled: e.target.checked })}
                  />
                </td>
                <td>
                  <Button onClick={() => handleSave(item)}>Save</Button>
                  {rowErrors[item._id] && <p role="alert">{rowErrors[item._id]}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/reseller/CatalogPage.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/reseller/CatalogPage.tsx client/src/pages/reseller/CatalogPage.test.tsx
git commit -m "feat: add reseller catalog page with enable toggle"
```

---

## Task 7: Frontend — CatalogPage Pricing Mode & Featured Toggle

**Files:**
- Modify: `client/src/pages/reseller/CatalogPage.tsx`
- Modify: `client/src/pages/reseller/CatalogPage.test.tsx`

**Interfaces:**
- Consumes: same as Task 6.
- Produces: the final `CatalogPage` shape consumed by Task 8's `App.tsx` wiring. `RowState` grows to include `pricingMode`, `customPrice`, `discountPercent`, `isFeatured`; `handleSave`'s payload grows to match.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/pages/reseller/CatalogPage.test.tsx`, inside the `describe('CatalogPage', ...)` block, right after the last `it(...)`:

```tsx
  it('switches to custom pricing, reveals the price input, and saves it', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({
      ...optionalItem,
      customPrice: 150,
    });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.selectOptions(within(row).getByLabelText('Pricing mode'), 'custom');
    await userEvent.type(within(row).getByLabelText('Custom price'), '150');
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ pricingMode: 'custom', customPrice: 150 })
      )
    );
  });

  it('switches to discount pricing, reveals the percent input, and saves it', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({
      ...optionalItem,
      discountPercent: 15,
    });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.selectOptions(within(row).getByLabelText('Pricing mode'), 'discount');
    await userEvent.type(within(row).getByLabelText('Discount percent'), '15');
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ pricingMode: 'discount', discountPercent: 15 })
      )
    );
  });

  it('toggles featured and saves', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({
      ...optionalItem,
      isFeatured: true,
    });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Featured' }));
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ isFeatured: true })
      )
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/pages/reseller/CatalogPage.test.tsx`
Expected: FAIL — 3 new tests fail (`getByLabelText('Pricing mode')` / `getByRole('checkbox', { name: 'Featured' })` not found)

- [ ] **Step 3: Write minimal implementation**

In `client/src/pages/reseller/CatalogPage.tsx`, replace the `RowState` interface and `toRowState` function:

```tsx
interface RowState {
  enabled: boolean;
}

function toRowState(item: ResellerCatalogItem): RowState {
  return { enabled: item.enabled };
}
```

with:

```tsx
interface RowState {
  enabled: boolean;
  pricingMode: 'default' | 'custom' | 'discount';
  customPrice: string;
  discountPercent: string;
  isFeatured: boolean;
}

function toRowState(item: ResellerCatalogItem): RowState {
  return {
    enabled: item.enabled,
    pricingMode: item.discountPercent != null ? 'discount' : item.customPrice != null ? 'custom' : 'default',
    customPrice: item.customPrice != null ? String(item.customPrice) : '',
    discountPercent: item.discountPercent != null ? String(item.discountPercent) : '',
    isFeatured: item.isFeatured,
  };
}
```

Replace the `handleSave` function:

```tsx
  const handleSave = async (item: ResellerCatalogItem): Promise<void> => {
    const state = rowStates[item._id] ?? toRowState(item);
    setRowErrors((prev) => ({ ...prev, [item._id]: '' }));
    try {
      await updateCatalogItem(item._id, { enabled: state.enabled });
      await queryClient.invalidateQueries({ queryKey: ['reseller-catalog'] });
    } catch {
      setRowErrors((prev) => ({ ...prev, [item._id]: 'Could not save changes. Please try again.' }));
    }
  };
```

with:

```tsx
  const handleSave = async (item: ResellerCatalogItem): Promise<void> => {
    const state = rowStates[item._id] ?? toRowState(item);
    setRowErrors((prev) => ({ ...prev, [item._id]: '' }));
    try {
      await updateCatalogItem(item._id, {
        enabled: state.enabled,
        pricingMode: state.pricingMode,
        customPrice: state.pricingMode === 'custom' ? Number(state.customPrice) : undefined,
        discountPercent: state.pricingMode === 'discount' ? Number(state.discountPercent) : undefined,
        isFeatured: state.isFeatured,
      });
      await queryClient.invalidateQueries({ queryKey: ['reseller-catalog'] });
    } catch {
      setRowErrors((prev) => ({ ...prev, [item._id]: 'Could not save changes. Please try again.' }));
    }
  };
```

Replace the table header row:

```tsx
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Base price</th>
            <th>Sync mode</th>
            <th>Enabled</th>
            <th></th>
          </tr>
```

with:

```tsx
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Base price</th>
            <th>Sync mode</th>
            <th>Enabled</th>
            <th>Pricing</th>
            <th>Featured</th>
            <th></th>
          </tr>
```

Replace the row's `<td>` block from the Enabled checkbox through the Save button:

```tsx
                <td>
                  <input
                    type="checkbox"
                    aria-label="Enabled"
                    checked={state.enabled}
                    disabled={item.syncMode === 'global'}
                    onChange={(e) => updateRow(item._id, { enabled: e.target.checked })}
                  />
                </td>
                <td>
                  <Button onClick={() => handleSave(item)}>Save</Button>
                  {rowErrors[item._id] && <p role="alert">{rowErrors[item._id]}</p>}
                </td>
```

with:

```tsx
                <td>
                  <input
                    type="checkbox"
                    aria-label="Enabled"
                    checked={state.enabled}
                    disabled={item.syncMode === 'global'}
                    onChange={(e) => updateRow(item._id, { enabled: e.target.checked })}
                  />
                </td>
                <td>
                  <label htmlFor={`pricing-mode-${item._id}`}>Pricing mode</label>
                  <select
                    id={`pricing-mode-${item._id}`}
                    value={state.pricingMode}
                    onChange={(e) =>
                      updateRow(item._id, { pricingMode: e.target.value as RowState['pricingMode'] })
                    }
                  >
                    <option value="default">Default price</option>
                    <option value="custom">Custom price</option>
                    <option value="discount">Discount %</option>
                  </select>
                  {state.pricingMode === 'custom' && (
                    <>
                      <label htmlFor={`custom-price-${item._id}`}>Custom price</label>
                      <input
                        id={`custom-price-${item._id}`}
                        type="number"
                        value={state.customPrice}
                        onChange={(e) => updateRow(item._id, { customPrice: e.target.value })}
                      />
                    </>
                  )}
                  {state.pricingMode === 'discount' && (
                    <>
                      <label htmlFor={`discount-percent-${item._id}`}>Discount percent</label>
                      <input
                        id={`discount-percent-${item._id}`}
                        type="number"
                        value={state.discountPercent}
                        onChange={(e) => updateRow(item._id, { discountPercent: e.target.value })}
                      />
                    </>
                  )}
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Featured"
                    checked={state.isFeatured}
                    onChange={(e) => updateRow(item._id, { isFeatured: e.target.checked })}
                  />
                </td>
                <td>
                  <Button onClick={() => handleSave(item)}>Save</Button>
                  {rowErrors[item._id] && <p role="alert">{rowErrors[item._id]}</p>}
                </td>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/reseller/CatalogPage.test.tsx`
Expected: PASS — all 6 tests

- [ ] **Step 5: Run a full TypeScript build check**

Run: `cd client && npm run build`
Expected: clean build, no TS errors

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/reseller/CatalogPage.tsx client/src/pages/reseller/CatalogPage.test.tsx
git commit -m "feat: add pricing mode and featured toggle to reseller catalog page"
```

---

## Task 8: Wire Reseller Routes and Remove Placeholder

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/App.test.tsx`
- Delete: `client/src/pages/ResellerHomePage.tsx`

**Interfaces:**
- Consumes: `ResellerLayout` from Task 5, `CatalogPage` from Task 7.
- Produces: nothing further — this is the final task.

- [ ] **Step 1: Write the failing test**

In `client/src/App.test.tsx`, insert a new test immediately after the closing `});` of the `it('logs in as master_admin and lands on the admin products page', ...)` test and before the `it('redirects an unauthenticated visit to /admin back to /login', ...)` test:

```tsx
  it('logs in as reseller_admin and lands on the catalog page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        user: { id: '2', email: 'reseller@example.com', role: 'reseller_admin', tenantId: 'tenant-1' },
      },
    });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'reseller@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — lands on the old `ResellerHomePage` placeholder text, no "Catalog" heading found

- [ ] **Step 3: Write minimal implementation**

In `client/src/App.tsx`, replace the import:

```tsx
import ResellerHomePage from './pages/ResellerHomePage';
```

with:

```tsx
import ResellerLayout from './pages/reseller/ResellerLayout';
import CatalogPage from './pages/reseller/CatalogPage';
```

Replace the `/reseller` route:

```tsx
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin', 'reseller_staff']}>
            <ResellerHomePage />
          </ProtectedRoute>
        }
      />
```

with:

```tsx
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin', 'reseller_staff']}>
            <ResellerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/reseller/catalog" replace />} />
        <Route path="catalog" element={<CatalogPage />} />
      </Route>
```

Delete `client/src/pages/ResellerHomePage.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Run the full frontend suite and build**

Run: `cd client && npx vitest run`
Expected: PASS — all suites

Run: `cd client && npm run build`
Expected: clean build

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx client/src/pages/ResellerHomePage.tsx
git commit -m "feat: wire reseller catalog routes into App and remove placeholder home page"
```

---

## Final Verification

- [ ] Run `npm test` from the repo root — all backend suites pass.
- [ ] Run `npm run build` from the repo root — clean backend build.
- [ ] Run `cd client && npx vitest run` — all frontend suites pass.
- [ ] Run `cd client && npm run build` — clean frontend build.
