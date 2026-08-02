import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { listResellerOrders } from '../../api/resellerAccount';
import { StatusBadge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ResellerOrdersPage(): JSX.Element {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['reseller-orders'],
    queryFn: listResellerOrders,
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const list = orders ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your storefront"
        title="Sales"
        description="Every order placed on your store, newest first."
      />

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={ShoppingCart}
            title="No sales yet"
            description="Orders from your customers will appear here as soon as they come in."
          />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Product</TH>
                <TH>Customer</TH>
                <TH>Date</TH>
                <TH>Status</TH>
                <TH className="text-right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((order) => (
                <TR key={order._id}>
                  <TD>
                    <span className="font-medium">{order.product?.name ?? 'Product removed'}</span>
                    {order.product && (
                      <span className="ml-2 text-xs text-muted">
                        {order.product.type.replace('_', ' ')}
                      </span>
                    )}
                  </TD>
                  <TD className="text-muted">{order.customerEmail ?? 'Unknown'}</TD>
                  <TD className="text-muted">{formatDate(order.createdAt)}</TD>
                  <TD>
                    <StatusBadge status={order.status} />
                  </TD>
                  <TD className="text-right font-medium tabular-nums">
                    {order.amount} {order.currency}
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
