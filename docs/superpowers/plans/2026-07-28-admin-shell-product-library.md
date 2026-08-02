# Master Admin — Shell & Product Library Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Master Admin layout shell (sidebar/topbar/logout) and a full Product Library management screen (list/filter, create, edit, archive, publish, versions, sync-mode), plus the one backend addition needed to support it (a tenant list endpoint).

**Architecture:** Backend: one new read endpoint on the existing `tenants` module. Frontend: a new `pages/admin/` directory with an `AdminLayout` wrapping nested routes, thin typed API wrapper modules (`api/adminProducts.ts`, `api/adminTenants.ts`) that pages call via TanStack Query, following the same patterns established in the Frontend Foundation sub-project.

**Tech Stack:** Same as prior sub-projects — Express/TypeScript/Mongoose/Jest on the backend; Vite/React/TypeScript/TanStack Query/react-hook-form+Zod/Vitest+RTL on the frontend.

## Global Constraints

- The existing `tenantsRouter` is mounted at `/api/v1/tenants` (not `/api/v1/admin/tenants`) — the new list endpoint lives at `GET /tenants` on that same router, matching the existing mount path. (Codebase fact, not a spec deviation — the design spec's prose said "admin/tenants" descriptively but the real path is `/tenants`.)
- No pagination on the tenant list endpoint. (Spec §1, §2)
- The `AdminHomePage` placeholder from the Frontend Foundation sub-project is deleted; `/admin` now redirects to `/admin/products`. (Spec §3)
- All new frontend API calls go through the existing `api` Axios instance (`client/src/lib/api.ts`) — no new HTTP client. (Frontend Foundation sub-project)
- Every mutation (create/update/archive/publish/sync-mode/add-version) invalidates its relevant TanStack Query key(s) on success. (Spec §4)

---

## Task 1: Backend — List Tenants Endpoint

**Files:**
- Modify: `src/modules/tenants/tenants.service.ts` (add `listTenants`)
- Modify: `src/modules/tenants/tenants.controller.ts` (add `listTenantsHandler`)
- Modify: `src/modules/tenants/tenants.routes.ts` (add `GET /`)
- Test: `tests/modules/tenants.list.test.ts`

**Interfaces:**
- Consumes: `Tenant` model (foundation sub-project).
- Produces: `listTenants(): Promise<TenantDocument[]>` — response shape `{ tenants: [...] }`, consumed by the frontend's `adminTenants.ts` in Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/tenants.list.test.ts`:

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

describe('tenants module — list', () => {
  const app = buildTestApp();
  const masterToken = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
  const customerToken = signAccessToken({ sub: 'cust-1', role: 'customer', tenantId: 'tenant-x' });

  it('rejects non-master_admin roles', async () => {
    const res = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('lists all tenants', async () => {
    await Tenant.create({ name: 'A', subdomain: 'a' });
    await Tenant.create({ name: 'B', subdomain: 'b' });

    const res = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modules/tenants.list.test.ts`
Expected: FAIL — `GET /` isn't handled yet (404)

- [ ] **Step 3: Modify `src/modules/tenants/tenants.service.ts`** — append `listTenants`

```ts
export async function listTenants(): Promise<TenantDocument[]> {
  return Tenant.find().sort({ createdAt: -1 });
}
```

- [ ] **Step 4: Modify `src/modules/tenants/tenants.controller.ts`** — append handler

```ts
export async function listTenantsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenants = await tenantsService.listTenants();
    res.status(200).json({ tenants });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Modify `src/modules/tenants/tenants.routes.ts`** — add route and import

Add to the imports:

```ts
import { listTenantsHandler } from './tenants.controller';
```

Add route (before the existing `POST '/'` line or after — order doesn't matter since Express distinguishes by method):

```ts
tenantsRouter.get('/', requireAuth, requireRole('master_admin'), listTenantsHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/modules/tenants.list.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/tenants tests/modules/tenants.list.test.ts
git commit -m "feat: add tenant list endpoint"
```

---

## Task 2: Frontend — Admin API Wrapper Modules

**Files:**
- Create: `client/src/api/adminProducts.ts`
- Create: `client/src/api/adminTenants.ts`

**Interfaces:**
- Consumes: `api` (Frontend Foundation sub-project).
- Produces: `AdminProduct`, `ProductVersion`, `ListProductsParams`, `ListProductsResult`, `CreateProductInput`, `UpdateProductInput`, `AddVersionInput` types; `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `archiveProduct`, `publishProduct`, `updateSyncMode`, `listVersions`, `addVersion` functions from `adminProducts.ts`. `AdminTenant` type and `listTenants` function from `adminTenants.ts`. All consumed by every page from Task 3 onward.

No dedicated test for this task — these are thin typed wrappers around `api` calls (matching the precedent set by `tokenStorage.ts` in the Frontend Foundation sub-project, which also had no dedicated test); they're exercised indirectly by every page test starting Task 4.

- [ ] **Step 1: Create `client/src/api/adminProducts.ts`**

```ts
import { api } from '../lib/api';

export interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  basePrice: number;
  currency: string;
  status: 'draft' | 'published' | 'archived';
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  tenantId: string | null;
  currentVersion: string | null;
  thumbnailUrl: string | null;
}

export interface ProductVersion {
  _id: string;
  version: string;
  changelog: string;
  fileUrl: string | null;
  createdAt: string;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  search?: string;
}

export interface ListProductsResult {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}

export async function listProducts(params: ListProductsParams): Promise<ListProductsResult> {
  const res = await api.get<ListProductsResult>('/admin/products', { params });
  return res.data;
}

export async function getProduct(id: string): Promise<AdminProduct> {
  const res = await api.get<{ product: AdminProduct }>(`/admin/products/${id}`);
  return res.data.product;
}

function toProductFormData(input: Record<string, unknown>): FormData {
  const formData = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
      formData.append(key, value);
    } else {
      formData.append(key, String(value));
    }
  });
  return formData;
}

export interface CreateProductInput {
  name: string;
  type: string;
  description?: string;
  basePrice: number;
  currency?: string;
  thumbnail?: File;
}

export async function createProduct(input: CreateProductInput): Promise<AdminProduct> {
  const res = await api.post<{ product: AdminProduct }>('/admin/products', toProductFormData(input), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.product;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  thumbnail?: File;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<AdminProduct> {
  const res = await api.patch<{ product: AdminProduct }>(`/admin/products/${id}`, toProductFormData(input), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.product;
}

export async function archiveProduct(id: string): Promise<AdminProduct> {
  const res = await api.delete<{ product: AdminProduct }>(`/admin/products/${id}`);
  return res.data.product;
}

export async function publishProduct(id: string): Promise<AdminProduct> {
  const res = await api.post<{ product: AdminProduct }>(`/admin/products/${id}/publish`);
  return res.data.product;
}

export async function updateSyncMode(
  id: string,
  input: { syncMode: string; tenantId?: string }
): Promise<AdminProduct> {
  const res = await api.patch<{ product: AdminProduct }>(`/admin/products/${id}/sync-mode`, input);
  return res.data.product;
}

export async function listVersions(id: string): Promise<ProductVersion[]> {
  const res = await api.get<{ versions: ProductVersion[] }>(`/admin/products/${id}/versions`);
  return res.data.versions;
}

export interface AddVersionInput {
  version: string;
  changelog?: string;
  file?: File;
}

export async function addVersion(id: string, input: AddVersionInput): Promise<ProductVersion> {
  const res = await api.post<{ version: ProductVersion }>(
    `/admin/products/${id}/versions`,
    toProductFormData(input),
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.version;
}
```

- [ ] **Step 2: Create `client/src/api/adminTenants.ts`**

```ts
import { api } from '../lib/api';

export interface AdminTenant {
  _id: string;
  name: string;
  subdomain: string;
  status: string;
}

export async function listTenants(): Promise<AdminTenant[]> {
  const res = await api.get<{ tenants: AdminTenant[] }>('/tenants');
  return res.data.tenants;
}
```

- [ ] **Step 3: Run the client build to verify it compiles**

Run: `cd client && npm run build`
Expected: PASS — no TypeScript errors (nothing imports these yet, so this only checks the files themselves compile)

- [ ] **Step 4: Commit**

```bash
git add client/src/api/adminProducts.ts client/src/api/adminTenants.ts
git commit -m "feat: add admin products and tenants API wrapper modules"
```

---

## Task 3: AdminLayout

**Files:**
- Create: `client/src/pages/admin/AdminLayout.tsx`
- Test: `client/src/pages/admin/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Frontend Foundation sub-project), `Button` (Frontend Foundation sub-project).
- Produces: `AdminLayout` default export — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/admin/AdminLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import * as AuthContextModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../auth/AuthContext')>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

describe('AdminLayout', () => {
  it('shows the user email, renders nested content, and logs out on click', async () => {
    const logout = vi.fn();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'admin@example.com', role: 'master_admin', tenantId: null },
      isLoading: false,
      login: vi.fn(),
      logout,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>Nested content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Nested content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/AdminLayout.test.tsx`
Expected: FAIL — `Cannot find module './AdminLayout'`

- [ ] **Step 3: Create `client/src/pages/admin/AdminLayout.tsx`**

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/button';

export default function AdminLayout(): JSX.Element {
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
        <NavLink to="/admin/products">Products</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/AdminLayout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AdminLayout.tsx client/src/pages/admin/AdminLayout.test.tsx
git commit -m "feat: add AdminLayout shell"
```

---

## Task 4: ProductsListPage

**Files:**
- Create: `client/src/pages/admin/ProductsListPage.tsx`
- Test: `client/src/pages/admin/ProductsListPage.test.tsx`

**Interfaces:**
- Consumes: `listProducts` (Task 2).
- Produces: `ProductsListPage` default export — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/admin/ProductsListPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductsListPage from './ProductsListPage';
import * as adminProductsApi from '../../api/adminProducts';

vi.mock('../../api/adminProducts', () => ({
  listProducts: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProductsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductsListPage', () => {
  beforeEach(() => {
    vi.mocked(adminProductsApi.listProducts).mockReset();
  });

  it('renders fetched products', async () => {
    vi.mocked(adminProductsApi.listProducts).mockResolvedValueOnce({
      items: [
        {
          _id: 'p1',
          name: 'Super Tool',
          slug: 'super-tool',
          type: 'software',
          description: '',
          basePrice: 100,
          currency: 'INR',
          status: 'draft',
          syncMode: 'optional',
          tenantId: null,
          currentVersion: null,
          thumbnailUrl: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderPage();

    expect(await screen.findByText('Super Tool')).toBeInTheDocument();
  });

  it('re-queries when the search filter changes', async () => {
    vi.mocked(adminProductsApi.listProducts).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    renderPage();

    await waitFor(() => expect(adminProductsApi.listProducts).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText('Search products'), 'tool');

    await waitFor(() =>
      expect(adminProductsApi.listProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'tool' })
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/ProductsListPage.test.tsx`
Expected: FAIL — `Cannot find module './ProductsListPage'`

- [ ] **Step 3: Create `client/src/pages/admin/ProductsListPage.tsx`**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listProducts } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';

export default function ProductsListPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', { search, type, status }],
    queryFn: () =>
      listProducts({
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
      }),
  });

  return (
    <div>
      <h1>Products</h1>
      <Link to="/admin/products/new">
        <Button>New Product</Button>
      </Link>

      <input aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All types</option>
        <option value="software">software</option>
        <option value="theme">theme</option>
      </select>
      <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="draft">draft</option>
        <option value="published">published</option>
        <option value="archived">archived</option>
      </select>

      {isLoading && <p>Loading...</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Price</th>
            <th>Sync mode</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((product) => (
            <tr key={product._id}>
              <td>
                <Link to={`/admin/products/${product._id}`}>{product.name}</Link>
              </td>
              <td>{product.type}</td>
              <td>{product.status}</td>
              <td>{product.basePrice}</td>
              <td>{product.syncMode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/ProductsListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ProductsListPage.tsx client/src/pages/admin/ProductsListPage.test.tsx
git commit -m "feat: add admin products list page with filters"
```

---

## Task 5: ProductFormPage (Create)

**Files:**
- Create: `client/src/pages/admin/ProductFormPage.tsx`
- Test: `client/src/pages/admin/ProductFormPage.test.tsx`

**Interfaces:**
- Consumes: `createProduct` (Task 2).
- Produces: `ProductFormPage` default export — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/admin/ProductFormPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductFormPage from './ProductFormPage';
import * as adminProductsApi from '../../api/adminProducts';

vi.mock('../../api/adminProducts', () => ({
  createProduct: vi.fn(),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/products/new']}>
      <Routes>
        <Route path="/admin/products/new" element={<ProductFormPage />} />
        <Route path="/admin/products/:id" element={<div>Product detail placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProductFormPage', () => {
  beforeEach(() => {
    vi.mocked(adminProductsApi.createProduct).mockReset();
  });

  it('shows a validation error for an empty name', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
  });

  it('creates a product and navigates to its detail page', async () => {
    vi.mocked(adminProductsApi.createProduct).mockResolvedValueOnce({
      _id: 'new-product-1',
      name: 'Super Tool',
      slug: 'super-tool',
      type: 'software',
      description: '',
      basePrice: 100,
      currency: 'INR',
      status: 'draft',
      syncMode: 'optional',
      tenantId: null,
      currentVersion: null,
      thumbnailUrl: null,
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Super Tool');
    await userEvent.type(screen.getByLabelText('Base price'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    expect(await screen.findByText('Product detail placeholder')).toBeInTheDocument();
    expect(adminProductsApi.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Super Tool', basePrice: 100 })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/ProductFormPage.test.tsx`
Expected: FAIL — `Cannot find module './ProductFormPage'`

- [ ] **Step 3: Create `client/src/pages/admin/ProductFormPage.tsx`**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { createProduct } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';

const PRODUCT_TYPES = [
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

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(PRODUCT_TYPES),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, 'Price must be zero or more'),
  currency: z.string().optional(),
});

type CreateProductFormValues = z.infer<typeof createProductSchema>;

export default function ProductFormPage(): JSX.Element {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | undefined>(undefined);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductFormValues>({ resolver: zodResolver(createProductSchema) });

  const onSubmit = async (values: CreateProductFormValues): Promise<void> => {
    setServerError(null);
    try {
      const product = await createProduct({ ...values, thumbnail });
      navigate(`/admin/products/${product._id}`);
    } catch {
      setServerError('Could not create the product. Please check your details and try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>New product</h1>
      <label htmlFor="name">Name</label>
      <input id="name" {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}

      <label htmlFor="type">Type</label>
      <select id="type" {...register('type')}>
        {PRODUCT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      {errors.type && <p>{errors.type.message}</p>}

      <label htmlFor="description">Description</label>
      <textarea id="description" {...register('description')} />

      <label htmlFor="basePrice">Base price</label>
      <input id="basePrice" type="number" {...register('basePrice')} />
      {errors.basePrice && <p>{errors.basePrice.message}</p>}

      <label htmlFor="thumbnail">Thumbnail</label>
      <input id="thumbnail" type="file" onChange={(e) => setThumbnail(e.target.files?.[0])} />

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Create product
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/ProductFormPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ProductFormPage.tsx client/src/pages/admin/ProductFormPage.test.tsx
git commit -m "feat: add admin product create form"
```

---

## Task 6: ProductDetailPage — Info, Publish, Archive

**Files:**
- Create: `client/src/pages/admin/ProductDetailPage.tsx`
- Test: `client/src/pages/admin/ProductDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getProduct`, `updateProduct`, `archiveProduct`, `publishProduct` (Task 2).
- Produces: `ProductDetailPage` default export — consumed by `App.tsx` in Task 9. The `if (isLoading || !product) { return <p>Loading...</p>; }` line inside the component is the anchor Tasks 7–8 insert new hooks before.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/admin/ProductDetailPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductDetailPage from './ProductDetailPage';
import * as adminProductsApi from '../../api/adminProducts';
import * as adminTenantsApi from '../../api/adminTenants';

vi.mock('../../api/adminProducts', () => ({
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  archiveProduct: vi.fn(),
  publishProduct: vi.fn(),
  updateSyncMode: vi.fn(),
  listVersions: vi.fn(),
  addVersion: vi.fn(),
}));
vi.mock('../../api/adminTenants', () => ({
  listTenants: vi.fn(),
}));

const baseProduct = {
  _id: 'product-1',
  name: 'Super Tool',
  slug: 'super-tool',
  type: 'software',
  description: 'A tool',
  basePrice: 100,
  currency: 'INR',
  status: 'draft',
  syncMode: 'optional',
  tenantId: null,
  currentVersion: null,
  thumbnailUrl: null,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/products/product-1']}>
        <Routes>
          <Route path="/admin/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.mocked(adminProductsApi.getProduct).mockReset().mockResolvedValue(baseProduct);
    vi.mocked(adminProductsApi.updateProduct).mockReset();
    vi.mocked(adminProductsApi.archiveProduct).mockReset();
    vi.mocked(adminProductsApi.publishProduct).mockReset();
    vi.mocked(adminProductsApi.listVersions).mockReset().mockResolvedValue([]);
    vi.mocked(adminTenantsApi.listTenants).mockReset().mockResolvedValue([]);
  });

  it('renders the product name and status', async () => {
    renderPage();
    expect(await screen.findByText('Super Tool')).toBeInTheDocument();
    expect(screen.getByText('Status: draft')).toBeInTheDocument();
  });

  it('saves info changes', async () => {
    vi.mocked(adminProductsApi.updateProduct).mockResolvedValueOnce({ ...baseProduct, basePrice: 200 });
    renderPage();
    await screen.findByText('Super Tool');

    const priceInput = screen.getByLabelText('Base price');
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '200');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(adminProductsApi.updateProduct).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({ basePrice: 200 })
      )
    );
  });

  it('shows an inline message when publish fails', async () => {
    vi.mocked(adminProductsApi.publishProduct).mockRejectedValueOnce(new Error('conflict'));
    renderPage();
    await screen.findByText('Super Tool');

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Add a version before publishing')).toBeInTheDocument();
  });

  it('archives the product', async () => {
    vi.mocked(adminProductsApi.archiveProduct).mockResolvedValueOnce({ ...baseProduct, status: 'archived' });
    renderPage();
    await screen.findByText('Super Tool');

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(adminProductsApi.archiveProduct).toHaveBeenCalledWith('product-1'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/ProductDetailPage.test.tsx`
Expected: FAIL — `Cannot find module './ProductDetailPage'`

- [ ] **Step 3: Create `client/src/pages/admin/ProductDetailPage.tsx`**

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getProduct, updateProduct, archiveProduct, publishProduct } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';

const updateInfoSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, 'Price must be zero or more'),
  currency: z.string().optional(),
});

type UpdateInfoFormValues = z.infer<typeof updateInfoSchema>;

export default function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | undefined>(undefined);

  const { data: product, isLoading } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => getProduct(id as string),
    enabled: Boolean(id),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateInfoFormValues>({
    resolver: zodResolver(updateInfoSchema),
    values: product
      ? {
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          currency: product.currency,
        }
      : undefined,
  });

  if (isLoading || !product) {
    return <p>Loading...</p>;
  }

  const onSubmitInfo = async (values: UpdateInfoFormValues): Promise<void> => {
    setInfoError(null);
    try {
      await updateProduct(product._id, { ...values, thumbnail });
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    } catch {
      setInfoError('Could not save changes. Please try again.');
    }
  };

  const handlePublish = async (): Promise<void> => {
    setPublishError(null);
    try {
      await publishProduct(product._id);
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    } catch {
      setPublishError('Add a version before publishing');
    }
  };

  const handleArchive = async (): Promise<void> => {
    await archiveProduct(product._id);
    await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
  };

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Status: {product.status}</p>

      <form onSubmit={handleSubmit(onSubmitInfo)}>
        <label htmlFor="name">Name</label>
        <input id="name" {...register('name')} />
        {errors.name && <p>{errors.name.message}</p>}

        <label htmlFor="description">Description</label>
        <textarea id="description" {...register('description')} />

        <label htmlFor="basePrice">Base price</label>
        <input id="basePrice" type="number" {...register('basePrice')} />
        {errors.basePrice && <p>{errors.basePrice.message}</p>}

        <label htmlFor="thumbnail">Thumbnail</label>
        <input id="thumbnail" type="file" onChange={(e) => setThumbnail(e.target.files?.[0])} />

        {infoError && <p role="alert">{infoError}</p>}

        <Button type="submit" disabled={isSubmitting}>
          Save changes
        </Button>
      </form>

      <Button onClick={handlePublish}>Publish</Button>
      {publishError && <p role="alert">{publishError}</p>}

      <Button variant="destructive" onClick={handleArchive}>
        Archive
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/ProductDetailPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ProductDetailPage.tsx client/src/pages/admin/ProductDetailPage.test.tsx
git commit -m "feat: add admin product detail page with info edit, publish, archive"
```

---

## Task 7: ProductDetailPage — Sync Mode Section

**Files:**
- Modify: `client/src/pages/admin/ProductDetailPage.tsx` (add sync-mode section)
- Modify: `client/src/pages/admin/ProductDetailPage.test.tsx` (add sync-mode tests)

**Interfaces:**
- Consumes: `updateSyncMode` (Task 2), `listTenants` (Task 2).
- Produces: nothing new for later tasks — this is additive UI on an existing page.

- [ ] **Step 1: Write the failing test**

Add to the imports in `client/src/pages/admin/ProductDetailPage.test.tsx` (it's already imported as `* as adminTenantsApi` — no import change needed). Append this test inside the existing `describe('ProductDetailPage', ...)` block:

```tsx
  it('shows the tenant dropdown only for private/exclusive modes and submits the change', async () => {
    vi.mocked(adminTenantsApi.listTenants).mockResolvedValueOnce([
      { _id: 'tenant-1', name: 'Acme', subdomain: 'acme', status: 'active' },
    ]);
    vi.mocked(adminProductsApi.updateSyncMode).mockResolvedValueOnce({
      ...baseProduct,
      syncMode: 'private',
      tenantId: 'tenant-1',
    });
    renderPage();
    await screen.findByText('Super Tool');

    expect(screen.queryByLabelText('Tenant')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Sync mode'), 'private');
    expect(await screen.findByLabelText('Tenant')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Tenant'), 'tenant-1');
    await userEvent.click(screen.getByRole('button', { name: 'Update sync mode' }));

    await waitFor(() =>
      expect(adminProductsApi.updateSyncMode).toHaveBeenCalledWith('product-1', {
        syncMode: 'private',
        tenantId: 'tenant-1',
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/ProductDetailPage.test.tsx`
Expected: FAIL — no "Sync mode" label exists yet

- [ ] **Step 3: Modify `client/src/pages/admin/ProductDetailPage.tsx`** — add imports, hooks, and JSX

Add to the imports:

```tsx
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
```

(merge `useEffect` into the existing `react` import line, and note `useQuery`/`useQueryClient` are already imported — no duplicate)

Add to the imports from `../../api/adminProducts`:

```tsx
import { getProduct, updateProduct, archiveProduct, publishProduct, updateSyncMode } from '../../api/adminProducts';
```

Add a new import:

```tsx
import { listTenants } from '../../api/adminTenants';
```

Insert the following hooks **immediately before** the `if (isLoading || !product) {` line:

```tsx
  const [syncMode, setSyncMode] = useState('optional');
  const [tenantId, setTenantId] = useState('');
  const [syncModeError, setSyncModeError] = useState<string | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: listTenants,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (product) {
      setSyncMode(product.syncMode);
      setTenantId(product.tenantId ?? '');
    }
  }, [product]);
```

Insert this handler after `handleArchive` (still before the `return (`):

```tsx
  const handleSyncModeSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSyncModeError(null);
    try {
      await updateSyncMode(product._id, {
        syncMode,
        tenantId: syncMode === 'private' || syncMode === 'exclusive' ? tenantId : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    } catch {
      setSyncModeError('Could not update sync mode. Please try again.');
    }
  };
```

Insert this JSX right before the final closing `</div>`:

```tsx
      <form onSubmit={handleSyncModeSubmit}>
        <label htmlFor="syncMode">Sync mode</label>
        <select id="syncMode" value={syncMode} onChange={(e) => setSyncMode(e.target.value)}>
          <option value="global">global</option>
          <option value="optional">optional</option>
          <option value="private">private</option>
          <option value="exclusive">exclusive</option>
        </select>

        {(syncMode === 'private' || syncMode === 'exclusive') && (
          <>
            <label htmlFor="tenantId">Tenant</label>
            <select id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">Select a tenant</option>
              {tenants?.map((tenant) => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name} ({tenant.subdomain})
                </option>
              ))}
            </select>
          </>
        )}

        {syncModeError && <p role="alert">{syncModeError}</p>}

        <Button type="submit">Update sync mode</Button>
      </form>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/ProductDetailPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ProductDetailPage.tsx client/src/pages/admin/ProductDetailPage.test.tsx
git commit -m "feat: add sync-mode section to admin product detail page"
```

---

## Task 8: ProductDetailPage — Versions Section

**Files:**
- Modify: `client/src/pages/admin/ProductDetailPage.tsx` (add versions section)
- Modify: `client/src/pages/admin/ProductDetailPage.test.tsx` (add versions test)

**Interfaces:**
- Consumes: `listVersions`, `addVersion` (Task 2).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Append this test inside the existing `describe('ProductDetailPage', ...)` block in `client/src/pages/admin/ProductDetailPage.test.tsx`:

```tsx
  it('lists versions and adds a new one, resetting the form', async () => {
    vi.mocked(adminProductsApi.listVersions).mockResolvedValueOnce([
      { _id: 'v1', version: '1.0.0', changelog: 'Initial', fileUrl: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    vi.mocked(adminProductsApi.addVersion).mockResolvedValueOnce({
      _id: 'v2',
      version: '1.1.0',
      changelog: 'Update',
      fileUrl: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Super Tool');

    expect(await screen.findByText('1.0.0')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Version'), '1.1.0');
    await userEvent.type(screen.getByLabelText('Changelog'), 'Update');
    await userEvent.click(screen.getByRole('button', { name: 'Add version' }));

    await waitFor(() =>
      expect(adminProductsApi.addVersion).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({ version: '1.1.0', changelog: 'Update' })
      )
    );
    await waitFor(() => expect(screen.getByLabelText('Version')).toHaveValue(''));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/ProductDetailPage.test.tsx`
Expected: FAIL — no "Version"/"Changelog"/"Add version" controls exist yet

- [ ] **Step 3: Modify `client/src/pages/admin/ProductDetailPage.tsx`** — add imports, hooks, handler, and JSX

Add to the imports from `../../api/adminProducts`:

```tsx
import {
  getProduct,
  updateProduct,
  archiveProduct,
  publishProduct,
  updateSyncMode,
  listVersions,
  addVersion,
} from '../../api/adminProducts';
```

Insert the following hooks **immediately before** the `if (isLoading || !product) {` line (after Task 7's hooks):

```tsx
  const {
    register: registerVersion,
    handleSubmit: handleSubmitVersion,
    reset: resetVersionForm,
    formState: { errors: versionErrors, isSubmitting: isSubmittingVersion },
  } = useForm<{ version: string; changelog?: string }>({
    resolver: zodResolver(
      z.object({
        version: z.string().min(1, 'Version is required'),
        changelog: z.string().optional(),
      })
    ),
  });
  const [versionFile, setVersionFile] = useState<File | undefined>(undefined);

  const { data: versions } = useQuery({
    queryKey: ['admin-product-versions', id],
    queryFn: () => listVersions(id as string),
    enabled: Boolean(id),
  });
```

Insert this handler after `handleSyncModeSubmit` (still before the `return (`):

```tsx
  const onSubmitVersion = async (values: { version: string; changelog?: string }): Promise<void> => {
    await addVersion(product._id, { ...values, file: versionFile });
    setVersionFile(undefined);
    resetVersionForm();
    await queryClient.invalidateQueries({ queryKey: ['admin-product-versions', id] });
    await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
  };
```

Insert this JSX right before the final closing `</div>` (after the sync-mode form):

```tsx
      <section>
        <h2>Versions</h2>
        <ul>
          {versions?.map((version) => (
            <li key={version._id}>
              {version.version} — {version.changelog}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmitVersion(onSubmitVersion)}>
          <label htmlFor="version">Version</label>
          <input id="version" {...registerVersion('version')} />
          {versionErrors.version && <p>{versionErrors.version.message}</p>}

          <label htmlFor="changelog">Changelog</label>
          <textarea id="changelog" {...registerVersion('changelog')} />

          <label htmlFor="versionFile">File</label>
          <input id="versionFile" type="file" onChange={(e) => setVersionFile(e.target.files?.[0])} />

          <Button type="submit" disabled={isSubmittingVersion}>
            Add version
          </Button>
        </form>
      </section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/ProductDetailPage.test.tsx`
Expected: PASS — all six tests in the file

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ProductDetailPage.tsx client/src/pages/admin/ProductDetailPage.test.tsx
git commit -m "feat: add versions section to admin product detail page"
```

---

## Task 9: Wire Admin Routes, Remove Placeholder, Fix Integration Test

**Files:**
- Modify: `client/src/App.tsx` (nest admin routes under `AdminLayout`)
- Modify: `client/src/App.test.tsx` (update the master_admin login test for the new destination)
- Delete: `client/src/pages/AdminHomePage.tsx`

**Interfaces:**
- Consumes: `AdminLayout` (Task 3), `ProductsListPage` (Task 4), `ProductFormPage` (Task 5), `ProductDetailPage` (Tasks 6–8).
- Produces: nothing new — proves the whole admin product-management flow works end-to-end inside the fully wired app.

- [ ] **Step 1: Modify `client/src/App.test.tsx`** — update the existing master_admin test

Replace:

```tsx
  it('logs in as master_admin and lands on the admin home page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'admin@example.com', role: 'master_admin', tenantId: null },
      },
    });

    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Welcome, admin@example.com (master_admin)')).toBeInTheDocument();
  });
```

with:

```tsx
  it('logs in as master_admin and lands on the admin products page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'admin@example.com', role: 'master_admin', tenantId: null },
      },
    });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, limit: 20 } });

    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — `App.tsx` still routes `/admin` straight to the (now-stale) `AdminHomePage`

- [ ] **Step 3: Replace `client/src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterCustomerPage from './pages/RegisterCustomerPage';
import RegisterResellerPage from './pages/RegisterResellerPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ResellerHomePage from './pages/ResellerHomePage';
import CustomerHomePage from './pages/CustomerHomePage';
import AdminLayout from './pages/admin/AdminLayout';
import ProductsListPage from './pages/admin/ProductsListPage';
import ProductFormPage from './pages/admin/ProductFormPage';
import ProductDetailPage from './pages/admin/ProductDetailPage';
import { ProtectedRoute } from './auth/ProtectedRoute';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCustomerPage />} />
      <Route path="/register-reseller" element={<RegisterResellerPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['master_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<ProductsListPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
      </Route>
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin', 'reseller_staff']}>
            <ResellerHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerHomePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

- [ ] **Step 4: Delete `client/src/pages/AdminHomePage.tsx`**

Run: `rm client/src/pages/AdminHomePage.tsx`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS — all three scenarios in the file

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git rm client/src/pages/AdminHomePage.tsx
git commit -m "feat: wire admin product routes and remove placeholder admin home page"
```

---

## Post-plan verification

Run both suites and confirm clean builds:

```bash
npm test
npm run build
cd client && npx vitest run
cd client && npm run build
```

All four must succeed with zero failures before this sub-project is considered done. The next sub-project should cover Reseller management (with its still-missing approve/suspend backend endpoints), Licenses/Plans admin screens, or the Reseller Panel/Customer Storefront frontends — to be brainstormed separately.
