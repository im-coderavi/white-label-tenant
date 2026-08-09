import { api } from '../lib/api';

export interface ResellerCustomer {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string;
  status: string;
  accessCodes: number;
  createdAt: string;
}

export interface AccessCode {
  _id: string;
  code: string;
  status: string;
  expiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
  customer: { _id: string; name: string; email: string } | null;
  product: { _id: string; name: string; type: string } | null;
  licenseKey: string | null;
}

export async function listCustomers(): Promise<ResellerCustomer[]> {
  const res = await api.get<{ customers: ResellerCustomer[] }>('/reseller/customers');
  return res.data.customers;
}

export async function createCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}): Promise<ResellerCustomer> {
  const res = await api.post<{ customer: ResellerCustomer }>('/reseller/customers', input);
  return res.data.customer;
}

export async function createAccessCode(customerId: string, productId: string): Promise<AccessCode> {
  const res = await api.post<{ accessCode: AccessCode }>(
    `/reseller/customers/${customerId}/access-codes`,
    { productId }
  );
  return res.data.accessCode;
}

export async function listAccessCodes(): Promise<AccessCode[]> {
  const res = await api.get<{ accessCodes: AccessCode[] }>('/reseller/access-codes');
  return res.data.accessCodes;
}

export async function revokeAccessCode(id: string): Promise<AccessCode> {
  const res = await api.patch<{ accessCode: AccessCode }>(`/reseller/access-codes/${id}/revoke`);
  return res.data.accessCode;
}
