# Master Product Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the master-level product catalog (CRUD, versioning, publish workflow, sync-mode flag) for master_admin, and upgrade the foundation's stubbed email/file-handling to real SMTP and Cloudinary.

**Architecture:** Same layered pattern as the foundation sub-project (`routes → controllers → services → models`), extended with a `common/cloudinary.ts` upload wrapper (mocked in tests) and a `common/smtpEmail.ts` implementation of the existing `EmailService` interface (also mocked in tests, never sending real email during the suite).

**Tech Stack:** Express, TypeScript, Mongoose, Zod, `multer` (memory storage) for multipart uploads, `cloudinary` SDK, `nodemailer` for SMTP, Jest + supertest + `mongodb-memory-server`.

## Global Constraints

- No `tenant_id`/`tenantId` scoping applies here — products are master-level, no tenant field. (Spec §2)
- Every `/admin/products*` route requires `requireAuth` + `requireRole('master_admin')`. (Spec §3)
- `DELETE /:id` is a soft archive (`status='archived'`), never a hard delete. (Spec §3)
- `POST /:id/publish` 409s if the product has no `currentVersion` yet. (Spec §3)
- `POST /admin/products/:id/sync` (force re-sync) is explicitly out of scope — do not implement it. (Spec §1)
- Cloudinary and SMTP calls are always mocked in tests — the suite must never make real network calls to either service. (Spec §4, §5, §7)
- `.env` (real credentials) is never committed; only `.env.example` (placeholders) is. (Existing `.gitignore` from the foundation sub-project already excludes `.env`.)

---

## Task 1: Config Additions for Cloudinary and SMTP

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Modify: `tests/jest.setup.ts`
- Modify: `package.json`
- Test: `tests/config/env.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `env.CLOUDINARY_URL: string`, `env.SMTP_HOST: string`, `env.SMTP_PORT: number`, `env.SMTP_USER: string`, `env.SMTP_PASSWORD: string`, `env.SMTP_FROM: string` — consumed by Task 2 (`common/cloudinary.ts`) and Task 3 (`common/smtpEmail.ts`).

- [ ] **Step 1: Install new dependencies**

Run: `npm install multer cloudinary nodemailer`
Run: `npm install --save-dev @types/multer @types/nodemailer`
Expected: `package.json` dependencies/devDependencies updated, `node_modules` populated, no errors.

- [ ] **Step 2: Write the failing test**

Create `tests/config/env.test.ts`:

```ts
describe('env validation', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('parses successfully with all required vars set', () => {
    expect(() => require('../../src/config/env')).not.toThrow();
  });

  it('throws when CLOUDINARY_URL is missing', () => {
    delete process.env.CLOUDINARY_URL;
    expect(() => require('../../src/config/env')).toThrow();
  });

  it('throws when SMTP_HOST is missing', () => {
    delete process.env.SMTP_HOST;
    expect(() => require('../../src/config/env')).toThrow();
  });

  it('coerces SMTP_PORT to a number', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { env } = require('../../src/config/env');
    expect(env.SMTP_PORT).toBe(587);
    expect(typeof env.SMTP_PORT).toBe('number');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/config/env.test.ts`
Expected: FAIL — `CLOUDINARY_URL`/`SMTP_*` aren't in the schema yet, so "throws when missing" tests fail (nothing throws) and `env.SMTP_PORT` is `undefined`.

- [ ] **Step 4: Modify `src/config/env.ts`** — extend the schema and export block

Replace the `envSchema` definition with:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_TTL_DAYS: z.string().default('30'),
  CLOUDINARY_URL: z.string().min(1, 'CLOUDINARY_URL is required'),
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASSWORD: z.string().min(1, 'SMTP_PASSWORD is required'),
  SMTP_FROM: z.string().min(1, 'SMTP_FROM is required'),
});
```

Replace the `export const env` block with:

```ts
export const env = {
  ...parsed.data,
  PORT: Number(parsed.data.PORT),
  REFRESH_TOKEN_TTL_DAYS: Number(parsed.data.REFRESH_TOKEN_TTL_DAYS),
  SMTP_PORT: Number(parsed.data.SMTP_PORT),
};
```

- [ ] **Step 5: Modify `tests/jest.setup.ts`** — add test values for the new vars

Append:

```ts
process.env.CLOUDINARY_URL = 'cloudinary://test_key:test_secret@test_cloud';
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@toolzypro.local';
process.env.SMTP_PASSWORD = 'test-password';
process.env.SMTP_FROM = 'noreply@toolzypro.local';
```

- [ ] **Step 6: Modify `.env.example`** — append the new vars (placeholders only)

Append:

```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@toolzypro.local
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/config/env.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/config/env.ts .env.example tests/jest.setup.ts tests/config/env.test.ts package.json package-lock.json
git commit -m "feat: add Cloudinary and SMTP config validation"
```

---

## Task 2: Cloudinary Upload Wrapper

**Files:**
- Create: `src/common/cloudinary.ts`
- Test: `tests/common/cloudinary.test.ts`

**Interfaces:**
- Consumes: `env.CLOUDINARY_URL` (Task 1).
- Produces: `uploadBuffer(buffer: Buffer, folder: string): Promise<{ secureUrl: string; publicId: string }>` — consumed by the products service starting Task 6.

- [ ] **Step 1: Write the failing test**

Create `tests/common/cloudinary.test.ts`:

```ts
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';
import { uploadBuffer } from '../../src/common/cloudinary';

describe('uploadBuffer', () => {
  it('resolves with secureUrl and publicId on success', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_opts, callback) => {
      callback(null, { secure_url: 'https://res.cloudinary.com/x.png', public_id: 'toolzypro/x' });
      return { end: jest.fn() };
    });

    const result = await uploadBuffer(Buffer.from('test'), 'toolzypro/test');
    expect(result).toEqual({ secureUrl: 'https://res.cloudinary.com/x.png', publicId: 'toolzypro/x' });
  });

  it('rejects on upload error', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_opts, callback) => {
      callback(new Error('upload failed'), null);
      return { end: jest.fn() };
    });

    await expect(uploadBuffer(Buffer.from('test'), 'toolzypro/test')).rejects.toThrow('upload failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common/cloudinary.test.ts`
Expected: FAIL — `Cannot find module '../../src/common/cloudinary'`

- [ ] **Step 3: Create `src/common/cloudinary.ts`**

```ts
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

function configureCloudinary(): void {
  const match = env.CLOUDINARY_URL.match(/^cloudinary:\/\/(.+):(.+)@(.+)$/);
  if (!match) {
    throw new Error('Invalid CLOUDINARY_URL format');
  }
  const [, apiKey, apiSecret, cloudName] = match;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

configureCloudinary();

export interface UploadResult {
  secureUrl: string;
  publicId: string;
}

export function uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error('Cloudinary upload failed'));
        return;
      }
      resolve({ secureUrl: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common/cloudinary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/common/cloudinary.ts tests/common/cloudinary.test.ts
git commit -m "feat: add Cloudinary upload wrapper"
```

---

## Task 3: Real SMTP Email Service

**Files:**
- Create: `src/common/smtpEmail.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `tests/modules/auth.register.test.ts`
- Modify: `tests/modules/auth.password-reset.test.ts`
- Test: `tests/common/smtpEmail.test.ts`

**Interfaces:**
- Consumes: `EmailService` interface (foundation sub-project, `src/common/email.ts`), `env.SMTP_*` (Task 1).
- Produces: `smtpEmailService: EmailService` — replaces `consoleEmailService` as the implementation `auth.service.ts` calls. `consoleEmailService` stays exported (unused fallback), not deleted.

- [ ] **Step 1: Write the failing test**

Create `tests/common/smtpEmail.test.ts`:

```ts
const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

import { smtpEmailService } from '../../src/common/smtpEmail';

describe('smtpEmailService', () => {
  it('sends mail with the expected recipient and content', async () => {
    await smtpEmailService.sendEmail('user@example.com', 'verify-email', { token: 'abc123' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('verify-email'),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common/smtpEmail.test.ts`
Expected: FAIL — `Cannot find module '../../src/common/smtpEmail'`

- [ ] **Step 3: Create `src/common/smtpEmail.ts`**

```ts
import nodemailer from 'nodemailer';
import { EmailService } from './email';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

export const smtpEmailService: EmailService = {
  async sendEmail(to, template, data) {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `ToolzyPro: ${template}`,
      text: JSON.stringify(data),
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common/smtpEmail.test.ts`
Expected: PASS

- [ ] **Step 5: Modify `src/modules/auth/auth.service.ts`** — swap the email service import and both call sites

Replace:

```ts
import { consoleEmailService } from '../../common/email';
```

with:

```ts
import { smtpEmailService } from '../../common/smtpEmail';
```

Replace both occurrences of `consoleEmailService.sendEmail(` with `smtpEmailService.sendEmail(` (one in `register`, one in `forgotPassword`).

- [ ] **Step 6: Modify `tests/modules/auth.register.test.ts`** — mock SMTP so the test never sends real email

Add at the very top of the file, before all other imports:

```ts
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

```

- [ ] **Step 7: Modify `tests/modules/auth.password-reset.test.ts`** — same mock

Add at the very top of the file, before all other imports:

```ts
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

```

- [ ] **Step 8: Run the full auth test suite to verify nothing broke**

Run: `npm test -- tests/modules/auth.register.test.ts tests/modules/auth.password-reset.test.ts tests/common/smtpEmail.test.ts`
Expected: PASS — no real SMTP calls, no hanging network requests

- [ ] **Step 9: Commit**

```bash
git add src/common/smtpEmail.ts src/modules/auth/auth.service.ts tests/modules/auth.register.test.ts tests/modules/auth.password-reset.test.ts tests/common/smtpEmail.test.ts
git commit -m "feat: replace stub email service with real SMTP delivery"
```

---

## Task 4: Product Model

**Files:**
- Create: `src/models/Product.ts`
- Test: `tests/models/product.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Product` model + `ProductDocument` (`name`, `slug` unique, `type`, `description`, `basePrice`, `currency`, `currentVersion`, `changelogJson`, `status`, `thumbnailUrl`, `thumbnailPublicId`, `syncMode`) and `ProductType`/`ProductStatus`/`ProductSyncMode` type exports — consumed by every task from Task 6 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/models/product.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Product } from '../../src/models/Product';

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

describe('Product model', () => {
  it('creates a product with defaults', async () => {
    const product = await Product.create({
      name: 'Super Tool',
      slug: 'super-tool',
      type: 'software',
      basePrice: 999,
    });
    expect(product.status).toBe('draft');
    expect(product.currency).toBe('INR');
    expect(product.syncMode).toBe('optional');
    expect(product.currentVersion).toBeNull();
  });

  it('rejects a duplicate slug', async () => {
    await Product.create({ name: 'A', slug: 'dup', type: 'software', basePrice: 1 });
    await expect(
      Product.create({ name: 'B', slug: 'dup', type: 'theme', basePrice: 2 })
    ).rejects.toThrow();
  });

  it('rejects an invalid type', async () => {
    await expect(
      Product.create({ name: 'A', slug: 'a', type: 'not-a-type', basePrice: 1 })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/product.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/Product'`

- [ ] **Step 3: Create `src/models/Product.ts`**

```ts
import { Schema, model, Document } from 'mongoose';

export type ProductType =
  | 'software'
  | 'ai_tool'
  | 'theme'
  | 'plugin'
  | 'script'
  | 'template'
  | 'landing_page'
  | 'bundle'
  | 'course'
  | 'digital_download'
  | 'subscription';

export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductSyncMode = 'global' | 'optional' | 'private' | 'exclusive';

export interface ProductDocument extends Document {
  name: string;
  slug: string;
  type: ProductType;
  description: string;
  basePrice: number;
  currency: string;
  currentVersion: string | null;
  changelogJson: Record<string, unknown> | null;
  status: ProductStatus;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;
  syncMode: ProductSyncMode;
  createdAt: Date;
  updatedAt: Date;
}

const PRODUCT_TYPES: ProductType[] = [
  'software',
  'ai_tool',
  'theme',
  'plugin',
  'script',
  'template',
  'landing_page',
  'bundle',
  'course',
  'digital_download',
  'subscription',
];

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: PRODUCT_TYPES, required: true },
    description: { type: String, default: '' },
    basePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    currentVersion: { type: String, default: null },
    changelogJson: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    thumbnailUrl: { type: String, default: null },
    thumbnailPublicId: { type: String, default: null },
    syncMode: { type: String, enum: ['global', 'optional', 'private', 'exclusive'], default: 'optional' },
  },
  { timestamps: true }
);

export const Product = model<ProductDocument>('Product', productSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/product.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/Product.ts tests/models/product.test.ts
git commit -m "feat: add Product model"
```

---

## Task 5: ProductVersion Model

**Files:**
- Create: `src/models/ProductVersion.ts`
- Test: `tests/models/productVersion.test.ts`

**Interfaces:**
- Consumes: `Product` model (Task 4).
- Produces: `ProductVersion` model + `ProductVersionDocument` (`productId`, `version`, `changelog`, `fileUrl`, `filePublicId`) — consumed by Task 10.

- [ ] **Step 1: Write the failing test**

Create `tests/models/productVersion.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Product } from '../../src/models/Product';
import { ProductVersion } from '../../src/models/ProductVersion';

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

describe('ProductVersion model', () => {
  it('creates a version linked to a product', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 1 });
    const version = await ProductVersion.create({
      productId: product._id,
      version: '1.0.0',
      changelog: 'Initial release',
    });
    expect(version.productId.toString()).toBe(product._id.toString());
    expect(version.fileUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/productVersion.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/ProductVersion'`

- [ ] **Step 3: Create `src/models/ProductVersion.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface ProductVersionDocument extends Document {
  productId: Types.ObjectId;
  version: string;
  changelog: string;
  fileUrl: string | null;
  filePublicId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const productVersionSchema = new Schema<ProductVersionDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    version: { type: String, required: true },
    changelog: { type: String, default: '' },
    fileUrl: { type: String, default: null },
    filePublicId: { type: String, default: null },
  },
  { timestamps: true }
);

export const ProductVersion = model<ProductVersionDocument>('ProductVersion', productVersionSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/productVersion.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/ProductVersion.ts tests/models/productVersion.test.ts
git commit -m "feat: add ProductVersion model"
```

---

## Task 6: Products Module — List & Create

**Files:**
- Create: `src/middleware/upload.middleware.ts`
- Modify: `src/middleware/validate.middleware.ts` (add `validateQuery`)
- Create: `src/modules/products/products.validators.ts`
- Create: `src/modules/products/products.service.ts`
- Create: `src/modules/products/products.controller.ts`
- Create: `src/modules/products/products.routes.ts`
- Test: `tests/modules/products.list-create.test.ts`

**Interfaces:**
- Consumes: `Product` model (Task 4), `uploadBuffer` (Task 2), `requireAuth`/`requireRole` (foundation), `validateBody` (foundation), `NotFoundError`/`ConflictError` (foundation).
- Produces: `validateQuery(schema): RequestHandler` from `validate.middleware.ts`. `upload: multer.Multer` from `upload.middleware.ts`. All Zod schemas needed by every subsequent products task are defined in `products.validators.ts` now (`createProductSchema`, `updateProductSchema`, `addVersionSchema`, `syncModeSchema`, `listProductsQuerySchema`, `PRODUCT_TYPES`). `listProducts(query: {page: number; limit: number; type?: string; status?: string; search?: string}): Promise<{items: ProductDocument[]; total: number; page: number; limit: number}>` and `createProduct(input: {name: string; type: string; description?: string; basePrice: number; currency?: string}, thumbnailFile?: Express.Multer.File): Promise<ProductDocument>` from `products.service.ts`. `productsRouter: Router` — mounted at `/api/v1/admin/products` in Task 12.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.list-create.test.ts`:

```ts
jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock.png',
    publicId: 'toolzypro/mock',
  }),
}));

import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — list & create', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a product in draft status with a generated slug', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Super Tool', type: 'software', basePrice: 999 });
    expect(res.status).toBe(201);
    expect(res.body.product.slug).toBe('super-tool');
    expect(res.body.product.status).toBe('draft');
  });

  it('generates a unique slug on name collision', async () => {
    await Product.create({ name: 'Super Tool', slug: 'super-tool', type: 'software', basePrice: 1 });
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Super Tool', type: 'software', basePrice: 999 });
    expect(res.status).toBe(201);
    expect(res.body.product.slug).toBe('super-tool-2');
  });

  it('lists products with pagination and filters', async () => {
    await Product.create({ name: 'Alpha', slug: 'alpha', type: 'software', basePrice: 10, status: 'draft' });
    await Product.create({ name: 'Beta', slug: 'beta', type: 'theme', basePrice: 20, status: 'published' });

    const res = await request(app)
      .get('/api/v1/admin/products?type=theme')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Beta');
    expect(res.body.total).toBe(1);
  });

  it('400s on an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: '', type: 'not-a-real-type', basePrice: -5 });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.list-create.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/middleware/upload.middleware.ts`**

```ts
import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
```

- [ ] **Step 4: Modify `src/middleware/validate.middleware.ts`** — add `validateQuery`

Append to the file:

```ts
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.flatten().fieldErrors));
      return;
    }
    req.query = result.data as unknown as typeof req.query;
    next();
  };
}
```

- [ ] **Step 5: Create `src/modules/products/products.validators.ts`**

```ts
import { z } from 'zod';

export const PRODUCT_TYPES = [
  'software',
  'ai_tool',
  'theme',
  'plugin',
  'script',
  'template',
  'landing_page',
  'bundle',
  'course',
  'digital_download',
  'subscription',
] as const;

export const createProductSchema = z.object({
  name: z.string().min(1),
  type: z.enum(PRODUCT_TYPES),
  description: z.string().optional().default(''),
  basePrice: z.coerce.number().min(0),
  currency: z.string().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
});

export const addVersionSchema = z.object({
  version: z.string().min(1),
  changelog: z.string().optional().default(''),
});

export const syncModeSchema = z.object({
  syncMode: z.enum(['global', 'optional', 'private', 'exclusive']),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(PRODUCT_TYPES).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().optional(),
});
```

- [ ] **Step 6: Create `src/modules/products/products.service.ts`**

```ts
import { Product, ProductDocument } from '../../models/Product';
import { uploadBuffer } from '../../common/cloudinary';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export interface ListProductsQuery {
  page: number;
  limit: number;
  type?: string;
  status?: string;
  search?: string;
}

export interface ListProductsResult {
  items: ProductDocument[];
  total: number;
  page: number;
  limit: number;
}

export async function listProducts(query: ListProductsQuery): Promise<ListProductsResult> {
  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .sort({ createdAt: -1 }),
    Product.countDocuments(filter),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function createProduct(
  input: { name: string; type: string; description?: string; basePrice: number; currency?: string },
  thumbnailFile?: Express.Multer.File
): Promise<ProductDocument> {
  const slug = await generateUniqueSlug(input.name);
  let thumbnailUrl: string | null = null;
  let thumbnailPublicId: string | null = null;
  if (thumbnailFile) {
    const uploaded = await uploadBuffer(thumbnailFile.buffer, 'toolzypro/product-thumbnails');
    thumbnailUrl = uploaded.secureUrl;
    thumbnailPublicId = uploaded.publicId;
  }
  return Product.create({
    name: input.name,
    slug,
    type: input.type,
    description: input.description ?? '',
    basePrice: input.basePrice,
    currency: input.currency ?? 'INR',
    thumbnailUrl,
    thumbnailPublicId,
  });
}
```

- [ ] **Step 7: Create `src/modules/products/products.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service';

export async function listProductsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productsService.listProducts(
      req.query as unknown as productsService.ListProductsQuery
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.createProduct(req.body, req.file);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 8: Create `src/modules/products/products.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { upload } from '../../middleware/upload.middleware';
import { createProductSchema, listProductsQuerySchema } from './products.validators';
import { listProductsHandler, createProductHandler } from './products.controller';

export const productsRouter = Router();

productsRouter.use(requireAuth, requireRole('master_admin'));

productsRouter.get('/', validateQuery(listProductsQuerySchema), listProductsHandler);
productsRouter.post('/', upload.single('thumbnail'), validateBody(createProductSchema), createProductHandler);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- tests/modules/products.list-create.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/middleware/upload.middleware.ts src/middleware/validate.middleware.ts src/modules/products tests/modules/products.list-create.test.ts
git commit -m "feat: add products module with list and create endpoints"
```

---

## Task 7: Products Module — Get by ID & Update

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `getProductById`, `updateProduct`)
- Modify: `src/modules/products/products.controller.ts` (add `getProductHandler`, `updateProductHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `GET /:id`, `PATCH /:id`)
- Test: `tests/modules/products.detail-update.test.ts`

**Interfaces:**
- Consumes: `NotFoundError` (foundation), `updateProductSchema` (Task 6).
- Produces: `getProductById(id: string): Promise<ProductDocument>` (also used internally by Tasks 8–10), `updateProduct(id: string, input: {name?: string; description?: string; basePrice?: number; currency?: string}, thumbnailFile?: Express.Multer.File): Promise<ProductDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.detail-update.test.ts`:

```ts
jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock2.png',
    publicId: 'toolzypro/mock2',
  }),
}));

import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — get & update', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('404s for an unknown product id', async () => {
    const res = await request(app)
      .get('/api/v1/admin/products/64b000000000000000000000')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(404);
  });

  it('fetches and updates a product', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });

    const getRes = await request(app)
      .get(`/api/v1/admin/products/${product._id}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.product.name).toBe('A');

    const updateRes = await request(app)
      .patch(`/api/v1/admin/products/${product._id}`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ basePrice: 25 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.product.basePrice).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.detail-update.test.ts`
Expected: FAIL — no `GET /:id` or `PATCH /:id` routes yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — add an import and append the two functions

Add to the import block:

```ts
import { NotFoundError } from '../../common/errors';
```

Append:

```ts
export async function getProductById(id: string): Promise<ProductDocument> {
  const product = await Product.findById(id);
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function updateProduct(
  id: string,
  input: { name?: string; description?: string; basePrice?: number; currency?: string },
  thumbnailFile?: Express.Multer.File
): Promise<ProductDocument> {
  const product = await getProductById(id);
  if (input.name !== undefined) product.name = input.name;
  if (input.description !== undefined) product.description = input.description;
  if (input.basePrice !== undefined) product.basePrice = input.basePrice;
  if (input.currency !== undefined) product.currency = input.currency;
  if (thumbnailFile) {
    const uploaded = await uploadBuffer(thumbnailFile.buffer, 'toolzypro/product-thumbnails');
    product.thumbnailUrl = uploaded.secureUrl;
    product.thumbnailPublicId = uploaded.publicId;
  }
  await product.save();
  return product;
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handlers

```ts
export async function getProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.getProductById(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function updateProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.updateProduct(req.params.id, req.body, req.file);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add routes and import

Add to the imports:

```ts
import { updateProductSchema } from './products.validators';
import { getProductHandler, updateProductHandler } from './products.controller';
```

Add routes:

```ts
productsRouter.get('/:id', getProductHandler);
productsRouter.patch('/:id', upload.single('thumbnail'), validateBody(updateProductSchema), updateProductHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.detail-update.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.detail-update.test.ts
git commit -m "feat: add product get-by-id and update endpoints"
```

---

## Task 8: Products Module — Archive

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `archiveProduct`)
- Modify: `src/modules/products/products.controller.ts` (add `archiveProductHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `DELETE /:id`)
- Test: `tests/modules/products.archive.test.ts`

**Interfaces:**
- Consumes: `getProductById` (Task 7).
- Produces: `archiveProduct(id: string): Promise<ProductDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.archive.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — archive', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('soft-archives a product instead of deleting it', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });

    const res = await request(app)
      .delete(`/api/v1/admin/products/${product._id}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.product.status).toBe('archived');

    const stillExists = await Product.findById(product._id);
    expect(stillExists).not.toBeNull();
    expect(stillExists!.status).toBe('archived');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.archive.test.ts`
Expected: FAIL — no `DELETE /:id` route yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — append `archiveProduct`

```ts
export async function archiveProduct(id: string): Promise<ProductDocument> {
  const product = await getProductById(id);
  product.status = 'archived';
  await product.save();
  return product;
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handler

```ts
export async function archiveProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.archiveProduct(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add route and import

Add to the imports:

```ts
import { archiveProductHandler } from './products.controller';
```

Add route:

```ts
productsRouter.delete('/:id', archiveProductHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.archive.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.archive.test.ts
git commit -m "feat: add product archive endpoint"
```

---

## Task 9: Products Module — Publish

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `publishProduct`)
- Modify: `src/modules/products/products.controller.ts` (add `publishProductHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `POST /:id/publish`)
- Test: `tests/modules/products.publish.test.ts`

**Interfaces:**
- Consumes: `getProductById` (Task 7), `ConflictError` (foundation).
- Produces: `publishProduct(id: string): Promise<ProductDocument>` — 409s via `ConflictError` if `currentVersion` is null.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.publish.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — publish', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('409s when publishing a product with no version', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(409);
  });

  it('publishes a product that has a version', async () => {
    const product = await Product.create({
      name: 'A',
      slug: 'a',
      type: 'software',
      basePrice: 10,
      currentVersion: '1.0.0',
    });
    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.product.status).toBe('published');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.publish.test.ts`
Expected: FAIL — no `POST /:id/publish` route yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — add an import and append `publishProduct`

Add to the import block:

```ts
import { NotFoundError, ConflictError } from '../../common/errors';
```

(replacing the earlier single-item import of `NotFoundError` from Task 7).

Append:

```ts
export async function publishProduct(id: string): Promise<ProductDocument> {
  const product = await getProductById(id);
  if (!product.currentVersion) {
    throw new ConflictError('Cannot publish a product with no version');
  }
  product.status = 'published';
  await product.save();
  return product;
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handler

```ts
export async function publishProductHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.publishProduct(req.params.id);
    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add route and import

Add to the imports:

```ts
import { publishProductHandler } from './products.controller';
```

Add route:

```ts
productsRouter.post('/:id/publish', publishProductHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.publish.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.publish.test.ts
git commit -m "feat: add product publish endpoint"
```

---

## Task 10: Products Module — Versions

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `addVersion`, `listVersions`)
- Modify: `src/modules/products/products.controller.ts` (add `addVersionHandler`, `listVersionsHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `POST /:id/versions`, `GET /:id/versions`)
- Test: `tests/modules/products.versions.test.ts`

**Interfaces:**
- Consumes: `ProductVersion` model (Task 5), `getProductById` (Task 7), `uploadBuffer` (Task 2), `addVersionSchema` (Task 6).
- Produces: `addVersion(productId: string, input: {version: string; changelog?: string}, file?: Express.Multer.File): Promise<ProductVersionDocument>`, `listVersions(productId: string): Promise<ProductVersionDocument[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.versions.test.ts`:

```ts
jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mockfile.zip',
    publicId: 'toolzypro/mockfile',
  }),
}));

import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — versions', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('adds a version and updates the product currentVersion/changelogJson', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });

    const res = await request(app)
      .post(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'Initial release' });
    expect(res.status).toBe(201);

    const updated = await Product.findById(product._id);
    expect(updated!.currentVersion).toBe('1.0.0');
    expect(updated!.changelogJson).toEqual({ version: '1.0.0', changelog: 'Initial release' });
  });

  it('lists versions newest first', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    await request(app)
      .post(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'First' });
    await request(app)
      .post(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.1.0', changelog: 'Second' });

    const res = await request(app)
      .get(`/api/v1/admin/products/${product._id}/versions`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].version).toBe('1.1.0');
  });

  it('404s when adding a version to an unknown product', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products/64b000000000000000000000/versions')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.versions.test.ts`
Expected: FAIL — no versions routes yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — add an import and append the two functions

Add to the import block:

```ts
import { ProductVersion, ProductVersionDocument } from '../../models/ProductVersion';
```

Append:

```ts
export async function addVersion(
  productId: string,
  input: { version: string; changelog?: string },
  file?: Express.Multer.File
): Promise<ProductVersionDocument> {
  const product = await getProductById(productId);
  let fileUrl: string | null = null;
  let filePublicId: string | null = null;
  if (file) {
    const uploaded = await uploadBuffer(file.buffer, 'toolzypro/product-files');
    fileUrl = uploaded.secureUrl;
    filePublicId = uploaded.publicId;
  }
  const version = await ProductVersion.create({
    productId: product._id,
    version: input.version,
    changelog: input.changelog ?? '',
    fileUrl,
    filePublicId,
  });
  product.currentVersion = input.version;
  product.changelogJson = { version: input.version, changelog: input.changelog ?? '' };
  await product.save();
  return version;
}

export async function listVersions(productId: string): Promise<ProductVersionDocument[]> {
  await getProductById(productId);
  return ProductVersion.find({ productId }).sort({ createdAt: -1 });
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handlers

```ts
export async function addVersionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const version = await productsService.addVersion(req.params.id, req.body, req.file);
    res.status(201).json({ version });
  } catch (err) {
    next(err);
  }
}

export async function listVersionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const versions = await productsService.listVersions(req.params.id);
    res.status(200).json({ versions });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add routes and imports

Add to the imports:

```ts
import { addVersionSchema } from './products.validators';
import { addVersionHandler, listVersionsHandler } from './products.controller';
```

Add routes:

```ts
productsRouter.post(
  '/:id/versions',
  upload.single('file'),
  validateBody(addVersionSchema),
  addVersionHandler
);
productsRouter.get('/:id/versions', listVersionsHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.versions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.versions.test.ts
git commit -m "feat: add product version add/list endpoints"
```

---

## Task 11: Products Module — Sync Mode

**Files:**
- Modify: `src/modules/products/products.service.ts` (add `updateSyncMode`)
- Modify: `src/modules/products/products.controller.ts` (add `updateSyncModeHandler`)
- Modify: `src/modules/products/products.routes.ts` (add `PATCH /:id/sync-mode`)
- Test: `tests/modules/products.sync-mode.test.ts`

**Interfaces:**
- Consumes: `getProductById` (Task 7), `syncModeSchema` (Task 6).
- Produces: `updateSyncMode(id: string, syncMode: string): Promise<ProductDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products.sync-mode.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { productsRouter } from '../../src/modules/products/products.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Product } from '../../src/models/Product';

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

describe('products module — sync-mode', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });

  it('updates the sync mode', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'exclusive' });
    expect(res.status).toBe(200);
    expect(res.body.product.syncMode).toBe('exclusive');
  });

  it('400s on an invalid sync mode', async () => {
    const product = await Product.create({ name: 'A', slug: 'a', type: 'software', basePrice: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'not-a-mode' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/products.sync-mode.test.ts`
Expected: FAIL — no `PATCH /:id/sync-mode` route yet

- [ ] **Step 3: Modify `src/modules/products/products.service.ts`** — append `updateSyncMode`

```ts
export async function updateSyncMode(id: string, syncMode: ProductDocument['syncMode']): Promise<ProductDocument> {
  const product = await getProductById(id);
  product.syncMode = syncMode;
  await product.save();
  return product;
}
```

- [ ] **Step 4: Modify `src/modules/products/products.controller.ts`** — append handler

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

- [ ] **Step 5: Modify `src/modules/products/products.routes.ts`** — add route and imports

Add to the imports:

```ts
import { syncModeSchema } from './products.validators';
import { updateSyncModeHandler } from './products.controller';
```

Add route:

```ts
productsRouter.patch(
  '/:id/sync-mode',
  validateBody(syncModeSchema),
  updateSyncModeHandler
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/products.sync-mode.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/products tests/modules/products.sync-mode.test.ts
git commit -m "feat: add product sync-mode endpoint"
```

---

## Task 12: Wire Products Router into the App & Full Lifecycle Integration Test

**Files:**
- Modify: `src/app.ts` (mount `productsRouter`)
- Test: `tests/integration/product-lifecycle.test.ts`

**Interfaces:**
- Consumes: `productsRouter` (Task 6), `createApp` (foundation).
- Produces: nothing new — this task proves the whole products module works end-to-end inside the fully wired app.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/product-lifecycle.test.ts`:

```ts
jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock.png',
    publicId: 'toolzypro/mock',
  }),
}));

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

describe('full product lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('create -> add version -> publish -> archive', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Lifecycle Tool', type: 'software', basePrice: 499 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.product.status).toBe('draft');

    const productId = createRes.body.product._id;

    const publishBeforeVersion = await request(app)
      .post(`/api/v1/admin/products/${productId}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(publishBeforeVersion.status).toBe(409);

    const versionRes = await request(app)
      .post(`/api/v1/admin/products/${productId}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'Initial release' });
    expect(versionRes.status).toBe(201);

    const publishRes = await request(app)
      .post(`/api/v1/admin/products/${productId}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.product.status).toBe('published');

    const archiveRes = await request(app)
      .delete(`/api/v1/admin/products/${productId}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.product.status).toBe('archived');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/product-lifecycle.test.ts`
Expected: FAIL — `createApp()` doesn't mount `productsRouter` yet, so every request 404s

- [ ] **Step 3: Modify `src/app.ts`** — mount the products router

Add to the imports:

```ts
import { productsRouter } from './modules/products/products.routes';
```

Add alongside the other `app.use('/api/v1/...')` lines:

```ts
app.use('/api/v1/admin/products', productsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/product-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.ts tests/integration/product-lifecycle.test.ts
git commit -m "feat: wire products router into the app"
```

---

## Post-plan verification

Run the entire suite once more and confirm a clean build:

```bash
npm test
npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project (per the PRD decomposition) should cover Reseller Onboarding and/or the Reseller Catalog (`reseller_products` + sync propagation) — to be brainstormed separately.
