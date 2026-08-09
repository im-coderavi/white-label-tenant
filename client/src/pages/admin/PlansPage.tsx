import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CreditCard, Plus } from 'lucide-react';
import { listAdminPlans, createAdminPlan, archiveAdminPlan } from '../../api/adminPlans';
import { Button } from '../../components/ui/button';
import { Input, Select, Label } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { StatusBadge, Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';
import { Alert } from '../../components/ui/alert';

export default function PlansPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useQuery({ queryKey: ['admin-plans'], queryFn: listAdminPlans });

  const [form, setForm] = useState({
    scope: 'reseller' as 'reseller' | 'customer',
    name: '',
    price: '',
    billingCycle: 'monthly' as 'monthly' | 'annual' | 'lifetime',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.price) {
      setError('Name and price are required.');
      return;
    }
    setSubmitting(true);
    try {
      await createAdminPlan({
        scope: form.scope,
        name: form.name,
        price: Number(form.price),
        billingCycle: form.billingCycle,
      });
      setForm({ scope: 'reseller', name: '', price: '', billingCycle: 'monthly' });
      await queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    } catch {
      setError('Could not create plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string): Promise<void> => {
    await archiveAdminPlan(id);
    await queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
  };

  const list = plans ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Master admin"
        title="Subscription Plans"
        description="Reseller plans control what a store owner pays to run their business; customer plans (future) gate storefront subscriptions."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" aria-hidden="true" />
            Create plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="plan-scope">Scope</Label>
              <Select
                id="plan-scope"
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as 'reseller' | 'customer' }))}
              >
                <option value="reseller">Reseller</option>
                <option value="customer">Customer</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                placeholder="Premium"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="plan-price">Price (INR)</Label>
              <Input
                id="plan-price"
                type="number"
                placeholder="1999"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="plan-cycle">Billing cycle</Label>
              <Select
                id="plan-cycle"
                value={form.billingCycle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billingCycle: e.target.value as 'monthly' | 'annual' | 'lifetime' }))
                }
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="lifetime">Lifetime</option>
              </Select>
            </div>
            {error && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Alert>{error}</Alert>
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={submitting}>
                <Plus aria-hidden="true" />
                {submitting ? 'Creating...' : 'Create plan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState icon={CreditCard} title="No plans yet" description="Create a plan above to start assigning it to resellers." />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Plan</TH>
                <TH>Scope</TH>
                <TH className="text-right">Price</TH>
                <TH>Billing</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.map((plan) => (
                <TR key={plan._id}>
                  <TD className="font-medium">{plan.name}</TD>
                  <TD>
                    <Badge tone="neutral">{plan.scope}</Badge>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {plan.price} {plan.currency}
                  </TD>
                  <TD className="text-muted">{plan.billingCycle}</TD>
                  <TD>
                    <StatusBadge status={plan.status} />
                  </TD>
                  <TD>
                    {plan.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(plan._id)}>
                        <Archive aria-hidden="true" />
                        Archive
                      </Button>
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
