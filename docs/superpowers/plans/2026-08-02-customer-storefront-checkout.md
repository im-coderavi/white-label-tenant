# Customer Storefront & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give customers a working storefront: browse the products their reseller's tenant has enabled, buy one, and simulate the mock payment completing. Replaces the placeholder `CustomerHomePage`.

**Architecture:** Backend: extract a shared `computeEffectivePrice()` helper out of `checkout.service.ts`, add a new `storefront` module (`GET /customer/products`), and add a customer-authenticated payment-confirmation endpoint to the existing `checkout` module (refactoring `processWebhook`'s shared logic into `markOrderPaid()`). Frontend: a new `pages/customer/` directory (`CustomerLayout`, `StorefrontPage`, `OrderConfirmationPage`) following the exact shell/page pattern already used for admin and reseller.

**Tech Stack:** Same as prior sub-projects — Express/TypeScript/Mongoose/Jest on the backend; Vite/React/TypeScript/TanStack Query/react-hook-form/Vitest+RTL on the frontend.

## Global Constraints

- `GET /customer/products` mounts at `/api/v1/customer/products` in `src/app.ts`, guarded by `requireAuth, requireRole('customer')`, scoped by `req.tenantId`. (Spec: Backend section)
- Only `ResellerProduct` rows with `enabled: true` whose populated product has `status: 'published'` appear in the storefront. (Spec: Backend section)
- Displayed/charged price is always `computeEffectivePrice(basePrice, entitlement)` — `customPrice` wins, else `discountPercent`-adjusted, else `basePrice`. Both the storefront list and `createCheckout` must use this single function. (Spec: Backend section)
- `POST /customer/orders/:id/confirm-payment` mounts on the existing `checkoutRouter` (already at `/api/v1/customer`), guarded by `requireAuth, requireRole('customer')`. 404 if the order doesn't belong to the caller; 409 if the order isn't `pending`. (Spec: Backend section)
- The real webhook (`processWebhook`) and the new confirm-payment endpoint share the exact same "mark paid" logic via one function — no duplicated license-assignment/email code. (Spec: Backend section)
- `OrderConfirmationPage` has no `GET /customer/orders/:id` endpoint to fetch from (out of scope) — it reads its initial order data from React Router navigation state, passed by `StorefrontPage` when it navigates after checkout. (Spec: Frontend section)
- Order history, license management, and downloads are out of scope for this sub-project. (Spec: Out of scope)
- All new frontend API calls go through the existing `api` Axios instance (`client/src/lib/api.ts`). (Established convention)

---

## Task 1: Backend — Effective Price Helper & Storefront List Endpoint

**Files:**
- Modify: `src/modules/checkout/checkout.service.ts` (extract `computeEffectivePrice`, use it in `createCheckout`)
- Test: `tests/modules/checkout.pricing.test.ts` (new)
- Create: `src/modules/storefront/storefront.service.ts`
- Create: `src/modules/storefront/storefront.controller.ts`
- Create: `src/modules/storefront/storefront.routes.ts`
- Modify: `src/app.ts` (mount the router)
- Test: `tests/modules/storefront.list.test.ts` (new)

**Interfaces:**
- Consumes: `ResellerProduct` model, `Product`/`ProductDocument` model, `req.tenantId` (JWT middleware).
- Produces: `computeEffectivePrice(basePrice: number, entitlement: { customPrice: number | null; discountPercent: number | null }): number` — exported from `checkout.service.ts`, consumed by `storefront.service.ts` in this task and already implicitly by `createCheckout`. `StorefrontItem` interface and `listStorefront(tenantId: string): Promise<StorefrontItem[]>`, response shape `{ items: StorefrontItem[] }`.

```ts
export interface StorefrontItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
}
```

- [ ] **Step 1: Write the failing test for the extracted pricing helper**

Create `tests/modules/checkout.pricing.test.ts`:

```ts
import { computeEffectivePrice } from '../../src/modules/checkout/checkout.service';

describe('computeEffectivePrice', () => {
  it('uses customPrice when set', () => {
    expect(computeEffectivePrice(100, { customPrice: 75, discountPercent: 10 })).toBe(75);
  });

  it('applies discountPercent when customPrice is not set', () => {
    expect(computeEffectivePrice(500, { customPrice: null, discountPercent: 20 })).toBe(400);
  });

  it('falls back to basePrice when neither is set', () => {
    expect(computeEffectivePrice(500, { customPrice: null, discountPercent: null })).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/checkout.pricing.test.ts`
Expected: FAIL — `computeEffectivePrice is not exported`

- [ ] **Step 3: Extract the helper in `checkout.service.ts`**

In `src/modules/checkout/checkout.service.ts`, replace:

```ts
export interface CreateCheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}
```

with:

```ts
export interface CreateCheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export function computeEffectivePrice(
  basePrice: number,
  entitlement: { customPrice: number | null; discountPercent: number | null }
): number {
  return (
    entitlement.customPrice ??
    (entitlement.discountPercent
      ? Number((basePrice * (1 - entitlement.discountPercent / 100)).toFixed(2))
      : basePrice)
  );
}
```

Then replace, inside `createCheckout`:

```ts
  const orderType = product.type === 'subscription' ? 'subscription' : 'single_product';
  const amount =
    entitlement.customPrice ??
    (entitlement.discountPercent
      ? Number((product.basePrice * (1 - entitlement.discountPercent / 100)).toFixed(2))
      : product.basePrice);
```

with:

```ts
  const orderType = product.type === 'subscription' ? 'subscription' : 'single_product';
  const amount = computeEffectivePrice(product.basePrice, entitlement);
```

- [ ] **Step 4: Run tests to verify the helper works and nothing broke**

Run: `npx jest tests/modules/checkout.pricing.test.ts tests/modules/checkout.create.test.ts`
Expected: PASS — 3 + 5 tests

- [ ] **Step 5: Write the failing test for the storefront list endpoint**

Create `tests/modules/storefront.list.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { storefrontRouter } from '../../src/modules/storefront/storefront.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { Product } from '../../src/models/Product';
import { ResellerProduct } from '../../src/models/ResellerProduct';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer/products', storefrontRouter);
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

describe('storefront module — list', () => {
  const app = buildTestApp();

  it('rejects non-customer roles', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists only published, enabled items for the caller tenant with computed price', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-storefront' });
    const otherTenant = await Tenant.create({ name: 'Other', subdomain: 'other-storefront' });

    const basePriced = await Product.create({
      name: 'Base Priced',
      slug: 'base-priced',
      type: 'software',
      basePrice: 100,
      status: 'published',
    });
    const discounted = await Product.create({
      name: 'Discounted',
      slug: 'discounted',
      type: 'software',
      basePrice: 200,
      status: 'published',
    });
    const draft = await Product.create({
      name: 'Draft',
      slug: 'draft-item',
      type: 'software',
      basePrice: 50,
      status: 'draft',
    });
    const disabled = await Product.create({
      name: 'Disabled',
      slug: 'disabled-item',
      type: 'software',
      basePrice: 75,
      status: 'published',
    });

    await ResellerProduct.create({ tenantId: tenant._id, productId: basePriced._id, enabled: true });
    await ResellerProduct.create({
      tenantId: tenant._id,
      productId: discounted._id,
      enabled: true,
      discountPercent: 10,
    });
    await ResellerProduct.create({ tenantId: tenant._id, productId: draft._id, enabled: true });
    await ResellerProduct.create({ tenantId: tenant._id, productId: disabled._id, enabled: false });
    await ResellerProduct.create({ tenantId: otherTenant._id, productId: basePriced._id, enabled: true });

    const token = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .get('/api/v1/customer/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const byName: Record<string, { price: number }> = Object.fromEntries(
      res.body.items.map((item: { name: string; price: number }) => [item.name, item])
    );
    expect(byName['Base Priced'].price).toBe(100);
    expect(byName['Discounted'].price).toBe(180);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/modules/storefront.list.test.ts`
Expected: FAIL — `Cannot find module '../../src/modules/storefront/storefront.routes'`

- [ ] **Step 7: Write minimal implementation**

Create `src/modules/storefront/storefront.service.ts`:

```ts
import { ResellerProduct } from '../../models/ResellerProduct';
import { ProductDocument } from '../../models/Product';
import { computeEffectivePrice } from '../checkout/checkout.service';

export interface StorefrontItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
}

export async function listStorefront(tenantId: string): Promise<StorefrontItem[]> {
  const rows = await ResellerProduct.find({ tenantId, enabled: true }).populate<{
    productId: ProductDocument;
  }>('productId');

  return rows
    .filter((row) => Boolean(row.productId) && row.productId.status === 'published')
    .map((row) => {
      const product = row.productId;
      return {
        _id: product._id.toString(),
        name: product.name,
        description: product.description,
        type: product.type,
        thumbnailUrl: product.thumbnailUrl,
        price: computeEffectivePrice(product.basePrice, row),
        currency: product.currency,
        isFeatured: row.isFeatured,
      };
    });
}
```

Create `src/modules/storefront/storefront.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express';
import * as storefrontService from './storefront.service';

export async function listStorefrontHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await storefrontService.listStorefront(req.tenantId as string);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}
```

Create `src/modules/storefront/storefront.routes.ts`:

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listStorefrontHandler } from './storefront.controller';

export const storefrontRouter = Router();

storefrontRouter.use(requireAuth, requireRole('customer'));
storefrontRouter.get('/', listStorefrontHandler);
```

Modify `src/app.ts` — add the import near the other module imports:

```ts
import { storefrontRouter } from './modules/storefront/storefront.routes';
```

and add the mount line near the other `app.use('/api/v1/...')` lines:

```ts
app.use('/api/v1/customer/products', storefrontRouter);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/modules/storefront.list.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 9: Commit**

```bash
git add src/modules/checkout/checkout.service.ts src/modules/storefront src/app.ts tests/modules/checkout.pricing.test.ts tests/modules/storefront.list.test.ts
git commit -m "feat: add storefront list endpoint with shared effective-price helper"
```

---

## Task 2: Backend — Confirm-Payment Endpoint

**Files:**
- Modify: `src/modules/checkout/checkout.service.ts` (extract `markOrderPaid`, add `confirmPayment`)
- Modify: `src/modules/checkout/checkout.controller.ts` (add `confirmPaymentHandler`)
- Modify: `src/modules/checkout/checkout.routes.ts` (add `POST /orders/:id/confirm-payment`)
- Test: `tests/modules/checkout.confirm-payment.test.ts` (new)

**Interfaces:**
- Consumes: `Order`, `License`, `User` models; `smtpEmailService` from `src/common/smtpEmail.ts`; `NotFoundError`, `ConflictError` from `src/common/errors.ts`.
- Produces: `confirmPayment(orderId: string, userId: string): Promise<OrderDocument>`, consumed by Task 3's frontend wrapper via `POST /customer/orders/:id/confirm-payment`, response shape `{ order }`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/checkout.confirm-payment.test.ts`:

```ts
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

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
import { License } from '../../src/models/License';

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

describe('checkout module — confirm payment', () => {
  const app = buildTestApp();

  it("404s for another customer's order", async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-confirm-1' });
    const product = await Product.create({ name: 'P', slug: 'p-confirm-1', type: 'software', basePrice: 10 });
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: new Types.ObjectId(),
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });

    const token = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'customer',
      tenantId: tenant._id.toString(),
    });
    const res = await request(app)
      .post(`/api/v1/customer/orders/${order._id.toString()}/confirm-payment`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('409s for an order that is not pending', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-confirm-2' });
    const product = await Product.create({ name: 'P', slug: 'p-confirm-2', type: 'software', basePrice: 10 });
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
      .post(`/api/v1/customer/orders/${order._id.toString()}/confirm-payment`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('marks a pending order paid and assigns an available license', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-confirm-3' });
    const product = await Product.create({ name: 'P', slug: 'p-confirm-3', type: 'software', basePrice: 10 });
    const userId = new Types.ObjectId();
    const order = await Order.create({
      tenantId: tenant._id,
      customerUserId: userId,
      productId: product._id,
      orderType: 'single_product',
      amount: 10,
    });
    await License.create({ productId: product._id, key: 'TZP-2026-CONFIRM01', status: 'available' });

    const token = signAccessToken({ sub: userId.toString(), role: 'customer', tenantId: tenant._id.toString() });
    const res = await request(app)
      .post(`/api/v1/customer/orders/${order._id.toString()}/confirm-payment`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.licenseId).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/checkout.confirm-payment.test.ts`
Expected: FAIL — all requests 404 (no route registered yet)

- [ ] **Step 3: Refactor `processWebhook` and add `confirmPayment`**

In `src/modules/checkout/checkout.service.ts`, update the import line:

```ts
import { ForbiddenError, NotFoundError } from '../../common/errors';
```

to:

```ts
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
```

Then replace:

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

with:

```ts
async function markOrderPaid(order: OrderDocument): Promise<OrderDocument> {
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

  return markOrderPaid(order);
}

export async function confirmPayment(orderId: string, userId: string): Promise<OrderDocument> {
  const order = await Order.findById(orderId);
  if (!order || order.customerUserId.toString() !== userId) {
    throw new NotFoundError('Order not found');
  }
  if (order.status !== 'pending') {
    throw new ConflictError('Order is not pending payment');
  }
  return markOrderPaid(order);
}
```

In `src/modules/checkout/checkout.controller.ts`, add after `generateDownloadTokenHandler`:

```ts
export async function confirmPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await checkoutService.confirmPayment(req.params.id, req.user!.id);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}
```

In `src/modules/checkout/checkout.routes.ts`, update the import:

```ts
import {
  createCheckoutHandler,
  webhookHandler,
  listOrdersHandler,
  generateDownloadTokenHandler,
} from './checkout.controller';
```

to:

```ts
import {
  createCheckoutHandler,
  webhookHandler,
  listOrdersHandler,
  generateDownloadTokenHandler,
  confirmPaymentHandler,
} from './checkout.controller';
```

and add, after the existing `checkoutRouter.get('/orders', ...)` line:

```ts
checkoutRouter.post(
  '/orders/:id/confirm-payment',
  requireAuth,
  requireRole('customer'),
  confirmPaymentHandler
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/modules/checkout.confirm-payment.test.ts tests/modules/checkout.webhook.test.ts tests/modules/checkout.create.test.ts tests/modules/checkout.orders.test.ts`
Expected: PASS — all tests (webhook tests confirm the refactor didn't change behavior)

- [ ] **Step 5: Commit**

```bash
git add src/modules/checkout/checkout.service.ts src/modules/checkout/checkout.controller.ts src/modules/checkout/checkout.routes.ts tests/modules/checkout.confirm-payment.test.ts
git commit -m "feat: add customer-authenticated payment confirmation endpoint"
```

---

## Task 3: Frontend — Storefront & Customer Orders API Wrappers

**Files:**
- Create: `client/src/api/storefront.ts`
- Create: `client/src/api/customerOrders.ts`

**Interfaces:**
- Consumes: the existing `api` Axios instance (`client/src/lib/api.ts`).
- Produces: `StorefrontItem`, `listStorefrontProducts()` from `storefront.ts`; `CheckoutResult`, `CustomerOrder`, `createCheckout()`, `confirmPayment()` from `customerOrders.ts` — consumed by Task 5 (`StorefrontPage`) and Task 6 (`OrderConfirmationPage`).

No independent test for this task — exercised through the page tests in Tasks 5–6, matching the established convention (`adminProducts.ts`, `adminTenants.ts`, `resellerCatalog.ts` have no dedicated test files).

- [ ] **Step 1: Write the files**

Create `client/src/api/storefront.ts`:

```ts
import { api } from '../lib/api';

export interface StorefrontItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
}

export async function listStorefrontProducts(): Promise<StorefrontItem[]> {
  const res = await api.get<{ items: StorefrontItem[] }>('/customer/products');
  return res.data.items;
}
```

Create `client/src/api/customerOrders.ts`:

```ts
import { api } from '../lib/api';

export interface CheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export interface CustomerOrder {
  _id: string;
  productId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';
}

export async function createCheckout(productId: string): Promise<CheckoutResult> {
  const res = await api.post<CheckoutResult>('/customer/checkout', { productId });
  return res.data;
}

export async function confirmPayment(orderId: string): Promise<CustomerOrder> {
  const res = await api.post<{ order: CustomerOrder }>(`/customer/orders/${orderId}/confirm-payment`);
  return res.data.order;
}
```

- [ ] **Step 2: Verify the build still compiles**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add client/src/api/storefront.ts client/src/api/customerOrders.ts
git commit -m "feat: add storefront and customer orders API wrappers"
```

---

## Task 4: Frontend — CustomerLayout

**Files:**
- Create: `client/src/pages/customer/CustomerLayout.tsx`
- Test: `client/src/pages/customer/CustomerLayout.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `client/src/auth/AuthContext.tsx`.
- Produces: default-exported `CustomerLayout` component, consumed by Task 7's `App.tsx` wiring.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/customer/CustomerLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CustomerLayout from './CustomerLayout';
import * as AuthContextModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../auth/AuthContext')>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

describe('CustomerLayout', () => {
  it('shows the user email, renders nested content, and logs out on click', async () => {
    const logout = vi.fn();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'customer@example.com', role: 'customer', tenantId: 'tenant-1' },
      isLoading: false,
      login: vi.fn(),
      logout,
    });

    render(
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<CustomerLayout />}>
            <Route index element={<div>Nested content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
    expect(screen.getByText('Nested content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/customer/CustomerLayout.test.tsx`
Expected: FAIL — `Cannot find module './CustomerLayout'`

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/customer/CustomerLayout.tsx`:

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/button';

export default function CustomerLayout(): JSX.Element {
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
        <NavLink to="/account/store">Store</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/customer/CustomerLayout.test.tsx`
Expected: PASS — 1 test

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/customer/CustomerLayout.tsx client/src/pages/customer/CustomerLayout.test.tsx
git commit -m "feat: add customer layout shell"
```

---

## Task 5: Frontend — StorefrontPage

**Files:**
- Create: `client/src/pages/customer/StorefrontPage.tsx`
- Test: `client/src/pages/customer/StorefrontPage.test.tsx`

**Interfaces:**
- Consumes: `listStorefrontProducts` from Task 3's `api/storefront.ts`; `createCheckout` from Task 3's `api/customerOrders.ts`; `Button` from `client/src/components/ui/button.tsx`.
- Produces: default-exported `StorefrontPage` component, consumed by Task 7's `App.tsx` wiring.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/customer/StorefrontPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StorefrontPage from './StorefrontPage';
import * as storefrontApi from '../../api/storefront';
import * as customerOrdersApi from '../../api/customerOrders';

vi.mock('../../api/storefront', () => ({
  listStorefrontProducts: vi.fn(),
}));
vi.mock('../../api/customerOrders', () => ({
  createCheckout: vi.fn(),
  confirmPayment: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/store']}>
        <Routes>
          <Route path="/account/store" element={<StorefrontPage />} />
          <Route path="/account/orders/:orderId" element={<div>Order confirmation placeholder</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const item = {
  _id: 'p1',
  name: 'Super Tool',
  description: 'A tool',
  type: 'software',
  thumbnailUrl: null,
  price: 180,
  currency: 'INR',
  isFeatured: true,
};

describe('StorefrontPage', () => {
  beforeEach(() => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockReset();
    vi.mocked(customerOrdersApi.createCheckout).mockReset();
  });

  it('renders fetched products with price and a featured badge', async () => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockResolvedValueOnce([item]);
    renderPage();

    expect(await screen.findByText('Super Tool')).toBeInTheDocument();
    expect(screen.getByText('180 INR')).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('buys a product and navigates to the order confirmation page', async () => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockResolvedValueOnce([{ ...item, isFeatured: false }]);
    vi.mocked(customerOrdersApi.createCheckout).mockResolvedValueOnce({
      orderId: 'order-1',
      gatewayOrderId: 'mock_order_1',
      amount: 180,
      currency: 'INR',
    });
    renderPage();

    await screen.findByText('Super Tool');
    await userEvent.click(screen.getByRole('button', { name: 'Buy' }));

    expect(await screen.findByText('Order confirmation placeholder')).toBeInTheDocument();
    expect(customerOrdersApi.createCheckout).toHaveBeenCalledWith('p1');
  });

  it('shows an inline error when checkout fails', async () => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockResolvedValueOnce([{ ...item, isFeatured: false }]);
    vi.mocked(customerOrdersApi.createCheckout).mockRejectedValueOnce(new Error('nope'));
    renderPage();

    await screen.findByText('Super Tool');
    await userEvent.click(screen.getByRole('button', { name: 'Buy' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start checkout. Please try again.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/customer/StorefrontPage.test.tsx`
Expected: FAIL — `Cannot find module './StorefrontPage'`

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/customer/StorefrontPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listStorefrontProducts } from '../../api/storefront';
import { createCheckout } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';

export default function StorefrontPage(): JSX.Element {
  const navigate = useNavigate();
  const [buyError, setBuyError] = useState<string | null>(null);
  const { data: items, isLoading } = useQuery({
    queryKey: ['storefront'],
    queryFn: listStorefrontProducts,
  });

  const handleBuy = async (productId: string): Promise<void> => {
    setBuyError(null);
    try {
      const result = await createCheckout(productId);
      navigate(`/account/orders/${result.orderId}`, { state: result });
    } catch {
      setBuyError('Could not start checkout. Please try again.');
    }
  };

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Store</h1>
      {buyError && <p role="alert">{buyError}</p>}
      <ul>
        {items?.map((item) => (
          <li key={item._id}>
            <h2>{item.name}</h2>
            {item.isFeatured && <span>Featured</span>}
            <p>{item.description}</p>
            <p>
              {item.price} {item.currency}
            </p>
            <Button onClick={() => handleBuy(item._id)}>Buy</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/customer/StorefrontPage.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/customer/StorefrontPage.tsx client/src/pages/customer/StorefrontPage.test.tsx
git commit -m "feat: add customer storefront page"
```

---

## Task 6: Frontend — OrderConfirmationPage

**Files:**
- Create: `client/src/pages/customer/OrderConfirmationPage.tsx`
- Test: `client/src/pages/customer/OrderConfirmationPage.test.tsx`

**Interfaces:**
- Consumes: `confirmPayment`, `CheckoutResult`, `CustomerOrder` from Task 3's `api/customerOrders.ts`; `Button` from `client/src/components/ui/button.tsx`.
- Produces: default-exported `OrderConfirmationPage` component, consumed by Task 7's `App.tsx` wiring.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/customer/OrderConfirmationPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderConfirmationPage from './OrderConfirmationPage';
import * as customerOrdersApi from '../../api/customerOrders';

vi.mock('../../api/customerOrders', () => ({
  confirmPayment: vi.fn(),
}));

function renderPage(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/account/orders/order-1', state }]}>
      <Routes>
        <Route path="/account/orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/account/store" element={<div>Store placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    vi.mocked(customerOrdersApi.confirmPayment).mockReset();
  });

  it('shows a not-found state when navigation state is missing', () => {
    renderPage(undefined);
    expect(screen.getByText('Order not found.')).toBeInTheDocument();
  });

  it('shows the pending order and confirms payment', async () => {
    vi.mocked(customerOrdersApi.confirmPayment).mockResolvedValueOnce({
      _id: 'order-1',
      productId: 'p1',
      amount: 180,
      currency: 'INR',
      status: 'paid',
    });
    renderPage({ orderId: 'order-1', gatewayOrderId: 'mock_order_1', amount: 180, currency: 'INR' });

    expect(screen.getByText('Amount: 180 INR')).toBeInTheDocument();
    expect(screen.getByText('Status: pending')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByText('Status: paid')).toBeInTheDocument();
    expect(customerOrdersApi.confirmPayment).toHaveBeenCalledWith('order-1');
  });

  it('shows an inline error when confirmation fails', async () => {
    vi.mocked(customerOrdersApi.confirmPayment).mockRejectedValueOnce(new Error('nope'));
    renderPage({ orderId: 'order-1', gatewayOrderId: 'mock_order_1', amount: 180, currency: 'INR' });

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm payment. Please try again.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/customer/OrderConfirmationPage.test.tsx`
Expected: FAIL — `Cannot find module './OrderConfirmationPage'`

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/customer/OrderConfirmationPage.tsx`:

```tsx
import { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { confirmPayment } from '../../api/customerOrders';
import type { CheckoutResult } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';

export default function OrderConfirmationPage(): JSX.Element {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const initialOrder = location.state as CheckoutResult | undefined;
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (!initialOrder) {
    return (
      <div>
        <p>Order not found.</p>
        <Link to="/account/store">Return to store</Link>
      </div>
    );
  }

  const handleConfirm = async (): Promise<void> => {
    setConfirmError(null);
    try {
      const order = await confirmPayment(orderId as string);
      setStatus(order.status === 'paid' ? 'paid' : 'pending');
    } catch {
      setConfirmError('Could not confirm payment. Please try again.');
    }
  };

  return (
    <div>
      <h1>Order confirmation</h1>
      <p>
        Amount: {initialOrder.amount} {initialOrder.currency}
      </p>
      <p>Status: {status}</p>

      {status === 'pending' && <Button onClick={handleConfirm}>Simulate Payment</Button>}
      {status === 'paid' && <p>Payment confirmed. Thank you for your purchase!</p>}
      {confirmError && <p role="alert">{confirmError}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/customer/OrderConfirmationPage.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/customer/OrderConfirmationPage.tsx client/src/pages/customer/OrderConfirmationPage.test.tsx
git commit -m "feat: add order confirmation page with mock payment simulation"
```

---

## Task 7: Wire Customer Routes and Remove Placeholder

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/App.test.tsx`
- Delete: `client/src/pages/CustomerHomePage.tsx`

**Interfaces:**
- Consumes: `CustomerLayout` from Task 4, `StorefrontPage` from Task 5, `OrderConfirmationPage` from Task 6.
- Produces: nothing further — this is the final task.

- [ ] **Step 1: Write the failing test**

In `client/src/App.test.tsx`, insert a new test immediately after the closing `});` of the `it('logs in as reseller_admin and lands on the catalog page', ...)` test and before the `it('redirects an unauthenticated visit to /admin back to /login', ...)` test:

```tsx
  it('logs in as customer and lands on the store page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-3',
        refreshToken: 'refresh-3',
        user: { id: '3', email: 'customer@example.com', role: 'customer', tenantId: 'tenant-1' },
      },
    });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Store' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — lands on the old `CustomerHomePage` placeholder text, no "Store" heading found

- [ ] **Step 3: Write minimal implementation**

In `client/src/App.tsx`, replace the import:

```tsx
import CustomerHomePage from './pages/CustomerHomePage';
```

with:

```tsx
import CustomerLayout from './pages/customer/CustomerLayout';
import StorefrontPage from './pages/customer/StorefrontPage';
import OrderConfirmationPage from './pages/customer/OrderConfirmationPage';
```

Replace the `/account` route:

```tsx
      <Route
        path="/account"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerHomePage />
          </ProtectedRoute>
        }
      />
```

with:

```tsx
      <Route
        path="/account"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/account/store" replace />} />
        <Route path="store" element={<StorefrontPage />} />
        <Route path="orders/:orderId" element={<OrderConfirmationPage />} />
      </Route>
```

Delete `client/src/pages/CustomerHomePage.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Run the full frontend suite and build**

Run: `cd client && npx vitest run`
Expected: PASS — all suites

Run: `cd client && npm run build`
Expected: clean build

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx client/src/pages/CustomerHomePage.tsx
git commit -m "feat: wire customer storefront routes into App and remove placeholder home page"
```

---

## Final Verification

- [ ] Run `npm test` from the repo root — all backend suites pass.
- [ ] Run `npm run build` from the repo root — clean backend build.
- [ ] Run `cd client && npx vitest run` — all frontend suites pass.
- [ ] Run `cd client && npm run build` — clean frontend build.
