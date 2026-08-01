import { api } from '../lib/api';

export interface AdminTenant {
  _id: string;
  name: string;
  subdomain: string;
  status: string;
}

export async function listTenants(): Promise<AdminTenant[]> {
  const res = await api.get<{ tenants: AdminTenant[] }>('/tenants');
  return res.data.tenants;
}
