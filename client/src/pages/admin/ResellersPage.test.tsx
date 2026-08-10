import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResellersPage from './ResellersPage';
import * as adminResellersApi from '../../api/adminResellers';

vi.mock('../../api/adminResellers', () => ({
  listAdminResellers: vi.fn(),
  suspendAdminReseller: vi.fn(),
  activateAdminReseller: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ResellersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ResellersPage', () => {
  beforeEach(() => {
    vi.mocked(adminResellersApi.listAdminResellers).mockReset();
    vi.mocked(adminResellersApi.suspendAdminReseller).mockReset();
    vi.mocked(adminResellersApi.activateAdminReseller).mockReset();
  });

  it('lists resellers and suspends an active store', async () => {
    vi.mocked(adminResellersApi.listAdminResellers).mockResolvedValue([
      {
        _id: 't1',
        name: 'Acme Store',
        subdomain: 'acme',
        customDomain: null,
        status: 'active',
        adminEmail: 'owner@acme.test',
        planName: 'Premium',
        subscriptionStatus: 'active',
        customers: 12,
        revenue: 4500,
        createdAt: '2026-08-09T00:00:00.000Z',
      },
    ]);
    vi.mocked(adminResellersApi.suspendAdminReseller).mockResolvedValue({
      _id: 't1',
      name: 'Acme Store',
      subdomain: 'acme',
      customDomain: null,
      status: 'suspended',
      adminEmail: 'owner@acme.test',
      planName: 'Premium',
      subscriptionStatus: 'active',
      customers: 12,
      revenue: 4500,
      createdAt: '2026-08-09T00:00:00.000Z',
    });

    renderPage();

    expect(await screen.findByText('Acme Store')).toBeInTheDocument();
    expect(screen.getByText(/owner@acme\.test/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await waitFor(() => expect(adminResellersApi.suspendAdminReseller).toHaveBeenCalledWith('t1'));
  });
});
