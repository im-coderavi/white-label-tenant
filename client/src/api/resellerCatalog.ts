import { api } from '../lib/api';

export interface ResellerCatalogItem {
  _id: string;
  product: { _id: string; name: string; type: string; basePrice: number; currency: string };
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
}

export interface UpdateCatalogItemInput {
  enabled?: boolean;
  pricingMode?: 'default' | 'custom' | 'discount';
  customPrice?: number;
  discountPercent?: number;
  isFeatured?: boolean;
}

export async function listCatalog(): Promise<ResellerCatalogItem[]> {
  const res = await api.get<{ items: ResellerCatalogItem[] }>('/reseller/products');
  return res.data.items;
}

export async function updateCatalogItem(
  id: string,
  input: UpdateCatalogItemInput
): Promise<ResellerCatalogItem> {
  const res = await api.patch<{ item: ResellerCatalogItem }>(`/reseller/products/${id}`, input);
  return res.data.item;
}
