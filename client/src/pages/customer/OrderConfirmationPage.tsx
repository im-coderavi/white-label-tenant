import { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { confirmPayment } from '../../api/customerOrders';
import type { CheckoutResult } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';

export default function OrderConfirmationPage(): JSX.Element {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const initialOrder = location.state as CheckoutResult | undefined;
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (!initialOrder) {
    return (
      <div>
        <p>Order not found.</p>
        <Link to="/account/store">Return to store</Link>
      </div>
    );
  }

  const handleConfirm = async (): Promise<void> => {
    setConfirmError(null);
    try {
      const order = await confirmPayment(orderId as string);
      setStatus(order.status === 'paid' ? 'paid' : 'pending');
    } catch {
      setConfirmError('Could not confirm payment. Please try again.');
    }
  };

  return (
    <div>
      <h1>Order confirmation</h1>
      <p>
        Amount: {initialOrder.amount} {initialOrder.currency}
      </p>
      <p>Status: {status}</p>

      {status === 'pending' && <Button onClick={handleConfirm}>Simulate Payment</Button>}
      {status === 'paid' && <p>Payment confirmed. Thank you for your purchase!</p>}
      {confirmError && <p role="alert">{confirmError}</p>}
    </div>
  );
}
