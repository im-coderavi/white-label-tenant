import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyOrdersPage from './MyOrdersPage';
import * as api from '../../api/customerOrders';

vi.mock('../../api/customerOrders', () => ({
  listMyOrders: vi.fn(),
  requestDownload: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const paidOrder = {
  _id: 'order-1',
  orderType: 'single_product',
  amount: 2499,
  currency: 'INR',
  status: 'paid' as const,
  licenseId: 'lic-1',
  createdAt: '2026-08-01T10:00:00.000Z',
  product: { _id: 'p1', name: 'Ecommerce Starter Kit', type: 'landing_page' },
};

const pendingOrder = {
  ...paidOrder,
  _id: 'order-2',
  amount: 3824,
  status: 'pending' as const,
  licenseId: null,
  product: { _id: 'p2', name: 'Chatbot Builder', type: 'ai_tool' },
};

describe('MyOrdersPage', () => {
  beforeEach(() => {
    vi.mocked(api.listMyOrders).mockReset();
    vi.mocked(api.requestDownload).mockReset();
  });

  it('shows an empty state when there are no orders', async () => {
    vi.mocked(api.listMyOrders).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  });

  it('lists orders with product, amount, and status', async () => {
    vi.mocked(api.listMyOrders).mockResolvedValueOnce([paidOrder, pendingOrder]);
    renderPage();

    expect(await screen.findByText('Ecommerce Starter Kit')).toBeInTheDocument();
    expect(screen.getByText('Chatbot Builder')).toBeInTheDocument();
    expect(screen.getByText('2499 INR')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('offers a download only on paid orders', async () => {
    vi.mocked(api.listMyOrders).mockResolvedValueOnce([paidOrder, pendingOrder]);
    renderPage();

    const paidRow = (await screen.findByText('Ecommerce Starter Kit')).closest('li') as HTMLElement;
    const pendingRow = screen.getByText('Chatbot Builder').closest('li') as HTMLElement;

    expect(within(paidRow).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(within(pendingRow).queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('surfaces a message when the product has no downloadable file', async () => {
    vi.mocked(api.listMyOrders).mockResolvedValueOnce([paidOrder]);
    vi.mocked(api.requestDownload).mockRejectedValueOnce(new Error('no file'));
    renderPage();

    const row = (await screen.findByText('Ecommerce Starter Kit')).closest('li') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(within(row).getByRole('alert')).toHaveTextContent(
        'No download is available for this order yet.'
      )
    );
  });
});
