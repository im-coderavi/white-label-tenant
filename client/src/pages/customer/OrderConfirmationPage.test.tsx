import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderConfirmationPage from './OrderConfirmationPage';
import * as customerOrdersApi from '../../api/customerOrders';

vi.mock('../../api/customerOrders', () => ({
  confirmPayment: vi.fn(),
  listMyLicenses: vi.fn(),
}));

function renderPage(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/account/orders/order-1', state }]}>
      <Routes>
        <Route path="/account/orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/account/store" element={<div>Store placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    vi.mocked(customerOrdersApi.confirmPayment).mockReset();
    vi.mocked(customerOrdersApi.listMyLicenses).mockReset().mockResolvedValue([]);
  });

  it('shows a not-found state when navigation state is missing', () => {
    renderPage(undefined);
    expect(screen.getByText('Order not found.')).toBeInTheDocument();
  });

  it('shows the pending order and confirms payment', async () => {
    vi.mocked(customerOrdersApi.confirmPayment).mockResolvedValueOnce({
      _id: 'order-1',
      productId: 'p1',
      amount: 180,
      currency: 'INR',
      status: 'paid',
    });
    renderPage({ orderId: 'order-1', gatewayOrderId: 'mock_order_1', amount: 180, currency: 'INR' });

    // Amount and status render as a summary list with the status as a badge.
    expect(screen.getByText('180 INR')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByText('paid')).toBeInTheDocument();
    expect(customerOrdersApi.confirmPayment).toHaveBeenCalledWith('order-1');
  });

  it('shows the license key issued for this order after payment', async () => {
    vi.mocked(customerOrdersApi.confirmPayment).mockResolvedValueOnce({
      _id: 'order-1',
      productId: 'p1',
      amount: 180,
      currency: 'INR',
      status: 'paid',
    });
    vi.mocked(customerOrdersApi.listMyLicenses).mockResolvedValueOnce([
      {
        _id: 'lic-other',
        key: 'TZP-2026-OTHER123',
        product: { _id: 'p9', name: 'Another Product', type: 'plugin' },
        orderId: 'order-9',
        status: 'assigned',
        activationLimit: 1,
        activationsUsed: 0,
        expiresAt: null,
      },
      {
        _id: 'lic-1',
        key: 'TZP-2026-ABCD1234',
        product: { _id: 'p1', name: 'Super Tool', type: 'software' },
        orderId: 'order-1',
        status: 'assigned',
        activationLimit: 3,
        activationsUsed: 1,
        expiresAt: null,
      },
    ]);
    renderPage({ orderId: 'order-1', gatewayOrderId: 'mock_order_1', amount: 180, currency: 'INR' });

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByText('TZP-2026-ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Activations used 1 of 3')).toBeInTheDocument();
    expect(screen.queryByText('TZP-2026-OTHER123')).not.toBeInTheDocument();
  });

  it('shows an inline error when confirmation fails', async () => {
    vi.mocked(customerOrdersApi.confirmPayment).mockRejectedValueOnce(new Error('nope'));
    renderPage({ orderId: 'order-1', gatewayOrderId: 'mock_order_1', amount: 180, currency: 'INR' });

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm payment. Please try again.');
  });
});
