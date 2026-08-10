import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StorefrontPage from './StorefrontPage';
import * as storefrontApi from '../../api/storefront';
import * as customerOrdersApi from '../../api/customerOrders';

vi.mock('../../api/storefront', () => ({
  listStorefrontProducts: vi.fn(),
}));
vi.mock('../../api/customerOrders', () => ({
  createCheckout: vi.fn(),
  confirmPayment: vi.fn(),
}));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, apiGet: vi.fn().mockResolvedValue({ store: null }), apiPost: vi.fn() };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/store']}>
        <Routes>
          <Route path="/account/store" element={<StorefrontPage />} />
          <Route path="/account/orders/:orderId" element={<div>Order confirmation placeholder</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const item = {
  _id: 'p1',
  name: 'Super Tool',
  description: 'A tool',
  type: 'software',
  thumbnailUrl: null,
  price: 180,
  currency: 'INR',
  isFeatured: true,
};

describe('StorefrontPage', () => {
  beforeEach(() => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockReset();
    vi.mocked(customerOrdersApi.createCheckout).mockReset();
  });

  it('renders fetched products with price and a featured badge', async () => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockResolvedValueOnce([item]);
    renderPage();

    expect(await screen.findByText('Super Tool')).toBeInTheDocument();
    expect(screen.getByText('₹180')).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('buys a product and navigates to the order confirmation page', async () => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockResolvedValueOnce([{ ...item, isFeatured: false }]);
    vi.mocked(customerOrdersApi.createCheckout).mockResolvedValueOnce({
      orderId: 'order-1',
      gatewayOrderId: 'mock_order_1',
      amount: 180,
      currency: 'INR',
    });
    renderPage();

    await screen.findByText('Super Tool');
    await userEvent.click(screen.getByRole('button', { name: 'Instant Access' }));

    expect(await screen.findByText('Order confirmation placeholder')).toBeInTheDocument();
    expect(customerOrdersApi.createCheckout).toHaveBeenCalledWith('p1');
  });

  it('shows an inline error when checkout fails', async () => {
    vi.mocked(storefrontApi.listStorefrontProducts).mockResolvedValueOnce([{ ...item, isFeatured: false }]);
    vi.mocked(customerOrdersApi.createCheckout).mockRejectedValueOnce(new Error('nope'));
    renderPage();

    await screen.findByText('Super Tool');
    await userEvent.click(screen.getByRole('button', { name: 'Instant Access' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start checkout. Please try again.');
  });
});
