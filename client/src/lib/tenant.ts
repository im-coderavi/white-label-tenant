/** Hosts that belong to the platform itself, never to a reseller store. */
const RESERVED_LABELS = new Set(['www', 'api', 'app', 'admin', 'static', 'cdn']);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Reads the storefront subdomain out of the host.
 *
 * `nova.toolzypro.com` and `nova.localhost` both resolve to `nova`; the apex domain
 * resolves to null, which is how the platform owner's own login is distinguished from
 * a reseller store's.
 */
export function getStoreSubdomain(hostname?: string): string | null {
  const raw = hostname ?? (typeof window === 'undefined' ? '' : window.location.hostname);
  const host = raw.split(':')[0].trim().toLowerCase();

  if (!host || host === 'localhost' || IPV4.test(host)) return null;

  const parts = host.split('.');
  // A local host needs one label in front of `localhost`; a real domain needs one in
  // front of `domain.tld`.
  const minimumParts = parts[parts.length - 1] === 'localhost' ? 2 : 3;
  if (parts.length < minimumParts) return null;

  const label = parts[0];
  if (!label || RESERVED_LABELS.has(label)) return null;

  return label;
}
