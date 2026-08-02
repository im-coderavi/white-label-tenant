import { api } from '../lib/api';

export interface CheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export interface CustomerOrder {
  _id: string;
  productId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';
}

export async function createCheckout(productId: string): Promise<CheckoutResult> {
  const res = await api.post<CheckoutResult>('/customer/checkout', { productId });
  return res.data;
}

export async function confirmPayment(orderId: string): Promise<CustomerOrder> {
  const res = await api.post<{ order: CustomerOrder }>(`/customer/orders/${orderId}/confirm-payment`);
  return res.data.order;
}

export interface CustomerLicense {
  _id: string;
  key: string;
  productId: string;
  orderId: string | null;
  status: string;
  activationLimit: number;
  activationsUsed: number;
}

export async function listMyLicenses(): Promise<CustomerLicense[]> {
  const res = await api.get<{ licenses: CustomerLicense[] }>('/customer/licenses');
  return res.data.licenses;
}
