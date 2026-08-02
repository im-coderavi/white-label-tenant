# Reseller Catalog & Sync Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ResellerProduct` entitlement model and the sync-propagation engine that keeps it consistent with each product's `syncMode`, finally giving real behavior to `PATCH /:id/sync-mode` (tenant assignment) and `POST /:id/sync` (force re-sync).

**Architecture:** A single service function, `syncProductToTenants(product)`, encodes all sync-mode reconciliation logic and is called from three places: the sync-mode PATCH handler, the force-sync endpoint, and (indirectly, via a lighter global-only path) tenant creation.

**Tech Stack:** Same as prior sub-projects — Express, TypeScript, Mongoose, Zod, Jest + supertest + `mongodb-memory-server`.

## Global Constraints

- `reseller_products` rows are never deleted by propagation — unentitled tenants get `enabled: false`, preserving any future customization. (Spec §3)
- `private` and `exclusive` sync modes are behaviorally identical in V1 — both mean "exactly one entitled tenant, disabled for everyone else." (Spec §6)
- `optional` sync mode is a no-op for propagation — no rows created or disabled automatically. (Spec §3)
- `PATCH /:id/sync-mode` 400s if `syncMode` is `private`/`exclusive` and no `tenantId` is given. (Spec §4)
- Reseller self-service endpoints (`/reseller/products*`) are explicitly out of scope. (Spec §1)
- All new/modified `/admin/products*` routes inherit `requireAuth` + `requireRole('master_admin')` from the existing router-level middleware — no new auth wiring needed. (Prior sub-project, `products.routes.ts`)

---

## Task 1: ResellerProduct Model

**Files:**
- Create: `src/models/ResellerProduct.ts`
- Test: `tests/models/resellerProduct.test.ts`

**Interfaces:**
- Consumes: `Tenant`, `Product` models (prior sub-projects).
- Produces: `ResellerProduct` model + `ResellerProductDocument` (`tenantId`, `productId`, `enabled`, `customPrice`, `discountPercent`, `isFeatured`, `categoryId`) with a unique compound index on `(tenantId, productId)` — consumed by every task from Task 3 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/models/resellerProduct.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

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

describe('ResellerProduct model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const rp = await ResellerProduct.create({ tenantId: tenant._id, productId: product._id });
    expect(rp.enabled).toBe(false);
    expect(rp.isFeatured).toBe(false);
    expect(rp.customPrice).toBeNull();
  });

  it('rejects a duplicate tenantId+productId pair', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id });
    await expect(
      ResellerProduct.create({ tenantId: tenant._id, productId: product._id })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/resellerProduct.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/ResellerProduct'`

- [ ] **Step 3: Create `src/models/ResellerProduct.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface ResellerProductDocument extends Document {
  tenantId: Types.ObjectId;
  productId: Types.ObjectId;
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
  categoryId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const resellerProductSchema = new Schema<ResellerProductDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    enabled: { type: Boolean, default: false },
    customPrice: { type: Number, default: null },
    discountPercent: { type: Number, default: null },
    isFeatured: { type: Boolean, default: false },
    categoryId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

resellerProductSchema.index({ tenantId: 1, productId: 1 }, { unique: true });

export const ResellerProduct = model<ResellerProductDocument>('ResellerProduct', resellerProductSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/resellerProduct.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/ResellerProduct.ts tests/models/resellerProduct.test.ts
git commit -m "feat: add ResellerProduct model"
```

---

## Task 2: Product Model — Add `tenantId` for Private/Exclusive Assignment

**Files:**
- Modify: `src/models/Product.ts`
- Modify: `tests/models/product.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ProductDocument.tenantId: Types.ObjectId | null` — consumed by Task 3's propagation logic and Task 4's sync-mode endpoint.

- [ ] **Step 1: Write the failing test**

Append to `tests/models/product.test.ts` (inside the existing `describe('Product model', ...)` block):

```ts
  it('defaults tenantId to null and can be set for private/exclusive assignment', async () => {
    const product = await Product.create({ name: 'B', slug: 'b', type: 'software', basePrice: 5 });
    expect(product.tenantId).toBeNull();

    product.tenantId = new mongoose.Types.ObjectId();
    await product.save();
    const reloaded = await Product.findById(product._id);
    expect(reloaded!.tenantId).not.toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/product.test.ts`
Expected: FAIL — `tenantId` doesn't exist on `ProductDocument`/schema yet (TypeScript compile error)

- [ ] **Step 3: Modify `src/models/Product.ts`** — add `Types` import, interface field, and schema field

Replace:

```ts
import { Schema, model, Document } from 'mongoose';
```

with:

```ts
import { Schema, model, Document, Types } from 'mongoose';
```

Add to `ProductDocument` (after `syncMode`):

```ts
  syncMode: ProductSyncMode;
  tenantId: Types.ObjectId | null;
```

Add to the schema (after `syncMode`):

```ts
    syncMode: { type: String, enum: ['global', 'optional', 'private', 'exclusive'], default: 'optional' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/product.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/Product.ts tests/models/product.test.ts
git commit -m "feat: add tenantId field to Product for private/exclusive assignment"
```

---

## Task 3: Sync Propagation Service

**Files:**
- Modify: `src/modules/products/products.service.ts`
- Test: `tests/modules/products.sync-propagation.test.ts`

**Interfaces:**
- Consumes: `Tenant` model, `ResellerProduct` model (Task 1), `ProductDocument.tenantId` (Task 2).
- Produces: `syncProductToTenants(product: ProductDocument): Promise<void>` — consumed by Task 4 (sync-mode endpoint), Task 5 (force-sync endpoint).

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.sync-propagation.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';
import { syncProductToTenants } from '../../src/modules/products/products.service';

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

describe('syncProductToTenants', () => {
  it('enables a global product for every tenant', async () => {
    await Tenant.create({ name: 'A', subdomain: 'a' });
    await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });

    await syncProductToTenants(product);

    const rows = await ResellerProduct.find({ productId: product._id });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.enabled)).toBe(true);
  });

  it('does nothing for optional mode', async () => {
    await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'optional',
    });

    await syncProductToTenants(product);

    const rows = await ResellerProduct.find({ productId: product._id });
    expect(rows).toHaveLength(0);
  });

  it('enables only the assigned tenant for private mode and disables others', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });
    await syncProductToTenants(product);

    product.syncMode = 'private';
    product.tenantId = tenantA._id;
    await product.save();
    await syncProductToTenants(product);

    const rowA = await ResellerProduct.findOne({ tenantId: tenantA._id, productId: product._id });
    const rowB = await ResellerProduct.findOne({ tenantId: tenantB._id, productId: product._id });
    expect(rowA!.enabled).toBe(true);
    expect(rowB!.enabled).toBe(false);
  });

  it('moving private assignment from tenant A to tenant B disables A and enables B', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'private',
      tenantId: tenantA._id,
    });
    await syncProductToTenants(product);

    product.tenantId = tenantB._id;
    await product.save();
    await syncProductToTenants(product);

    const rowA = await ResellerProduct.findOne({ tenantId: tenantA._id, productId: product._id });
    const rowB = await ResellerProduct.findOne({ tenantId: tenantB._id, productId: product._id });
    expect(rowA!.enabled).toBe(false);
    expect(rowB!.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.sync-propagation.test.ts`
Expected: FAIL — `syncProductToTenants` is not exported yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — add imports and the function

Add to the import block:

```ts
import { Tenant } from '../../models/Tenant';
import { ResellerProduct } from '../../models/ResellerProduct';
```

Append:

```ts
export async function syncProductToTenants(product: ProductDocument): Promise<void> {
  if (product.syncMode === 'global') {
    const tenants = await Tenant.find();
    await Promise.all(
      tenants.map((tenant) =>
        ResellerProduct.findOneAndUpdate(
          { tenantId: tenant._id, productId: product._id },
          { $set: { enabled: true }, $setOnInsert: { tenantId: tenant._id, productId: product._id } },
          { upsert: true, new: true }
        )
      )
    );
    return;
  }

  if (product.syncMode === 'private' || product.syncMode === 'exclusive') {
    if (!product.tenantId) return;
    const entitledTenantId = product.tenantId;
    await ResellerProduct.findOneAndUpdate(
      { tenantId: entitledTenantId, productId: product._id },
      { $set: { enabled: true }, $setOnInsert: { tenantId: entitledTenantId, productId: product._id } },
      { upsert: true, new: true }
    );
    await ResellerProduct.updateMany(
      { productId: product._id, tenantId: { $ne: entitledTenantId } },
      { $set: { enabled: false } }
    );
    return;
  }

  // 'optional' mode — no-op, resellers opt in manually (future sub-project)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/modules/products.sync-propagation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/products/products.service.ts tests/modules/products.sync-propagation.test.ts
git commit -m "feat: add sync propagation engine for reseller_products"
```

---

## Task 4: Sync-Mode Endpoint — Accept `tenantId` and Propagate

**Files:**
- Modify: `src/modules/products/products.validators.ts` (extend `syncModeSchema`)
- Modify: `src/modules/products/products.service.ts` (extend `updateSyncMode`)
- Modify: `src/modules/products/products.controller.ts` (pass `tenantId` through)
- Test: `tests/modules/products.sync-mode-tenant.test.ts`

**Interfaces:**
- Consumes: `syncProductToTenants` (Task 3).
- Produces: `updateSyncMode(id: string, syncMode: ProductDocument['syncMode'], tenantId?: string): Promise<ProductDocument>` — now also propagates.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.sync-mode-tenant.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { Tenant } from '../../src/models/Tenant';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/products', productsRouter);
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

describe('products module — sync-mode tenant assignment', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('400s when switching to private without a tenantId', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private' });
    expect(res.status).toBe(400);
  });

  it('assigns to a tenant and propagates entitlement', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });

    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private', tenantId: tenant._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.product.syncMode).toBe('private');

    const row = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.sync-mode-tenant.test.ts`
Expected: FAIL — `syncModeSchema` doesn't accept/require `tenantId` yet, and `updateSyncMode` doesn't propagate

- [ ] **Step 3: Modify `src/modules/products/products.validators.ts`** — replace `syncModeSchema`

Replace:

```ts
export const syncModeSchema = z.object({
  syncMode: z.enum(['global', 'optional', 'private', 'exclusive']),
});
```

with:

```ts
export const syncModeSchema = z
  .object({
    syncMode: z.enum(['global', 'optional', 'private', 'exclusive']),
    tenantId: z.string().optional(),
  })
  .refine((data) => !(['private', 'exclusive'].includes(data.syncMode) && !data.tenantId), {
    message: 'tenantId is required when syncMode is private or exclusive',
    path: ['tenantId'],
  });
```

- [ ] **Step 4: Modify `src/modules/products/products.service.ts`** — add `Types` import and replace `updateSyncMode`

Add to the import block:

```ts
import { Types } from 'mongoose';
```

Replace:

```ts
export async function updateSyncMode(
  id: string,
  syncMode: ProductDocument['syncMode']
): Promise<ProductDocument> {
  const product = await getProductById(id);
  product.syncMode = syncMode;
  await product.save();
  return product;
}
```

with:

```ts
export async function updateSyncMode(
  id: string,
  syncMode: ProductDocument['syncMode'],
  tenantId?: string
): Promise<ProductDocument> {
  const product = await getProductById(id);
  product.syncMode = syncMode;
  product.tenantId =
    (syncMode === 'private' || syncMode === 'exclusive') && tenantId ? new Types.ObjectId(tenantId) : null;
  await product.save();
  await syncProductToTenants(product);
  return product;
}
```

- [ ] **Step 5: Modify `src/modules/products/products.controller.ts`** — pass `tenantId` through

Replace:

```ts
export async function updateSyncModeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.updateSyncMode(req.params.id, req.body.syncMode);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
```

with:

```ts
export async function updateSyncModeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.updateSyncMode(req.params.id, req.body.syncMode, req.body.tenantId);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.sync-mode-tenant.test.ts tests/modules/products.sync-mode.test.ts`
Expected: PASS — including the pre-existing sync-mode test file, unaffected since `tenantId` is optional for `global`/`exclusive`... (only required for `private`/`exclusive`, and the existing test uses `exclusive` — verify it still passes since it doesn't send `tenantId`)

- [ ] **Step 7: If the pre-existing sync-mode test fails, update it**

The existing `tests/modules/products.sync-mode.test.ts` test `'updates the sync mode'` sends `{ syncMode: 'exclusive' }` with no `tenantId` — this now 400s under the new refine rule. Update that test's body to include a tenant:

Replace the test body in `tests/modules/products.sync-mode.test.ts`:

```ts
  it('updates the sync mode', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'exclusive' });
    expect(res.status).toBe(200);
    expect(res.body.product.syncMode).toBe('exclusive');
  });
```

with:

```ts
  it('updates the sync mode to global (no tenantId required)', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'global' });
    expect(res.status).toBe(200);
    expect(res.body.product.syncMode).toBe('global');
  });
```

Add `import { Tenant } from '../../src/models/Tenant';` to that file if not already present (it isn't) — not required for this replacement since the new test doesn't use `Tenant`, so no import change needed.

- [ ] **Step 8: Run both test files again to verify they pass**

Run: `npm test -- tests/modules/products.sync-mode-tenant.test.ts tests/modules/products.sync-mode.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/modules/products tests/modules/products.sync-mode-tenant.test.ts tests/modules/products.sync-mode.test.ts
git commit -m "feat: accept tenantId on sync-mode change and propagate entitlements"
```

---

## Task 5: Force Re-Sync Endpoint

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `forceSync`)
- Modify: `src/modules/products/products.controller.ts` (add `forceSyncHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `POST /:id/sync`)
- Test: `tests/modules/products.force-sync.test.ts`

**Interfaces:**
- Consumes: `syncProductToTenants` (Task 3), `getProductById` (prior sub-project).
- Produces: `forceSync(id: string): Promise<ProductDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.force-sync.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { Tenant } from '../../src/models/Tenant';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/products', productsRouter);
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

describe('products module — force sync', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('re-derives reseller_products for a global product with no existing rows', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });
    // No ResellerProduct row exists yet — simulates drift (e.g. a tenant added before this feature).

    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/sync`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);

    const row = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });

  it('404s for an unknown product', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products/64b000000000000000000000/sync')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.force-sync.test.ts`
Expected: FAIL — no `POST /:id/sync` route yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — append `forceSync`

```ts
export async function forceSync(id: string): Promise<ProductDocument> {
  const product = await getProductById(id);
  await syncProductToTenants(product);
  return product;
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handler

```ts
export async function forceSyncHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.forceSync(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add route and import

Add to the imports:

```ts
import { forceSyncHandler } from './products.controller';
```

Add route:

```ts
productsRouter.post('/:id/sync', forceSyncHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.force-sync.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.force-sync.test.ts
git commit -m "feat: add force re-sync endpoint"
```

---

## Task 6: List Entitled Resellers Endpoint

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `listEntitledTenants`)
- Modify: `src/modules/products/products.controller.ts` (add `listResellersHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `GET /:id/resellers`)
- Test: `tests/modules/products.resellers.test.ts`

**Interfaces:**
- Consumes: `ResellerProduct` model (Task 1), `TenantDocument` (foundation), `getProductById` (prior sub-project).
- Produces: `listEntitledTenants(productId: string): Promise<Array<{_id: string; name: string; subdomain: string}>>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.resellers.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { Tenant } from '../../src/models/Tenant';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/products', productsRouter);
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

describe('products module — list entitled resellers', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('lists only tenants with an enabled entitlement', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await ResellerProduct.create({ tenantId: tenantA._id, productId: product._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenantB._id, productId: product._id, enabled: false });

    const res = await request(app)
      .get(`/api/v1/admin/products/${product._id}/resellers`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(1);
    expect(res.body.tenants[0].subdomain).toBe('a');
  });

  it('404s for an unknown product', async () => {
    const res = await request(app)
      .get('/api/v1/admin/products/64b000000000000000000000/resellers')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.resellers.test.ts`
Expected: FAIL — no `GET /:id/resellers` route yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — add an import and append `listEntitledTenants`

Add to the import block:

```ts
import { TenantDocument } from '../../models/Tenant';
```

(merge with the existing `import { Tenant } from '../../models/Tenant';` line into `import { Tenant, TenantDocument } from '../../models/Tenant';`)

Append:

```ts
export async function listEntitledTenants(
  productId: string
): Promise<Array<{ _id: string; name: string; subdomain: string }>> {
  await getProductById(productId);
  const rows = await ResellerProduct.find({ productId, enabled: true }).populate<{
    tenantId: TenantDocument;
  }>('tenantId');
  return rows.map((row) => {
    const tenant = row.tenantId as unknown as TenantDocument;
    return { _id: tenant._id.toString(), name: tenant.name, subdomain: tenant.subdomain };
  });
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handler

```ts
export async function listResellersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenants = await productsService.listEntitledTenants(req.params.id);
    res.status(200).json({ tenants });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add route and import

Add to the imports:

```ts
import { listResellersHandler } from './products.controller';
```

Add route:

```ts
productsRouter.get('/:id/resellers', listResellersHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.resellers.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.resellers.test.ts
git commit -m "feat: add endpoint to list entitled resellers for a product"
```

---

## Task 7: Tenant Creation Auto-Syncs Global Products

**Files:**
- Modify: `src/modules/tenants/tenants.service.ts`
- Test: `tests/modules/tenants.global-sync.test.ts`

**Interfaces:**
- Consumes: `Product` model, `ResellerProduct` model (Task 1).
- Produces: `createTenant` (existing function) now also creates enabled `ResellerProduct` rows for every `syncMode='global'` product.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/tenants.global-sync.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { tenantsRouter } from '../../src/modules/tenants/tenants.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tenants', tenantsRouter);
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

describe('tenant creation — global product auto-sync', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('auto-enables existing global products for a newly created tenant', async () => {
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 10,
      syncMode: 'global',
    });

    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'New Reseller', subdomain: 'new-reseller' });
    expect(res.status).toBe(201);

    const row = await ResellerProduct.findOne({ tenantId: res.body.tenant._id, productId: product._id });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });

  it('does not enable optional products for a new tenant', async () => {
    await Product.create({ name: 'Opt', slug: 'opt', type: 'software', basePrice: 10, syncMode: 'optional' });

    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Another Reseller', subdomain: 'another-reseller' });
    expect(res.status).toBe(201);

    const rows = await ResellerProduct.find({ tenantId: res.body.tenant._id });
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/tenants.global-sync.test.ts`
Expected: FAIL — no auto-sync yet, so no `ResellerProduct` row is created

- [ ] **Step 3: Modify `src/modules/tenants/tenants.service.ts`** — add imports and update `createTenant`

Add to the import block:

```ts
import { Product } from '../../models/Product';
import { ResellerProduct } from '../../models/ResellerProduct';
```

Replace:

```ts
export async function createTenant(input: { name: string; subdomain: string }): Promise<TenantDocument> {
  const subdomain = input.subdomain.toLowerCase();
  const existing = await Tenant.findOne({ subdomain });
  if (existing) {
    throw new ConflictError('Subdomain already in use');
  }
  return Tenant.create({ name: input.name, subdomain, status: 'active' });
}
```

with:

```ts
export async function createTenant(input: { name: string; subdomain: string }): Promise<TenantDocument> {
  const subdomain = input.subdomain.toLowerCase();
  const existing = await Tenant.findOne({ subdomain });
  if (existing) {
    throw new ConflictError('Subdomain already in use');
  }
  const tenant = await Tenant.create({ name: input.name, subdomain, status: 'active' });

  const globalProducts = await Product.find({ syncMode: 'global' });
  await Promise.all(
    globalProducts.map((product) =>
      ResellerProduct.findOneAndUpdate(
        { tenantId: tenant._id, productId: product._id },
        { $set: { enabled: true }, $setOnInsert: { tenantId: tenant._id, productId: product._id } },
        { upsert: true, new: true }
      )
    )
  );

  return tenant;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/modules/tenants.global-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/tenants/tenants.service.ts tests/modules/tenants.global-sync.test.ts
git commit -m "feat: auto-enable global products when a new tenant is created"
```

---

## Task 8: Full Reseller-Catalog Lifecycle Integration Test

**Files:**
- Test: `tests/integration/reseller-catalog-lifecycle.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–7. No new production code — proves the whole sync engine works together end-to-end through the fully wired app.

- [ ] **Step 1: Write the test**

Create `tests/integration/reseller-catalog-lifecycle.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';

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

describe('full reseller catalog lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('global product auto-syncs to a new tenant, then reassigning to private disables it and enables the assigned tenant', async () => {
    const productRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Catalog Tool', type: 'software', basePrice: 100 });
    expect(productRes.status).toBe(201);
    const productId = productRes.body.product._id;

    await request(app)
      .patch(`/api/v1/admin/products/${productId}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'global' });

    const tenantARes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Tenant A', subdomain: 'tenant-a-catalog' });
    expect(tenantARes.status).toBe(201);

    const afterGlobalSync = await request(app)
      .get(`/api/v1/admin/products/${productId}/resellers`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(afterGlobalSync.body.tenants.map((t: { subdomain: string }) => t.subdomain)).toContain(
      'tenant-a-catalog'
    );

    const tenantBRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Tenant B', subdomain: 'tenant-b-catalog' });
    expect(tenantBRes.status).toBe(201);

    await request(app)
      .patch(`/api/v1/admin/products/${productId}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private', tenantId: tenantBRes.body.tenant._id });

    const afterReassign = await request(app)
      .get(`/api/v1/admin/products/${productId}/resellers`)
      .set('Authorization', `Bearer ${masterToken}`);
    const subdomains = afterReassign.body.tenants.map((t: { subdomain: string }) => t.subdomain);
    expect(subdomains).toEqual(['tenant-b-catalog']);
    expect(subdomains).not.toContain('tenant-a-catalog');
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test -- tests/integration/reseller-catalog-lifecycle.test.ts`
Expected: PASS — all of Tasks 1–7 working together

- [ ] **Step 3: Commit**

```bash
git add tests/integration/reseller-catalog-lifecycle.test.ts
git commit -m "test: add full reseller catalog sync lifecycle integration test"
```

---

## Post-plan verification

Run the entire suite once more and confirm a clean build:

```bash
npm test
npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project (per the PRD decomposition) should cover the Reseller Onboarding Wizard and/or Reseller Panel catalog self-service endpoints — to be brainstormed separately.
