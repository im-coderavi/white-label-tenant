import { api } from '../lib/api';

export interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  basePrice: number;
  currency: string;
  status: 'draft' | 'published' | 'archived';
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  tenantId: string | null;
  currentVersion: string | null;
  thumbnailUrl: string | null;
}

export interface ProductVersion {
  _id: string;
  version: string;
  changelog: string;
  fileUrl: string | null;
  createdAt: string;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  search?: string;
}

export interface ListProductsResult {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}

export async function listProducts(params: ListProductsParams): Promise<ListProductsResult> {
  const res = await api.get<ListProductsResult>('/admin/products', { params });
  return res.data;
}

export async function getProduct(id: string): Promise<AdminProduct> {
  const res = await api.get<{ product: AdminProduct }>(`/admin/products/${id}`);
  return res.data.product;
}

function toProductFormData(input: object): FormData {
  const formData = new FormData();
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
      formData.append(key, value);
    } else {
      formData.append(key, String(value));
    }
  });
  return formData;
}

export interface CreateProductInput {
  name: string;
  type: string;
  description?: string;
  basePrice: number;
  currency?: string;
  thumbnail?: File;
}

export async function createProduct(input: CreateProductInput): Promise<AdminProduct> {
  const res = await api.post<{ product: AdminProduct }>('/admin/products', toProductFormData(input), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.product;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  thumbnail?: File;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<AdminProduct> {
  const res = await api.patch<{ product: AdminProduct }>(`/admin/products/${id}`, toProductFormData(input), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.product;
}

export async function archiveProduct(id: string): Promise<AdminProduct> {
  const res = await api.delete<{ product: AdminProduct }>(`/admin/products/${id}`);
  return res.data.product;
}

export async function publishProduct(id: string): Promise<AdminProduct> {
  const res = await api.post<{ product: AdminProduct }>(`/admin/products/${id}/publish`);
  return res.data.product;
}

export async function updateSyncMode(
  id: string,
  input: { syncMode: string; tenantId?: string }
): Promise<AdminProduct> {
  const res = await api.patch<{ product: AdminProduct }>(`/admin/products/${id}/sync-mode`, input);
  return res.data.product;
}

export async function listVersions(id: string): Promise<ProductVersion[]> {
  const res = await api.get<{ versions: ProductVersion[] }>(`/admin/products/${id}/versions`);
  return res.data.versions;
}

export interface AddVersionInput {
  version: string;
  changelog?: string;
  file?: File;
}

export async function addVersion(id: string, input: AddVersionInput): Promise<ProductVersion> {
  const res = await api.post<{ version: ProductVersion }>(
    `/admin/products/${id}/versions`,
    toProductFormData(input),
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.version;
}
