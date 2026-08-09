import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { activateAdminReseller, listAdminResellers, suspendAdminReseller } from '../../api/adminResellers';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '../../components/ui/table';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active resellers',
  suspended: 'Suspended resellers',
  pending: 'Pending resellers',
};

export default function ResellersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const { data: allResellers = [], isLoading } = useQuery({
    queryKey: ['admin-resellers'],
    queryFn: listAdminResellers,
  });

  const resellers = statusFilter ? allResellers.filter((r) => r.status === statusFilter) : allResellers;

  const setStatus = async (id: string, status: 'active' | 'suspended'): Promise<void> => {
    if (status === 'active') await activateAdminReseller(id);
    else await suspendAdminReseller(id);
    await queryClient.invalidateQueries({ queryKey: ['admin-resellers'] });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Master admin"
        title={statusFilter ? STATUS_LABEL[statusFilter] ?? 'Resellers' : 'Resellers'}
        description="Review every reseller, their plan state, customer count, revenue, and store status."
      />

      {isLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : resellers.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={Store}
            title={statusFilter ? `No ${statusFilter} resellers` : 'No resellers yet'}
            description="Reseller signups will appear here for approval and support."
          />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Store</TH>
                <TH>Status</TH>
                <TH>Plan</TH>
                <TH className="text-right">Customers</TH>
                <TH className="text-right">Revenue</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {resellers.map((reseller) => (
                <TR key={reseller._id}>
                  <TD>
                    <Link to={`/admin/resellers/${reseller._id}`} className="font-medium hover:text-primary">
                      {reseller.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {reseller.adminEmail ?? 'No admin user'} -{' '}
                      {reseller.customDomain ?? `${reseller.subdomain}.toolzypro.in`}
                    </div>
                  </TD>
                  <TD><StatusBadge status={reseller.status} /></TD>
                  <TD>
                    <div>{reseller.planName ?? 'No plan'}</div>
                    {reseller.subscriptionStatus && <div className="text-xs text-muted">{reseller.subscriptionStatus}</div>}
                  </TD>
                  <TD className="text-right">{reseller.customers}</TD>
                  <TD className="text-right tabular-nums">{reseller.revenue}</TD>
                  <TD>
                    {reseller.status === 'suspended' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus(reseller._id, 'active')}>Activate</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(reseller._id, 'suspended')}>Suspend</Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
