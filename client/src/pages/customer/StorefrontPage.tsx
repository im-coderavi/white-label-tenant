import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { ShoppingBag, Sparkles, Store, KeyRound, CheckCircle, ArrowRight } from 'lucide-react';
import { listStorefrontProducts } from '../../api/storefront';
import { createCheckout } from '../../api/customerOrders';
import type { StorefrontItem } from '../../api/storefront';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { EmptyState } from '../../components/ui/empty-state';
import { apiGet, apiPost } from '../../lib/api';

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
  return (
    <div className="grid h-40 w-full place-items-center rounded-t-lg bg-gradient-to-br from-indigo-900/40 via-slate-900 to-indigo-950">
      <ShoppingBag className="size-7 text-indigo-400/60" aria-hidden="true" />
    </div>
  );
}

export default function StorefrontPage(): JSX.Element {
  const navigate = useNavigate();
  const [buyError, setBuyError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  
  // Access Code State
  const [codeModal, setCodeModal] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState<any | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Store Public Config
  const [storeConfig, setStoreConfig] = useState<any | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['storefront'],
    queryFn: listStorefrontProducts,
  });

  useEffect(() => {
    apiGet<{ store: any }>('/customer/products/public-config')
      .then((res: { store: any }) => {
        if (res.store) setStoreConfig(res.store);
      })
      .catch(() => {});
  }, []);

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

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemError(null);
    setRedeemSuccess(null);
    if (!accessCodeInput) return;

    setRedeeming(true);
    try {
      const res = await apiPost<{ result: any }>('/customer/products/redeem-code', { code: accessCodeInput });
      setRedeemSuccess(res.result);
    } catch (err: any) {
      setRedeemError(err?.response?.data?.message || 'Invalid access code or code expired.');
    } finally {
      setRedeeming(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading storefront catalog...</p>;
  }

  // If custom HTML template is set
  if (storeConfig?.storefrontJson?.landingTemplate === 'custom_html' && storeConfig?.storefrontJson?.customHtmlContent) {
    const sanitizedHtml = DOMPurify.sanitize(storeConfig.storefrontJson.customHtmlContent, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    });
    return (
      <div
        className="custom-landing-container"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  const list = items ?? [];
  const heroTitle = storeConfig?.storefrontJson?.heroTitle || 'Premium Digital Software & Tools Marketplace';
  const heroSubtitle =
    storeConfig?.storefrontJson?.heroSubtitle ||
    'Instant access to 10,000+ software tools, reels bundles, themes & plugins with lifetime license keys.';

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-slate-800 p-8 sm:p-10 overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-4">
          <Badge tone="accent" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            {storeConfig?.name || 'Verified Reseller Store'}
          </Badge>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {heroTitle}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            {heroSubtitle}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCodeModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all"
            >
              <KeyRound className="w-4 h-4" />
              <span>Redeem Access Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Access Code Modal */}
      {codeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                Redeem Customer Access Code
              </h2>
              <button onClick={() => setCodeModal(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter your <span className="font-mono text-indigo-400">TZP-YYYY-XXXX</span> access code provided by your seller to claim your product license.
            </p>

            <form onSubmit={handleRedeemCode} className="space-y-3">
              <input
                type="text"
                placeholder="TZP-2026-ABCD1234"
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value)}
                className="w-full p-3 font-mono uppercase bg-slate-950 border border-slate-800 rounded-xl text-center font-bold text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {redeemError && (
                <div className="p-3 bg-rose-950/60 border border-rose-900 text-rose-400 text-xs rounded-lg">{redeemError}</div>
              )}

              {redeemSuccess && (
                <div className="p-4 bg-emerald-950/60 border border-emerald-900 text-emerald-300 text-xs rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    Access Code Redeemed Successfully!
                  </div>
                  <div>Product: <strong className="text-white">{redeemSuccess.productName}</strong></div>
                  {redeemSuccess.licenseKey && (
                    <div>License Key: <span className="font-mono text-indigo-300 font-bold">{redeemSuccess.licenseKey}</span></div>
                  )}
                  <Link
                    to="/account/licenses"
                    className="mt-2 inline-flex items-center gap-1 text-indigo-400 hover:underline font-semibold"
                  >
                    View My Licenses & Downloads <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              <Button type="submit" disabled={redeeming} className="w-full">
                {redeeming ? 'Validating...' : 'Claim License Key'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {buyError && <Alert>{buyError}</Alert>}

      {/* Catalog Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Available Software & Digital Tools ({list.length})</h2>

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
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-card transition-all hover:border-slate-700 hover:shadow-2xl"
              >
                <div className="relative">
                  <ProductThumb item={item} />
                  {item.isFeatured && (
                    <Badge tone="accent" className="absolute left-3 top-3 shadow-card bg-indigo-500 text-white">
                      <Sparkles className="size-3 mr-1" aria-hidden="true" />
                      Featured
                    </Badge>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs uppercase font-bold text-indigo-400 tracking-wider">{item.type.replace('_', ' ')}</p>
                  <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-white">
                    <Link to={`/account/products/${item._id}`} className="hover:text-indigo-400">
                      {item.name}
                    </Link>
                  </h3>
                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  )}

                  <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                    <p className="font-display text-lg font-bold text-emerald-400 tabular-nums">
                      ₹{item.price}
                    </p>
                    <Button onClick={() => handleBuy(item._id)} disabled={pendingId === item._id}>
                      Instant Access
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
