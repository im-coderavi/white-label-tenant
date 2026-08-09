import { Tenant, TenantDocument } from '../models/Tenant';

/** Strips port and leading "www." so both "shop.example.com:5173" and "www.shop.example.com" resolve consistently. */
export function normalizeHostname(hostOrDomain: string): string {
  const withoutPort = hostOrDomain.split(':')[0].toLowerCase().trim();
  return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
}

/**
 * Resolves a tenant by custom domain first (exact match), then by subdomain
 * (either the full host equals "<subdomain>.<platformDomain>" or the raw value is just the subdomain label).
 * Returns null if nothing matches — callers decide whether to fall back.
 */
export async function resolveTenantByHost(hostOrDomain: string): Promise<TenantDocument | null> {
  const host = normalizeHostname(hostOrDomain);
  if (!host) return null;

  const byCustomDomain = await Tenant.findOne({ customDomain: host });
  if (byCustomDomain) return byCustomDomain;

  const subdomainLabel = host.split('.')[0];
  const bySubdomain = await Tenant.findOne({ subdomain: subdomainLabel });
  return bySubdomain;
}
