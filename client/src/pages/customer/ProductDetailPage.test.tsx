import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductDetailPage from './ProductDetailPage';
import * as storefrontApi from '../../api/storefront';
import * as ordersApi from '../../api/customerOrders';

vi.mock('../../api/storefront', () => ({
  getStorefrontProduct: vi.fn(),
}));
vi.mock('../../api/customerOrders', () => ({
  createCheckout: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/products/p1']}>
        <Routes>
          <Route path="/account/products/:productId" element={<ProductDetailPage />} />
          <Route path="/account/orders/:orderId" element={<div>Order confirmation placeholder</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const product = {
  _id: 'p1',
  name: 'Chatbot Builder',
  description: 'Drag-and-drop chatbot flows.',
  type: 'ai_tool',
  thumbnailUrl: null,
  price: 3000,
  currency: 'INR',
  isFeatured: true,
  currentVersion: '2.1.0',
  latestChangelog: 'Adds WhatsApp delivery.',
};

describe('customer ProductDetailPage', () => {
  beforeEach(() => {
    vi.mocked(storefrontApi.getStorefrontProduct).mockReset();
    vi.mocked(ordersApi.createCheckout).mockReset();
  });

  it('shows the product, its price, and its latest release', async () => {
    vi.mocked(storefrontApi.getStorefrontProduct).mockResolvedValueOnce(product);
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Chatbot Builder' })).toBeInTheDocument();
    expect(screen.getByText('3000 INR')).toBeInTheDocument();
    expect(screen.getByText('2.1.0')).toBeInTheDocument();
    expect(screen.getByText('Adds WhatsApp delivery.')).toBeInTheDocument();
  });

  it('buys the product and moves to the order confirmation', async () => {
    vi.mocked(storefrontApi.getStorefrontProduct).mockResolvedValueOnce(product);
    vi.mocked(ordersApi.createCheckout).mockResolvedValueOnce({
      orderId: 'order-1',
      gatewayOrderId: 'mock_1',
      amount: 3000,
      currency: 'INR',
    });
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Chatbot Builder' });
    await userEvent.click(screen.getByRole('button', { name: 'Buy now' }));

    expect(await screen.findByText('Order confirmation placeholder')).toBeInTheDocument();
    expect(ordersApi.createCheckout).toHaveBeenCalledWith('p1');
  });

  it('explains when the product is not available in this store', async () => {
    vi.mocked(storefrontApi.getStorefrontProduct).mockRejectedValueOnce(new Error('404'));
    renderPage();

    expect(await screen.findByText('This product is not available')).toBeInTheDocument();
  });
});
