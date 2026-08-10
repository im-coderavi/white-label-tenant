import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound, Lock, ShoppingBag, Sparkles, Store, Unlock, X } from 'lucide-react';
import { listMarketplace, redeemLicenseKey, createMarketplaceCheckout } from '../../api/marketplace';
import type { MarketplaceItem } from '../../api/marketplace';
import { listCategories } from '../../api/categories';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';

function ProductThumb({ item }: { item: MarketplaceItem }): JSX.Element {
  if (item.thumbnailUrl) {
    return <img src={item.thumbnailUrl} alt="" className="h-36 w-full rounded-t-lg object-cover" loading="lazy" />;
  }
  return (
    <div className="grid h-36 w-full place-items-center rounded-t-lg bg-gradient-to-br from-primary/10 via-secondary to-accent/10">
      <ShoppingBag className="size-7 text-primary/40" aria-hidden="true" />
    </div>
  );
}

export default function MarketplacePage(): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category') ?? undefined;

  const { data: items, isLoading } = useQuery({
    queryKey: ['reseller-marketplace', categoryId],
    queryFn: () => listMarketplace(categoryId),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const activeCategory = categories?.find((c) => c._id === categoryId);

  const [licenseKey, setLicenseKey] = useState('');
  const [redeemMessage, setRedeemMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const handleRedeem = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setRedeemMessage(null);
    if (!licenseKey.trim()) return;
    setRedeeming(true);
    try {
      const result = await redeemLicenseKey(licenseKey.trim());
      setRedeemMessage({ tone: 'success', text: `Unlocked "${result.productName}" — it's now live in your catalog.` });
      setLicenseKey('');
      await queryClient.invalidateQueries({ queryKey: ['reseller-marketplace'] });
    } catch (err: any) {
      setRedeemMessage({
        tone: 'danger',
        text: err?.response?.data?.error?.message || 'Invalid or already-used license key.',
      });
    } finally {
      setRedeeming(false);
    }
  };

  const handleBuy = async (item: MarketplaceItem): Promise<void> => {
    setBuyError(null);
    setBuyingId(item._id);
    try {
      const result = await createMarketplaceCheckout(item._id);
      navigate(`/reseller/marketplace/orders/${result.orderId}`, { state: result });
    } catch {
      setBuyError('Could not start checkout. Please try again.');
    } finally {
      setBuyingId(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted">Loading marketplace...</p>;

  const list = items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Master catalog"
        title={activeCategory ? activeCategory.name : 'Marketplace'}
        description="Unlock products from the platform library with a license key, or buy individual access outright."
        actions={
          activeCategory && (
            <Button asChild variant="outline" size="sm">
              <Link to="/reseller/marketplace">
                <X aria-hidden="true" />
                Clear filter
              </Link>
            </Button>
          )
        }
      />

      <Card>
        <CardContent>
          <form onSubmit={handleRedeem} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="license-key-input">Redeem a license key</Label>
              <Input
                id="license-key-input"
                placeholder="TZP-2026-XXXXXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="font-mono uppercase"
              />
            </div>
            <Button type="submit" disabled={redeeming}>
              <KeyRound aria-hidden="true" />
              {redeeming ? 'Verifying...' : 'Verify & Unlock'}
            </Button>
          </form>
          {redeemMessage && (
            <div className="mt-3">
              <Alert tone={redeemMessage.tone}>{redeemMessage.text}</Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {buyError && <Alert>{buyError}</Alert>}

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={Store}
            title="No products in the master catalog yet"
            description="Once the platform publishes products, they'll appear here for you to unlock."
          />
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item) => (
            <li
              key={item._id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card"
            >
              <div className="relative">
                <ProductThumb item={item} />
                <Badge
                  tone={item.unlocked ? 'success' : 'neutral'}
                  className="absolute left-3 top-3 shadow-card"
                >
                  {item.unlocked ? (
                    <>
                      <Unlock className="size-3" aria-hidden="true" />
                      Unlocked
                    </>
                  ) : (
                    <>
                      <Lock className="size-3" aria-hidden="true" />
                      Locked
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <p className="text-eyebrow uppercase text-muted">{item.type.replace('_', ' ')}</p>
                <h3 className="mt-1.5 font-display text-base font-semibold leading-snug">{item.name}</h3>
                {item.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{item.description}</p>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 pt-1">
                  <span className="font-display text-lg font-bold tabular-nums">
                    {item.basePrice} <span className="text-xs text-muted">{item.currency}</span>
                  </span>
                  {item.unlocked ? (
                    <Badge tone="brand">
                      <Sparkles className="size-3" aria-hidden="true" />
                      In your catalog
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => handleBuy(item)} disabled={buyingId === item._id}>
                      {buyingId === item._id ? 'Starting...' : 'Buy access'}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
