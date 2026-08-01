import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderConfirmationPage from './OrderConfirmationPage';
import * as customerOrdersApi from '../../api/customerOrders';

vi.mock('../../api/customerOrders', () => ({
  confirmPayment: vi.fn(),
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

    expect(screen.getByText('Amount: 180 INR')).toBeInTheDocument();
    expect(screen.getByText('Status: pending')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByText('Status: paid')).toBeInTheDocument();
    expect(customerOrdersApi.confirmPayment).toHaveBeenCalledWith('order-1');
  });

  it('shows an inline error when confirmation fails', async () => {
    vi.mocked(customerOrdersApi.confirmPayment).mockRejectedValueOnce(new Error('nope'));
    renderPage({ orderId: 'order-1', gatewayOrderId: 'mock_order_1', amount: 180, currency: 'INR' });

    await userEvent.click(screen.getByRole('button', { name: 'Simulate Payment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm payment. Please try again.');
  });
});
