import { api } from '../lib/api';

export interface ResellerLicense {
  _id: string;
  key: string;
  status: string;
  productId: { _id: string; name: string } | string | null;
  assignedUserId: string | null;
  activationLimit: number;
  activationsUsed: number;
  expiresAt: string | null;
  createdAt: string;
}

export async function listResellerLicenses(): Promise<ResellerLicense[]> {
  const res = await api.get<{ items: ResellerLicense[] }>('/reseller/licenses');
  return res.data.items;
}
