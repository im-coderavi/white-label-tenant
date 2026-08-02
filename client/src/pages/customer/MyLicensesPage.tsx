import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { listMyLicenses, activateLicense } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { LicenseKey } from '../../components/ui/license-key';

export default function MyLicensesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: licenses, isLoading } = useQuery({
    queryKey: ['my-licenses'],
    queryFn: listMyLicenses,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleActivate = async (licenseId: string): Promise<void> => {
    setErrors((prev) => ({ ...prev, [licenseId]: '' }));
    setPendingId(licenseId);
    try {
      await activateLicense(licenseId);
      await queryClient.invalidateQueries({ queryKey: ['my-licenses'] });
    } catch {
      setErrors((prev) => ({ ...prev, [licenseId]: 'Could not activate this license.' }));
    } finally {
      setPendingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const list = licenses ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your account"
        title="Licenses"
        description="One key per purchase. Activate a key on each device or install you use it for."
      />

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={KeyRound}
            title="No licenses yet"
            description="Keys are issued automatically the moment an order is paid."
            action={
              <Button asChild>
                <Link to="/account/store">Browse the store</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {list.map((license) => {
            const used = license.activationsUsed;
            const limit = license.activationLimit;
            const exhausted = used >= limit;
            return (
              <li
                key={license._id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-eyebrow uppercase text-muted">
                      {license.product?.type.replace('_', ' ') ?? 'product'}
                    </p>
                    <p className="mt-1 font-display font-semibold">
                      {license.product?.name ?? 'Product removed'}
                    </p>
                  </div>
                  <StatusBadge status={license.status} />
                </div>

                <LicenseKey value={license.key} meta={`Activations used ${used} of ${limit}`} />

                {errors[license._id] && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {errors[license._id]}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted">
                    {exhausted ? 'All activations used.' : `${limit - used} activation(s) left.`}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exhausted || pendingId === license._id}
                    onClick={() => handleActivate(license._id)}
                  >
                    Activate
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
