import { api } from '../lib/api';

export interface MarketplaceItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  basePrice: number;
  currency: string;
  syncMode: string;
  unlocked: boolean;
  licenseRequired: boolean;
  categoryId: string | null;
}

export async function listMarketplace(categoryId?: string): Promise<MarketplaceItem[]> {
  const res = await api.get<{ items: MarketplaceItem[] }>('/reseller/marketplace', {
    params: categoryId ? { categoryId } : undefined,
  });
  return res.data.items;
}

export interface RedeemLicenseResult {
  productId: string;
  productName: string;
  unlocked: boolean;
}

export async function redeemLicenseKey(key: string): Promise<RedeemLicenseResult> {
  const res = await api.post<{ result: RedeemLicenseResult }>('/reseller/marketplace/redeem', { key });
  return res.data.result;
}

export interface MarketplaceCheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export async function createMarketplaceCheckout(productId: string): Promise<MarketplaceCheckoutResult> {
  const res = await api.post<MarketplaceCheckoutResult>('/reseller/marketplace/checkout', { productId });
  return res.data;
}

export async function confirmMarketplacePurchase(orderId: string): Promise<void> {
  await api.post(`/reseller/marketplace/orders/${orderId}/confirm-payment`);
}
