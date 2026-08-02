# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Vite + React + TypeScript SPA at `/client` — scaffold, Tailwind + shadcn/ui, API client with auto-refresh, auth context, protected routing, and login/register pages — so later frontend sub-projects (Master Admin, Reseller Panel, Customer Storefront) have a working shell to build on.

**Architecture:** Standard Vite SPA. `lib/api.ts` wraps Axios with request/response interceptors; `auth/AuthContext.tsx` holds user/session state backed by `localStorage`; `auth/ProtectedRoute.tsx` gates role-specific route subtrees; pages are plain function components using `react-hook-form` + Zod for validation.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui (hand-authored primitives, not the interactive CLI), TanStack Query, Axios, react-router-dom v6, react-hook-form + `@hookform/resolvers/zod`, Vitest + React Testing Library.

## Global Constraints

- `client/` is a fully independent npm project (own `package.json`, own `node_modules`) living inside the existing repo — it does not touch the backend's `package.json` or `tests/` folder. (Spec §3)
- Tokens are stored in `localStorage` via a small `tokenStorage.ts` module — no httpOnly cookies this round. (Spec §1, §4)
- No portal-specific dashboards (Master Admin, Reseller Panel, Customer Storefront) — only placeholder home pages proving each role's route works. (Spec §1)
- No E2E test suite — Vitest + React Testing Library component/unit tests only. (Spec §1, §5)
- `vite.config.ts` proxies `/api` to `http://localhost:4000` so the SPA calls relative paths in dev without CORS setup. (Spec §3)
- All client commands run with `client/` as the working directory — this is a separate npm project from the backend at the repo root.

---

## Task 1: Vite + React + TypeScript Scaffold

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/index.css`
- Create: `client/src/setupTests.ts`
- Test: `client/src/App.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: a running Vite dev server and a Vitest test runner. `App` component (placeholder now, fully built out in Task 9).

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "toolzypro-client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `client/vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

- [ ] **Step 4: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ToolzyPro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `client/src/index.css`**

```css
body {
  margin: 0;
}
```

- [ ] **Step 6: Create `client/src/setupTests.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 7: Install dependencies**

Run: `cd client && npm install`
Expected: `client/node_modules` created, no errors.

- [ ] **Step 8: Write the failing test**

Create `client/src/App.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('ToolzyPro')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — `Cannot find module './App'`

- [ ] **Step 10: Create `client/src/App.tsx`**

```tsx
export default function App(): JSX.Element {
  return <div>ToolzyPro</div>;
}
```

- [ ] **Step 11: Create `client/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/src/main.tsx client/src/App.tsx client/src/index.css client/src/setupTests.ts client/src/App.test.tsx client/package-lock.json
git commit -m "chore: scaffold Vite+React+TS frontend"
```

---

## Task 2: Tailwind CSS + shadcn/ui Button Primitive

**Files:**
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Modify: `client/src/index.css`
- Create: `client/src/lib/utils.ts`
- Create: `client/src/components/ui/button.tsx`
- Test: `client/src/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `cn(...inputs): string` from `lib/utils.ts`. `Button` component + `ButtonProps` + `buttonVariants` from `components/ui/button.tsx` — consumed by every later page.

- [ ] **Step 1: Install dependencies**

Run: `cd client && npm install class-variance-authority clsx tailwind-merge @radix-ui/react-slot`
Run: `cd client && npm install --save-dev tailwindcss postcss autoprefixer`

- [ ] **Step 2: Write the failing test**

Create `client/src/components/ui/button.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children and handles click', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    await userEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies the destructive variant class', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-destructive');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/ui/button.test.tsx`
Expected: FAIL — `Cannot find module './button'`

- [ ] **Step 4: Create `client/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create `client/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Replace `client/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}

body {
  margin: 0;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

- [ ] **Step 7: Create `client/src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Create `client/src/components/ui/button.tsx`**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-background hover:bg-secondary hover:text-secondary-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/ui/button.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add client/tailwind.config.js client/postcss.config.js client/src/index.css client/src/lib/utils.ts client/src/components/ui/button.tsx client/src/components/ui/button.test.tsx client/package.json client/package-lock.json
git commit -m "feat: add Tailwind CSS and shadcn/ui Button primitive"
```

---

## Task 3: API Client with Token Attach & Refresh

**Files:**
- Create: `client/src/lib/tokenStorage.ts`
- Create: `client/src/lib/api.ts`
- Create: `client/src/lib/queryClient.ts`
- Test: `client/src/lib/api.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `loadStoredAuth(): StoredAuth | null`, `saveStoredAuth(auth: StoredAuth): void`, `clearStoredAuth(): void` from `tokenStorage.ts` (consumed by `AuthContext` in Task 4). `api: AxiosInstance` from `api.ts` (consumed by every page from Task 6 onward). `queryClient: QueryClient` from `queryClient.ts` (consumed by Task 9's `main.tsx`).

- [ ] **Step 1: Install dependencies**

Run: `cd client && npm install axios @tanstack/react-query`

- [ ] **Step 2: Create `client/src/lib/tokenStorage.ts`**

```ts
export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'toolzypro_auth';

export function loadStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveStoredAuth(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 3: Write the failing test**

Create `client/src/lib/api.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { postMock, requestUseMock, responseUseMock, instanceMock } = vi.hoisted(() => {
  const postMock = vi.fn();
  const requestUseMock = vi.fn();
  const responseUseMock = vi.fn();
  const instanceMock = vi.fn(() => Promise.resolve({ data: 'retried' })) as unknown as {
    (...args: unknown[]): Promise<{ data: string }>;
    interceptors: { request: { use: typeof requestUseMock }; response: { use: typeof responseUseMock } };
    mockClear: () => void;
  };
  (instanceMock as unknown as { interceptors: unknown }).interceptors = {
    request: { use: requestUseMock },
    response: { use: responseUseMock },
  };
  return { postMock, requestUseMock, responseUseMock, instanceMock };
});

vi.mock('axios', () => ({
  default: {
    create: () => instanceMock,
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import { saveStoredAuth, loadStoredAuth } from './tokenStorage';
import './api';

describe('api response interceptor', () => {
  beforeEach(() => {
    postMock.mockClear();
    instanceMock.mockClear();
    localStorage.clear();
  });

  it('refreshes the token once on a 401 and retries the request', async () => {
    saveStoredAuth({ accessToken: 'old', refreshToken: 'refresh-1' });
    postMock.mockResolvedValueOnce({ data: { accessToken: 'new', refreshToken: 'refresh-2' } });

    const onRejected = responseUseMock.mock.calls[0][1];
    const headersSet = vi.fn();
    const originalRequest = { headers: { set: headersSet } };
    const error = { response: { status: 401 }, config: originalRequest };

    await onRejected(error);

    expect(postMock).toHaveBeenCalledWith('/api/v1/auth/refresh', { refreshToken: 'refresh-1' });
    expect(headersSet).toHaveBeenCalledWith('Authorization', 'Bearer new');
    expect(instanceMock).toHaveBeenCalledWith(originalRequest);
    expect(loadStoredAuth()).toEqual({ accessToken: 'new', refreshToken: 'refresh-2' });
  });

  it('clears stored auth when refresh fails', async () => {
    saveStoredAuth({ accessToken: 'old', refreshToken: 'refresh-1' });
    postMock.mockRejectedValueOnce(new Error('refresh failed'));

    const onRejected = responseUseMock.mock.calls[0][1];
    const originalRequest = { headers: { set: vi.fn() } };
    const error = { response: { status: 401 }, config: originalRequest };

    await expect(onRejected(error)).rejects.toBe(error);

    expect(loadStoredAuth()).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `Cannot find module './api'`

- [ ] **Step 5: Create `client/src/lib/api.ts`**

```ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from './tokenStorage';

export const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const stored = loadStoredAuth();
  if (stored?.accessToken) {
    config.headers.set('Authorization', `Bearer ${stored.accessToken}`);
  }
  return config;
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const stored = loadStoredAuth();
  if (!stored?.refreshToken) return null;
  try {
    const res = await axios.post('/api/v1/auth/refresh', { refreshToken: stored.refreshToken });
    const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
    saveStoredAuth({ accessToken, refreshToken });
    return accessToken;
  } catch {
    clearStoredAuth();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? ({} as InternalAxiosRequestConfig['headers']);
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return api(originalRequest);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 6: Create `client/src/lib/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/api.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/lib/tokenStorage.ts client/src/lib/api.ts client/src/lib/queryClient.ts client/src/lib/api.test.ts client/package.json client/package-lock.json
git commit -m "feat: add API client with token attach and auto-refresh"
```

---

## Task 4: AuthContext

**Files:**
- Create: `client/src/auth/AuthContext.tsx`
- Test: `client/src/auth/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `api` (Task 3), `loadStoredAuth`/`saveStoredAuth`/`clearStoredAuth` (Task 3).
- Produces: `AuthProvider` component, `useAuth(): {user: AuthUser | null; isLoading: boolean; login(input): Promise<AuthUser>; logout(): void}`, `AuthUser` type — consumed by `ProtectedRoute` (Task 5) and every page from Task 6 onward.

- [ ] **Step 1: Write the failing test**

Create `client/src/auth/AuthContext.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../lib/api';
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from '../lib/tokenStorage';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function TestComponent(): JSX.Element {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <button onClick={() => login({ email: 'a@example.com', password: 'pw' })}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    clearStoredAuth();
  });

  it('restores a user from a valid stored token on mount', async () => {
    saveStoredAuth({ accessToken: 'a', refreshToken: 'b' });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'restored@example.com', role: 'customer', tenantId: 't1' } },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('restored@example.com');
  });

  it('logs in, persists tokens, and logs out clearing them', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: '2', email: 'new@example.com', role: 'customer', tenantId: 't1' },
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('new@example.com'));
    expect(loadStoredAuth()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(loadStoredAuth()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/auth/AuthContext.test.tsx`
Expected: FAIL — `Cannot find module './AuthContext'`

- [ ] **Step 3: Create `client/src/auth/AuthContext.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from '../lib/tokenStorage';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: { email: string; password: string; tenantSubdomain?: string }) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user as AuthUser);
      })
      .catch(() => {
        clearStoredAuth();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string; tenantSubdomain?: string }): Promise<AuthUser> => {
      const res = await api.post('/auth/login', input);
      const { accessToken, refreshToken, user: loggedInUser } = res.data;
      saveStoredAuth({ accessToken, refreshToken });
      setUser(loggedInUser as AuthUser);
      return loggedInUser as AuthUser;
    },
    []
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/auth/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/auth/AuthContext.tsx client/src/auth/AuthContext.test.tsx
git commit -m "feat: add AuthContext with login/logout and session restore"
```

---

## Task 5: ProtectedRoute

**Files:**
- Create: `client/src/auth/ProtectedRoute.tsx`
- Test: `client/src/auth/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 4).
- Produces: `ProtectedRoute({allowedRoles: string[]; children: React.ReactNode}): JSX.Element` — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Install dependencies**

Run: `cd client && npm install react-router-dom`

- [ ] **Step 2: Write the failing test**

Create `client/src/auth/ProtectedRoute.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContextModule from './AuthContext';

vi.mock('./AuthContext', async () => {
  const actual = await vi.importActual<typeof import('./AuthContext')>('./AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderWithRoute(initialPath: string): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['master_admin']}>
              <div>Admin Home</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute('/admin');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /unauthorized for a wrong role', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'a@example.com', role: 'customer', tenantId: null },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute('/admin');
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });

  it('renders children for an allowed role', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'a@example.com', role: 'master_admin', tenantId: null },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute('/admin');
    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/auth/ProtectedRoute.test.tsx`
Expected: FAIL — `Cannot find module './ProtectedRoute'`

- [ ] **Step 4: Create `client/src/auth/ProtectedRoute.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}): JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/auth/ProtectedRoute.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/auth/ProtectedRoute.tsx client/src/auth/ProtectedRoute.test.tsx client/package.json client/package-lock.json
git commit -m "feat: add ProtectedRoute for role-based route guarding"
```

---

## Task 6: LoginPage

**Files:**
- Create: `client/src/pages/LoginPage.tsx`
- Test: `client/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 4), `Button` (Task 2).
- Produces: `LoginPage` default export — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Install dependencies**

Run: `cd client && npm install react-hook-form @hookform/resolvers zod`

- [ ] **Step 2: Write the failing test**

Create `client/src/pages/LoginPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import * as AuthContextModule from '../auth/AuthContext';

vi.mock('../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../auth/AuthContext')>('../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderLoginPage(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>Admin Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(AuthContextModule.useAuth).mockReset();
  });

  it('shows validation errors for empty submit', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
  });

  it('logs in and redirects to the role home route', async () => {
    const login = vi
      .fn()
      .mockResolvedValue({ id: '1', email: 'a@example.com', role: 'master_admin', tenantId: null });
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login,
      logout: vi.fn(),
    });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Admin Home')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'longenough1',
      tenantSubdomain: '',
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/LoginPage.test.tsx`
Expected: FAIL — `Cannot find module './LoginPage'`

- [ ] **Step 4: Create `client/src/pages/LoginPage.tsx`**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  tenantSubdomain: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const roleHomeRoute: Record<string, string> = {
  master_admin: '/admin',
  reseller_admin: '/reseller',
  reseller_staff: '/reseller',
  customer: '/account',
};

export default function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    try {
      const user = await login(values);
      navigate(roleHomeRoute[user.role] ?? '/login');
    } catch {
      setServerError('Invalid email or password');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Log in</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      <label htmlFor="tenantSubdomain">Store subdomain (optional)</label>
      <input id="tenantSubdomain" {...register('tenantSubdomain')} />

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Log in
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/LoginPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/LoginPage.tsx client/src/pages/LoginPage.test.tsx client/package.json client/package-lock.json
git commit -m "feat: add LoginPage with role-based redirect"
```

---

## Task 7: RegisterCustomerPage

**Files:**
- Create: `client/src/pages/RegisterCustomerPage.tsx`
- Test: `client/src/pages/RegisterCustomerPage.test.tsx`

**Interfaces:**
- Consumes: `api` (Task 3), `Button` (Task 2).
- Produces: `RegisterCustomerPage` default export — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/RegisterCustomerPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterCustomerPage from './RegisterCustomerPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn() },
}));

describe('RegisterCustomerPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('shows a success message after registering', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: '1', status: 'pending' } } });
    render(<RegisterCustomerPage />);

    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme');
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      tenantSubdomain: 'acme',
      email: 'buyer@example.com',
      password: 'longenough1',
    });
  });

  it('shows validation error for a short password', async () => {
    render(<RegisterCustomerPage />);
    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme');
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/RegisterCustomerPage.test.tsx`
Expected: FAIL — `Cannot find module './RegisterCustomerPage'`

- [ ] **Step 3: Create `client/src/pages/RegisterCustomerPage.tsx`**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';

const registerSchema = z.object({
  tenantSubdomain: z.string().min(3, 'Enter your store subdomain'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterCustomerPage(): JSX.Element {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setServerError(null);
    try {
      await api.post('/auth/register', values);
      setSuccess(true);
    } catch {
      setServerError('Registration failed. Please check your details and try again.');
    }
  };

  if (success) {
    return <p>Check your email to verify your account, then log in.</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Create your account</h1>
      <label htmlFor="tenantSubdomain">Store subdomain</label>
      <input id="tenantSubdomain" {...register('tenantSubdomain')} />
      {errors.tenantSubdomain && <p>{errors.tenantSubdomain.message}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Register
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/RegisterCustomerPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/RegisterCustomerPage.tsx client/src/pages/RegisterCustomerPage.test.tsx
git commit -m "feat: add RegisterCustomerPage"
```

---

## Task 8: RegisterResellerPage

**Files:**
- Create: `client/src/pages/RegisterResellerPage.tsx`
- Test: `client/src/pages/RegisterResellerPage.test.tsx`

**Interfaces:**
- Consumes: `api` (Task 3), TanStack Query (Task 3), `Button` (Task 2).
- Produces: `RegisterResellerPage` default export — consumed by `App.tsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/RegisterResellerPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterResellerPage from './RegisterResellerPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RegisterResellerPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('lists fetched plans and submits registration', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        plans: [{ _id: 'plan-1', name: 'Starter Annual', price: 999, currency: 'INR', billingCycle: 'annual' }],
      },
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { gatewayOrderId: 'mock_order_1', amount: 999, currency: 'INR' },
    });

    renderWithClient(<RegisterResellerPage />);

    expect(await screen.findByText('Starter Annual — 999 INR')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Business name'), 'Acme Resell');
    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme-resell');
    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'plan-1');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/Almost there/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register-reseller', {
      businessName: 'Acme Resell',
      subdomain: 'acme-resell',
      email: 'owner@example.com',
      password: 'longenough1',
      planId: 'plan-1',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/RegisterResellerPage.test.tsx`
Expected: FAIL — `Cannot find module './RegisterResellerPage'`

- [ ] **Step 3: Create `client/src/pages/RegisterResellerPage.tsx`**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';

interface Plan {
  _id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
}

const registerResellerSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  planId: z.string().min(1, 'Choose a plan'),
});

type RegisterResellerFormValues = z.infer<typeof registerResellerSchema>;

export default function RegisterResellerPage(): JSX.Element {
  const [result, setResult] = useState<{ gatewayOrderId: string; amount: number; currency: string } | null>(
    null
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['reseller-plans'],
    queryFn: async () => {
      const res = await api.get<{ plans: Plan[] }>('/plans');
      return res.data.plans;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterResellerFormValues>({ resolver: zodResolver(registerResellerSchema) });

  const onSubmit = async (values: RegisterResellerFormValues): Promise<void> => {
    setServerError(null);
    try {
      const res = await api.post('/auth/register-reseller', values);
      setResult(res.data);
    } catch {
      setServerError('Registration failed. Please check your details and try again.');
    }
  };

  if (result) {
    return (
      <p>
        Almost there — complete payment (order {result.gatewayOrderId}) for {result.amount} {result.currency} to
        activate your store.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Become a reseller</h1>
      <label htmlFor="businessName">Business name</label>
      <input id="businessName" {...register('businessName')} />
      {errors.businessName && <p>{errors.businessName.message}</p>}

      <label htmlFor="subdomain">Store subdomain</label>
      <input id="subdomain" {...register('subdomain')} />
      {errors.subdomain && <p>{errors.subdomain.message}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      <label htmlFor="planId">Plan</label>
      <select id="planId" {...register('planId')} disabled={plansLoading}>
        <option value="">Select a plan</option>
        {plans?.map((plan) => (
          <option key={plan._id} value={plan._id}>
            {plan.name} — {plan.price} {plan.currency}
          </option>
        ))}
      </select>
      {errors.planId && <p>{errors.planId.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Register
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/RegisterResellerPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/RegisterResellerPage.tsx client/src/pages/RegisterResellerPage.test.tsx
git commit -m "feat: add RegisterResellerPage with plan selection"
```

---

## Task 9: Route Tree, Placeholder Home Pages & App Wiring

**Files:**
- Create: `client/src/pages/UnauthorizedPage.tsx`
- Create: `client/src/pages/AdminHomePage.tsx`
- Create: `client/src/pages/ResellerHomePage.tsx`
- Create: `client/src/pages/CustomerHomePage.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.test.tsx` (replaces Task 1's smoke test)

**Interfaces:**
- Consumes: `ProtectedRoute` (Task 5), `LoginPage`/`RegisterCustomerPage`/`RegisterResellerPage` (Tasks 6–8), `AuthProvider` (Task 4), `queryClient` (Task 3).
- Produces: the fully wired `App` component and `main.tsx` entry point — the deliverable of this whole sub-project.

- [ ] **Step 1: Write the failing test**

Replace `client/src/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { api } from './lib/api';

vi.mock('./lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function renderApp(initialPath: string): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    localStorage.clear();
  });

  it('redirects the root path to /login', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

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

  it('redirects an unauthenticated visit to /admin back to /login', async () => {
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/App.test.tsx`
Expected: FAIL — old `App.tsx` only renders "ToolzyPro", none of the new routes/pages exist yet

- [ ] **Step 3: Create `client/src/pages/UnauthorizedPage.tsx`**

```tsx
export default function UnauthorizedPage(): JSX.Element {
  return <div>You are not authorized to view this page.</div>;
}
```

- [ ] **Step 4: Create `client/src/pages/AdminHomePage.tsx`**

```tsx
import { useAuth } from '../auth/AuthContext';

export default function AdminHomePage(): JSX.Element {
  const { user } = useAuth();
  return <div>Welcome, {user?.email} (master_admin)</div>;
}
```

- [ ] **Step 5: Create `client/src/pages/ResellerHomePage.tsx`**

```tsx
import { useAuth } from '../auth/AuthContext';

export default function ResellerHomePage(): JSX.Element {
  const { user } = useAuth();
  return <div>Welcome, {user?.email} (reseller)</div>;
}
```

- [ ] **Step 6: Create `client/src/pages/CustomerHomePage.tsx`**

```tsx
import { useAuth } from '../auth/AuthContext';

export default function CustomerHomePage(): JSX.Element {
  const { user } = useAuth();
  return <div>Welcome, {user?.email} (customer)</div>;
}
```

- [ ] **Step 7: Replace `client/src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterCustomerPage from './pages/RegisterCustomerPage';
import RegisterResellerPage from './pages/RegisterResellerPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import AdminHomePage from './pages/AdminHomePage';
import ResellerHomePage from './pages/ResellerHomePage';
import CustomerHomePage from './pages/CustomerHomePage';
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
            <AdminHomePage />
          </ProtectedRoute>
        }
      />
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

- [ ] **Step 8: Replace `client/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { queryClient } from './lib/queryClient';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd client && npx vitest run`
Expected: PASS — the entire client test suite, including this file's three scenarios

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/UnauthorizedPage.tsx client/src/pages/AdminHomePage.tsx client/src/pages/ResellerHomePage.tsx client/src/pages/CustomerHomePage.tsx client/src/App.tsx client/src/main.tsx client/src/App.test.tsx
git commit -m "feat: wire route tree, placeholder home pages, and app entry point"
```

---

## Post-plan verification

Run the entire client suite once more and confirm a clean build:

```bash
cd client && npx vitest run
cd client && npm run build
```

Both must succeed with zero failures before this sub-project is considered done. The next sub-project should cover the Master Admin dashboard/panel — to be brainstormed separately.
