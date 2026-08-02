import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './LoginPage';
import * as AuthContextModule from '../auth/AuthContext';
import * as tenantModule from '../lib/tenant';
import * as publicStoreApi from '../api/publicStore';

vi.mock('../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../auth/AuthContext')>('../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});
vi.mock('../lib/tenant', () => ({ getStoreSubdomain: vi.fn() }));
vi.mock('../api/publicStore', () => ({ getStore: vi.fn() }));

function renderLoginPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<div>Admin Home</div>} />
          <Route path="/account" element={<div>Store Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(AuthContextModule.useAuth).mockReset();
    // Default: the platform's own domain, where the subdomain field is shown.
    vi.mocked(tenantModule.getStoreSubdomain).mockReset().mockReturnValue(null);
    vi.mocked(publicStoreApi.getStore).mockReset();
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
      tenantSubdomain: undefined,
    });
  });

  it('passes a filled-in store subdomain through unchanged', async () => {
    const login = vi
      .fn()
      .mockResolvedValue({ id: '2', email: 'r@example.com', role: 'reseller_admin', tenantId: 't1' });
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login,
      logout: vi.fn(),
    });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'r@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.type(screen.getByLabelText('Store subdomain (optional)'), 'acme');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(login).toHaveBeenCalledWith({
      email: 'r@example.com',
      password: 'longenough1',
      tenantSubdomain: 'acme',
    });
  });

  it('takes the store from the host and hides the field on a storefront domain', async () => {
    vi.mocked(tenantModule.getStoreSubdomain).mockReturnValue('nova');
    vi.mocked(publicStoreApi.getStore).mockResolvedValue({
      name: 'Nova Digital',
      subdomain: 'nova',
      status: 'active',
    });
    const login = vi
      .fn()
      .mockResolvedValue({ id: '3', email: 'c@example.com', role: 'customer', tenantId: 't1' });
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login,
      logout: vi.fn(),
    });
    renderLoginPage();

    expect(await screen.findByText('Signing in to Nova Digital')).toBeInTheDocument();
    expect(screen.queryByLabelText('Store subdomain (optional)')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'c@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(login).toHaveBeenCalledWith({
      email: 'c@example.com',
      password: 'longenough1',
      tenantSubdomain: 'nova',
    });
  });

  it('falls back to the subdomain itself if the store name has not loaded', async () => {
    vi.mocked(tenantModule.getStoreSubdomain).mockReturnValue('nova');
    vi.mocked(publicStoreApi.getStore).mockRejectedValue(new Error('offline'));
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderLoginPage();

    expect(await screen.findByText('Signing in to nova')).toBeInTheDocument();
  });
});
