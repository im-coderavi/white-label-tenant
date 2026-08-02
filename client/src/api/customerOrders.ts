import { api } from '../lib/api';

export interface CheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';

export interface CustomerOrder {
  _id: string;
  productId: string;
  amount: number;
  currency: string;
  status: OrderStatus;
}

export interface ProductRef {
  _id: string;
  name: string;
  type: string;
}

export interface CustomerOrderView {
  _id: string;
  orderType: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  licenseId: string | null;
  createdAt: string;
  product: ProductRef | null;
}

export interface CustomerLicense {
  _id: string;
  key: string;
  status: string;
  activationLimit: number;
  activationsUsed: number;
  expiresAt: string | null;
  orderId: string | null;
  product: ProductRef | null;
}

export interface DownloadGrant {
  fileUrl: string;
  expiresAt: string;
}

export async function createCheckout(productId: string): Promise<CheckoutResult> {
  const res = await api.post<CheckoutResult>('/customer/checkout', { productId });
  return res.data;
}

export async function confirmPayment(orderId: string): Promise<CustomerOrder> {
  const res = await api.post<{ order: CustomerOrder }>(`/customer/orders/${orderId}/confirm-payment`);
  return res.data.order;
}

export async function listMyOrders(): Promise<CustomerOrderView[]> {
  const res = await api.get<{ orders: CustomerOrderView[] }>('/customer/orders');
  return res.data.orders;
}

export async function listMyLicenses(): Promise<CustomerLicense[]> {
  const res = await api.get<{ licenses: CustomerLicense[] }>('/customer/licenses');
  return res.data.licenses;
}

/** Consumes one activation. The caller refetches, since the response is the raw record. */
export async function activateLicense(licenseId: string): Promise<void> {
  await api.post(`/customer/licenses/${licenseId}/activate`);
}

/** Mints a short-lived download link for a paid order. */
export async function requestDownload(orderId: string): Promise<DownloadGrant> {
  const res = await api.get<DownloadGrant>(`/customer/downloads/${orderId}`);
  return res.data;
}
