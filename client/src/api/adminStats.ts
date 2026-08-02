import { api } from '../lib/api';

export interface PlatformStats {
  tenantsTotal: number;
  tenantsActive: number;
  productsTotal: number;
  productsPublished: number;
  subscriptionsActive: number;
  ordersPaid: number;
  revenue: number;
  licensesIssued: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const res = await api.get<{ stats: PlatformStats }>('/admin/stats');
  return res.data.stats;
}
