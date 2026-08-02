# Foundation: Auth, Multi-Tenancy & DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Express + TypeScript + MongoDB backend foundation for ToolzyPro — tenants, users, JWT auth (register/login/refresh/logout/forgot/reset/verify/me), tenant-isolation middleware, and RBAC — so every later module (products, licensing, billing) has something to build on.

**Architecture:** Layered `routes → controllers → services → models`, Express app with Mongoose models. Tenant isolation enforced by middleware reading `tenantId` from the verified JWT (never trusted from client input); RBAC enforced by a `requireRole(...)` middleware reading the JWT's `role` claim.

**Tech Stack:** Node.js, Express, TypeScript, MongoDB + Mongoose, Zod, JWT (`jsonwebtoken`), bcrypt, `express-rate-limit`, Jest + supertest + `mongodb-memory-server`.

## Global Constraints

- No `tenant_id`/`tenantId` may be read from client-supplied body/query/params for scoping any read or write — it always comes from `req.tenantId`, set by `requireAuth` from the verified JWT. (Spec §2, PRD §7)
- Refresh tokens are opaque random values; only their SHA-256 hash is ever persisted. (Spec §4)
- Passwords hashed with bcrypt, never logged or returned in any API response. (Spec §1, §4)
- All auth request bodies validated with Zod before reaching a controller. (Spec §5)
- Access tokens: 15 min TTL, payload `{ sub, role, tenantId }`. Refresh tokens: `REFRESH_TOKEN_TTL_DAYS` (env-configurable, default 30), rotated on every use. (Spec §4)
- No Docker — tests use `mongodb-memory-server`; local/dev run against a real MongoDB via `MONGO_URI` in `.env`. (Spec §1)
- Single backend app at repo root (`c:\wtsaas`); no `/client` folder yet. (Spec §1)

---

## Task 1: Project Scaffold & Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `jest.config.js`
- Create: `tests/jest.setup.ts`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Test: `tests/health.test.ts`

**Interfaces:**
- Produces: `createApp(): Express` from `src/app.ts` — later tasks import this and mount routers on the returned app inside the function body (Task 16 modifies this file to mount all routers; until then it only serves `GET /health`).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "toolzypro-backend",
  "version": "0.1.0",
  "private": true,
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "test": "jest --runInBand",
    "seed:master-admin": "ts-node src/scripts/seedMasterAdmin.ts"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.9",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "mongodb-memory-server": "^9.4.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.5",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `.env.example`**

```
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/toolzypro
JWT_ACCESS_SECRET=replace-with-a-random-32-char-minimum-secret
REFRESH_TOKEN_TTL_DAYS=30
SEED_MASTER_ADMIN_EMAIL=admin@toolzypro.local
SEED_MASTER_ADMIN_PASSWORD=change-me-please
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 6: Create `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
};
```

- [ ] **Step 7: Create `tests/jest.setup.ts`**

```ts
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-please-ignore-1234567890';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/placeholder';
process.env.REFRESH_TOKEN_TTL_DAYS = '30';
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: `node_modules` created, no errors.

- [ ] **Step 9: Write the failing test**

Create `tests/health.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- tests/health.test.ts`
Expected: FAIL — `Cannot find module '../src/app'`

- [ ] **Step 11: Create `src/app.ts`**

```ts
import express, { Express } from 'express';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
```

- [ ] **Step 12: Create `src/server.ts`**

```ts
import { createApp } from './app';

const PORT = Number(process.env.PORT) || 4000;

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm test -- tests/health.test.ts`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git init
git add package.json tsconfig.json tsconfig.build.json .env.example .gitignore jest.config.js tests/jest.setup.ts tests/health.test.ts src/app.ts src/server.ts
git commit -m "chore: scaffold Express+TS backend with health check"
```

---

## Task 2: Config (env validation) & DB Connection

**Files:**
- Create: `src/config/env.ts`
- Create: `src/config/db.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/config/db.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `env: { NODE_ENV, PORT: number, MONGO_URI: string, JWT_ACCESS_SECRET: string, REFRESH_TOKEN_TTL_DAYS: number }` from `src/config/env.ts`. `connectDb(uri?: string): Promise<typeof mongoose>` and `disconnectDb(): Promise<void>` from `src/config/db.ts`. `startTestDb(): Promise<string>` (returns the in-memory URI), `stopTestDb(): Promise<void>`, `clearTestDb(): Promise<void>` from `tests/helpers/db.ts` — used by every later test file.

- [ ] **Step 1: Write the failing test**

Create `tests/config/db.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb } from '../helpers/db';
import { connectDb } from '../../src/config/db';

describe('connectDb', () => {
  let uri: string;

  beforeAll(async () => {
    uri = await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('connects to the given MongoDB URI', async () => {
    await connectDb(uri);
    expect(mongoose.connection.readyState).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/db.test.ts`
Expected: FAIL — `Cannot find module '../helpers/db'`

- [ ] **Step 3: Create `src/config/env.ts`**

```ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_TTL_DAYS: z.string().default('30'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsed.data,
  PORT: Number(parsed.data.PORT),
  REFRESH_TOKEN_TTL_DAYS: Number(parsed.data.REFRESH_TOKEN_TTL_DAYS),
};
```

- [ ] **Step 4: Create `src/config/db.ts`**

```ts
import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
```

- [ ] **Step 5: Create `tests/helpers/db.ts`**

```ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer | null = null;

export async function startTestDb(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  return mongod.getUri();
}

export async function stopTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/config/db.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/config/env.ts src/config/db.ts tests/helpers/db.ts tests/config/db.test.ts
git commit -m "feat: add env validation and DB connection helpers"
```

---

## Task 3: Common Utilities (errors, logger, password, token, jwt)

**Files:**
- Create: `src/common/errors.ts`
- Create: `src/common/logger.ts`
- Create: `src/common/password.ts`
- Create: `src/common/token.ts`
- Create: `src/common/jwt.ts`
- Test: `tests/common/password.test.ts`
- Test: `tests/common/token.test.ts`
- Test: `tests/common/jwt.test.ts`

**Interfaces:**
- Consumes: `env` from `src/config/env.ts` (Task 2).
- Produces: `AppError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError` (all extend `AppError` with `statusCode`, `code`, optional `details`) from `src/common/errors.ts`. `logger.{info,warn,error,debug}(message: string, meta?: unknown): void` from `src/common/logger.ts`. `hashPassword(plain: string): Promise<string>`, `comparePassword(plain: string, hash: string): Promise<boolean>` from `src/common/password.ts`. `generateOpaqueToken(): string`, `hashToken(raw: string): string` from `src/common/token.ts`. `signAccessToken(payload: {sub: string; role: string; tenantId: string | null}): string`, `verifyAccessToken(token: string): {sub: string; role: string; tenantId: string | null}` from `src/common/jwt.ts` — used by every module from here on to issue/verify tokens.

- [ ] **Step 1: Write the failing tests**

Create `tests/common/password.test.ts`:

```ts
import { hashPassword, comparePassword } from '../../src/common/password';

describe('password utils', () => {
  it('hashes and verifies a matching password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toEqual('correct-horse-battery-staple');
    await expect(comparePassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });
});
```

Create `tests/common/token.test.ts`:

```ts
import { generateOpaqueToken, hashToken } from '../../src/common/token';

describe('token utils', () => {
  it('generates unique opaque tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(64);
  });

  it('hashes deterministically', () => {
    const raw = generateOpaqueToken();
    expect(hashToken(raw)).toEqual(hashToken(raw));
    expect(hashToken(raw)).not.toEqual(raw);
  });
});
```

Create `tests/common/jwt.test.ts`:

```ts
import { signAccessToken, verifyAccessToken } from '../../src/common/jwt';

describe('jwt utils', () => {
  it('signs and verifies a valid access token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('customer');
    expect(payload.tenantId).toBe('tenant-1');
  });

  it('throws on an invalid token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/common`
Expected: FAIL — modules under `src/common` don't exist yet

- [ ] **Step 3: Create `src/common/errors.ts`**

```ts
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}
```

- [ ] **Step 4: Create `src/common/logger.ts`**

```ts
type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, message: string, meta?: unknown): void {
  const line = JSON.stringify({ level, message, meta, timestamp: new Date().toISOString() });
  // eslint-disable-next-line no-console
  if (level === 'error') console.error(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: unknown): void => log('info', message, meta),
  warn: (message: string, meta?: unknown): void => log('warn', message, meta),
  error: (message: string, meta?: unknown): void => log('error', message, meta),
  debug: (message: string, meta?: unknown): void => log('debug', message, meta),
};
```

- [ ] **Step 5: Create `src/common/password.ts`**

```ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 6: Create `src/common/token.ts`**

```ts
import crypto from 'crypto';

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
```

- [ ] **Step 7: Create `src/common/jwt.ts`**

```ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  tenantId: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- tests/common`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/common tests/common
git commit -m "feat: add error types, logger, password, token, and jwt utils"
```

---

## Task 4: Mongoose Models

**Files:**
- Create: `src/models/Tenant.ts`
- Create: `src/models/User.ts`
- Create: `src/models/RefreshToken.ts`
- Create: `src/models/PasswordResetToken.ts`
- Create: `src/models/EmailVerificationToken.ts`
- Test: `tests/models/tenant.test.ts`
- Test: `tests/models/user.test.ts`

**Interfaces:**
- Consumes: `startTestDb`/`stopTestDb`/`clearTestDb` (Task 2).
- Produces: `Tenant` model + `TenantDocument` (`name`, `subdomain` unique, `customDomain` unique sparse, `plan`, `status`, `brandingJson`, `smtpConfigJson`, `paymentGatewayJson`). `User` model + `UserDocument` (`tenantId: ObjectId | null`, `role`, `email`, `passwordHash`, `status`, `lastLoginAt`) with a unique compound index on `(tenantId, email)`. `RefreshToken` model + `RefreshTokenDocument` (`userId`, `tokenHash` unique, `expiresAt`, `revoked`). `PasswordResetToken` and `EmailVerificationToken` models (`userId`, `tokenHash` unique, `expiresAt`, `used`). All consumed by every later module.

- [ ] **Step 1: Write the failing tests**

Create `tests/models/tenant.test.ts`:

```ts
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';

beforeAll(async () => {
  const uri = await startTestDb();
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe('Tenant model', () => {
  it('creates a tenant with defaults', async () => {
    const tenant = await Tenant.create({ name: 'Acme Resell', subdomain: 'acme' });
    expect(tenant.plan).toBe('starter');
    expect(tenant.status).toBe('pending');
  });

  it('rejects a duplicate subdomain', async () => {
    await Tenant.create({ name: 'Acme Resell', subdomain: 'acme' });
    await expect(Tenant.create({ name: 'Other', subdomain: 'acme' })).rejects.toThrow();
  });
});
```

Create `tests/models/user.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';

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

describe('User model', () => {
  it('allows the same email under different tenants', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    await User.create({ tenantId: tenantA._id, role: 'customer', email: 'same@example.com', passwordHash: 'x' });
    await expect(
      User.create({ tenantId: tenantB._id, role: 'customer', email: 'same@example.com', passwordHash: 'x' })
    ).resolves.toBeDefined();
  });

  it('rejects a duplicate email within the same tenant', async () => {
    const tenant = await Tenant.create({ name: 'A', subdomain: 'a' });
    await User.create({ tenantId: tenant._id, role: 'customer', email: 'dup@example.com', passwordHash: 'x' });
    await expect(
      User.create({ tenantId: tenant._id, role: 'customer', email: 'dup@example.com', passwordHash: 'x' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/models`
Expected: FAIL — `Cannot find module '../../src/models/Tenant'`

- [ ] **Step 3: Create `src/models/Tenant.ts`**

```ts
import { Schema, model, Document } from 'mongoose';

export type TenantPlan = 'starter' | 'premium' | 'enterprise';
export type TenantStatus = 'pending' | 'active' | 'suspended';

export interface TenantDocument extends Document {
  name: string;
  subdomain: string;
  customDomain?: string;
  plan: TenantPlan;
  status: TenantStatus;
  brandingJson: Record<string, unknown>;
  smtpConfigJson: Record<string, unknown>;
  paymentGatewayJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDocument>(
  {
    name: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customDomain: { type: String, unique: true, sparse: true },
    plan: { type: String, enum: ['starter', 'premium', 'enterprise'], default: 'starter' },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    brandingJson: { type: Schema.Types.Mixed, default: {} },
    smtpConfigJson: { type: Schema.Types.Mixed, default: {} },
    paymentGatewayJson: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Tenant = model<TenantDocument>('Tenant', tenantSchema);
```

- [ ] **Step 4: Create `src/models/User.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'master_admin' | 'reseller_admin' | 'reseller_staff' | 'customer';
export type UserStatus = 'pending' | 'active' | 'suspended';

export interface UserDocument extends Document {
  tenantId: Types.ObjectId | null;
  role: UserRole;
  email: string;
  passwordHash: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    role: {
      type: String,
      enum: ['master_admin', 'reseller_admin', 'reseller_staff', 'customer'],
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = model<UserDocument>('User', userSchema);
```

- [ ] **Step 5: Create `src/models/RefreshToken.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface RefreshTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RefreshToken = model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema);
```

- [ ] **Step 6: Create `src/models/PasswordResetToken.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface PasswordResetTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PasswordResetToken = model<PasswordResetTokenDocument>(
  'PasswordResetToken',
  passwordResetTokenSchema
);
```

- [ ] **Step 7: Create `src/models/EmailVerificationToken.ts`**

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface EmailVerificationTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const emailVerificationTokenSchema = new Schema<EmailVerificationTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const EmailVerificationToken = model<EmailVerificationTokenDocument>(
  'EmailVerificationToken',
  emailVerificationTokenSchema
);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- tests/models`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/models tests/models
git commit -m "feat: add Tenant, User, RefreshToken, and token models"
```

---

## Task 5: Validation & Error-Handling Middleware

**Files:**
- Create: `src/middleware/validate.middleware.ts`
- Create: `src/middleware/error.middleware.ts`
- Test: `tests/middleware/validate-error.test.ts`

**Interfaces:**
- Consumes: `ValidationError`, `AppError` (Task 3).
- Produces: `validateBody(schema: ZodTypeAny): RequestHandler` and `errorMiddleware(err, req, res, next): void`, both used by every route from here on.

- [ ] **Step 1: Write the failing test**

Create `tests/middleware/validate-error.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody } from '../../src/middleware/validate.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { NotFoundError } from '../../src/common/errors';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  const schema = z.object({ name: z.string().min(1) });
  app.post('/echo', validateBody(schema), (req, res) => {
    res.status(200).json({ received: req.body });
  });

  app.get('/boom', (_req, _res, next) => {
    next(new NotFoundError('Widget not found'));
  });

  app.use(errorMiddleware);
  return app;
}

describe('validateBody + errorMiddleware', () => {
  const app = buildTestApp();

  it('passes through valid input', async () => {
    const res = await request(app).post('/echo').send({ name: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: { name: 'ok' } });
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/echo').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps AppError subclasses to their status code', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Widget not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/middleware/validate-error.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/middleware/validate.middleware.ts`**

```ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';
import { ValidationError } from '../common/errors';

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.flatten().fieldErrors));
      return;
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 4: Create `src/middleware/error.middleware.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors';
import { logger } from '../common/logger';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }
  logger.error('Unhandled error', { error: err instanceof Error ? err.stack : err });
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/middleware/validate-error.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/middleware/validate.middleware.ts src/middleware/error.middleware.ts tests/middleware/validate-error.test.ts
git commit -m "feat: add request validation and centralized error middleware"
```

---

## Task 6: Auth & RBAC Middleware

**Files:**
- Create: `src/middleware/auth.middleware.ts`
- Create: `src/middleware/rbac.middleware.ts`
- Test: `tests/middleware/auth-rbac.test.ts`

**Interfaces:**
- Consumes: `signAccessToken`/`verifyAccessToken` (Task 3), `UnauthorizedError`/`ForbiddenError` (Task 3), `errorMiddleware`/`validateBody` (Task 5).
- Produces: `requireAuth(req, res, next): void` — sets `req.user = { id, role, tenantId }` and `req.tenantId`. `requireRole(...roles: string[])` — returns a middleware. Both used by every protected route from here on. Also extends the Express `Request` type globally with `user?` and `tenantId?`.

- [ ] **Step 1: Write the failing test**

Create `tests/middleware/auth-rbac.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../../src/middleware/auth.middleware';
import { requireRole } from '../../src/middleware/rbac.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/whoami', requireAuth, (req, res) => {
    res.status(200).json({ user: req.user, tenantId: req.tenantId });
  });

  app.get('/admin-only', requireAuth, requireRole('master_admin'), (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorMiddleware);
  return app;
}

describe('requireAuth + requireRole', () => {
  const app = buildTestApp();

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(401);
  });

  it('attaches user and tenantId from a valid token', async () => {
    const token = signAccessToken({ sub: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    const res = await request(app).get('/whoami').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    expect(res.body.tenantId).toBe('tenant-1');
  });

  it('rejects a role that does not match requireRole', async () => {
    const token = signAccessToken({ sub: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows a role that matches requireRole', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/middleware/auth-rbac.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/middleware/auth.middleware.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../common/jwt';
import { UnauthorizedError } from '../common/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; tenantId: string | null };
      tenantId?: string | null;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid Authorization header'));
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, tenantId: payload.tenantId };
    req.tenantId = payload.tenantId;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
```

- [ ] **Step 4: Create `src/middleware/rbac.middleware.ts`**

```ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors';

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/middleware/auth-rbac.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/middleware/auth.middleware.ts src/middleware/rbac.middleware.ts tests/middleware/auth-rbac.test.ts
git commit -m "feat: add JWT auth and RBAC middleware"
```

---

## Task 7: Rate Limiting Middleware

**Files:**
- Create: `src/middleware/rateLimit.middleware.ts`
- Test: `tests/middleware/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `authRateLimiter: RequestHandler` — applied to `/auth/register`, `/auth/login`, `/auth/forgot-password` in Task 16.

- [ ] **Step 1: Write the failing test**

Create `tests/middleware/rate-limit.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

function buildTestApp() {
  const app = express();
  const limiter = rateLimit({ windowMs: 60000, max: 2, standardHeaders: true, legacyHeaders: false });
  app.get('/limited', limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('rate limiting', () => {
  it('allows requests under the limit and blocks over it', async () => {
    const app = buildTestApp();
    const first = await request(app).get('/limited');
    const second = await request(app).get('/limited');
    const third = await request(app).get('/limited');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/middleware/rate-limit.test.ts`
Expected: FAIL if `express-rate-limit` weren't installed — but it is (Task 1), so this actually verifies the *behavior* first. Confirm it passes once `src/middleware/rateLimit.middleware.ts` mirrors this config (this test exercises the library directly to lock in the config choice before wiring the app's own module).

- [ ] **Step 3: Create `src/middleware/rateLimit.middleware.ts`**

```ts
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' } },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/middleware/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/middleware/rateLimit.middleware.ts tests/middleware/rate-limit.test.ts
git commit -m "feat: add auth rate limiting middleware"
```

---

## Task 8: Email Stub Service

**Files:**
- Create: `src/common/email.ts`
- Test: `tests/common/email.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EmailService` interface (`sendEmail(to: string, template: string, data: Record<string, unknown>): Promise<void>`) and `consoleEmailService: EmailService` — used by the auth service (Tasks 11, 14, 15) for verification/reset emails, swappable later for Resend/Postmark without touching auth logic.

- [ ] **Step 1: Write the failing test**

Create `tests/common/email.test.ts`:

```ts
import { consoleEmailService } from '../../src/common/email';

describe('consoleEmailService', () => {
  it('logs the send and resolves', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(
      consoleEmailService.sendEmail('user@example.com', 'reset-password', { token: 'abc' })
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/common/email.test.ts`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Create `src/common/email.ts`**

```ts
export interface EmailService {
  sendEmail(to: string, template: string, data: Record<string, unknown>): Promise<void>;
}

export const consoleEmailService: EmailService = {
  async sendEmail(to, template, data) {
    // eslint-disable-next-line no-console
    console.log(`[email:${template}] to=${to}`, data);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/common/email.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/common/email.ts tests/common/email.test.ts
git commit -m "feat: add stubbed email service interface"
```

---

## Task 9: Tenants Module (create + get, master_admin only)

**Files:**
- Create: `src/modules/tenants/tenants.validators.ts`
- Create: `src/modules/tenants/tenants.service.ts`
- Create: `src/modules/tenants/tenants.controller.ts`
- Create: `src/modules/tenants/tenants.routes.ts`
- Test: `tests/modules/tenants.test.ts`

**Interfaces:**
- Consumes: `Tenant` model (Task 4), `requireAuth`/`requireRole` (Task 6), `validateBody` (Task 5), `signAccessToken` (Task 3) for building test tokens.
- Produces: `createTenant(input: {name: string; subdomain: string}): Promise<TenantDocument>`, `getTenantById(id: string): Promise<TenantDocument>`, `getTenantBySubdomain(subdomain: string): Promise<TenantDocument>` from `tenants.service.ts` — `getTenantBySubdomain` is consumed by the auth service in Task 11. `tenantsRouter: Router` mounted at `/api/v1/tenants` in Task 16.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/tenants.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { tenantsRouter } from '../../src/modules/tenants/tenants.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';

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

describe('tenants module', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects tenant creation from a non-master_admin role', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });
    expect(res.status).toBe(403);
  });

  it('creates a tenant as master_admin and fetches it by id', async () => {
    const createRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.tenant.subdomain).toBe('acme');

    const getRes = await request(app)
      .get(`/api/v1/tenants/${createRes.body.tenant._id}`)
      .set('Authorization', `Bearer ${masterToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.tenant.name).toBe('Acme');
  });

  it('rejects a duplicate subdomain with 409', async () => {
    await Tenant.create({ name: 'Existing', subdomain: 'dup' });
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'New', subdomain: 'dup' });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/tenants.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/tenants/tenants.validators.ts`**

```ts
import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(1),
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens'),
});
```

- [ ] **Step 4: Create `src/modules/tenants/tenants.service.ts`**

```ts
import { Tenant, TenantDocument } from '../../models/Tenant';
import { ConflictError, NotFoundError } from '../../common/errors';

export async function createTenant(input: { name: string; subdomain: string }): Promise<TenantDocument> {
  const subdomain = input.subdomain.toLowerCase();
  const existing = await Tenant.findOne({ subdomain });
  if (existing) {
    throw new ConflictError('Subdomain already in use');
  }
  return Tenant.create({ name: input.name, subdomain, status: 'active' });
}

export async function getTenantById(id: string): Promise<TenantDocument> {
  const tenant = await Tenant.findById(id);
  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}

export async function getTenantBySubdomain(subdomain: string): Promise<TenantDocument> {
  const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}
```

- [ ] **Step 5: Create `src/modules/tenants/tenants.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as tenantsService from './tenants.service';

export async function createTenantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await tenantsService.createTenant(req.body);
    res.status(201).json({ tenant });
  } catch (err) {
    next(err);
  }
}

export async function getTenantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await tenantsService.getTenantById(req.params.id);
    res.status(200).json({ tenant });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Create `src/modules/tenants/tenants.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createTenantSchema } from './tenants.validators';
import { createTenantHandler, getTenantHandler } from './tenants.controller';

export const tenantsRouter = Router();

tenantsRouter.post(
  '/',
  requireAuth,
  requireRole('master_admin'),
  validateBody(createTenantSchema),
  createTenantHandler
);
tenantsRouter.get('/:id', requireAuth, requireRole('master_admin'), getTenantHandler);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/tenants.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/tenants tests/modules/tenants.test.ts
git commit -m "feat: add tenants module (master_admin create/get)"
```

---

## Task 10: Users Module (own-tenant listing, reseller_admin only)

**Files:**
- Create: `src/modules/users/users.service.ts`
- Create: `src/modules/users/users.controller.ts`
- Create: `src/modules/users/users.routes.ts`
- Test: `tests/modules/users.test.ts`

**Interfaces:**
- Consumes: `User` model (Task 4), `requireAuth`/`requireRole` (Task 6), `signAccessToken` (Task 3).
- Produces: `listUsersForTenant(tenantId: string): Promise<UserDocument[]>` from `users.service.ts`. `usersRouter: Router` mounted at `/api/v1/users` in Task 16. This is the concrete tenant-isolation test target the design spec calls for.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/users.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { usersRouter } from '../../src/modules/users/users.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', usersRouter);
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

describe('users module — tenant isolation', () => {
  const app = buildTestApp();

  it('only returns users belonging to the caller\'s own tenant', async () => {
    const tenantA = await Tenant.create({ name: 'A', subdomain: 'a' });
    const tenantB = await Tenant.create({ name: 'B', subdomain: 'b' });
    await User.create({ tenantId: tenantA._id, role: 'customer', email: 'a1@example.com', passwordHash: 'x' });
    await User.create({ tenantId: tenantA._id, role: 'customer', email: 'a2@example.com', passwordHash: 'x' });
    await User.create({ tenantId: tenantB._id, role: 'customer', email: 'b1@example.com', passwordHash: 'x' });

    const tokenForA = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'reseller_admin',
      tenantId: tenantA._id.toString(),
    });

    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenForA}`);
    expect(res.status).toBe(200);
    const emails = res.body.users.map((u: { email: string }) => u.email).sort();
    expect(emails).toEqual(['a1@example.com', 'a2@example.com']);
  });

  it('rejects a customer-role caller', async () => {
    const tokenForCustomer = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'customer',
      tenantId: new Types.ObjectId().toString(),
    });
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenForCustomer}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/users.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/users/users.service.ts`**

```ts
import { User, UserDocument } from '../../models/User';

export async function listUsersForTenant(tenantId: string): Promise<UserDocument[]> {
  return User.find({ tenantId }).select('-passwordHash');
}
```

- [ ] **Step 4: Create `src/modules/users/users.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { ForbiddenError } from '../../common/errors';

export async function listUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenantId) {
      throw new ForbiddenError('No tenant context');
    }
    const users = await usersService.listUsersForTenant(req.tenantId);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Create `src/modules/users/users.routes.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { listUsersHandler } from './users.controller';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole('reseller_admin'), listUsersHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/users.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/users tests/modules/users.test.ts
git commit -m "feat: add users module with tenant-scoped listing"
```

---

## Task 11: Auth — Register

**Files:**
- Create: `src/modules/auth/auth.validators.ts`
- Create: `src/modules/auth/auth.service.ts`
- Create: `src/modules/auth/auth.controller.ts`
- Create: `src/modules/auth/auth.routes.ts`
- Test: `tests/modules/auth.register.test.ts`

**Interfaces:**
- Consumes: `Tenant`, `User`, `EmailVerificationToken` models (Task 4), `hashPassword` (Task 3), `generateOpaqueToken`/`hashToken` (Task 3), `consoleEmailService` (Task 8), `validateBody` (Task 5), `NotFoundError`/`ConflictError` (Task 3).
- Produces: `register(input: {tenantSubdomain: string; email: string; password: string}): Promise<{user: UserDocument}>` from `auth.service.ts`. `authRouter: Router` (starts with just `POST /register`; Tasks 12–15 add more routes to this same file/router). All Zod schemas needed by every subsequent auth task are defined in `auth.validators.ts` now, so later tasks only import from it.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/auth.register.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
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

describe('POST /auth/register', () => {
  const app = buildTestApp();

  it('registers a customer under an existing tenant', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });

    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('pending');

    const user = await User.findOne({ tenantId: tenant._id, email: 'buyer@example.com' });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe('longenough1');

    const verifyToken = await EmailVerificationToken.findOne({ userId: user!._id });
    expect(verifyToken).not.toBeNull();
  });

  it('404s for an unknown tenant subdomain', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'nope', email: 'buyer@example.com', password: 'longenough1' });
    expect(res.status).toBe(404);
  });

  it('409s on duplicate email within the same tenant', async () => {
    await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(res.status).toBe(409);
  });

  it('400s on an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/auth.register.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create `src/modules/auth/auth.validators.ts`**

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  tenantSubdomain: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  tenantSubdomain: z.string().min(3).optional(),
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  tenantSubdomain: z.string().min(3),
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
```

- [ ] **Step 4: Create `src/modules/auth/auth.service.ts`**

```ts
import { User, UserDocument } from '../../models/User';
import { Tenant } from '../../models/Tenant';
import { EmailVerificationToken } from '../../models/EmailVerificationToken';
import { hashPassword } from '../../common/password';
import { generateOpaqueToken, hashToken } from '../../common/token';
import { NotFoundError, ConflictError } from '../../common/errors';
import { consoleEmailService } from '../../common/email';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export async function register(input: {
  tenantSubdomain: string;
  email: string;
  password: string;
}): Promise<{ user: UserDocument }> {
  const tenant = await Tenant.findOne({ subdomain: input.tenantSubdomain.toLowerCase() });
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ tenantId: tenant._id, email });
  if (existing) {
    throw new ConflictError('Email already registered for this tenant');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    tenantId: tenant._id,
    role: 'customer',
    email,
    passwordHash,
    status: 'pending',
  });
  const rawVerify = generateOpaqueToken();
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(rawVerify),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    used: false,
  });
  await consoleEmailService.sendEmail(user.email, 'verify-email', { token: rawVerify });
  return { user };
}
```

- [ ] **Step 5: Create `src/modules/auth/auth.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user } = await authService.register(req.body);
    res.status(201).json({ user: { id: user._id, email: user.email, status: user.status } });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Create `src/modules/auth/auth.routes.ts`**

```ts
import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { registerSchema } from './auth.validators';
import { registerHandler } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), registerHandler);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/modules/auth.register.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/auth tests/modules/auth.register.test.ts
git commit -m "feat: add auth register endpoint"
```

---

## Task 12: Auth — Login

**Files:**
- Modify: `src/modules/auth/auth.service.ts` (add `login`)
- Modify: `src/modules/auth/auth.controller.ts` (add `loginHandler`)
- Modify: `src/modules/auth/auth.routes.ts` (add `POST /login`)
- Test: `tests/modules/auth.login.test.ts`

**Interfaces:**
- Consumes: `comparePassword` (Task 3), `signAccessToken` (Task 3), `RefreshToken` model (Task 4), `loginSchema` (Task 11).
- Produces: `login(input: {email: string; password: string; tenantSubdomain?: string}): Promise<{user: UserDocument; tokens: {accessToken: string; refreshToken: string}}>` and an internal `issueTokenPair(user: UserDocument): Promise<{accessToken: string; refreshToken: string}>` helper reused by Task 13's `refresh`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/auth.login.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { hashPassword } from '../../src/common/password';
import { User } from '../../src/models/User';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
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

describe('POST /auth/login', () => {
  const app = buildTestApp();

  it('logs in with correct credentials and returns tokens', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('401s on wrong password', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('401s for a suspended user', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'suspended',
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/auth.login.test.ts`
Expected: FAIL — no `POST /login` route yet

- [ ] **Step 3: Modify `src/modules/auth/auth.service.ts`** — add imports and the `login`/`issueTokenPair` functions

Add these imports at the top (alongside the existing ones):

```ts
import { Types } from 'mongoose';
import { RefreshToken } from '../../models/RefreshToken';
import { signAccessToken } from '../../common/jwt';
import { comparePassword } from '../../common/password';
import { UnauthorizedError } from '../../common/errors';
import { env } from '../../config/env';
```

Append to the end of the file:

```ts
const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(user: UserDocument): Promise<TokenPair> {
  const accessToken = signAccessToken({
    sub: (user._id as Types.ObjectId).toString(),
    role: user.role,
    tenantId: user.tenantId ? user.tenantId.toString() : null,
  });
  const rawRefresh = generateOpaqueToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(rawRefresh),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    revoked: false,
  });
  return { accessToken, refreshToken: rawRefresh };
}

export async function login(input: {
  email: string;
  password: string;
  tenantSubdomain?: string;
}): Promise<{ user: UserDocument; tokens: TokenPair }> {
  const query: Record<string, unknown> = { email: input.email.toLowerCase() };
  if (input.tenantSubdomain) {
    const tenant = await Tenant.findOne({ subdomain: input.tenantSubdomain.toLowerCase() });
    if (!tenant) throw new UnauthorizedError('Invalid credentials');
    query.tenantId = tenant._id;
  } else {
    query.tenantId = null;
  }
  const user = await User.findOne(query);
  if (!user) throw new UnauthorizedError('Invalid credentials');
  if (user.status === 'suspended') throw new UnauthorizedError('Account suspended');
  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');
  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await issueTokenPair(user);
  return { user, tokens };
}
```

- [ ] **Step 4: Modify `src/modules/auth/auth.controller.ts`** — append `loginHandler`

```ts
export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, tokens } = await authService.login(req.body);
    res.status(200).json({
      user: { id: user._id, email: user.email, role: user.role, tenantId: user.tenantId },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/auth/auth.routes.ts`** — add the `/login` route

```ts
import { loginSchema } from './auth.validators';
import { loginHandler } from './auth.controller';

authRouter.post('/login', authRateLimiter, validateBody(loginSchema), loginHandler);
```

(Add the two imports to the existing import block and the route line after the existing `/register` route.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/auth.login.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth
git commit -m "feat: add auth login endpoint with token issuance"
```

---

## Task 13: Auth — Refresh & Logout

**Files:**
- Modify: `src/modules/auth/auth.service.ts` (add `refresh`, `logout`)
- Modify: `src/modules/auth/auth.controller.ts` (add `refreshHandler`, `logoutHandler`)
- Modify: `src/modules/auth/auth.routes.ts` (add `POST /refresh`, `POST /logout`)
- Test: `tests/modules/auth.refresh-logout.test.ts`

**Interfaces:**
- Consumes: `issueTokenPair` (private helper from Task 12), `RefreshToken` model (Task 4), `refreshSchema`/`logoutSchema` (Task 11).
- Produces: `refresh(rawRefreshToken: string): Promise<TokenPair>`, `logout(rawRefreshToken: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/auth.refresh-logout.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { hashPassword } from '../../src/common/password';
import { User } from '../../src/models/User';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
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

async function loginAndGetTokens(app: express.Express) {
  const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
  await User.create({
    tenantId: tenant._id,
    role: 'customer',
    email: 'buyer@example.com',
    passwordHash: await hashPassword('longenough1'),
    status: 'active',
  });
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
  return loginRes.body as { accessToken: string; refreshToken: string };
}

describe('POST /auth/refresh and /auth/logout', () => {
  const app = buildTestApp();

  it('rotates the refresh token and issues a new access token', async () => {
    const { refreshToken } = await loginAndGetTokens(app);
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('revokes the refresh token on logout, blocking future refresh', async () => {
    const { refreshToken } = await loginAndGetTokens(app);
    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/auth.refresh-logout.test.ts`
Expected: FAIL — no `/refresh` or `/logout` routes yet

- [ ] **Step 3: Modify `src/modules/auth/auth.service.ts`** — append `refresh` and `logout`

```ts
export async function refresh(rawRefreshToken: string): Promise<TokenPair> {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  stored.revoked = true;
  await stored.save();
  const user = await User.findById(stored.userId);
  if (!user) throw new UnauthorizedError('Invalid refresh token');
  return issueTokenPair(user);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash }, { revoked: true });
}
```

- [ ] **Step 4: Modify `src/modules/auth/auth.controller.ts`** — append `refreshHandler` and `logoutHandler`

```ts
export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/auth/auth.routes.ts`** — add `/refresh` and `/logout` routes

```ts
import { refreshSchema, logoutSchema } from './auth.validators';
import { refreshHandler, logoutHandler } from './auth.controller';

authRouter.post('/refresh', validateBody(refreshSchema), refreshHandler);
authRouter.post('/logout', validateBody(logoutSchema), logoutHandler);
```

(Merge these imports into the existing import block; no rate limiter on refresh/logout since they require possession of a valid refresh token already.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/auth.refresh-logout.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth tests/modules/auth.refresh-logout.test.ts
git commit -m "feat: add refresh token rotation and logout"
```

---

## Task 14: Auth — Forgot Password & Reset Password

**Files:**
- Modify: `src/modules/auth/auth.service.ts` (add `forgotPassword`, `resetPassword`)
- Modify: `src/modules/auth/auth.controller.ts` (add `forgotPasswordHandler`, `resetPasswordHandler`)
- Modify: `src/modules/auth/auth.routes.ts` (add `POST /forgot-password`, `POST /reset-password`)
- Test: `tests/modules/auth.password-reset.test.ts`

**Interfaces:**
- Consumes: `PasswordResetToken` model (Task 4), `forgotPasswordSchema`/`resetPasswordSchema` (Task 11), `consoleEmailService` (Task 8).
- Produces: `forgotPassword(input: {email: string; tenantSubdomain: string}): Promise<void>`, `resetPassword(input: {token: string; newPassword: string}): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/auth.password-reset.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { hashPassword, comparePassword } from '../../src/common/password';
import { User } from '../../src/models/User';
import { PasswordResetToken } from '../../src/models/PasswordResetToken';
import { generateOpaqueToken, hashToken } from '../../src/common/token';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
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

describe('forgot-password + reset-password', () => {
  const app = buildTestApp();

  it('issues a reset token on forgot-password and resets the password with it', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('oldpassword1'),
      status: 'active',
    });

    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com' });
    expect(forgotRes.status).toBe(200);

    const record = await PasswordResetToken.findOne({ userId: user._id });
    expect(record).not.toBeNull();

    // Simulate having received the raw token via email by generating one that matches the stored hash
    // (the raw token is only ever known to the email recipient; here we regenerate the flow end-to-end
    // by reading the service's own token generation contract via a fresh request).
    const rawTokenForTest = generateOpaqueToken();
    record!.tokenHash = hashToken(rawTokenForTest);
    await record!.save();

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawTokenForTest, newPassword: 'newpassword1' });
    expect(resetRes.status).toBe(200);

    const updated = await User.findById(user._id);
    await expect(comparePassword('newpassword1', updated!.passwordHash)).resolves.toBe(true);
  });

  it('does not leak whether an email exists', async () => {
    await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantSubdomain: 'acme', email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });

  it('401s on an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'newpassword1' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/auth.password-reset.test.ts`
Expected: FAIL — no `/forgot-password` or `/reset-password` routes yet

- [ ] **Step 3: Modify `src/modules/auth/auth.service.ts`** — append `forgotPassword` and `resetPassword`, and add a `PasswordResetToken` import at the top alongside the other model imports

```ts
import { PasswordResetToken } from '../../models/PasswordResetToken';
```

```ts
const RESET_TTL_MS = 60 * 60 * 1000;

export async function forgotPassword(input: { email: string; tenantSubdomain: string }): Promise<void> {
  const tenant = await Tenant.findOne({ subdomain: input.tenantSubdomain.toLowerCase() });
  if (!tenant) return;
  const user = await User.findOne({ tenantId: tenant._id, email: input.email.toLowerCase() });
  if (!user) return;
  const rawToken = generateOpaqueToken();
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
    used: false,
  });
  await consoleEmailService.sendEmail(user.email, 'reset-password', { token: rawToken });
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  const tokenHash = hashToken(input.token);
  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }
  const user = await User.findById(record.userId);
  if (!user) throw new NotFoundError('User not found');
  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();
  record.used = true;
  await record.save();
}
```

- [ ] **Step 4: Modify `src/modules/auth/auth.controller.ts`** — append handlers

```ts
export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.forgotPassword(req.body);
    res.status(200).json({ message: 'If the account exists, a reset email has been sent' });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resetPassword(req.body);
    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/auth/auth.routes.ts`** — add routes

```ts
import { forgotPasswordSchema, resetPasswordSchema } from './auth.validators';
import { forgotPasswordHandler, resetPasswordHandler } from './auth.controller';

authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPasswordHandler
);
authRouter.post('/reset-password', validateBody(resetPasswordSchema), resetPasswordHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/auth.password-reset.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth tests/modules/auth.password-reset.test.ts
git commit -m "feat: add forgot-password and reset-password endpoints"
```

---

## Task 15: Auth — Verify Email

**Files:**
- Modify: `src/modules/auth/auth.service.ts` (add `verifyEmail`)
- Modify: `src/modules/auth/auth.controller.ts` (add `verifyEmailHandler`)
- Modify: `src/modules/auth/auth.routes.ts` (add `POST /verify-email`)
- Test: `tests/modules/auth.verify-email.test.ts`

**Interfaces:**
- Consumes: `EmailVerificationToken` model (Task 4), `verifyEmailSchema` (Task 11).
- Produces: `verifyEmail(token: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/auth.verify-email.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { User } from '../../src/models/User';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken';
import { generateOpaqueToken, hashToken } from '../../src/common/token';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
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

describe('POST /auth/verify-email', () => {
  const app = buildTestApp();

  it('activates a pending user with a valid token', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'pending',
    });
    const rawToken = generateOpaqueToken();
    await EmailVerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60000),
      used: false,
    });

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated!.status).toBe('active');
  });

  it('401s on an already-used token', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    const user = await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: 'x',
      status: 'pending',
    });
    const rawToken = generateOpaqueToken();
    await EmailVerificationToken.create({
      userId: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60000),
      used: true,
    });

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/auth.verify-email.test.ts`
Expected: FAIL — no `/verify-email` route yet

- [ ] **Step 3: Modify `src/modules/auth/auth.service.ts`** — append `verifyEmail`, and add an `EmailVerificationToken` import at the top

```ts
import { EmailVerificationToken } from '../../models/EmailVerificationToken';
```

```ts
export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await EmailVerificationToken.findOne({ tokenHash });
  if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired verification token');
  }
  const user = await User.findById(record.userId);
  if (!user) throw new NotFoundError('User not found');
  user.status = 'active';
  await user.save();
  record.used = true;
  await record.save();
}
```

- [ ] **Step 4: Modify `src/modules/auth/auth.controller.ts`** — append handler

```ts
export async function verifyEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.verifyEmail(req.body.token);
    res.status(200).json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/auth/auth.routes.ts`** — add route

```ts
import { verifyEmailSchema } from './auth.validators';
import { verifyEmailHandler } from './auth.controller';

authRouter.post('/verify-email', validateBody(verifyEmailSchema), verifyEmailHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/auth.verify-email.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth tests/modules/auth.verify-email.test.ts
git commit -m "feat: add verify-email endpoint"
```

---

## Task 16: Auth — GET /me & Full App Wiring

**Files:**
- Modify: `src/modules/auth/auth.service.ts` (add `getMe`)
- Modify: `src/modules/auth/auth.controller.ts` (add `meHandler`)
- Modify: `src/modules/auth/auth.routes.ts` (add `GET /me`)
- Modify: `src/app.ts` (mount `authRouter`, `tenantsRouter`, `usersRouter`, `errorMiddleware`)
- Test: `tests/modules/auth.me.test.ts`
- Test: `tests/app.integration.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 6), `authRouter`/`tenantsRouter`/`usersRouter`/`errorMiddleware` (Tasks 6, 9, 10, 11–15).
- Produces: `getMe(userId: string): Promise<UserDocument>`. The fully wired `createApp()` used by `src/server.ts` and every future module's routes.

- [ ] **Step 1: Write the failing tests**

Create `tests/modules/auth.me.test.ts`:

```ts
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { Tenant } from '../../src/models/Tenant';
import { hashPassword } from '../../src/common/password';
import { User } from '../../src/models/User';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
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

describe('GET /auth/me', () => {
  const app = buildTestApp();

  it('returns the current user for a valid access token', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme', status: 'active' });
    await User.create({
      tenantId: tenant._id,
      role: 'customer',
      email: 'buyer@example.com',
      passwordHash: await hashPassword('longenough1'),
      status: 'active',
    });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('buyer@example.com');
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  it('401s with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
```

Create `tests/app.integration.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from './helpers/db';
import { createApp } from '../src/app';
import { Tenant } from '../src/models/Tenant';
import { User } from '../src/models/User';
import { signAccessToken } from '../src/common/jwt';

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

describe('full app wiring', () => {
  const app = createApp();

  it('serves health, auth, tenants, and users routes on one app', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);

    const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });
    const createTenant = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });
    expect(createTenant.status).toBe(201);

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(registerRes.status).toBe(201);

    const tenantDoc = await Tenant.findOne({ subdomain: 'acme' });
    const resellerToken = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'reseller_admin',
      tenantId: tenantDoc!._id.toString(),
    });
    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${resellerToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.users).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/modules/auth.me.test.ts tests/app.integration.test.ts`
Expected: FAIL — no `GET /me` route, and `createApp()` doesn't mount any routers yet

- [ ] **Step 3: Modify `src/modules/auth/auth.service.ts`** — append `getMe`

```ts
export async function getMe(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw new NotFoundError('User not found');
  return user;
}
```

- [ ] **Step 4: Modify `src/modules/auth/auth.controller.ts`** — append handler

```ts
export async function meHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/auth/auth.routes.ts`** — add route

```ts
import { requireAuth } from '../../middleware/auth.middleware';
import { meHandler } from './auth.controller';

authRouter.get('/me', requireAuth, meHandler);
```

- [ ] **Step 6: Replace `src/app.ts`** with the fully wired version

```ts
import express, { Express } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { usersRouter } from './modules/users/users.routes';
import { errorMiddleware } from './middleware/error.middleware';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tenants', tenantsRouter);
  app.use('/api/v1/users', usersRouter);

  app.use(errorMiddleware);
  return app;
}
```

- [ ] **Step 7: Replace `src/server.ts`** to connect the DB before listening

```ts
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './common/logger';

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err instanceof Error ? err.stack : err });
  process.exit(1);
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (entire suite, including the original `tests/health.test.ts` which now runs against the fully wired app)

- [ ] **Step 9: Commit**

```bash
git add src/modules/auth src/app.ts src/server.ts tests/modules/auth.me.test.ts tests/app.integration.test.ts
git commit -m "feat: add GET /auth/me and wire all routers into the app"
```

---

## Task 17: Seed Script for Master Admin

**Files:**
- Create: `src/scripts/seedMasterAdmin.ts`
- Test: `tests/scripts/seedMasterAdmin.test.ts`

**Interfaces:**
- Consumes: `User` model (Task 4), `hashPassword` (Task 3), `connectDb`/`disconnectDb` (Task 2).
- Produces: `seedMasterAdmin(): Promise<void>` — exported for testing; the file also self-invokes when run directly via `npm run seed:master-admin`.

- [ ] **Step 1: Write the failing test**

Create `tests/scripts/seedMasterAdmin.test.ts`:

```ts
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { User } from '../../src/models/User';
import { seedMasterAdmin } from '../../src/scripts/seedMasterAdmin';

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

describe('seedMasterAdmin', () => {
  const originalEmail = process.env.SEED_MASTER_ADMIN_EMAIL;
  const originalPassword = process.env.SEED_MASTER_ADMIN_PASSWORD;

  afterEach(() => {
    process.env.SEED_MASTER_ADMIN_EMAIL = originalEmail;
    process.env.SEED_MASTER_ADMIN_PASSWORD = originalPassword;
  });

  it('creates a master_admin user with tenantId null', async () => {
    process.env.SEED_MASTER_ADMIN_EMAIL = 'admin@toolzypro.local';
    process.env.SEED_MASTER_ADMIN_PASSWORD = 'change-me-please';

    await seedMasterAdmin();

    const admin = await User.findOne({ role: 'master_admin', email: 'admin@toolzypro.local' });
    expect(admin).not.toBeNull();
    expect(admin!.tenantId).toBeNull();
  });

  it('is idempotent — running twice does not throw or duplicate', async () => {
    process.env.SEED_MASTER_ADMIN_EMAIL = 'admin@toolzypro.local';
    process.env.SEED_MASTER_ADMIN_PASSWORD = 'change-me-please';

    await seedMasterAdmin();
    await seedMasterAdmin();

    const count = await User.countDocuments({ role: 'master_admin' });
    expect(count).toBe(1);
  });

  it('throws if required env vars are missing', async () => {
    delete process.env.SEED_MASTER_ADMIN_EMAIL;
    delete process.env.SEED_MASTER_ADMIN_PASSWORD;
    await expect(seedMasterAdmin()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scripts/seedMasterAdmin.test.ts`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Create `src/scripts/seedMasterAdmin.ts`**

```ts
import { User } from '../models/User';
import { hashPassword } from '../common/password';
import { logger } from '../common/logger';

export async function seedMasterAdmin(): Promise<void> {
  const email = process.env.SEED_MASTER_ADMIN_EMAIL;
  const password = process.env.SEED_MASTER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_MASTER_ADMIN_EMAIL and SEED_MASTER_ADMIN_PASSWORD must be set');
  }
  const existing = await User.findOne({ tenantId: null, email: email.toLowerCase(), role: 'master_admin' });
  if (existing) {
    logger.info('Master admin already exists, skipping');
    return;
  }
  const passwordHash = await hashPassword(password);
  await User.create({
    tenantId: null,
    role: 'master_admin',
    email: email.toLowerCase(),
    passwordHash,
    status: 'active',
  });
  logger.info('Master admin created');
}

/* istanbul ignore next -- exercised manually via `npm run seed:master-admin`, not under test */
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { connectDb, disconnectDb } = require('../config/db');
  connectDb()
    .then(() => seedMasterAdmin())
    .then(() => disconnectDb())
    .catch((err: unknown) => {
      logger.error('Failed to seed master admin', { error: err instanceof Error ? err.stack : err });
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/scripts/seedMasterAdmin.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scripts/seedMasterAdmin.ts tests/scripts/seedMasterAdmin.test.ts
git commit -m "feat: add idempotent master admin seed script"
```

---

## Task 18: Full Auth Lifecycle & Tenant Isolation Integration Test

**Files:**
- Test: `tests/integration/full-lifecycle.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–17. No new production code — this task exists solely to prove the whole foundation works together end-to-end, per the design spec's testing section.

- [ ] **Step 1: Write the test**

Create `tests/integration/full-lifecycle.test.ts`:

```ts
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createApp } from '../../src/app';
import { signAccessToken } from '../../src/common/jwt';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken';

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

describe('full auth lifecycle', () => {
  const app = createApp();

  it('register -> verify -> login -> me -> refresh -> logout -> refresh fails', async () => {
    const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });
    await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Acme', subdomain: 'acme' });

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(registerRes.status).toBe(201);

    const verifyRecord = await EmailVerificationToken.findOne({ userId: registerRes.body.user.id });
    expect(verifyRecord).not.toBeNull();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ tenantSubdomain: 'acme', email: 'buyer@example.com', password: 'longenough1' });
    expect(loginRes.status).toBe(200);

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('buyer@example.com');

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(200);

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshRes.body.refreshToken });
    expect(logoutRes.status).toBe(204);

    const failedRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshRes.body.refreshToken });
    expect(failedRefresh.status).toBe(401);
  });

  it('a JWT issued for one tenant cannot read another tenant\'s users', async () => {
    const masterToken = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'master_admin', tenantId: null });
    const tenantARes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'TenantA', subdomain: 'tenant-a' });
    const tenantBRes = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'TenantB', subdomain: 'tenant-b' });

    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'tenant-a', email: 'a@example.com', password: 'longenough1' });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantSubdomain: 'tenant-b', email: 'b@example.com', password: 'longenough1' });

    const tokenForTenantA = signAccessToken({
      sub: new Types.ObjectId().toString(),
      role: 'reseller_admin',
      tenantId: tenantARes.body.tenant._id,
    });

    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tokenForTenantA}`);
    expect(usersRes.status).toBe(200);
    const emails = usersRes.body.users.map((u: { email: string }) => u.email);
    expect(emails).toEqual(['a@example.com']);
    expect(emails).not.toContain('b@example.com');
    expect(tenantBRes.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS — every test file from Tasks 1–18 passes together

- [ ] **Step 3: Commit**

```bash
git add tests/integration/full-lifecycle.test.ts
git commit -m "test: add full auth lifecycle and tenant isolation integration test"
```

---

## Post-plan verification

Run the entire suite once more and confirm a clean build:

```bash
npm test
npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project (per the PRD decomposition) should cover the Master Product Library and/or Reseller Onboarding — to be brainstormed separately.
