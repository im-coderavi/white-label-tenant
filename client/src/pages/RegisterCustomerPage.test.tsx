import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterCustomerPage from './RegisterCustomerPage';
import { api } from '../lib/api';
import * as tenantModule from '../lib/tenant';
import * as publicStoreApi from '../api/publicStore';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn() },
}));
vi.mock('../lib/tenant', () => ({ getStoreSubdomain: vi.fn() }));
vi.mock('../api/publicStore', () => ({ getStore: vi.fn() }));

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterCustomerPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RegisterCustomerPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(tenantModule.getStoreSubdomain).mockReset().mockReturnValue(null);
    vi.mocked(publicStoreApi.getStore).mockReset();
  });

  it('shows a success message after registering', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: '1', status: 'pending' } } });
    renderPage();

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
    renderPage();
    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme');
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('takes the store from the host and hides the field on a storefront domain', async () => {
    vi.mocked(tenantModule.getStoreSubdomain).mockReturnValue('nova');
    vi.mocked(publicStoreApi.getStore).mockResolvedValue({
      name: 'Nova Digital',
      subdomain: 'nova',
      status: 'active',
    });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: '1', status: 'pending' } } });
    renderPage();

    expect(await screen.findByText('Joining Nova Digital')).toBeInTheDocument();
    expect(screen.queryByLabelText('Store subdomain')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      tenantSubdomain: 'nova',
      email: 'buyer@example.com',
      password: 'longenough1',
    });
  });

  it('still requires a store subdomain on the platform domain', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Enter your store subdomain')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
