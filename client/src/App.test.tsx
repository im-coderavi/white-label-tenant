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

  it('serves the marketing page at the root path', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { plans: [] } });
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Every sale ships a key');
  });

  it('logs in as master_admin and lands on the admin products page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'admin@example.com', role: 'master_admin', tenantId: null },
      },
    });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], total: 0, page: 1, limit: 20 },
    });

    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
  });

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

  it('redirects an unauthenticated visit to /admin back to /login', async () => {
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});
