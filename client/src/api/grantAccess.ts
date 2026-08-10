import { api } from '../lib/api';

export interface GrantedAccessItem {
  _id: string;
  licenseKey: string;
  status: string;
  expiresAt: string | null;
  grantedAt: string;
  customer: { _id: string; name: string; email: string };
  product: { _id: string; name: string; type: string };
}

export async function listGrantedAccess(): Promise<GrantedAccessItem[]> {
  const res = await api.get<{ grants: GrantedAccessItem[] }>('/reseller/grant-access');
  return res.data.grants;
}

export async function grantProductAccess(input: {
  customerId: string;
  productId: string;
  expiresAt?: string | null;
}): Promise<GrantedAccessItem> {
  const res = await api.post<{ grant: GrantedAccessItem }>('/reseller/grant-access', input);
  return res.data.grant;
}
