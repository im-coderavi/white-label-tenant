# Reseller Plans & Self-Signup Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build fully dynamic, master-admin-managed reseller subscription plans, plus a public reseller self-signup flow that creates a pending tenant/account/subscription trio and activates all three once payment is confirmed.

**Architecture:** Same layered pattern as prior sub-projects. Two new modules: `plans` (admin CRUD + a public read-only listing) and `resellerSignup` (the public registration + webhook flow), both reusing the existing `mockPaymentGateway`, raw-body-capture, and HMAC-signature-verification pattern from Checkout & Orders.

**Tech Stack:** Express, TypeScript, Mongoose, Zod, Jest + supertest + `mongodb-memory-server` — no new dependencies.

## Global Constraints

- `Plan.name` is a free-text string, never a fixed enum — plans are fully admin-defined. (Spec §2)
- `Plan.featureFlagsJson`/`limitsJson` are stored but read by nothing yet — no enforcement logic this round. (Spec §1)
- No automatic subscription renewal/expiry/grace transitions — `Subscription.status` supports those states but nothing moves a subscription into them except the webhook's pending→active/cancelled transition. (Spec §1)
- Reseller self-signup issues no email-verification token — successful payment (confirmed via webhook) is the activation signal. (Spec §4)
- The webhook route (`POST /auth/register-reseller/webhook`) has no `requireAuth`/`requireRole` — authenticity comes from HMAC signature verification, matching the Checkout & Orders webhook. (Spec §3)
- `DELETE /admin/plans/:id` is a soft archive (`status='archived'`), never a hard delete. (Spec §3)

---

## Task 1: Plan Model

**Files:**
- Create: `src/models/Plan.ts`
- Test: `tests/models/plan.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Plan` model + `PlanDocument` (`scope`, `name`, `price`, `currency`, `billingCycle`, `featureFlagsJson`, `limitsJson`, `status`) and `PlanScope`/`PlanBillingCycle`/`PlanStatus` type exports — consumed by every task from Task 3 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/models/plan.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Plan } from '../../src/models/Plan';

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

describe('Plan model', () => {
  it('creates with defaults', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    expect(plan.currency).toBe('INR');
    expect(plan.status).toBe('active');
    expect(plan.featureFlagsJson).toEqual({});
    expect(plan.limitsJson).toEqual({});
  });

  it('rejects an invalid billingCycle', async () => {
    await expect(
      Plan.create({ scope: 'reseller', name: 'Bad', price: 1, billingCycle: 'weekly' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/plan.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/Plan'`

- [ ] **Step 3: Create `src/models/Plan.ts`**

```ts
import { Schema, model, Document } from 'mongoose';

export type PlanScope = 'reseller' | 'customer';
export type PlanBillingCycle = 'monthly' | 'annual' | 'lifetime';
export type PlanStatus = 'active' | 'archived';

export interface PlanDocument extends Document {
  scope: PlanScope;
  name: string;
  price: number;
  currency: string;
  billingCycle: PlanBillingCycle;
  featureFlagsJson: Record<string, unknown>;
  limitsJson: Record<string, unknown>;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>(
  {
    scope: { type: String, enum: ['reseller', 'customer'], required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    billingCycle: { type: String, enum: ['monthly', 'annual', 'lifetime'], required: true },
    featureFlagsJson: { type: Schema.Types.Mixed, default: {} },
    limitsJson: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

export const Plan = model<PlanDocument>('Plan', planSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/plan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/Plan.ts tests/models/plan.test.ts
git commit -m "feat: add Plan model"
```

---

## Task 2: Subscription Model

**Files:**
- Create: `src/models/Subscription.ts`
- Test: `tests/models/subscription.test.ts`

**Interfaces:**
- Consumes: `Tenant`, `Plan` models.
- Produces: `Subscription` model + `SubscriptionDocument` (`tenantId`, `planId`, `status`, `currentPeriodEnd`, `paymentRef`) — consumed by Task 5 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/models/subscription.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';

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

describe('Subscription model', () => {
  it('creates with defaults', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    const plan = await Plan.create({ scope: 'reseller', name: 'Starter', price: 999, billingCycle: 'annual' });
    const subscription = await Subscription.create({ tenantId: tenant._id, planId: plan._id });
    expect(subscription.status).toBe('pending');
    expect(subscription.currentPeriodEnd).toBeNull();
    expect(subscription.paymentRef).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models/subscription.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/Subscription'`

- [ ] **Step 3: Create `src/models/Subscription.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export type SubscriptionStatus = 'pending' | 'active' | 'grace' | 'expired' | 'cancelled';

export interface SubscriptionDocument extends Document {
  tenantId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  paymentRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'grace', 'expired', 'cancelled'],
      default: 'pending',
    },
    currentPeriodEnd: { type: Date, default: null },
    paymentRef: { type: String, default: null },
  },
  { timestamps: true }
);

export const Subscription = model<SubscriptionDocument>('Subscription', subscriptionSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models/subscription.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/Subscription.ts tests/models/subscription.test.ts
git commit -m "feat: add Subscription model"
```

---

## Task 3: Plans Module — Admin CRUD

**Files:**
- Create: `src/modules/plans/plans.validators.ts`
- Create: `src/modules/plans/plans.service.ts`
- Create: `src/modules/plans/plans.controller.ts`
- Create: `src/modules/plans/plans.routes.ts`
- Test: `tests/modules/plans.admin.test.ts`

**Interfaces:**
- Consumes: `Plan` model (Task 1), `requireAuth`/`requireRole`/`validateBody` (foundation), `NotFoundError` (foundation).
- Produces: `createPlanSchema`, `updatePlanSchema` (Zod schemas for this and later tasks). `listPlans(): Promise<PlanDocument[]>`, `createPlan(input): Promise<PlanDocument>`, `getPlanById(id: string): Promise<PlanDocument>`, `updatePlan(id, input): Promise<PlanDocument>`, `archivePlan(id: string): Promise<PlanDocument>` from `plans.service.ts` — `getPlanById` reused by Task 5. `plansRouter: Router` — mounted at `/api/v1/admin/plans` in Task 7.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/plans.admin.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { plansRouter } from '../../src/modules/plans/plans.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Plan } from '../../src/models/Plan';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/plans', plansRouter);
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

describe('plans module — admin CRUD', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('creates, updates, and archives a plan', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ scope: 'reseller', name: 'Starter Annual', price: 999, billingCycle: 'annual' });
    expect(createRes.status).toBe(201);
    const planId = createRes.body.plan._id;

    const updateRes = await request(app)
      .patch(`/api/v1/admin/plans/${planId}`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ price: 1099 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.plan.price).toBe(1099);

    const archiveRes = await request(app)
      .delete(`/api/v1/admin/plans/${planId}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.plan.status).toBe('archived');
  });

  it('lists all plans', async () => {
    await Plan.create({ scope: 'reseller', name: 'Starter', price: 999, billingCycle: 'annual' });
    await Plan.create({ scope: 'reseller', name: 'Ultimate Lifetime', price: 14999, billingCycle: 'lifetime' });

    const res = await request(app)
      .get('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/plans.admin.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/plans/plans.validators.ts`**

```ts
import { z } from 'zod';

export const createPlanSchema = z.object({
  scope: z.enum(['reseller', 'customer']),
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  currency: z.string().optional(),
  billingCycle: z.enum(['monthly', 'annual', 'lifetime']),
  featureFlagsJson: z.record(z.unknown()).optional(),
  limitsJson: z.record(z.unknown()).optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
  billingCycle: z.enum(['monthly', 'annual', 'lifetime']).optional(),
  featureFlagsJson: z.record(z.unknown()).optional(),
  limitsJson: z.record(z.unknown()).optional(),
});
```

- [ ] **Step 4: Create `src/modules/plans/plans.service.ts`**

```ts
import { Plan, PlanDocument, PlanBillingCycle } from '../../models/Plan';
import { NotFoundError } from '../../common/errors';

export async function listPlans(): Promise<PlanDocument[]> {
  return Plan.find().sort({ createdAt: -1 });
}

export async function createPlan(input: {
  scope: 'reseller' | 'customer';
  name: string;
  price: number;
  currency?: string;
  billingCycle: PlanBillingCycle;
  featureFlagsJson?: Record<string, unknown>;
  limitsJson?: Record<string, unknown>;
}): Promise<PlanDocument> {
  return Plan.create({
    scope: input.scope,
    name: input.name,
    price: input.price,
    currency: input.currency ?? 'INR',
    billingCycle: input.billingCycle,
    featureFlagsJson: input.featureFlagsJson ?? {},
    limitsJson: input.limitsJson ?? {},
  });
}

export async function getPlanById(id: string): Promise<PlanDocument> {
  const plan = await Plan.findById(id);
  if (!plan) throw new NotFoundError('Plan not found');
  return plan;
}

export async function updatePlan(
  id: string,
  input: {
    name?: string;
    price?: number;
    currency?: string;
    billingCycle?: PlanBillingCycle;
    featureFlagsJson?: Record<string, unknown>;
    limitsJson?: Record<string, unknown>;
  }
): Promise<PlanDocument> {
  const plan = await getPlanById(id);
  if (input.name !== undefined) plan.name = input.name;
  if (input.price !== undefined) plan.price = input.price;
  if (input.currency !== undefined) plan.currency = input.currency;
  if (input.billingCycle !== undefined) plan.billingCycle = input.billingCycle;
  if (input.featureFlagsJson !== undefined) plan.featureFlagsJson = input.featureFlagsJson;
  if (input.limitsJson !== undefined) plan.limitsJson = input.limitsJson;
  await plan.save();
  return plan;
}

export async function archivePlan(id: string): Promise<PlanDocument> {
  const plan = await getPlanById(id);
  plan.status = 'archived';
  await plan.save();
  return plan;
}
```

- [ ] **Step 5: Create `src/modules/plans/plans.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as plansService from './plans.service';

export async function listPlansHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plans = await plansService.listPlans();
    res.status(200).json({ plans });
  } catch (err) {
    next(err);
  }
}

export async function createPlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await plansService.createPlan(req.body);
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function updatePlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await plansService.updatePlan(req.params.id, req.body);
    res.status(200).json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function archivePlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await plansService.archivePlan(req.params.id);
    res.status(200).json({ plan });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Create `src/modules/plans/plans.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createPlanSchema, updatePlanSchema } from './plans.validators';
import {
  listPlansHandler,
  createPlanHandler,
  updatePlanHandler,
  archivePlanHandler,
} from './plans.controller';

export const plansRouter = Router();

plansRouter.use(requireAuth, requireRole('master_admin'));

plansRouter.get('/', listPlansHandler);
plansRouter.post('/', validateBody(createPlanSchema), createPlanHandler);
plansRouter.patch('/:id', validateBody(updatePlanSchema), updatePlanHandler);
plansRouter.delete('/:id', archivePlanHandler);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/plans.admin.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/plans tests/modules/plans.admin.test.ts
git commit -m "feat: add plans module with admin CRUD"
```

---

## Task 4: Public Plan Listing

**Files:**
- Modify: `src/modules/plans/plans.service.ts` (add `listActiveResellerPlans`)
- Modify: `src/modules/plans/plans.controller.ts` (add `listActiveResellerPlansHandler`)
- Create: `src/modules/plans/public.routes.ts`
- Test: `tests/modules/plans.public.test.ts`

**Interfaces:**
- Consumes: `Plan` model (Task 1).
- Produces: `listActiveResellerPlans(): Promise<PlanDocument[]>`. `publicPlansRouter: Router` — mounted at `/api/v1` in Task 7 (defines its own `/plans` path).

- [ ] **Step 1: Write the failing test**

Create `tests/modules/plans.public.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { publicPlansRouter } from '../../src/modules/plans/public.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Plan } from '../../src/models/Plan';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', publicPlansRouter);
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

describe('plans module — public listing', () => {
  const app = buildTestApp();

  it('only returns active reseller-scope plans', async () => {
    await Plan.create({ scope: 'reseller', name: 'Starter', price: 999, billingCycle: 'annual' });
    await Plan.create({
      scope: 'reseller',
      name: 'Archived Plan',
      price: 500,
      billingCycle: 'annual',
      status: 'archived',
    });
    await Plan.create({ scope: 'customer', name: 'Customer Plan', price: 200, billingCycle: 'monthly' });

    const res = await request(app).get('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(1);
    expect(res.body.plans[0].name).toBe('Starter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/plans.public.test.ts`
Expected: FAIL — `Cannot find module '../../src/modules/plans/public.routes'`

- [ ] **Step 3: Modify `src/modules/plans/plans.service.ts`** — append `listActiveResellerPlans`

```ts
export async function listActiveResellerPlans(): Promise<PlanDocument[]> {
  return Plan.find({ status: 'active', scope: 'reseller' }).sort({ price: 1 });
}
```

- [ ] **Step 4: Modify `src/modules/plans/plans.controller.ts`** — append handler

```ts
export async function listActiveResellerPlansHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await plansService.listActiveResellerPlans();
    res.status(200).json({ plans });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Create `src/modules/plans/public.routes.ts`**

```ts
import { Router } from 'express';
import { listActiveResellerPlansHandler } from './plans.controller';

export const publicPlansRouter = Router();

publicPlansRouter.get('/plans', listActiveResellerPlansHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/plans.public.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/plans tests/modules/plans.public.test.ts
git commit -m "feat: add public reseller plan listing endpoint"
```

---

## Task 5: Reseller Self-Signup — Registration

**Files:**
- Create: `src/modules/resellerSignup/resellerSignup.validators.ts`
- Create: `src/modules/resellerSignup/resellerSignup.service.ts`
- Create: `src/modules/resellerSignup/resellerSignup.controller.ts`
- Create: `src/modules/resellerSignup/resellerSignup.routes.ts`
- Test: `tests/modules/resellerSignup.register.test.ts`

**Interfaces:**
- Consumes: `Tenant`, `User`, `Plan`, `Subscription` models, `hashPassword` (foundation), `mockPaymentGateway` (Checkout & Orders sub-project), `ConflictError`/`NotFoundError` (foundation).
- Produces: `registerResellerSchema`, `resellerWebhookPayloadSchema` (Zod schemas, both defined now). `registerReseller(input): Promise<{tenantId, userId, subscriptionId, gatewayOrderId, amount, currency}>` from `resellerSignup.service.ts`. `resellerSignupRouter: Router` — mounted at `/api/v1/auth` in Task 7.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/resellerSignup.register.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerSignupRouter } from '../../src/modules/resellerSignup/resellerSignup.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Plan } from '../../src/models/Plan';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Subscription } from '../../src/models/Subscription';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', resellerSignupRouter);
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

describe('reseller signup — register', () => {
  const app = buildTestApp();

  it('creates a pending tenant, user, and subscription with a gateway reference', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });

    const res = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Acme Resell',
      subdomain: 'acme-resell',
      email: 'owner@acme.example',
      password: 'longenough1',
      planId: plan._id.toString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(999);
    expect(res.body.gatewayOrderId).toMatch(/^mock_order_/);

    const tenant = await Tenant.findById(res.body.tenantId);
    expect(tenant!.status).toBe('pending');
    const user = await User.findById(res.body.userId);
    expect(user!.status).toBe('pending');
    expect(user!.role).toBe('reseller_admin');
    const subscription = await Subscription.findById(res.body.subscriptionId);
    expect(subscription!.status).toBe('pending');
    expect(subscription!.paymentRef).toBe(res.body.gatewayOrderId);
  });

  it('404s for an unknown plan', async () => {
    const res = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Acme Resell',
      subdomain: 'acme-resell-2',
      email: 'owner2@acme.example',
      password: 'longenough1',
      planId: '64b000000000000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('409s for a taken subdomain', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    await Tenant.create({ name: 'Existing', subdomain: 'taken-subdomain' });

    const res = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Acme Resell',
      subdomain: 'taken-subdomain',
      email: 'owner3@acme.example',
      password: 'longenough1',
      planId: plan._id.toString(),
    });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/resellerSignup.register.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/resellerSignup/resellerSignup.validators.ts`**

```ts
import { z } from 'zod';

export const registerResellerSchema = z.object({
  businessName: z.string().min(1),
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens'),
  email: z.string().email(),
  password: z.string().min(8),
  planId: z.string().min(1),
});

export const resellerWebhookPayloadSchema = z.object({
  gatewayOrderId: z.string().min(1),
  success: z.boolean(),
});
```

- [ ] **Step 4: Create `src/modules/resellerSignup/resellerSignup.service.ts`**

```ts
import { Tenant } from '../../models/Tenant';
import { User } from '../../models/User';
import { Plan } from '../../models/Plan';
import { Subscription } from '../../models/Subscription';
import { ConflictError, NotFoundError } from '../../common/errors';
import { hashPassword } from '../../common/password';
import { mockPaymentGateway } from '../../common/paymentGateway';

export interface RegisterResellerResult {
  tenantId: string;
  userId: string;
  subscriptionId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export async function registerReseller(input: {
  businessName: string;
  subdomain: string;
  email: string;
  password: string;
  planId: string;
}): Promise<RegisterResellerResult> {
  const plan = await Plan.findById(input.planId);
  if (!plan || plan.status !== 'active' || plan.scope !== 'reseller') {
    throw new NotFoundError('Plan not found');
  }

  const subdomain = input.subdomain.toLowerCase();
  const existingTenant = await Tenant.findOne({ subdomain });
  if (existingTenant) {
    throw new ConflictError('Subdomain already in use');
  }

  const tenant = await Tenant.create({ name: input.businessName, subdomain, status: 'pending' });
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    tenantId: tenant._id,
    role: 'reseller_admin',
    email: input.email.toLowerCase(),
    passwordHash,
    status: 'pending',
  });
  const subscription = await Subscription.create({
    tenantId: tenant._id,
    planId: plan._id,
    status: 'pending',
  });

  const { gatewayOrderId } = await mockPaymentGateway.createOrder({
    amount: plan.price,
    currency: plan.currency,
    receipt: subscription._id.toString(),
  });
  subscription.paymentRef = gatewayOrderId;
  await subscription.save();

  return {
    tenantId: tenant._id.toString(),
    userId: user._id.toString(),
    subscriptionId: subscription._id.toString(),
    gatewayOrderId,
    amount: plan.price,
    currency: plan.currency,
  };
}
```

- [ ] **Step 5: Create `src/modules/resellerSignup/resellerSignup.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as resellerSignupService from './resellerSignup.service';

export async function registerResellerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await resellerSignupService.registerReseller(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Create `src/modules/resellerSignup/resellerSignup.routes.ts`**

```ts
import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { registerResellerSchema } from './resellerSignup.validators';
import { registerResellerHandler } from './resellerSignup.controller';

export const resellerSignupRouter = Router();

resellerSignupRouter.post(
  '/register-reseller',
  validateBody(registerResellerSchema),
  registerResellerHandler
);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/resellerSignup.register.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/resellerSignup tests/modules/resellerSignup.register.test.ts
git commit -m "feat: add public reseller self-signup registration endpoint"
```

---

## Task 6: Reseller Self-Signup — Webhook

**Files:**
- Modify: `src/modules/resellerSignup/resellerSignup.service.ts` (add `processResellerSignupWebhook`)
- Modify: `src/modules/resellerSignup/resellerSignup.controller.ts` (add `webhookHandler`)
- Modify: `src/modules/resellerSignup/resellerSignup.routes.ts` (add `POST /register-reseller/webhook`, unauthenticated)
- Test: `tests/modules/resellerSignup.webhook.test.ts`

**Interfaces:**
- Consumes: `mockPaymentGateway.verifyAndParseWebhook` (Checkout & Orders sub-project), `smtpEmailService` (foundation), `req.rawBody` (populated by `express.json`'s `verify` hook, already added to the global `Request` type in the Checkout & Orders sub-project).
- Produces: `processResellerSignupWebhook(gatewayOrderId: string, success: boolean): Promise<SubscriptionDocument>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/resellerSignup.webhook.test.ts`:

```ts
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose from 'mongoose';
import express, { Request } from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resellerSignupRouter } from '../../src/modules/resellerSignup/resellerSignup.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Plan } from '../../src/models/Plan';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { Subscription } from '../../src/models/Subscription';

function buildTestApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );
  app.use('/api/v1/auth', resellerSignupRouter);
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

describe('reseller signup — webhook', () => {
  const app = buildTestApp();

  it('400s on an invalid signature', async () => {
    const body = JSON.stringify({ gatewayOrderId: 'mock_order_x', success: true });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'wrong-signature')
      .send(body);
    expect(res.status).toBe(400);
  });

  it('activates tenant, user, and subscription for an annual plan', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-webhook-signup', status: 'pending' });
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'owner@acme.example',
      passwordHash: 'x',
      status: 'pending',
    });
    const subscription = await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'pending',
      paymentRef: 'mock_order_signuptest',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_signuptest', success: true });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('active');
    expect(res.body.subscription.currentPeriodEnd).not.toBeNull();

    const updatedTenant = await Tenant.findById(tenant._id);
    expect(updatedTenant!.status).toBe('active');
    const updatedUser = await User.findOne({ tenantId: tenant._id, role: 'reseller_admin' });
    expect(updatedUser!.status).toBe('active');
    const updatedSub = await Subscription.findById(subscription._id);
    const expectedYear = new Date().getFullYear() + 1;
    expect(updatedSub!.currentPeriodEnd!.getFullYear()).toBe(expectedYear);
  });

  it('sets currentPeriodEnd to null for a lifetime plan', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Ultimate Lifetime',
      price: 14999,
      billingCycle: 'lifetime',
    });
    const tenant = await Tenant.create({ name: 'Acme2', subdomain: 'acme-webhook-lifetime', status: 'pending' });
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'owner2@acme.example',
      passwordHash: 'x',
      status: 'pending',
    });
    await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'pending',
      paymentRef: 'mock_order_lifetimetest',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_lifetimetest', success: true });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.subscription.currentPeriodEnd).toBeNull();
  });

  it('cancels the subscription without activating tenant/user on failure', async () => {
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter Annual',
      price: 999,
      billingCycle: 'annual',
    });
    const tenant = await Tenant.create({ name: 'Acme3', subdomain: 'acme-webhook-fail', status: 'pending' });
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'owner3@acme.example',
      passwordHash: 'x',
      status: 'pending',
    });
    await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'pending',
      paymentRef: 'mock_order_failtest',
    });

    const body = JSON.stringify({ gatewayOrderId: 'mock_order_failtest', success: false });
    const res = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('cancelled');

    const updatedTenant = await Tenant.findById(tenant._id);
    expect(updatedTenant!.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/resellerSignup.webhook.test.ts`
Expected: FAIL — no `/register-reseller/webhook` route yet

- [ ] **Step 3: Modify `src/modules/resellerSignup/resellerSignup.service.ts`** — add imports and append `processResellerSignupWebhook`

Add to the import block:

```ts
import { SubscriptionDocument } from '../../models/Subscription';
import { smtpEmailService } from '../../common/smtpEmail';
```

Append:

```ts
export async function processResellerSignupWebhook(
  gatewayOrderId: string,
  success: boolean
): Promise<SubscriptionDocument> {
  const subscription = await Subscription.findOne({ paymentRef: gatewayOrderId });
  if (!subscription) {
    throw new NotFoundError('Subscription not found for gateway reference');
  }

  if (!success) {
    subscription.status = 'cancelled';
    await subscription.save();
    return subscription;
  }

  const plan = await Plan.findById(subscription.planId);
  if (!plan) {
    throw new NotFoundError('Plan not found');
  }

  subscription.status = 'active';
  if (plan.billingCycle === 'lifetime') {
    subscription.currentPeriodEnd = null;
  } else {
    const periodEnd = new Date();
    if (plan.billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }
    subscription.currentPeriodEnd = periodEnd;
  }
  await subscription.save();

  await Tenant.findByIdAndUpdate(subscription.tenantId, { status: 'active' });
  const user = await User.findOneAndUpdate(
    { tenantId: subscription.tenantId, role: 'reseller_admin' },
    { status: 'active' },
    { new: true }
  );

  if (user) {
    await smtpEmailService.sendEmail(user.email, 'reseller-welcome', {
      tenantId: subscription.tenantId.toString(),
    });
  }

  return subscription;
}
```

- [ ] **Step 4: Modify `src/modules/resellerSignup/resellerSignup.controller.ts`** — add an import and append `webhookHandler`

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
    const subscription = await resellerSignupService.processResellerSignupWebhook(
      parsed.gatewayOrderId,
      parsed.success
    );
    res.status(200).json({ subscription });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/resellerSignup/resellerSignup.routes.ts`** — add the unauthenticated webhook route

Add to the imports:

```ts
import { webhookHandler } from './resellerSignup.controller';
```

Add route:

```ts
resellerSignupRouter.post('/register-reseller/webhook', webhookHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/resellerSignup.webhook.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/resellerSignup tests/modules/resellerSignup.webhook.test.ts
git commit -m "feat: add reseller signup webhook with tenant/user/subscription activation"
```

---

## Task 7: Wire Into the App & Full Lifecycle Integration Test

**Files:**
- Modify: `src/app.ts` (mount `plansRouter`, `publicPlansRouter`, `resellerSignupRouter`)
- Test: `tests/integration/reseller-signup-lifecycle.test.ts`

**Interfaces:**
- Consumes: `plansRouter`/`publicPlansRouter` (Tasks 3–4), `resellerSignupRouter` (Tasks 5–6), `createApp` (foundation).
- Produces: nothing new — proves the whole reseller-plans-and-signup flow works end-to-end inside the fully wired app.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/reseller-signup-lifecycle.test.ts`:

```ts
jest.mock('../../src/common/smtpEmail', () => ({
  smtpEmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';

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

describe('full reseller signup lifecycle', () => {
  const app = createApp();
  const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });

  it('admin creates a plan -> reseller registers -> webhook activates everything', async () => {
    const planRes = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ scope: 'reseller', name: 'Starter Annual', price: 999, billingCycle: 'annual' });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.plan._id;

    const publicPlansRes = await request(app).get('/api/v1/plans');
    expect(publicPlansRes.status).toBe(200);
    expect(publicPlansRes.body.plans.some((p: { _id: string }) => p._id === planId)).toBe(true);

    const registerRes = await request(app).post('/api/v1/auth/register-reseller').send({
      businessName: 'Full Lifecycle Reseller',
      subdomain: 'full-lifecycle-reseller',
      email: 'owner@fulllifecycle.example',
      password: 'longenough1',
      planId,
    });
    expect(registerRes.status).toBe(201);
    const { tenantId, userId, subscriptionId, gatewayOrderId } = registerRes.body;

    const webhookBody = JSON.stringify({ gatewayOrderId, success: true });
    const webhookRes = await request(app)
      .post('/api/v1/auth/register-reseller/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(webhookBody))
      .send(webhookBody);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.subscription.status).toBe('active');

    expect(tenantId).toBeDefined();
    expect(userId).toBeDefined();
    expect(subscriptionId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/reseller-signup-lifecycle.test.ts`
Expected: FAIL — `createApp()` doesn't mount any of the new routers yet, so `/api/v1/admin/plans` 404s

- [ ] **Step 3: Modify `src/app.ts`** — mount the three new routers

Add to the imports:

```ts
import { plansRouter } from './modules/plans/plans.routes';
import { publicPlansRouter } from './modules/plans/public.routes';
import { resellerSignupRouter } from './modules/resellerSignup/resellerSignup.routes';
```

Add alongside the other `app.use('/api/v1/...')` lines:

```ts
app.use('/api/v1/admin/plans', plansRouter);
app.use('/api/v1', publicPlansRouter);
app.use('/api/v1/auth', resellerSignupRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/reseller-signup-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.ts tests/integration/reseller-signup-lifecycle.test.ts
git commit -m "feat: wire plans and reseller signup routers into the app"
```

---

## Post-plan verification

Run the entire suite once more and confirm a clean build:

```bash
npm test
npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project (per the PRD decomposition) should cover the Reseller Onboarding Wizard (branding, domain, SMTP, gateway config), real Razorpay wiring, or the frontend applications — to be brainstormed separately.
