import { api } from '../lib/api';

export interface PublicStore {
  name: string;
  subdomain: string;
  status: string;
}

export async function getStore(subdomain: string): Promise<PublicStore | null> {
  const res = await api.get<{ store: PublicStore | null }>('/public/store', { params: { subdomain } });
  return res.data.store;
}
