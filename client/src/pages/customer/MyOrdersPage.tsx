import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Receipt } from 'lucide-react';
import { listMyOrders, requestDownload } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MyOrdersPage(): JSX.Element {
  const { data: orders, isLoading } = useQuery({ queryKey: ['my-orders'], queryFn: listMyOrders });
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleDownload = async (orderId: string): Promise<void> => {
    setDownloadErrors((prev) => ({ ...prev, [orderId]: '' }));
    setPendingId(orderId);
    try {
      const grant = await requestDownload(orderId);
      window.open(grant.fileUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setDownloadErrors((prev) => ({
        ...prev,
        [orderId]: 'No download is available for this order yet.',
      }));
    } finally {
      setPendingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const list = orders ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your account"
        title="Orders"
        description="Everything you have bought, newest first."
      />

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={Receipt}
            title="No orders yet"
            description="Once you buy something it will show up here with its download."
            action={
              <Button asChild>
                <Link to="/account/store">Browse the store</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((order) => (
            <li
              key={order._id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-5 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-display font-semibold">{order.product?.name ?? 'Product removed'}</p>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(order.createdAt)}
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono text-xs">{order._id}</span>
                </p>
                {downloadErrors[order._id] && (
                  <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                    {downloadErrors[order._id]}
                  </p>
                )}
              </div>

              <p className="font-display text-lg font-bold tabular-nums">
                {order.amount} {order.currency}
              </p>

              {order.status === 'paid' && (
                <Button
                  variant="outline"
                  onClick={() => handleDownload(order._id)}
                  disabled={pendingId === order._id}
                >
                  <Download aria-hidden="true" />
                  Download
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
