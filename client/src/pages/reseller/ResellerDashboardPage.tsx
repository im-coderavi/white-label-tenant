import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, CircleDollarSign, LayoutGrid, Receipt, Users } from 'lucide-react';
import { getSubscription, getResellerStats } from '../../api/resellerAccount';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/badge';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { LicenseKey } from '../../components/ui/license-key';
import { Alert } from '../../components/ui/alert';
import { Card, CardContent } from '../../components/ui/card';

const CYCLE_LABEL: Record<string, string> = {
  monthly: 'Renews monthly',
  annual: 'Renews yearly',
  lifetime: 'Never expires',
};

export default function ResellerDashboardPage(): JSX.Element {
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['reseller-subscription'],
    queryFn: getSubscription,
  });
  const { data: stats } = useQuery({ queryKey: ['reseller-stats'], queryFn: getResellerStats });

  const isLapsed = Boolean(
    subscription && subscription.status !== 'active' && subscription.status !== 'grace'
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your storefront"
        title="Dashboard"
        description="Your plan, your access key, and how the store is doing."
        actions={
          <Button asChild variant="outline">
            <Link to="/reseller/catalog">Manage catalog</Link>
          </Button>
        }
      />

      {isLapsed && <Alert>Your store is not accepting new orders.</Alert>}

      {/* Plan + key */}
      {subLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : subscription ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            <StatCard
              label="Plan"
              value={subscription.plan?.name ?? 'Unknown plan'}
              hint={
                <span className="flex items-center gap-2">
                  <StatusBadge status={subscription.status} />
                  {subscription.plan && <span>{CYCLE_LABEL[subscription.plan.billingCycle]}</span>}
                </span>
              }
              icon={CircleDollarSign}
              accent={isLapsed ? 'destructive' : 'primary'}
            />
            <StatCard
              label="Days remaining"
              value={subscription.daysRemaining ?? '∞'}
              hint={
                subscription.currentPeriodEnd
                  ? `Until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : 'Lifetime access'
              }
              icon={CalendarClock}
              accent={isLapsed ? 'destructive' : 'accent'}
            />
          </div>

          {subscription.licenseKey ? (
            <LicenseKey
              value={subscription.licenseKey}
              label="Subscription key"
              meta="Identifies your store when you contact support."
            />
          ) : (
            <Card>
              <CardContent className="text-sm text-muted">
                Your key is issued once the first payment clears.
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display font-semibold">No plan selected</p>
              <p className="mt-1 text-sm text-muted">
                Pick a plan to put your storefront online and start taking orders.
              </p>
            </div>
            <Button asChild>
              <Link to="/register-reseller">Choose a plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Store totals */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={stats?.revenue ?? 0}
          hint="From settled orders"
          icon={CircleDollarSign}
          accent="success"
        />
        <StatCard
          label="Orders"
          value={stats?.ordersPaid ?? 0}
          hint={`${stats?.ordersTotal ?? 0} placed in total`}
          icon={Receipt}
          accent="primary"
        />
        <StatCard
          label="Live products"
          value={stats ? `${stats.catalogLive} of ${stats.catalogTotal}` : '—'}
          hint="Listed on your storefront"
          icon={LayoutGrid}
          accent="accent"
        />
        <StatCard
          label="Customers"
          value={stats?.customers ?? 0}
          hint="Have bought from you"
          icon={Users}
          accent="warning"
        />
      </div>
    </div>
  );
}
