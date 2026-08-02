import { api } from '../lib/api';

export interface ResellerPlanRef {
  _id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'annual' | 'lifetime';
}

export interface ResellerSubscription {
  _id: string;
  status: string;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  licenseKey: string | null;
  plan: ResellerPlanRef | null;
}

export interface ResellerStats {
  catalogTotal: number;
  catalogLive: number;
  ordersTotal: number;
  ordersPaid: number;
  revenue: number;
  customers: number;
}

export interface ResellerOrder {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  product: { _id: string; name: string; type: string } | null;
  customerEmail: string | null;
}

export async function getSubscription(): Promise<ResellerSubscription | null> {
  const res = await api.get<{ subscription: ResellerSubscription | null }>('/reseller/subscription');
  return res.data.subscription;
}

export async function getResellerStats(): Promise<ResellerStats> {
  const res = await api.get<{ stats: ResellerStats }>('/reseller/stats');
  return res.data.stats;
}

export async function listResellerOrders(): Promise<ResellerOrder[]> {
  const res = await api.get<{ orders: ResellerOrder[] }>('/reseller/orders');
  return res.data.orders;
}
