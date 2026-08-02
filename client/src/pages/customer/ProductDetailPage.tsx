import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PackageX, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { getStorefrontProduct } from '../../api/storefront';
import { createCheckout } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { EmptyState } from '../../components/ui/empty-state';
import { Card, CardContent } from '../../components/ui/card';

export default function ProductDetailPage(): JSX.Element {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [buyError, setBuyError] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['storefront-product', productId],
    queryFn: () => getStorefrontProduct(productId as string),
    enabled: Boolean(productId),
  });

  const handleBuy = async (): Promise<void> => {
    if (!product) return;
    setBuyError(null);
    setIsBuying(true);
    try {
      const result = await createCheckout(product._id);
      navigate(`/account/orders/${result.orderId}`, { state: result });
    } catch {
      setBuyError('Could not start checkout. Please try again.');
    } finally {
      setIsBuying(false);
    }
  };

  if (isError) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-border bg-surface shadow-card">
        <EmptyState
          icon={PackageX}
          title="This product is not available"
          description="It may have been removed from this store. Browse what else is on offer."
          action={
            <Button asChild>
              <Link to="/account/store">Back to store</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || !product) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/account/store"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to store
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt=""
              className="h-64 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="grid h-64 w-full place-items-center rounded-lg border border-border bg-gradient-to-br from-primary/10 via-secondary to-accent/10">
              <ShoppingBag className="size-10 text-primary/40" aria-hidden="true" />
            </div>
          )}

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-eyebrow uppercase text-muted">{product.type.replace('_', ' ')}</p>
              {product.isFeatured && (
                <Badge tone="accent">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Featured
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold sm:text-[1.75rem]">{product.name}</h1>
            {product.description && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{product.description}</p>
            )}
          </div>

          {product.currentVersion && (
            <Card className="mt-6">
              <CardContent>
                <p className="text-eyebrow uppercase text-muted">Latest release</p>
                <p className="mt-2 font-mono text-sm font-bold">{product.currentVersion}</p>
                {product.latestChangelog && (
                  <p className="mt-2 text-sm text-muted">{product.latestChangelog}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:sticky lg:top-24">
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-eyebrow uppercase text-muted">Your price</p>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
                {product.price} {product.currency}
              </p>
            </div>

            <Button size="lg" onClick={handleBuy} disabled={isBuying}>
              Buy now
            </Button>

            {buyError && <Alert>{buyError}</Alert>}

            <p className="flex items-start gap-2 text-sm text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              A license key is issued as soon as your payment clears, and the download unlocks straight
              away.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
