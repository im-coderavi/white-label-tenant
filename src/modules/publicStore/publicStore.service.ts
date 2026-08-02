import { Tenant } from '../../models/Tenant';

export interface PublicStore {
  name: string;
  subdomain: string;
  status: string;
}

/**
 * Resolves a storefront subdomain to the identity a visitor may see before signing in.
 * Deliberately narrow: a subdomain is public, but nothing else about the tenant is.
 */
export async function findStoreBySubdomain(subdomain?: string): Promise<PublicStore | null> {
  if (!subdomain) return null;

  const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
  if (!tenant) return null;

  return { name: tenant.name, subdomain: tenant.subdomain, status: tenant.status };
}
