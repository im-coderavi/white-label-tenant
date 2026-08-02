# Checkout & Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build customer checkout (single-product + lifetime-subscription) behind a swappable `PaymentGateway` interface (mock now), a webhook that marks orders paid and auto-assigns a license, order history, and DB-tracked signed download tokens.

**Architecture:** Same layered pattern as prior sub-projects. One new module, `checkout`, with its own service/controller/routes. The payment gateway is a small interface + mock implementation, mirroring the existing `EmailService`/`consoleEmailService` → `smtpEmailService` swap pattern.

**Tech Stack:** Express, TypeScript, Mongoose, Zod, Jest + supertest + `mongodb-memory-server` — no new dependencies (webhook signature verification uses Node's built-in `crypto`).

## Global Constraints

- `PaymentGateway` is an interface; only `mockPaymentGateway` is implemented this round — no real Razorpay SDK calls. (Spec §1, §3)
- No Invoice model/endpoint, no separate Subscription/Plan model — `orderType` on `Order` is derived from the product's `type`. (Spec §1, §2)
- The webhook route has **no** `requireAuth`/`requireRole` — authenticity comes from HMAC signature verification over the raw request body, not a JWT. (Spec §4)
- Auto-assignment on payment success is best-effort: if no `available` license exists for the product, the order still becomes `paid` with `licenseId: null` — no retry/queue is built. (Spec §5)
- Download tokens expire 15 minutes after issuance and are tracked in our own `DownloadToken` collection, not via Cloudinary signed URLs. (Spec §1, §2)

---

## Task 1: Config Addition — `MOCK_WEBHOOK_SECRET`

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Modify: `tests/jest.setup.ts`
- Modify: `tests/config/env.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `env.MOCK_WEBHOOK_SECRET: string` — consumed by Task 2's `mockPaymentGateway`.

- [ ] **Step 1: Write the failing test**

Append to `tests/config/env.test.ts` (inside the existing `describe('env validation', ...)` block):

```ts
  it('throws when MOCK_WEBHOOK_SECRET is missing', () => {
    delete process.env.MOCK_WEBHOOK_SECRET;
    expect(() => require('../../src/config/env')).toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/env.test.ts`
Expected: FAIL — `MOCK_WEBHOOK_SECRET` isn't in the schema yet, so nothing throws

- [ ] **Step 3: Modify `src/config/env.ts`** — add the field to the schema

Add to the `envSchema` object (after `SMTP_FROM`):

```ts
  SMTP_FROM: z.string().min(1, 'SMTP_FROM is required'),
  MOCK_WEBHOOK_SECRET: z.string().min(1, 'MOCK_WEBHOOK_SECRET is required'),
```

(Replace the existing `SMTP_FROM` line with both lines — no other changes to the schema.)

- [ ] **Step 4: Modify `tests/jest.setup.ts`** — add a test value

Append:

```ts
process.env.MOCK_WEBHOOK_SECRET = 'test-webhook-secret-please-ignore';
```

- [ ] **Step 5: Modify `.env.example`** — append the new var

Append:

```
MOCK_WEBHOOK_SECRET=replace-with-a-random-secret
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/config/env.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/config/env.ts .env.example tests/jest.setup.ts tests/config/env.test.ts
git commit -m "feat: add MOCK_WEBHOOK_SECRET config for the payment gateway stub"
```

---

## Task 2: Payment Gateway Abstraction

**Files:**
- Create: `src/common/paymentGateway.ts`
- Test: `tests/common/paymentGateway.test.ts`

**Interfaces:**
- Consumes: `env.MOCK_WEBHOOK_SECRET` (Task 1).
- Produces: `PaymentGateway` interface and `mockPaymentGateway: PaymentGateway` — consumed by the checkout service starting Task 5.

- [ ] **Step 1: Write the failing test**

Create `tests/common/paymentGateway.test.ts`:

```ts
import crypto from 'crypto';
import { mockPaymentGateway } from '../../src/common/paymentGateway';

describe('mockPaymentGateway', () => {
  it('creates an order with a mock_order_ prefixed id', async () => {
    const { gatewayOrderId } = await mockPaymentGateway.createOrder({
      amount: 100,
      currency: 'INR',
      receipt: 'order-1',
    });
    expect(gatewayOrderId).toMatch(/^mock_order_[a-f0-9]+$/);
  });

  it('returns null for an invalid signature', () => {
    const rawBody = JSON.stringify({ gatewayOrderId: 'mock_order_abc', success: true });
    const result = mockPaymentGateway.verifyAndParseWebhook(rawBody, 'not-the-real-signature');
    expect(result).toBeNull();
  });

  it('parses the payload for a valid signature', () => {
    const rawBody = JSON.stringify({ gatewayOrderId: 'mock_order_abc', success: true });
    const signature = crypto
      .createHmac('sha256', 'test-webhook-secret-please-ignore')
      .update(rawBody)
      .digest('hex');
    const result = mockPaymentGateway.verifyAndParseWebhook(rawBody, signature);
    expect(result).toEqual({ gatewayOrderId: 'mock_order_abc', success: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common/paymentGateway.test.ts`
Expected: FAIL — `Cannot find module '../../src/common/paymentGateway'`

- [ ] **Step 3: Create `src/common/paymentGateway.ts`**

```ts
import crypto from 'crypto';
import { env } from '../config/env';

export interface PaymentGateway {
  createOrder(input: { amount: number; currency: string; receipt: string }): Promise<{ gatewayOrderId: string }>;
  verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): { gatewayOrderId: string; success: boolean } | null;
}

export const mockPaymentGateway: PaymentGateway = {
  async createOrder() {
    const gatewayOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
    return { gatewayOrderId };
  },

  verifyAndParseWebhook(rawBody, signature) {
    const expected = crypto.createHmac('sha256', env.MOCK_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (expected !== signature) {
      return null;
    }
    return JSON.parse(rawBody) as { gatewayOrderId: string; success: boolean };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common/paymentGateway.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/common/paymentGateway.ts tests/common/paymentGateway.test.ts
git commit -m "feat: add swappable payment gateway abstraction with mock implementation"
```

---

## Task 3: Order Model

**Files:**
- Create: `src/models/Order.ts`
- Test: `tests/models/order.test.ts`

**Interfaces:**
- Consumes: `Tenant`, `User`, `Product`, `License` models (prior sub-projects).
- Produces: `Order` model + `OrderDocument` (`tenantId`, `customerUserId`, `productId`, `orderType`, `amount`, `currency`, `status`, `paymentGateway`, `paymentRef`, `licenseId`) — consumed by every task from Task 5 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/models/order.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';

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

describe('Order model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });

    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });
    expect(order.status).toBe('pending');
    expect(order.currency).toBe('INR');
    expect(order.paymentRef).toBeNull();
    expect(order.licenseId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/order.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/Order'`

- [ ] **Step 3: Create `src/models/Order.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export type OrderType = 'single_product' | 'subscription';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';

export interface OrderDocument extends Document {
  tenantId: Types.ObjectId;
  customerUserId: Types.ObjectId;
  productId: Types.ObjectId;
  orderType: OrderType;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentGateway: string;
  paymentRef: string | null;
  licenseId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderType: { type: String, enum: ['single_product', 'subscription'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
      default: 'pending',
    },
    paymentGateway: { type: String, default: 'mock' },
    paymentRef: { type: String, default: null },
    licenseId: { type: Schema.Types.ObjectId, ref: 'License', default: null },
  },
  { timestamps: true }
);

export const Order = model<OrderDocument>('Order', orderSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/order.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/Order.ts tests/models/order.test.ts
git commit -m "feat: add Order model"
```

---

## Task 4: DownloadToken Model

**Files:**
- Create: `src/models/DownloadToken.ts`
- Test: `tests/models/downloadToken.test.ts`

**Interfaces:**
- Consumes: `Order` model (Task 3).
- Produces: `DownloadToken` model + `DownloadTokenDocument` (`orderId`, `fileUrl`, `expiresAt`, `used`, `ipAddress`) — consumed by Task 8.

- [ ] **Step 1: Write the failing test**

Create `tests/models/downloadToken.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { DownloadToken } from '../../src/models/DownloadToken';

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

describe('DownloadToken model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });

    const token = await DownloadToken.create({
      orderId: order._id,
      fileUrl: 'https://res.cloudinary.com/x.zip',
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(token.used).toBe(false);
    expect(token.ipAddress).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/downloadToken.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/DownloadToken'`

- [ ] **Step 3: Create `src/models/DownloadToken.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface DownloadTokenDocument extends Document {
  orderId: Types.ObjectId;
  fileUrl: string;
  expiresAt: Date;
  used: boolean;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const downloadTokenSchema = new Schema<DownloadTokenDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    fileUrl: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

export const DownloadToken = model<DownloadTokenDocument>('DownloadToken', downloadTokenSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/downloadToken.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/DownloadToken.ts tests/models/downloadToken.test.ts
git commit -m "feat: add DownloadToken model"
```

---

## Task 5: Checkout Module — Create Checkout

**Files:**
- Create: `src/modules/checkout/checkout.validators.ts`
- Create: `src/modules/checkout/checkout.service.ts`
- Create: `src/modules/checkout/checkout.controller.ts`
- Create: `src/modules/checkout/checkout.routes.ts`
- Test: `tests/modules/checkout.create.test.ts`

**Interfaces:**
- Consumes: `Order` model (Task 3), `mockPaymentGateway` (Task 2), `Product`/`ResellerProduct` models (prior sub-projects), `requireAuth`/`requireRole`/`validateBody` (foundation).
- Produces: `createCheckoutSchema`, `webhookPayloadSchema` (Zod schemas defined now for all subsequent checkout tasks). `createCheckout(input: {productId: string; tenantId: string; customerUserId: string}): Promise<{orderId: string; gatewayOrderId: string; amount: number; currency: string}>` from `checkout.service.ts`. `checkoutRouter: Router` — mounted at `/api/v1/customer` in Task 9. Note: unlike other modules, auth/role middleware is applied **per-route** here (not router-level), because the webhook route added in Task 6 must stay unauthenticated.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/checkout.create.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer', checkoutRouter);
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

describe('checkout module — create checkout', () => {
  const app = buildTestApp();

  it('creates a pending order with a gateway reference', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout' });
    const product = await Product.create({
      name: 'P',
      slug: 'p',
      type: 'software',
      basePrice: 500,
      status: 'published',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(500);
    expect(res.body.gatewayOrderId).toMatch(/^mock_order_/);
  });

  it('403s if the product is not entitled to the tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout-2' });
    const product = await Product.create({
      name: 'P',
      slug: 'p2',
      type: 'software',
      basePrice: 500,
      status: 'published',
    });
    // No ResellerProduct entitlement created.

    const token = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(403);
  });

  it('404s for an unpublished product', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-checkout-3' });
    const product = await Product.create({
      name: 'P',
      slug: 'p3',
      type: 'software',
      basePrice: 500,
      status: 'draft',
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: product._id, enabled: true });

    const token = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/checkout.create.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/checkout/checkout.validators.ts`**

```ts
import { z } from 'zod';

export const createCheckoutSchema = z.object({
  productId: z.string().min(1),
});

export const webhookPayloadSchema = z.object({
  gatewayOrderId: z.string().min(1),
  success: z.boolean(),
});
```

- [ ] **Step 4: Create `src/modules/checkout/checkout.service.ts`**

```ts
import { Order, OrderDocument } from '../../models/Order';
import { Product } from '../../models/Product';
import { ResellerProduct } from '../../models/ResellerProduct';
import { ForbiddenError, NotFoundError } from '../../common/errors';
import { mockPaymentGateway } from '../../common/paymentGateway';

export interface CreateCheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export async function createCheckout(input: {
  productId: string;
  tenantId: string;
  customerUserId: string;
}): Promise<CreateCheckoutResult> {
  const product = await Product.findById(input.productId);
  if (!product || product.status !== 'published') {
    throw new NotFoundError('Product not found');
  }
  const entitlement = await ResellerProduct.findOne({
    tenantId: input.tenantId,
    productId: product._id,
    enabled: true,
  });
  if (!entitlement) {
    throw new ForbiddenError('Product not available to your store');
  }

  const orderType = product.type === 'subscription' ? 'subscription' : 'single_product';
  const amount = entitlement.customPrice ?? product.basePrice;

  const order = await Order.create({
    tenantId: input.tenantId,
    customerUserId: input.customerUserId,
    productId: product._id,
    orderType,
    amount,
    currency: product.currency,
    status: 'pending',
    paymentGateway: 'mock',
  });

  const { gatewayOrderId } = await mockPaymentGateway.createOrder({
    amount,
    currency: product.currency,
    receipt: order._id.toString(),
  });
  order.paymentRef = gatewayOrderId;
  await order.save();

  return {
    orderId: (order._id as OrderDocument['_id']).toString(),
    gatewayOrderId,
    amount,
    currency: product.currency,
  };
}
```

- [ ] **Step 5: Create `src/modules/checkout/checkout.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as checkoutService from './checkout.service';

export async function createCheckoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await checkoutService.createCheckout({
      productId: req.body.productId,
      tenantId: req.tenantId!,
      customerUserId: req.user!.id,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Create `src/modules/checkout/checkout.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createCheckoutSchema } from './checkout.validators';
import { createCheckoutHandler } from './checkout.controller';

export const checkoutRouter = Router();

checkoutRouter.post(
  '/checkout',
  requireAuth,
  requireRole('customer'),
  validateBody(createCheckoutSchema),
  createCheckoutHandler
);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/checkout.create.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/checkout tests/modules/checkout.create.test.ts
git commit -m "feat: add checkout module with order creation"
```

---

## Task 6: Checkout Module — Webhook

**Files:**
- Modify: `src/middleware/auth.middleware.ts` (extend the global `Request` augmentation with `rawBody`)
- Modify: `src/modules/checkout/checkout.service.ts` (add `processWebhook`)
- Modify: `src/modules/checkout/checkout.controller.ts` (add `webhookHandler`)
- Modify: `src/modules/checkout/checkout.routes.ts` (add `POST /checkout/webhook`, unauthenticated)
- Test: `tests/modules/checkout.webhook.test.ts`

**Interfaces:**
- Consumes: `mockPaymentGateway.verifyAndParseWebhook` (Task 2), `License` model (Licensing Engine sub-project), `smtpEmailService` (foundation), `req.rawBody` (populated by Task 9's `express.json` `verify` hook — not present when this task's own test builds a minimal app, so the test sets it directly via a tiny middleware).
- Produces: `processWebhook(gatewayOrderId: string, success: boolean): Promise<OrderDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/checkout.webhook.test.ts`:

```ts
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose from 'mongoose';
import express, { Request } from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { License } from '../../src/models/License';

function buildTestApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );
  app.use('/api/v1/customer', checkoutRouter);
  app.use(errorMiddleware);
  return app;
}

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', 'test-webhook-secret-please-ignore').update(rawBody).digest('hex');
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

describe('checkout module — webhook', () => {
  const app = buildTestApp();

  it('400s on an invalid signature', async () => {
    const body = JSON.stringify({ gatewayOrderId: 'mock_order_x', success: true });
    const res = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'wrong-signature')
      .send(body);
    expect(res.status).toBe(400);
  });

  it('marks the order paid and auto-assigns an available license', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-webhook' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      paymentRef: 'mock_order_paidtest',
    });
    await License.create({ productId: product._id, key: 'TZP-2026-WEBHOOK1', status: 'available' });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_paidtest', success: true });
    const res = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.licenseId).not.toBeNull();

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder!.status).toBe('paid');
    const license = await License.findOne({ productId: product._id });
    expect(license!.status).toBe('assigned');
    expect(license!.assignedUserId!.toString()).toBe(user._id.toString());
  });

  it('leaves licenseId null when no license is available', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-webhook-2' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer2@example.com',
      passwordHash: 'x',
    });
    const product = await Product.create({ name: 'P', slug: 'p2', type: 'software', basePrice: 10 });
    await Order.create({
      tenantId: tenant._id,
      customerUserId: user._id,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      paymentRef: 'mock_order_nolicense',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_nolicense', success: true });
    const res = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.licenseId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/checkout.webhook.test.ts`
Expected: FAIL — `req.rawBody` doesn't type-check (no augmentation yet) and no `/checkout/webhook` route exists

- [ ] **Step 3: Modify `src/middleware/auth.middleware.ts`** — extend the `Request` augmentation

Replace:

```ts
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; tenantId: string | null };
      tenantId?: string | null;
    }
  }
}
```

with:

```ts
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; tenantId: string | null };
      tenantId?: string | null;
      rawBody?: Buffer;
    }
  }
}
```

- [ ] **Step 4: Modify `src/modules/checkout/checkout.service.ts`** — add imports and `processWebhook`

Add to the import block:

```ts
import { License } from '../../models/License';
import { User } from '../../models/User';
import { smtpEmailService } from '../../common/smtpEmail';
```

Append:

```ts
export async function processWebhook(gatewayOrderId: string, success: boolean): Promise<OrderDocument> {
  const order = await Order.findOne({ paymentRef: gatewayOrderId });
  if (!order) {
    throw new NotFoundError('Order not found for gateway reference');
  }

  if (!success) {
    order.status = 'failed';
    await order.save();
    return order;
  }

  order.status = 'paid';

  const license = await License.findOne({ productId: order.productId, status: 'available' });
  if (license) {
    license.assignedUserId = order.customerUserId;
    license.tenantId = order.tenantId;
    license.orderId = order._id;
    license.status = 'assigned';
    await license.save();
    order.licenseId = license._id;
  }

  await order.save();

  const customer = await User.findById(order.customerUserId);
  if (customer) {
    await smtpEmailService.sendEmail(customer.email, 'order-paid', { orderId: order._id.toString() });
  }

  return order;
}
```

- [ ] **Step 5: Modify `src/modules/checkout/checkout.controller.ts`** — add an import and append `webhookHandler`

Add to the import block:

```ts
import { mockPaymentGateway } from '../../common/paymentGateway';
```

Append:

```ts
export async function webhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.header('x-webhook-signature') ?? '';
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    const parsed = mockPaymentGateway.verifyAndParseWebhook(rawBody, signature);
    if (!parsed) {
      res.status(400).json({ error: { message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' } });
      return;
    }
    const order = await checkoutService.processWebhook(parsed.gatewayOrderId, parsed.success);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Modify `src/modules/checkout/checkout.routes.ts`** — add the unauthenticated webhook route

Add to the imports:

```ts
import { webhookHandler } from './checkout.controller';
```

Add route (no `requireAuth`/`requireRole`):

```ts
checkoutRouter.post('/checkout/webhook', webhookHandler);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/checkout.webhook.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/middleware/auth.middleware.ts src/modules/checkout tests/modules/checkout.webhook.test.ts
git commit -m "feat: add checkout webhook with auto license assignment"
```

---

## Task 7: Checkout Module — List Own Orders

**Files:**
- Modify: `src/modules/checkout/checkout.service.ts` (add `listOrdersForUser`)
- Modify: `src/modules/checkout/checkout.controller.ts` (add `listOrdersHandler`)
- Modify: `src/modules/checkout/checkout.routes.ts` (add `GET /orders`)
- Test: `tests/modules/checkout.orders.test.ts`

**Interfaces:**
- Consumes: `Order` model (Task 3).
- Produces: `listOrdersForUser(userId: string): Promise<OrderDocument[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/checkout.orders.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer', checkoutRouter);
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

describe('checkout module — list orders', () => {
  const app = buildTestApp();

  it("lists only the caller's own orders", async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-orders' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    const myUserId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    await Order.create({
      tenantId: tenant._id,
      customerUserId: myUserId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });
    await Order.create({
      tenantId: tenant._id,
      customerUserId: otherUserId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });

    const token = signAccessToken({ sub: myUserId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/checkout.orders.test.ts`
Expected: FAIL — no `GET /orders` route yet

- [ ] **Step 3: Modify `src/modules/checkout/checkout.service.ts`** — append `listOrdersForUser`

```ts
export async function listOrdersForUser(userId: string): Promise<OrderDocument[]> {
  return Order.find({ customerUserId: userId }).sort({ createdAt: -1 });
}
```

- [ ] **Step 4: Modify `src/modules/checkout/checkout.controller.ts`** — append handler

```ts
export async function listOrdersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orders = await checkoutService.listOrdersForUser(req.user!.id);
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/checkout/checkout.routes.ts`** — add route and import

Add to the imports:

```ts
import { listOrdersHandler } from './checkout.controller';
```

Add route:

```ts
checkoutRouter.get('/orders', requireAuth, requireRole('customer'), listOrdersHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/checkout.orders.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/checkout tests/modules/checkout.orders.test.ts
git commit -m "feat: add list own orders endpoint"
```

---

## Task 8: Checkout Module — Download Tokens

**Files:**
- Modify: `src/modules/checkout/checkout.service.ts` (add `generateDownloadToken`)
- Modify: `src/modules/checkout/checkout.controller.ts` (add `generateDownloadTokenHandler`)
- Modify: `src/modules/checkout/checkout.routes.ts` (add `GET /downloads/:orderId`)
- Test: `tests/modules/checkout.downloads.test.ts`

**Interfaces:**
- Consumes: `DownloadToken` model (Task 4), `ProductVersion` model (Master Product Library sub-project), `NotFoundError` (foundation).
- Produces: `generateDownloadToken(orderId: string, userId: string): Promise<{fileUrl: string; expiresAt: Date}>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/checkout.downloads.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { checkoutRouter } from '../../src/modules/checkout/checkout.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ProductVersion } from '../../src/models/ProductVersion';
import { Order } from '../../src/models/Order';
import { DownloadToken } from '../../src/models/DownloadToken';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer', checkoutRouter);
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

describe('checkout module — downloads', () => {
  const app = buildTestApp();

  it('issues a download token for a paid own order', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-downloads' });
    const product = await Product.create({ name: 'P', slug: 'p', type: 'software', basePrice: 10 });
    await ProductVersion.create({
      productId: product._id,
      version: '1.0.0',
      fileUrl: 'https://res.cloudinary.com/file.zip',
    });
    const userId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      status: 'paid',
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/customer/downloads/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fileUrl).toBe('https://res.cloudinary.com/file.zip');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const stored = await DownloadToken.findOne({ orderId: order._id });
    expect(stored).not.toBeNull();
  });

  it("404s for another customer's order", async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-downloads-2' });
    const product = await Product.create({ name: 'P', slug: 'p2', type: 'software', basePrice: 10 });
    const ownerId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: ownerId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      status: 'paid',
    });

    const token = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .get(`/api/v1/customer/downloads/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('404s for an unpaid order', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-downloads-3' });
    const product = await Product.create({ name: 'P', slug: 'p3', type: 'software', basePrice: 10 });
    const userId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
      status: 'pending',
    });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get(`/api/v1/customer/downloads/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/checkout.downloads.test.ts`
Expected: FAIL — no `GET /downloads/:orderId` route yet

- [ ] **Step 3: Modify `src/modules/checkout/checkout.service.ts`** — add imports and append `generateDownloadToken`

Add to the import block:

```ts
import { ProductVersion } from '../../models/ProductVersion';
import { DownloadToken } from '../../models/DownloadToken';
```

Append:

```ts
const DOWNLOAD_TOKEN_TTL_MINUTES = 15;

export async function generateDownloadToken(
  orderId: string,
  userId: string
): Promise<{ fileUrl: string; expiresAt: Date }> {
  const order = await Order.findById(orderId);
  if (!order || order.customerUserId.toString() !== userId || order.status !== 'paid') {
    throw new NotFoundError('Order not found');
  }
  const version = await ProductVersion.findOne({ productId: order.productId }).sort({ createdAt: -1 });
  if (!version || !version.fileUrl) {
    throw new NotFoundError('No downloadable file for this product');
  }
  const expiresAt = new Date(Date.now() + DOWNLOAD_TOKEN_TTL_MINUTES * 60 * 1000);
  await DownloadToken.create({ orderId: order._id, fileUrl: version.fileUrl, expiresAt, used: false });
  return { fileUrl: version.fileUrl, expiresAt };
}
```

- [ ] **Step 4: Modify `src/modules/checkout/checkout.controller.ts`** — append handler

```ts
export async function generateDownloadTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await checkoutService.generateDownloadToken(req.params.orderId, req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/checkout/checkout.routes.ts`** — add route and import

Add to the imports:

```ts
import { generateDownloadTokenHandler } from './checkout.controller';
```

Add route:

```ts
checkoutRouter.get(
  '/downloads/:orderId',
  requireAuth,
  requireRole('customer'),
  generateDownloadTokenHandler
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/checkout.downloads.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/checkout tests/modules/checkout.downloads.test.ts
git commit -m "feat: add download token issuance endpoint"
```

---

## Task 9: Wire Checkout into the App & Full Lifecycle Integration Test

**Files:**
- Modify: `src/app.ts` (capture raw body via `express.json({verify})`, mount `checkoutRouter`)
- Test: `tests/integration/checkout-lifecycle.test.ts`

**Interfaces:**
- Consumes: `checkoutRouter` (Task 5), `createApp` (foundation).
- Produces: nothing new — proves the whole checkout flow works end-to-end inside the fully wired app, including real raw-body capture for webhook signature verification.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/checkout-lifecycle.test.ts`:

```ts
jest.mock('../../src/common/cloudinary', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/mock.png',
    publicId: 'toolzypro/mock',
  }),
}));
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/common/password';

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', 'test-webhook-secret-please-ignore').update(rawBody).digest('hex');
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

describe('full checkout lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('checkout -> webhook -> order paid with license -> download', async () => {
    const productRes = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Checkout Tool', type: 'software', basePrice: 300 });
    const productId = productRes.body.product._id;

    await request(app)
      .post(`/api/v1/admin/products/${productId}/versions`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ version: '1.0.0', changelog: 'Initial' });
    await request(app)
      .post(`/api/v1/admin/products/${productId}/publish`)
      .set('Authorization', `Bearer ${masterToken}`);

    await request(app)
      .post('/api/v1/admin/licenses/generate')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ productId, quantity: 1 });

    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-full-checkout' });
    await request(app)
      .patch(`/api/v1/admin/products/${productId}/sync-mode`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ syncMode: 'private', tenantId: tenant._id.toString() });

    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });
    const customerToken = signAccessToken({
      sub: user._id.toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });

    const checkoutRes = await request(app)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId });
    expect(checkoutRes.status).toBe(201);
    const { orderId, gatewayOrderId } = checkoutRes.body;

    const webhookBody = JSON.stringify({ gatewayOrderId, success: true });
    const webhookRes = await request(app)
      .post('/api/v1/customer/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(webhookBody))
      .send(webhookBody);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.order.status).toBe('paid');
    expect(webhookRes.body.order.licenseId).not.toBeNull();

    const downloadRes = await request(app)
      .get(`/api/v1/customer/downloads/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.body.fileUrl).toMatch(/^https:\/\/res\.cloudinary\.com/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/checkout-lifecycle.test.ts`
Expected: FAIL — `createApp()` doesn't capture raw body or mount `checkoutRouter` yet

- [ ] **Step 3: Modify `src/app.ts`** — capture raw body and mount the checkout router

Replace:

```ts
  app.use(express.json());
```

with:

```ts
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    })
  );
```

Add to the imports:

```ts
import { checkoutRouter } from './modules/checkout/checkout.routes';
```

Add alongside the other `app.use('/api/v1/...')` lines:

```ts
app.use('/api/v1/customer', checkoutRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/checkout-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.ts tests/integration/checkout-lifecycle.test.ts
git commit -m "feat: wire checkout router into the app with raw body capture"
```

---

## Post-plan verification

Run the entire suite once more and confirm a clean build:

```bash
npm test
npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project (per the PRD decomposition) should cover Reseller Onboarding, real Razorpay SDK wiring (swapping in for `mockPaymentGateway`), or Invoices — to be brainstormed separately.
