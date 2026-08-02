# Licensing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the license pool (model, key generation, master-admin CRUD), a direct assignment endpoint standing in for order-based assignment, and customer-facing activation.

**Architecture:** Same layered pattern as prior sub-projects — one `licenses.service.ts`/`licenses.controller.ts` pair, but two routers: `adminLicensesRouter` (master_admin, mounted at `/api/v1/admin/licenses`) and `customerLicensesRouter` (customer, mounted at `/api/v1/customer/licenses`).

**Tech Stack:** Express, TypeScript, Mongoose, Zod, Jest + supertest + `mongodb-memory-server` — same as prior sub-projects, no new dependencies.

## Global Constraints

- `license_requests` and `access_codes` are out of scope — PRD §8 marks manual licensing Phase 2+. (Spec §1)
- `orderId` stays `null`/unused this round; `assignedUserId` is the assignment mechanism until Orders exists. (Spec §2, §3)
- Activation uses a simple counter (`activationsUsed`/`activationLimit`) — no device-ID list. (Spec §5)
- License keys: `TZP-<year>-<8-char uppercase alphanumeric>`, collision-checked. (Spec §3)
- All `/admin/licenses*` routes: `requireAuth` + `requireRole('master_admin')`. All `/customer/licenses*` routes: `requireAuth` + `requireRole('customer')`. (Spec §4)

---

## Task 1: License Model

**Files:**
- Create: `src/models/License.ts`
- Test: `tests/models/license.test.ts`

**Interfaces:**
- Consumes: `Product`, `Tenant`, `User` models (prior sub-projects).
- Produces: `License` model + `LicenseDocument` (`productId`, `tenantId`, `orderId`, `assignedUserId`, `key`, `status`, `activationLimit`, `activationsUsed`, `expiresAt`) and `LicenseStatus` type — consumed by every task from Task 3 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/models/license.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

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

describe('License model', () => {
  it('creates with defaults', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-ABCD1234' });
    expect(license.status).toBe('available');
    expect(license.activationLimit).toBe(1);
    expect(license.activationsUsed).toBe(0);
    expect(license.tenantId).toBeNull();
    expect(license.assignedUserId).toBeNull();
  });

  it('rejects a duplicate key', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await License.create({ productId: product._id, key: 'TZP-2026-DUPEKEY1' });
    await expect(License.create({ productId: product._id, key: 'TZP-2026-DUPEKEY1' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/license.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/License'`

- [ ] **Step 3: Create `src/models/License.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export type LicenseStatus =
  | 'draft'
  | 'available'
  | 'reserved'
  | 'assigned'
  | 'activated'
  | 'suspended'
  | 'expired'
  | 'revoked';

export interface LicenseDocument extends Document {
  productId: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  orderId: Types.ObjectId | null;
  assignedUserId: Types.ObjectId | null;
  key: string;
  status: LicenseStatus;
  activationLimit: number;
  activationsUsed: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const licenseSchema = new Schema<LicenseDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    orderId: { type: Schema.Types.ObjectId, default: null },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    key: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['draft', 'available', 'reserved', 'assigned', 'activated', 'suspended', 'expired', 'revoked'],
      default: 'available',
    },
    activationLimit: { type: Number, default: 1 },
    activationsUsed: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const License = model<LicenseDocument>('License', licenseSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/license.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/License.ts tests/models/license.test.ts
git commit -m "feat: add License model"
```

---

## Task 2: License Key Generation

**Files:**
- Create: `src/common/licenseKey.ts`
- Test: `tests/common/licenseKey.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `generateLicenseKey(): string` — consumed by Task 3's `generateUniqueLicenseKey` helper.

- [ ] **Step 1: Write the failing test**

Create `tests/common/licenseKey.test.ts`:

```ts
import { generateLicenseKey } from '../../src/common/licenseKey';

describe('generateLicenseKey', () => {
  it('matches the TZP-YYYY-XXXXXXXX format', () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^TZP-\d{4}-[A-Z0-9]{8}$/);
  });

  it('generates different keys on subsequent calls', () => {
    const a = generateLicenseKey();
    const b = generateLicenseKey();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common/licenseKey.test.ts`
Expected: FAIL — `Cannot find module '../../src/common/licenseKey'`

- [ ] **Step 3: Create `src/common/licenseKey.ts`**

```ts
import crypto from 'crypto';

const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateLicenseKey(): string {
  const year = new Date().getFullYear();
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += KEY_CHARS[crypto.randomInt(KEY_CHARS.length)];
  }
  return `TZP-${year}-${suffix}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common/licenseKey.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/common/licenseKey.ts tests/common/licenseKey.test.ts
git commit -m "feat: add license key generator"
```

---

## Task 3: Licenses Module — Admin Generate & List

**Files:**
- Create: `src/modules/licenses/licenses.validators.ts`
- Create: `src/modules/licenses/licenses.service.ts`
- Create: `src/modules/licenses/licenses.controller.ts`
- Create: `src/modules/licenses/licenses.routes.ts`
- Test: `tests/modules/licenses.generate-list.test.ts`

**Interfaces:**
- Consumes: `License` model (Task 1), `generateLicenseKey` (Task 2), `requireAuth`/`requireRole`/`validateBody`/`validateQuery` (prior sub-projects).
- Produces: All Zod schemas needed by every subsequent licenses task are defined in `licenses.validators.ts` now (`generateLicensesSchema`, `importLicensesSchema`, `assignLicenseSchema`, `listLicensesQuerySchema`). `listLicenses(query): Promise<{items, total, page, limit}>` and `generateLicenses(input: {productId, quantity, expiresAt?}): Promise<LicenseDocument[]>` from `licenses.service.ts`. `adminLicensesRouter: Router` — mounted at `/api/v1/admin/licenses` in Task 8.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/licenses.generate-list.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminLicensesRouter } from '../../src/modules/licenses/licenses.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
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

describe('licenses module — generate & list', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/licenses')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('bulk-generates unique license keys', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const res = await request(app)
      .post('/api/v1/admin/licenses/generate')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId: product._id.toString(), quantity: 5 });
    expect(res.status).toBe(201);
    expect(res.body.licenses).toHaveLength(5);
    const keys = res.body.licenses.map((l: { key: string }) => l.key);
    expect(new Set(keys).size).toBe(5);
    expect(res.body.licenses.every((l: { status: string }) => l.status === 'available')).toBe(true);
  });

  it('lists licenses with pagination and filters', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await License.create({ productId: product._id, key: 'TZP-2026-AAAAAAAA', status: 'available' });
    await License.create({ productId: product._id, key: 'TZP-2026-BBBBBBBB', status: 'revoked' });

    const res = await request(app)
      .get('/api/v1/admin/licenses?status=revoked')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].key).toBe('TZP-2026-BBBBBBBB');
    expect(res.body.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/licenses.generate-list.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/licenses/licenses.validators.ts`**

```ts
import { z } from 'zod';

export const generateLicensesSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  expiresAt: z.string().datetime().optional(),
});

export const importLicensesSchema = z.object({
  productId: z.string().min(1),
  keys: z.array(z.string().min(1)).min(1),
});

export const assignLicenseSchema = z.object({
  userId: z.string().min(1),
});

export const listLicensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  productId: z.string().optional(),
  tenantId: z.string().optional(),
  status: z
    .enum(['draft', 'available', 'reserved', 'assigned', 'activated', 'suspended', 'expired', 'revoked'])
    .optional(),
});
```

- [ ] **Step 4: Create `src/modules/licenses/licenses.service.ts`**

```ts
import { License, LicenseDocument } from '../../models/License';
import { generateLicenseKey } from '../../common/licenseKey';

async function generateUniqueLicenseKey(): Promise<string> {
  let key = generateLicenseKey();
  // eslint-disable-next-line no-await-in-loop
  while (await License.exists({ key })) {
    key = generateLicenseKey();
  }
  return key;
}

export interface ListLicensesQuery {
  page: number;
  limit: number;
  productId?: string;
  tenantId?: string;
  status?: string;
}

export interface ListLicensesResult {
  items: LicenseDocument[];
  total: number;
  page: number;
  limit: number;
}

export async function listLicenses(query: ListLicensesQuery): Promise<ListLicensesResult> {
  const filter: Record<string, unknown> = {};
  if (query.productId) filter.productId = query.productId;
  if (query.tenantId) filter.tenantId = query.tenantId;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    License.find(filter)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .sort({ createdAt: -1 }),
    License.countDocuments(filter),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function generateLicenses(input: {
  productId: string;
  quantity: number;
  expiresAt?: string;
}): Promise<LicenseDocument[]> {
  const licenses: LicenseDocument[] = [];
  for (let i = 0; i < input.quantity; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const key = await generateUniqueLicenseKey();
    // eslint-disable-next-line no-await-in-loop
    const license = await License.create({
      productId: input.productId,
      key,
      status: 'available',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    licenses.push(license);
  }
  return licenses;
}
```

- [ ] **Step 5: Create `src/modules/licenses/licenses.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as licensesService from './licenses.service';

export async function listLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await licensesService.listLicenses(
      req.query as unknown as licensesService.ListLicensesQuery
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function generateLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const licenses = await licensesService.generateLicenses(req.body);
    res.status(201).json({ licenses });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Create `src/modules/licenses/licenses.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { generateLicensesSchema, listLicensesQuerySchema } from './licenses.validators';
import { listLicensesHandler, generateLicensesHandler } from './licenses.controller';

export const adminLicensesRouter = Router();

adminLicensesRouter.use(requireAuth, requireRole('master_admin'));

adminLicensesRouter.get('/', validateQuery(listLicensesQuerySchema), listLicensesHandler);
adminLicensesRouter.post('/generate', validateBody(generateLicensesSchema), generateLicensesHandler);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/licenses.generate-list.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/licenses tests/modules/licenses.generate-list.test.ts
git commit -m "feat: add licenses module with generate and list endpoints"
```

---

## Task 4: Licenses Module — Import

**Files:**
- Modify: `src/modules/licenses/licenses.service.ts` (add `importLicenses`)
- Modify: `src/modules/licenses/licenses.controller.ts` (add `importLicensesHandler`)
- Modify: `src/modules/licenses/licenses.routes.ts` (add `POST /import`)
- Test: `tests/modules/licenses.import.test.ts`

**Interfaces:**
- Consumes: `ConflictError` (foundation), `importLicensesSchema` (Task 3).
- Produces: `importLicenses(input: {productId: string; keys: string[]}): Promise<LicenseDocument[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/licenses.import.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminLicensesRouter } from '../../src/modules/licenses/licenses.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
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

describe('licenses module — import', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('imports externally-supplied keys', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const res = await request(app)
      .post('/api/v1/admin/licenses/import')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId: product._id.toString(), keys: ['TZP-2026-EXT00001', 'TZP-2026-EXT00002'] });
    expect(res.status).toBe(201);
    expect(res.body.licenses).toHaveLength(2);
  });

  it('409s if a supplied key already exists', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await License.create({ productId: product._id, key: 'TZP-2026-EXISTING' });

    const res = await request(app)
      .post('/api/v1/admin/licenses/import')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId: product._id.toString(), keys: ['TZP-2026-EXISTING'] });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/licenses.import.test.ts`
Expected: FAIL — no `/import` route yet

- [ ] **Step 3: Modify `src/modules/licenses/licenses.service.ts`** — add an import and append `importLicenses`

Add to the import block:

```ts
import { ConflictError } from '../../common/errors';
```

Append:

```ts
export async function importLicenses(input: {
  productId: string;
  keys: string[];
}): Promise<LicenseDocument[]> {
  const existing = await License.findOne({ key: { $in: input.keys } });
  if (existing) {
    throw new ConflictError('One or more license keys already exist');
  }
  const docs = await License.insertMany(
    input.keys.map((key) => ({ productId: input.productId, key, status: 'available' }))
  );
  return docs as unknown as LicenseDocument[];
}
```

- [ ] **Step 4: Modify `src/modules/licenses/licenses.controller.ts`** — append handler

```ts
export async function importLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const licenses = await licensesService.importLicenses(req.body);
    res.status(201).json({ licenses });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/licenses/licenses.routes.ts`** — add route and imports

Add to the imports:

```ts
import { importLicensesSchema } from './licenses.validators';
import { importLicensesHandler } from './licenses.controller';
```

Add route:

```ts
adminLicensesRouter.post('/import', validateBody(importLicensesSchema), importLicensesHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/licenses.import.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/licenses tests/modules/licenses.import.test.ts
git commit -m "feat: add license import endpoint"
```

---

## Task 5: Licenses Module — Revoke

**Files:**
- Modify: `src/modules/licenses/licenses.service.ts` (add `getLicenseById`, `revokeLicense`)
- Modify: `src/modules/licenses/licenses.controller.ts` (add `revokeLicenseHandler`)
- Modify: `src/modules/licenses/licenses.routes.ts` (add `PATCH /:id/revoke`)
- Test: `tests/modules/licenses.revoke.test.ts`

**Interfaces:**
- Consumes: `NotFoundError` (foundation).
- Produces: `getLicenseById(id: string): Promise<LicenseDocument>` (reused by Tasks 6–7), `revokeLicense(id: string): Promise<LicenseDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/licenses.revoke.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminLicensesRouter } from '../../src/modules/licenses/licenses.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
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

describe('licenses module — revoke', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('revokes a license regardless of current status', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-REVOKEME', status: 'assigned' });

    const res = await request(app)
      .patch(`/api/v1/admin/licenses/${license._id}/revoke`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.license.status).toBe('revoked');
  });

  it('404s for an unknown license', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/licenses/64b000000000000000000000/revoke')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/licenses.revoke.test.ts`
Expected: FAIL — no `PATCH /:id/revoke` route yet

- [ ] **Step 3: Modify `src/modules/licenses/licenses.service.ts`** — add an import and append the two functions

Add to the import block:

```ts
import { NotFoundError } from '../../common/errors';
```

(merge with the existing `import { ConflictError } from '../../common/errors';` into `import { ConflictError, NotFoundError } from '../../common/errors';`)

Append:

```ts
export async function getLicenseById(id: string): Promise<LicenseDocument> {
  const license = await License.findById(id);
  if (!license) throw new NotFoundError('License not found');
  return license;
}

export async function revokeLicense(id: string): Promise<LicenseDocument> {
  const license = await getLicenseById(id);
  license.status = 'revoked';
  await license.save();
  return license;
}
```

- [ ] **Step 4: Modify `src/modules/licenses/licenses.controller.ts`** — append handler

```ts
export async function revokeLicenseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const license = await licensesService.revokeLicense(req.params.id);
    res.status(200).json({ license });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/licenses/licenses.routes.ts`** — add route and import

Add to the imports:

```ts
import { revokeLicenseHandler } from './licenses.controller';
```

Add route:

```ts
adminLicensesRouter.patch('/:id/revoke', revokeLicenseHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/licenses.revoke.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/licenses tests/modules/licenses.revoke.test.ts
git commit -m "feat: add license revoke endpoint"
```

---

## Task 6: Licenses Module — Assign

**Files:**
- Modify: `src/modules/licenses/licenses.service.ts` (add `assignLicense`)
- Modify: `src/modules/licenses/licenses.controller.ts` (add `assignLicenseHandler`)
- Modify: `src/modules/licenses/licenses.routes.ts` (add `POST /:id/assign`)
- Test: `tests/modules/licenses.assign.test.ts`

**Interfaces:**
- Consumes: `getLicenseById` (Task 5), `User` model (foundation), `assignLicenseSchema` (Task 3).
- Produces: `assignLicense(licenseId: string, userId: string): Promise<LicenseDocument>` — 409s if the license isn't `available`, 404s if the user doesn't exist.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/licenses.assign.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { adminLicensesRouter } from '../../src/modules/licenses/licenses.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/licenses', adminLicensesRouter);
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

describe('licenses module — assign', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('assigns an available license to a user and copies the tenantId', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'active',
    });
    const license = await License.create({ productId: product._id, key: 'TZP-2026-ASSIGNME' });

    const res = await request(app)
      .post(`/api/v1/admin/licenses/${license._id}/assign`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ userId: user._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.license.status).toBe('assigned');
    expect(res.body.license.assignedUserId).toBe(user._id.toString());
    expect(res.body.license.tenantId).toBe(tenant._id.toString());
  });

  it('409s when the license is not available', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'active',
    });
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-TAKEN001',
      status: 'revoked',
    });

    const res = await request(app)
      .post(`/api/v1/admin/licenses/${license._id}/assign`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ userId: user._id.toString() });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/licenses.assign.test.ts`
Expected: FAIL — no `POST /:id/assign` route yet

- [ ] **Step 3: Modify `src/modules/licenses/licenses.service.ts`** — add an import and append `assignLicense`

Add to the import block:

```ts
import { User } from '../../models/User';
```

Append:

```ts
export async function assignLicense(licenseId: string, userId: string): Promise<LicenseDocument> {
  const license = await getLicenseById(licenseId);
  if (license.status !== 'available') {
    throw new ConflictError('License is not available for assignment');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  license.assignedUserId = user._id;
  license.tenantId = user.tenantId;
  license.status = 'assigned';
  await license.save();
  return license;
}
```

- [ ] **Step 4: Modify `src/modules/licenses/licenses.controller.ts`** — append handler

```ts
export async function assignLicenseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const license = await licensesService.assignLicense(req.params.id, req.body.userId);
    res.status(200).json({ license });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/licenses/licenses.routes.ts`** — add route and imports

Add to the imports:

```ts
import { assignLicenseSchema } from './licenses.validators';
import { assignLicenseHandler } from './licenses.controller';
```

Add route:

```ts
adminLicensesRouter.post('/:id/assign', validateBody(assignLicenseSchema), assignLicenseHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/licenses.assign.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/licenses tests/modules/licenses.assign.test.ts
git commit -m "feat: add license assignment endpoint"
```

---

## Task 7: Licenses Module — Customer List & Activate

**Files:**
- Modify: `src/modules/licenses/licenses.service.ts` (add `listLicensesForUser`, `activateLicense`)
- Modify: `src/modules/licenses/licenses.controller.ts` (add `listMyLicensesHandler`, `activateLicenseHandler`)
- Create: `src/modules/licenses/customer.routes.ts`
- Test: `tests/modules/licenses.customer.test.ts`

**Interfaces:**
- Consumes: `getLicenseById` (Task 5), `UnauthorizedError`/`ConflictError` (foundation).
- Produces: `listLicensesForUser(userId: string): Promise<LicenseDocument[]>`, `activateLicense(id: string, userId: string): Promise<LicenseDocument>`. `customerLicensesRouter: Router` — mounted at `/api/v1/customer/licenses` in Task 8.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/licenses.customer.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { customerLicensesRouter } from '../../src/modules/licenses/customer.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer/licenses', customerLicensesRouter);
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

describe('licenses module — customer list & activate', () => {
  const app = buildTestApp();

  it('lists only the caller\'s own licenses', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const myUserId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    await License.create({
      productId: product._id,
      key: 'TZP-2026-MINE0001',
      assignedUserId: myUserId,
      status: 'assigned',
    });
    await License.create({
      productId: product._id,
      key: 'TZP-2026-THEIRS01',
      assignedUserId: otherUserId,
      status: 'assigned',
    });

    const token = signAccessToken({ sub: myUserId.toString(), role: 'customer', tenantId: 'tenant-x' });
    const res = await request(app)
      .get('/api/v1/customer/licenses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.licenses).toHaveLength(1);
    expect(res.body.licenses[0].key).toBe('TZP-2026-MINE0001');
  });

  it('401s activating a license not assigned to the caller', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const ownerId = new mongoose.Types.ObjectId();
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-NOTYOURS',
      assignedUserId: ownerId,
      status: 'assigned',
    });

    const token = signAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: 'customer',
      tenantId: 'tenant-x',
    });
    const res = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('activates a license and increments activationsUsed, then 409s once the limit is reached', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const userId = new mongoose.Types.ObjectId();
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-LIMIT001',
      assignedUserId: userId,
      status: 'assigned',
      activationLimit: 1,
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: 'tenant-x' });

    const firstActivate = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(firstActivate.status).toBe(200);
    expect(firstActivate.body.license.status).toBe('activated');
    expect(firstActivate.body.license.activationsUsed).toBe(1);

    const secondActivate = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(secondActivate.status).toBe(409);
  });

  it('401s and expires a license whose expiresAt has passed', async () => {
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const userId = new mongoose.Types.ObjectId();
    const license = await License.create({
      productId: product._id,
      key: 'TZP-2026-EXPIRED1',
      assignedUserId: userId,
      status: 'assigned',
      expiresAt: new Date(Date.now() - 60000),
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: 'tenant-x' });
    const res = await request(app)
      .post(`/api/v1/customer/licenses/${license._id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);

    const updated = await License.findById(license._id);
    expect(updated!.status).toBe('expired');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/licenses.customer.test.ts`
Expected: FAIL — `Cannot find module '../../src/modules/licenses/customer.routes'`

- [ ] **Step 3: Modify `src/modules/licenses/licenses.service.ts`** — add an import and append the two functions

Add to the import block:

```ts
import { UnauthorizedError } from '../../common/errors';
```

(merge with the existing `import { ConflictError, NotFoundError } from '../../common/errors';` into `import { ConflictError, NotFoundError, UnauthorizedError } from '../../common/errors';`)

Append:

```ts
export async function listLicensesForUser(userId: string): Promise<LicenseDocument[]> {
  return License.find({ assignedUserId: userId }).sort({ createdAt: -1 });
}

export async function activateLicense(id: string, userId: string): Promise<LicenseDocument> {
  const license = await getLicenseById(id);
  if (!license.assignedUserId || license.assignedUserId.toString() !== userId) {
    throw new UnauthorizedError('This license is not assigned to you');
  }
  if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
    license.status = 'expired';
    await license.save();
    throw new UnauthorizedError('License has expired');
  }
  if (license.activationsUsed >= license.activationLimit) {
    throw new ConflictError('Activation limit reached');
  }
  license.activationsUsed += 1;
  license.status = 'activated';
  await license.save();
  return license;
}
```

- [ ] **Step 4: Modify `src/modules/licenses/licenses.controller.ts`** — append handlers

```ts
export async function listMyLicensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const licenses = await licensesService.listLicensesForUser(req.user!.id);
    res.status(200).json({ licenses });
  } catch (err) {
    next(err);
  }
}

export async function activateLicenseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const license = await licensesService.activateLicense(req.params.id, req.user!.id);
    res.status(200).json({ license });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Create `src/modules/licenses/customer.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listMyLicensesHandler, activateLicenseHandler } from './licenses.controller';

export const customerLicensesRouter = Router();

customerLicensesRouter.use(requireAuth, requireRole('customer'));

customerLicensesRouter.get('/', listMyLicensesHandler);
customerLicensesRouter.post('/:id/activate', activateLicenseHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/licenses.customer.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/licenses tests/modules/licenses.customer.test.ts
git commit -m "feat: add customer license listing and activation endpoints"
```

---

## Task 8: Wire Licenses Routers into the App & Full Lifecycle Integration Test

**Files:**
- Modify: `src/app.ts` (mount `adminLicensesRouter`, `customerLicensesRouter`)
- Test: `tests/integration/license-lifecycle.test.ts`

**Interfaces:**
- Consumes: `adminLicensesRouter` (Task 3), `customerLicensesRouter` (Task 7), `createApp` (foundation).
- Produces: nothing new — proves the whole licensing module works end-to-end inside the fully wired app.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/license-lifecycle.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/common/password';

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

describe('full license lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('generate -> assign -> activate -> activate again fails once limit reached', async () => {
    const productRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Licensed Tool', type: 'software', basePrice: 200 });
    expect(productRes.status).toBe(201);
    const productId = productRes.body.product._id;

    const generateRes = await request(app)
      .post('/api/v1/admin/licenses/generate')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId, quantity: 1 });
    expect(generateRes.status).toBe(201);
    const licenseId = generateRes.body.licenses[0]._id;

    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-license' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });

    const assignRes = await request(app)
      .post(`/api/v1/admin/licenses/${licenseId}/assign`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ userId: user._id.toString() });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.license.status).toBe('assigned');

    const customerToken = signAccessToken({
      sub: user._id.toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });

    const listRes = await request(app)
      .get('/api/v1/customer/licenses')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.licenses).toHaveLength(1);

    const activateRes = await request(app)
      .post(`/api/v1/customer/licenses/${licenseId}/activate`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.license.status).toBe('activated');

    const secondActivateRes = await request(app)
      .post(`/api/v1/customer/licenses/${licenseId}/activate`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(secondActivateRes.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/license-lifecycle.test.ts`
Expected: FAIL — `createApp()` doesn't mount the licenses routers yet, so every `/licenses` request 404s

- [ ] **Step 3: Modify `src/app.ts`** — mount both licenses routers

Add to the imports:

```ts
import { adminLicensesRouter } from './modules/licenses/licenses.routes';
import { customerLicensesRouter } from './modules/licenses/customer.routes';
```

Add alongside the other `app.use('/api/v1/...')` lines:

```ts
app.use('/api/v1/admin/licenses', adminLicensesRouter);
app.use('/api/v1/customer/licenses', customerLicensesRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/license-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.ts tests/integration/license-lifecycle.test.ts
git commit -m "feat: wire licenses routers into the app"
```

---

## Post-plan verification

Run the entire suite once more and confirm a clean build:

```bash
npm test
npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project (per the PRD decomposition) should cover Reseller Onboarding, Razorpay Checkout & Orders (which will connect `License.orderId` to real orders), or Reseller Panel catalog self-service — to be brainstormed separately.
