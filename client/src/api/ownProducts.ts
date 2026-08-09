import { api } from '../lib/api';

export interface OwnProduct {
  _id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  shortDescription: string;
  description: string;
  price: number;
  currency: string;
  thumbnailUrl: string | null;
  fileUrl: string | null;
  status: 'draft' | 'published';
  isFeatured: boolean;
  createdAt: string;
}

export async function listOwnProducts(): Promise<OwnProduct[]> {
  const res = await api.get<{ products: OwnProduct[] }>('/reseller/own-products');
  return res.data.products;
}

export interface CreateOwnProductInput {
  name: string;
  price: number;
  shortDescription?: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
}

export async function createOwnProduct(input: CreateOwnProductInput): Promise<OwnProduct> {
  const res = await api.post<{ product: OwnProduct }>('/reseller/own-products', input);
  return res.data.product;
}

export interface UpdateOwnProductInput {
  name?: string;
  price?: number;
  shortDescription?: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  isFeatured?: boolean;
  status?: 'draft' | 'published';
}

export async function updateOwnProduct(id: string, input: UpdateOwnProductInput): Promise<OwnProduct> {
  const res = await api.patch<{ product: OwnProduct }>(`/reseller/own-products/${id}`, input);
  return res.data.product;
}

export async function deleteOwnProduct(id: string): Promise<void> {
  await api.delete(`/reseller/own-products/${id}`);
}
