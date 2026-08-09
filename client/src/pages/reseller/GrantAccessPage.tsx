import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog, KeyRound, Info } from 'lucide-react';
import { listGrantedAccess, grantProductAccess } from '../../api/grantAccess';
import { listCustomers } from '../../api/resellerCustomers';
import { listCatalog } from '../../api/resellerCatalog';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input, Label, Select } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Alert } from '../../components/ui/alert';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function GrantAccessPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: customers } = useQuery({ queryKey: ['reseller-customers'], queryFn: listCustomers });
  const { data: catalog } = useQuery({ queryKey: ['reseller-catalog'], queryFn: listCatalog });
  const { data: grants, isLoading: grantsLoading } = useQuery({
    queryKey: ['reseller-grant-access'],
    queryFn: listGrantedAccess,
  });

  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const enabledProducts = (catalog ?? []).filter((item) => item.enabled);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setMessage(null);
    if (!customerId || !productId) {
      setMessage({ tone: 'danger', text: 'Choose an end user and a product.' });
      return;
    }
    setSubmitting(true);
    try {
      const grant = await grantProductAccess({
        customerId,
        productId,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setMessage({ tone: 'success', text: `Access granted — license ${grant.licenseKey} issued.` });
      setCustomerId('');
      setProductId('');
      setExpiresAt('');
      await queryClient.invalidateQueries({ queryKey: ['reseller-grant-access'] });
    } catch (err: any) {
      setMessage({ tone: 'danger', text: err?.response?.data?.message || 'Could not grant access.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Manual fulfillment"
        title="Grant Product Access"
        description="Manually give an end user access to a single product without requiring them to go through checkout or the payment gateway."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-4" aria-hidden="true" />
              New grant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="grant-customer">1. Select end user</Label>
                <Select id="grant-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">-- Search end user --</option>
                  {(customers ?? []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="grant-product">2. Select product</Label>
                <Select id="grant-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">-- Select a product --</option>
                  {enabledProducts.map((item) => (
                    <option key={item.product._id} value={item.product._id}>
                      {item.product.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="grant-expiry">3. Expiry date (optional)</Label>
                <Input
                  id="grant-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">Leave blank for lifetime access.</p>
              </div>
              {message && (
                <div className="md:col-span-2">
                  <Alert tone={message.tone}>{message.text}</Alert>
                </div>
              )}
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>
                  <KeyRound aria-hidden="true" />
                  {submitting ? 'Granting...' : 'Grant access'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4" aria-hidden="true" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-4 text-sm text-muted">
              <li>The user is immediately assigned a license and can see it from their licenses page.</li>
              <li>An email with the license key is sent to the customer automatically.</li>
              <li>If no expiry date is set, the access is permanent (lifetime).</li>
              <li>Only customers registered under your store and products enabled in your catalog can be selected.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Granted access history</CardTitle>
          <CardDescription>Every manual grant issued from this panel.</CardDescription>
        </CardHeader>
        {grantsLoading ? (
          <CardContent>
            <p className="text-sm text-muted">Loading...</p>
          </CardContent>
        ) : (grants ?? []).length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No manual grants yet"
            description="Access you grant directly to a customer will show up here."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>License key</TH>
                  <TH>Customer</TH>
                  <TH>Product</TH>
                  <TH>Status</TH>
                  <TH>Granted</TH>
                  <TH>Expires</TH>
                </TR>
              </THead>
              <TBody>
                {(grants ?? []).map((grant) => (
                  <TR key={grant._id}>
                    <TD className="font-mono text-xs">{grant.licenseKey}</TD>
                    <TD>
                      {grant.customer.name}
                      <span className="ml-2 text-xs text-muted">{grant.customer.email}</span>
                    </TD>
                    <TD>{grant.product.name}</TD>
                    <TD>
                      <StatusBadge status={grant.status} />
                    </TD>
                    <TD className="text-muted">{formatDate(grant.grantedAt)}</TD>
                    <TD className="text-muted">{grant.expiresAt ? formatDate(grant.expiresAt) : 'Lifetime'}</TD>
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
