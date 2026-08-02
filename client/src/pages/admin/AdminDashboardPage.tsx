import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, CircleDollarSign, KeyRound, Package, Receipt } from 'lucide-react';
import { getPlatformStats } from '../../api/adminStats';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';

export default function AdminDashboardPage(): JSX.Element {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getPlatformStats,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        description="How the whole platform is doing, across every reseller store."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/products">Manage products</Link>
          </Button>
        }
      />

      {isError ? (
        <p className="text-sm text-muted">Stats are unavailable right now.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Revenue"
              value={stats?.revenue ?? 0}
              hint="From settled orders"
              icon={CircleDollarSign}
              accent="success"
            />
            <StatCard
              label="Paid orders"
              value={stats?.ordersPaid ?? 0}
              hint="Across all stores"
              icon={Receipt}
              accent="primary"
            />
            <StatCard
              label="Reseller stores"
              value={stats ? `${stats.tenantsActive} of ${stats.tenantsTotal}` : '—'}
              hint="Active right now"
              icon={Building2}
              accent="accent"
            />
            <StatCard
              label="Licenses issued"
              value={stats?.licensesIssued ?? 0}
              hint="Handed to buyers"
              icon={KeyRound}
              accent="warning"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <StatCard
              label="Products published"
              value={stats ? `${stats.productsPublished} of ${stats.productsTotal}` : '—'}
              hint="Available to sync to stores"
              icon={Package}
              accent="primary"
            />
            <StatCard
              label="Active subscriptions"
              value={stats?.subscriptionsActive ?? 0}
              hint="Resellers currently paying"
              icon={CircleDollarSign}
              accent="accent"
            />
          </div>
        </>
      )}
    </div>
  );
}
