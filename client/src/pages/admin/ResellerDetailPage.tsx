import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, PackageCheck } from 'lucide-react';
import {
  getAdminReseller,
  assignResellerPlan,
  listResellerEntitlements,
  setResellerEntitlement,
  activateAdminReseller,
  suspendAdminReseller,
} from '../../api/adminResellers';
import { listAdminPlans } from '../../api/adminPlans';
import { listProducts } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';
import { Select, Label } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { StatusBadge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

export default function ResellerDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: reseller, isLoading } = useQuery({
    queryKey: ['admin-reseller', id],
    queryFn: () => getAdminReseller(id as string),
    enabled: Boolean(id),
  });
  const { data: plans } = useQuery({ queryKey: ['admin-plans'], queryFn: listAdminPlans });
  const { data: entitlements } = useQuery({
    queryKey: ['admin-reseller-entitlements', id],
    queryFn: () => listResellerEntitlements(id as string),
    enabled: Boolean(id),
  });
  const { data: catalog } = useQuery({
    queryKey: ['admin-products-for-grant'],
    queryFn: () => listProducts({ status: 'published', limit: 100 }),
  });

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planMessage, setPlanMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [grantMessage, setGrantMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const resellerPlans = (plans ?? []).filter((p) => p.scope === 'reseller' && p.status === 'active');
  const entitledProductIds = new Set((entitlements ?? []).map((e) => e.productId));
  const grantableProducts = (catalog?.items ?? []).filter((p) => !entitledProductIds.has(p._id));

  const handleAssignPlan = async (): Promise<void> => {
    setPlanMessage(null);
    if (!selectedPlanId) {
      setPlanMessage({ tone: 'danger', text: 'Choose a plan first.' });
      return;
    }
    setAssigningPlan(true);
    try {
      await assignResellerPlan(id as string, selectedPlanId);
      await queryClient.invalidateQueries({ queryKey: ['admin-reseller', id] });
      setPlanMessage({ tone: 'success', text: 'Plan assigned.' });
    } catch {
      setPlanMessage({ tone: 'danger', text: 'Could not assign plan.' });
    } finally {
      setAssigningPlan(false);
    }
  };

  const handleGrant = async (): Promise<void> => {
    setGrantMessage(null);
    if (!selectedProductId) {
      setGrantMessage({ tone: 'danger', text: 'Choose a product first.' });
      return;
    }
    try {
      await setResellerEntitlement(id as string, selectedProductId, true);
      setSelectedProductId('');
      await queryClient.invalidateQueries({ queryKey: ['admin-reseller-entitlements', id] });
      setGrantMessage({ tone: 'success', text: 'Access granted.' });
    } catch {
      setGrantMessage({ tone: 'danger', text: 'Could not grant access.' });
    }
  };

  const handleRevoke = async (productId: string): Promise<void> => {
    try {
      await setResellerEntitlement(id as string, productId, false);
      await queryClient.invalidateQueries({ queryKey: ['admin-reseller-entitlements', id] });
    } catch {
      setGrantMessage({ tone: 'danger', text: 'Could not revoke access (global products cannot be revoked).' });
    }
  };

  const toggleStatus = async (): Promise<void> => {
    if (!reseller) return;
    if (reseller.status === 'suspended') await activateAdminReseller(reseller._id);
    else await suspendAdminReseller(reseller._id);
    await queryClient.invalidateQueries({ queryKey: ['admin-reseller', id] });
  };

  if (isLoading || !reseller) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/admin/resellers"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to resellers
      </Link>

      <PageHeader
        eyebrow="Master admin"
        title={reseller.name}
        description={reseller.customDomain ?? `${reseller.subdomain}.toolzypro.in`}
        actions={
          <Button variant={reseller.status === 'suspended' ? 'default' : 'outline'} onClick={toggleStatus}>
            {reseller.status === 'suspended' ? 'Activate store' : 'Suspend store'}
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-eyebrow uppercase text-muted">Status</p>
            <div className="mt-2">
              <StatusBadge status={reseller.status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-eyebrow uppercase text-muted">Plan</p>
            <p className="mt-2 font-display text-lg font-bold">{reseller.planName ?? 'No plan'}</p>
            {reseller.subscriptionStatus && <p className="text-xs text-muted">{reseller.subscriptionStatus}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-eyebrow uppercase text-muted">Customers</p>
            <p className="mt-2 font-display text-lg font-bold tabular-nums">{reseller.customers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-eyebrow uppercase text-muted">Revenue</p>
            <p className="mt-2 font-display text-lg font-bold tabular-nums">{reseller.revenue}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" aria-hidden="true" />
            Assign plan
          </CardTitle>
          <CardDescription>Assigning a plan activates the store immediately, bypassing payment.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="plan-select">Plan</Label>
            <Select id="plan-select" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
              <option value="">-- Choose a plan --</option>
              {resellerPlans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} — {plan.price} {plan.currency} / {plan.billingCycle}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={handleAssignPlan} disabled={assigningPlan}>
            {assigningPlan ? 'Assigning...' : 'Assign plan'}
          </Button>
        </CardContent>
        {planMessage && (
          <div className="px-5 pb-5">
            <Alert tone={planMessage.tone}>{planMessage.text}</Alert>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="size-4" aria-hidden="true" />
            Direct product access
          </CardTitle>
          <CardDescription>
            Grant or revoke access to a specific master product for this reseller, independent of its sync mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="product-select">Product</Label>
            <Select
              id="product-select"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">-- Choose a product --</option>
              {grantableProducts.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={handleGrant}>
            Grant access
          </Button>
        </CardContent>
        {grantMessage && (
          <div className="px-5 pb-5">
            <Alert tone={grantMessage.tone}>{grantMessage.text}</Alert>
          </div>
        )}

        {(entitlements ?? []).length > 0 && (
          <TableWrap>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH className="text-center">Enabled</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {(entitlements ?? []).map((entitlement) => (
                  <TR key={entitlement._id}>
                    <TD>{entitlement.productName}</TD>
                    <TD className="text-center">
                      <StatusBadge status={entitlement.enabled ? 'active' : 'inactive'} />
                    </TD>
                    <TD>
                      {entitlement.enabled && (
                        <Button size="sm" variant="ghost" onClick={() => handleRevoke(entitlement.productId)}>
                          Revoke
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
