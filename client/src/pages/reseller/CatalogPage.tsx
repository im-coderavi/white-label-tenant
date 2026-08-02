import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageOpen } from 'lucide-react';
import { listCatalog, updateCatalogItem } from '../../api/resellerCatalog';
import type { ResellerCatalogItem } from '../../api/resellerCatalog';
import { Button } from '../../components/ui/button';
import { Input, Select, Label } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';

interface RowState {
  enabled: boolean;
  pricingMode: 'default' | 'custom' | 'discount';
  customPrice: string;
  discountPercent: string;
  isFeatured: boolean;
}

function toRowState(item: ResellerCatalogItem): RowState {
  return {
    enabled: item.enabled,
    pricingMode: item.discountPercent != null ? 'discount' : item.customPrice != null ? 'custom' : 'default',
    customPrice: item.customPrice != null ? String(item.customPrice) : '',
    discountPercent: item.discountPercent != null ? String(item.discountPercent) : '',
    isFeatured: item.isFeatured,
  };
}

/** Mirrors the server's pricing rule so the row shows what a buyer will actually pay. */
function effectivePrice(basePrice: number, state: RowState): number {
  if (state.pricingMode === 'custom') return Number(state.customPrice) || 0;
  if (state.pricingMode === 'discount') {
    const percent = Number(state.discountPercent) || 0;
    return Number((basePrice * (1 - percent / 100)).toFixed(2));
  }
  return basePrice;
}

export default function CatalogPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({ queryKey: ['reseller-catalog'], queryFn: listCatalog });
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items) return;
    setRowStates((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!next[item._id]) {
          next[item._id] = toRowState(item);
        }
      });
      return next;
    });
  }, [items]);

  const updateRow = (id: string, patch: Partial<RowState>): void => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (item: ResellerCatalogItem): Promise<void> => {
    const state = rowStates[item._id] ?? toRowState(item);
    setRowErrors((prev) => ({ ...prev, [item._id]: '' }));
    try {
      await updateCatalogItem(item._id, {
        enabled: state.enabled,
        pricingMode: state.pricingMode,
        customPrice: state.pricingMode === 'custom' ? Number(state.customPrice) : undefined,
        discountPercent: state.pricingMode === 'discount' ? Number(state.discountPercent) : undefined,
        isFeatured: state.isFeatured,
      });
      await queryClient.invalidateQueries({ queryKey: ['reseller-catalog'] });
    } catch {
      setRowErrors((prev) => ({ ...prev, [item._id]: 'Could not save changes. Please try again.' }));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const list = items ?? [];
  const liveCount = list.filter((item) => (rowStates[item._id] ?? toRowState(item)).enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your storefront"
        title="Catalog"
        description="Choose what to sell and what to charge. Changes apply to your store only."
        actions={
          <Badge tone="brand">
            {liveCount} of {list.length} live
          </Badge>
        }
      />

      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <EmptyState
            icon={PackageOpen}
            title="Nothing in your catalog yet"
            description="Products appear here once the platform publishes them to your store."
          />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Product</TH>
                <TH className="text-right">Base</TH>
                <TH>Selling</TH>
                <TH className="text-right">Your price</TH>
                <TH className="text-center">Live</TH>
                <TH className="text-center">Featured</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.map((item) => {
                const state = rowStates[item._id] ?? toRowState(item);
                const isGlobal = item.syncMode === 'global';
                return (
                  <TR key={item._id} className="align-top">
                    <TD className="py-4">
                      <div className="font-medium text-foreground">{item.product.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <span>{item.product.type.replace('_', ' ')}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.syncMode}</span>
                      </div>
                    </TD>

                    <TD className="py-4 text-right tabular-nums text-muted">
                      {item.product.basePrice}
                    </TD>

                    <TD className="py-4">
                      <Label htmlFor={`pricing-mode-${item._id}`} className="sr-only">
                        Pricing mode
                      </Label>
                      <Select
                        id={`pricing-mode-${item._id}`}
                        value={state.pricingMode}
                        onChange={(e) =>
                          updateRow(item._id, { pricingMode: e.target.value as RowState['pricingMode'] })
                        }
                        className="h-9 w-[9.5rem]"
                      >
                        <option value="default">Default price</option>
                        <option value="custom">Custom price</option>
                        <option value="discount">Discount %</option>
                      </Select>

                      {state.pricingMode === 'custom' && (
                        <div className="mt-2">
                          <Label htmlFor={`custom-price-${item._id}`} className="sr-only">
                            Custom price
                          </Label>
                          <Input
                            id={`custom-price-${item._id}`}
                            type="number"
                            placeholder="Amount"
                            value={state.customPrice}
                            onChange={(e) => updateRow(item._id, { customPrice: e.target.value })}
                            className="h-9 w-[9.5rem]"
                          />
                        </div>
                      )}

                      {state.pricingMode === 'discount' && (
                        <div className="mt-2">
                          <Label htmlFor={`discount-percent-${item._id}`} className="sr-only">
                            Discount percent
                          </Label>
                          <Input
                            id={`discount-percent-${item._id}`}
                            type="number"
                            placeholder="% off"
                            value={state.discountPercent}
                            onChange={(e) => updateRow(item._id, { discountPercent: e.target.value })}
                            className="h-9 w-[9.5rem]"
                          />
                        </div>
                      )}
                    </TD>

                    <TD className="py-4 text-right">
                      <span className="font-display text-base font-bold tabular-nums">
                        {effectivePrice(item.product.basePrice, state)}
                      </span>
                      <span className="ml-1 text-xs text-muted">{item.product.currency}</span>
                    </TD>

                    <TD className="py-4 text-center">
                      <input
                        type="checkbox"
                        aria-label="Enabled"
                        checked={state.enabled}
                        disabled={isGlobal}
                        onChange={(e) => updateRow(item._id, { enabled: e.target.checked })}
                        className="size-4 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {isGlobal && <p className="mt-1 text-[0.6875rem] text-muted">Always on</p>}
                    </TD>

                    <TD className="py-4 text-center">
                      <input
                        type="checkbox"
                        aria-label="Featured"
                        checked={state.isFeatured}
                        onChange={(e) => updateRow(item._id, { isFeatured: e.target.checked })}
                        className="size-4 cursor-pointer accent-[hsl(var(--accent))]"
                      />
                    </TD>

                    <TD className="py-4">
                      <Button size="sm" variant="outline" onClick={() => handleSave(item)}>
                        Save
                      </Button>
                      {rowErrors[item._id] && (
                        <p role="alert" className="mt-1.5 max-w-[11rem] text-xs font-medium text-destructive">
                          {rowErrors[item._id]}
                        </p>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
