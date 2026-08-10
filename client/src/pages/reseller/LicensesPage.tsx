import { useQuery } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { listResellerLicenses } from '../../api/resellerLicenses';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LicensesPage(): JSX.Element {
  const { data: licenses, isLoading } = useQuery({
    queryKey: ['reseller-licenses'],
    queryFn: listResellerLicenses,
  });

  if (isLoading) return <p className="text-sm text-muted">Loading...</p>;

  const list = licenses ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your store"
        title="Licenses"
        description="Every license key bound to your store — issued via checkout, redemption, or a direct grant."
      />

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={KeyRound}
            title="No licenses yet"
            description="Licenses appear here once a customer buys, or you unlock/grant one."
          />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>License key</TH>
                <TH>Product</TH>
                <TH>Status</TH>
                <TH className="text-center">Activations</TH>
                <TH>Expires</TH>
                <TH>Issued</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((license) => (
                <TR key={license._id}>
                  <TD className="font-mono text-xs">{license.key}</TD>
                  <TD>
                    {typeof license.productId === 'object' && license.productId
                      ? license.productId.name
                      : 'Unknown product'}
                  </TD>
                  <TD>
                    <StatusBadge status={license.status} />
                  </TD>
                  <TD className="text-center tabular-nums">
                    {license.activationsUsed} / {license.activationLimit}
                  </TD>
                  <TD className="text-muted">{formatDate(license.expiresAt)}</TD>
                  <TD className="text-muted">{formatDate(license.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
