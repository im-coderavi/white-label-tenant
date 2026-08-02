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

export interface StorefrontDetail extends StorefrontItem {
  currentVersion: string | null;
  latestChangelog: string | null;
}

export async function listStorefrontProducts(): Promise<StorefrontItem[]> {
  const res = await api.get<{ items: StorefrontItem[] }>('/customer/products');
  return res.data.items;
}

export async function getStorefrontProduct(productId: string): Promise<StorefrontDetail> {
  const res = await api.get<{ product: StorefrontDetail }>(`/customer/products/${productId}`);
  return res.data.product;
}
