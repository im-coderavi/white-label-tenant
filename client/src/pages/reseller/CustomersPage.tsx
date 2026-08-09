import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserPlus } from 'lucide-react';
import { createAccessCode, createCustomer, listAccessCodes, listCustomers, revokeAccessCode } from '../../api/resellerCustomers';
import { listCatalog } from '../../api/resellerCatalog';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Input, Label, Select, Textarea } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '../../components/ui/table';

export default function CustomersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useQuery({ queryKey: ['reseller-customers'], queryFn: listCustomers });
  const { data: codes = [] } = useQuery({ queryKey: ['reseller-access-codes'], queryFn: listAccessCodes });
  const { data: catalog = [] } = useQuery({ queryKey: ['reseller-catalog'], queryFn: listCatalog });
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const liveProducts = catalog.filter((item) => item.enabled);

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reseller-customers'] }),
      queryClient.invalidateQueries({ queryKey: ['reseller-access-codes'] }),
    ]);
  };

  const handleCreateCustomer = async (): Promise<void> => {
    setMessage('');
    try {
      await createCustomer({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      });
      setForm({ name: '', email: '', phone: '', notes: '' });
      await refresh();
    } catch {
      setMessage('Could not add customer. Check email and try again.');
    }
  };

  const handleCreateCode = async (customerId: string): Promise<void> => {
    const productId = selected[customerId] || liveProducts[0]?.product._id;
    if (!productId) return;
    setMessage('');
    try {
      await createAccessCode(customerId, productId);
      await refresh();
    } catch {
      setMessage('No available license key for this product, or the product is not live.');
    }
  };

  const handleRevoke = async (id: string): Promise<void> => {
    await revokeAccessCode(id);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reseller operations"
        title="Customers & access codes"
        description="Add buyers, issue product access codes, and revoke codes from one reseller workspace."
      />

      {message && <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="customer-name">Name</Label>
            <Input id="customer-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="customer-email">Email</Label>
            <Input id="customer-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="customer-phone">Phone</Label>
            <Input id="customer-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="md:row-span-2">
            <Label htmlFor="customer-notes">Notes</Label>
            <Textarea id="customer-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={handleCreateCustomer}>
              <UserPlus aria-hidden="true" />
              Add customer
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState icon={UserPlus} title="No customers yet" description="Create a customer before issuing access codes." />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH>Codes</TH>
                <TH>Issue access</TH>
              </TR>
            </THead>
            <TBody>
              {customers.map((customer) => (
                <TR key={customer._id}>
                  <TD>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted">{customer.email}</div>
                  </TD>
                  <TD><StatusBadge status={customer.status} /></TD>
                  <TD>{customer.accessCodes}</TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={selected[customer._id] || liveProducts[0]?.product._id || ''}
                        onChange={(e) => setSelected({ ...selected, [customer._id]: e.target.value })}
                        className="h-9 w-48"
                      >
                        {liveProducts.map((item) => (
                          <option key={item.product._id} value={item.product._id}>{item.product.name}</option>
                        ))}
                      </Select>
                      <Button size="sm" variant="outline" disabled={liveProducts.length === 0} onClick={() => handleCreateCode(customer._id)}>
                        <KeyRound aria-hidden="true" />
                        Issue
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Issued access codes</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted">No access codes issued yet.</p>
          ) : (
            <div className="grid gap-3">
              {codes.map((code) => (
                <div key={code._id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <div className="font-mono text-sm font-semibold">{code.code}</div>
                    <div className="mt-1 text-xs text-muted">{code.customer?.email} - {code.product?.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={code.status} />
                    {code.status !== 'revoked' && (
                      <Button size="sm" variant="ghost" onClick={() => handleRevoke(code._id)}>Revoke</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
