import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Sparkles, Store } from 'lucide-react';
import { listStorefrontProducts } from '../../api/storefront';
import { createCheckout } from '../../api/customerOrders';
import type { StorefrontItem } from '../../api/storefront';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { EmptyState } from '../../components/ui/empty-state';

function ProductThumb({ item }: { item: StorefrontItem }): JSX.Element {
  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt=""
        className="h-40 w-full rounded-t-lg object-cover"
        loading="lazy"
      />
    );
  }
  // No artwork yet: a tinted panel keeps the grid even instead of collapsing the card.
  return (
    <div className="grid h-40 w-full place-items-center rounded-t-lg bg-gradient-to-br from-primary/10 via-secondary to-accent/10">
      <ShoppingBag className="size-7 text-primary/40" aria-hidden="true" />
    </div>
  );
}

export default function StorefrontPage(): JSX.Element {
  const navigate = useNavigate();
  const [buyError, setBuyError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { data: items, isLoading } = useQuery({
    queryKey: ['storefront'],
    queryFn: listStorefrontProducts,
  });

  const handleBuy = async (productId: string): Promise<void> => {
    setBuyError(null);
    setPendingId(productId);
    try {
      const result = await createCheckout(productId);
      navigate(`/account/orders/${result.orderId}`, { state: result });
    } catch {
      setBuyError('Could not start checkout. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const list = items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1.5 text-eyebrow uppercase text-primary">Digital marketplace</p>
        <h1 className="text-2xl font-bold sm:text-[1.75rem]">Store</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Buy once and download straight away. Every order comes with its own license key.
        </p>
      </div>

      {buyError && <Alert>{buyError}</Alert>}

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={Store}
            title="This store has no products yet"
            description="Check back shortly — the seller is still setting up their catalog."
          />
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item) => (
            <li
              key={item._id}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="relative">
                <ProductThumb item={item} />
                {item.isFeatured && (
                  <Badge tone="accent" className="absolute left-3 top-3 shadow-card">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Featured
                  </Badge>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <p className="text-eyebrow uppercase text-muted">{item.type.replace('_', ' ')}</p>
                <h2 className="mt-1.5 font-display text-base font-semibold leading-snug">{item.name}</h2>
                {item.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{item.description}</p>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 pt-1">
                  <p className="font-display text-lg font-bold tabular-nums">
                    {item.price} {item.currency}
                  </p>
                  <Button onClick={() => handleBuy(item._id)} disabled={pendingId === item._id}>
                    Buy
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
