import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomersPage from './CustomersPage';
import * as customersApi from '../../api/resellerCustomers';
import * as catalogApi from '../../api/resellerCatalog';

vi.mock('../../api/resellerCustomers', () => ({
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
  createAccessCode: vi.fn(),
  listAccessCodes: vi.fn(),
  revokeAccessCode: vi.fn(),
}));

vi.mock('../../api/resellerCatalog', () => ({
  listCatalog: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CustomersPage />
    </QueryClientProvider>
  );
}

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.mocked(customersApi.listCustomers).mockReset();
    vi.mocked(customersApi.createCustomer).mockReset();
    vi.mocked(customersApi.createAccessCode).mockReset();
    vi.mocked(customersApi.listAccessCodes).mockReset();
    vi.mocked(customersApi.revokeAccessCode).mockReset();
    vi.mocked(catalogApi.listCatalog).mockReset();
  });

  it('adds a customer and issues an access code for a live product', async () => {
    vi.mocked(customersApi.listCustomers)
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          _id: 'c1',
          name: 'Jane Buyer',
          email: 'jane@example.com',
          phone: null,
          notes: '',
          status: 'active',
          accessCodes: 0,
          createdAt: '2026-08-09T00:00:00.000Z',
        },
      ]);
    vi.mocked(customersApi.listAccessCodes).mockResolvedValue([]);
    vi.mocked(catalogApi.listCatalog).mockResolvedValue([
      {
        _id: 'rp1',
        product: { _id: 'p1', name: 'Pro Toolkit', type: 'software', basePrice: 999, currency: 'INR' },
        syncMode: 'global',
        enabled: true,
        customPrice: null,
        discountPercent: null,
        isFeatured: false,
        sortOrder: 0,
        overrides: {},
      },
    ]);
    vi.mocked(customersApi.createCustomer).mockResolvedValue({
      _id: 'c1',
      name: 'Jane Buyer',
      email: 'jane@example.com',
      phone: null,
      notes: '',
      status: 'active',
      accessCodes: 0,
      createdAt: '2026-08-09T00:00:00.000Z',
    });
    vi.mocked(customersApi.createAccessCode).mockResolvedValue({
      _id: 'a1',
      code: 'TZP-2026-ABCDEF12',
      status: 'unused',
      expiresAt: null,
      redeemedAt: null,
      createdAt: '2026-08-09T00:00:00.000Z',
      customer: { _id: 'c1', name: 'Jane Buyer', email: 'jane@example.com' },
      product: { _id: 'p1', name: 'Pro Toolkit', type: 'software' },
      licenseKey: 'TZP-2026-LICENSE1',
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Buyer');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByText('Jane Buyer')).toBeInTheDocument();

    const row = screen.getByText('Jane Buyer').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Issue' }));

    await waitFor(() => expect(customersApi.createAccessCode).toHaveBeenCalledWith('c1', 'p1'));
  });
});
