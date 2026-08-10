import { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, CreditCard, PackageX } from 'lucide-react';
import { confirmMarketplacePurchase } from '../../api/marketplace';
import type { MarketplaceCheckoutResult } from '../../api/marketplace';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { Card, CardContent, CardFooter } from '../../components/ui/card';

export default function MarketplaceOrderConfirmationPage(): JSX.Element {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const initialOrder = location.state as MarketplaceCheckoutResult | undefined;
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!initialOrder) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-border bg-surface shadow-card">
        <EmptyState
          icon={PackageX}
          title="Order not found."
          description="We could not load this order. Head back to the marketplace and try again."
          action={
            <Button asChild>
              <Link to="/reseller/marketplace">Return to marketplace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const handleConfirm = async (): Promise<void> => {
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await confirmMarketplacePurchase(orderId as string);
      setStatus('paid');
    } catch {
      setConfirmError('Could not confirm payment. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const isPaid = status === 'paid';

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div>
        <p className="mb-1.5 text-eyebrow uppercase text-primary">Marketplace checkout</p>
        <h1 className="text-2xl font-bold">Order confirmation</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div
            className={`flex items-center gap-3 rounded-md p-4 ${
              isPaid ? 'bg-success/[0.08]' : 'bg-warning/[0.08]'
            }`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-md ${
                isPaid ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
              }`}
            >
              {isPaid ? (
                <CheckCircle2 className="size-5" aria-hidden="true" />
              ) : (
                <CreditCard className="size-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="font-display font-semibold">
                {isPaid ? 'Payment received' : 'Waiting for payment'}
              </p>
              <p className="text-sm text-muted">
                {isPaid
                  ? 'This product is now unlocked in your catalog.'
                  : 'Complete payment to unlock this product.'}
              </p>
            </div>
          </div>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Order</dt>
              <dd className="truncate font-mono text-xs">{orderId}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Amount</dt>
              <dd className="font-display text-lg font-bold tabular-nums">
                {initialOrder.amount} {initialOrder.currency}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge status={status} />
              </dd>
            </div>
          </dl>

          {confirmError && <Alert>{confirmError}</Alert>}
        </CardContent>

        <CardFooter className="justify-end">
          {isPaid ? (
            <>
              <Button asChild variant="ghost">
                <Link to="/reseller/marketplace">Back to marketplace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/reseller/catalog">Manage catalog</Link>
              </Button>
            </>
          ) : (
            <Button onClick={handleConfirm} disabled={isConfirming}>
              Simulate Payment
            </Button>
          )}
        </CardFooter>
      </Card>

      <p className="text-center text-xs text-muted">
        Payments run through your configured gateway (or a mock while sandboxed).
      </p>
    </div>
  );
}
