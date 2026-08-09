import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Package, Plus, Trash2 } from 'lucide-react';
import { listOwnProducts, createOwnProduct, updateOwnProduct, deleteOwnProduct } from '../../api/ownProducts';
import type { OwnProduct } from '../../api/ownProducts';
import { getResellerEntitlements } from '../../api/resellerEntitlements';
import { Button } from '../../components/ui/button';
import { Input, Label, Textarea } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { Alert } from '../../components/ui/alert';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

export default function MyProductsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: entitlements, isLoading: entitlementsLoading } = useQuery({
    queryKey: ['reseller-entitlements'],
    queryFn: getResellerEntitlements,
  });
  const { data: products, isLoading } = useQuery({
    queryKey: ['reseller-own-products'],
    queryFn: listOwnProducts,
    enabled: Boolean(entitlements?.canAddOwnProducts),
  });

  const [form, setForm] = useState({ name: '', price: '', shortDescription: '', description: '' });
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
      await createOwnProduct({
        name: form.name,
        price: Number(form.price),
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
      });
      setForm({ name: '', price: '', shortDescription: '', description: '' });
      await queryClient.invalidateQueries({ queryKey: ['reseller-own-products'] });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not create product.');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePublish = async (product: OwnProduct): Promise<void> => {
    await updateOwnProduct(product._id, { status: product.status === 'published' ? 'draft' : 'published' });
    await queryClient.invalidateQueries({ queryKey: ['reseller-own-products'] });
  };

  const handleDelete = async (id: string): Promise<void> => {
    await deleteOwnProduct(id);
    await queryClient.invalidateQueries({ queryKey: ['reseller-own-products'] });
  };

  if (entitlementsLoading) return <p className="text-sm text-muted">Loading...</p>;

  if (!entitlements?.canAddOwnProducts) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Your storefront" title="My Products" description="Sell your own products alongside the platform catalog." />
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={Lock}
            title="Not available on your current plan"
            description="Upgrade to Premium or Agency to add and sell your own products under your brand."
          />
        </div>
      </div>
    );
  }

  const list = products ?? [];
  const limitText =
    entitlements.maxOwnProducts !== undefined ? `${list.length} of ${entitlements.maxOwnProducts} used` : `${list.length} products`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your storefront"
        title="My Products"
        description="Products you own completely — independent of the platform's master catalog."
        actions={<span className="text-sm text-muted">{limitText}</span>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Add a new product
          </CardTitle>
          <CardDescription>Fully yours — name, pricing, description, delivery. No platform lock.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="own-name">Product name</Label>
              <Input id="own-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="own-price">Price (INR)</Label>
              <Input
                id="own-price"
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="own-short">Short description</Label>
              <Input
                id="own-short"
                value={form.shortDescription}
                onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="own-desc">Full description</Label>
              <Textarea
                id="own-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {error && (
              <div className="md:col-span-2">
                <Alert>{error}</Alert>
              </div>
            )}
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Add product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState icon={Package} title="No products yet" description="Add your first product above." />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Product</TH>
                <TH className="text-right">Price</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.map((product) => (
                <TR key={product._id}>
                  <TD className="font-medium">{product.name}</TD>
                  <TD className="text-right tabular-nums">
                    {product.price} {product.currency}
                  </TD>
                  <TD>
                    <StatusBadge status={product.status} />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => togglePublish(product)}>
                        {product.status === 'published' ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(product._id)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
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
