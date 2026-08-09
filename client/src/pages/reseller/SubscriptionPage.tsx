import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CircleDollarSign } from 'lucide-react';
import { getSubscription } from '../../api/resellerAccount';
import { StatusBadge } from '../../components/ui/badge';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { LicenseKey } from '../../components/ui/license-key';
import { Card, CardContent } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';

const CYCLE_LABEL: Record<string, string> = {
  monthly: 'Renews monthly',
  annual: 'Renews yearly',
  lifetime: 'Never expires',
};

export default function SubscriptionPage(): JSX.Element {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['reseller-subscription'],
    queryFn: getSubscription,
  });

  if (isLoading) return <p className="text-sm text-muted">Loading...</p>;

  const isLapsed = Boolean(subscription && subscription.status !== 'active' && subscription.status !== 'grace');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your account"
        title="Subscription"
        description="Your platform plan — what it includes, and when it renews."
      />

      {isLapsed && <Alert>Your subscription is not active. Some features may be restricted.</Alert>}

      {subscription ? (
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
          <CardContent className="text-sm text-muted">No subscription found for your account.</CardContent>
        </Card>
      )}
    </div>
  );
}
