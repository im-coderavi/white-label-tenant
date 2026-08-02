import { describe, it, expect } from 'vitest';
import { getStoreSubdomain } from './tenant';

describe('getStoreSubdomain', () => {
  it('reads the store from a production subdomain', () => {
    expect(getStoreSubdomain('nova.toolzypro.com')).toBe('nova');
  });

  it('reads the store from a local subdomain', () => {
    expect(getStoreSubdomain('nova.localhost')).toBe('nova');
  });

  it('returns null on the apex domain, where the platform owner signs in', () => {
    expect(getStoreSubdomain('toolzypro.com')).toBeNull();
    expect(getStoreSubdomain('localhost')).toBeNull();
  });

  it('ignores reserved hosts that are not stores', () => {
    expect(getStoreSubdomain('www.toolzypro.com')).toBeNull();
    expect(getStoreSubdomain('api.toolzypro.com')).toBeNull();
    expect(getStoreSubdomain('app.toolzypro.com')).toBeNull();
  });

  it('returns null for bare IP addresses', () => {
    expect(getStoreSubdomain('127.0.0.1')).toBeNull();
    expect(getStoreSubdomain('192.168.1.14')).toBeNull();
  });

  it('is case-insensitive and ignores a port', () => {
    expect(getStoreSubdomain('NOVA.localhost:5173')).toBe('nova');
  });

  it('handles deeper hosts by taking the leftmost label', () => {
    expect(getStoreSubdomain('nova.stores.toolzypro.com')).toBe('nova');
  });
});
