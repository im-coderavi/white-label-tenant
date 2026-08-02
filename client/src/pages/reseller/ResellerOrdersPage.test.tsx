import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResellerOrdersPage from './ResellerOrdersPage';
import * as api from '../../api/resellerAccount';

vi.mock('../../api/resellerAccount', () => ({
  listResellerOrders: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ResellerOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ResellerOrdersPage', () => {
  beforeEach(() => {
    vi.mocked(api.listResellerOrders).mockReset();
  });

  it('shows an empty state before the first sale', async () => {
    vi.mocked(api.listResellerOrders).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('No sales yet')).toBeInTheDocument();
  });

  it('lists each sale with product, buyer, amount, and status', async () => {
    vi.mocked(api.listResellerOrders).mockResolvedValueOnce([
      {
        _id: 'order-1',
        amount: 2499,
        currency: 'INR',
        status: 'paid',
        createdAt: '2026-08-01T10:00:00.000Z',
        product: { _id: 'p1', name: 'Ecommerce Starter Kit', type: 'landing_page' },
        customerEmail: 'buyer@example.com',
      },
    ]);
    renderPage();

    expect(await screen.findByText('Ecommerce Starter Kit')).toBeInTheDocument();
    expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    expect(screen.getByText('2499 INR')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });
});
