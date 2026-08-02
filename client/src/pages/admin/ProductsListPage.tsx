import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';
import { listProducts } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { StatusBadge, Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

const PRODUCT_TYPES = ['software', 'ai_tool', 'theme', 'plugin', 'script', 'template', 'bundle', 'course'];

export default function ProductsListPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', { search, type, status }],
    queryFn: () =>
      listProducts({
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Master catalog"
        title="Products"
        description="Everything published here can be synced to reseller storefronts."
        actions={
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus aria-hidden="true" />
              New Product
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            aria-label="Search products"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filter by type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="sm:w-44"
        >
          <option value="">All types</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-40"
        >
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted shadow-card">
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={Package}
            title="No products match this view"
            description="Clear the filters, or add the first product to your catalog."
            action={
              <Button asChild>
                <Link to="/admin/products/new">
                  <Plus aria-hidden="true" />
                  New Product
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH className="text-right">Price</TH>
                <TH>Sync mode</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((product) => (
                <TR key={product._id}>
                  <TD>
                    <Link
                      to={`/admin/products/${product._id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    {product.currentVersion && (
                      <span className="ml-2 font-mono text-xs text-muted">v{product.currentVersion}</span>
                    )}
                  </TD>
                  <TD className="text-muted">{product.type.replace('_', ' ')}</TD>
                  <TD>
                    <StatusBadge status={product.status} />
                  </TD>
                  <TD className="text-right font-medium tabular-nums">
                    {product.basePrice} <span className="text-xs text-muted">{product.currency}</span>
                  </TD>
                  <TD>
                    <Badge tone="neutral">{product.syncMode}</Badge>
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
