import { api } from '../lib/api';

export interface StorefrontItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
}

export async function listStorefrontProducts(): Promise<StorefrontItem[]> {
  const res = await api.get<{ items: StorefrontItem[] }>('/customer/products');
  return res.data.items;
}
