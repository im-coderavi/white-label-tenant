import { useQuery } from '@tanstack/react-query';
import { getStoreSubdomain } from './tenant';
import { getStore, type PublicStore } from '../api/publicStore';

interface CurrentStore {
  /** The storefront this browser tab belongs to, or null on the platform's own domain. */
  subdomain: string | null;
  store: PublicStore | null;
  isLoading: boolean;
}

/**
 * Resolves which reseller storefront the visitor is on, from the host alone.
 * On the apex domain there is no store, which is how the platform owner signs in.
 */
export function useCurrentStore(): CurrentStore {
  const subdomain = getStoreSubdomain();

  const { data, isLoading } = useQuery({
    queryKey: ['public-store', subdomain],
    queryFn: () => getStore(subdomain as string),
    enabled: Boolean(subdomain),
    staleTime: Infinity,
    retry: false,
  });

  return { subdomain, store: data ?? null, isLoading: Boolean(subdomain) && isLoading };
}
