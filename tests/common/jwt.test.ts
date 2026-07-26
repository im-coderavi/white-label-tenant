import { signAccessToken, verifyAccessToken } from '../../src/common/jwt';

describe('jwt utils', () => {
  it('signs and verifies a valid access token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('customer');
    expect(payload.tenantId).toBe('tenant-1');
  });

  it('throws on an invalid token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });
});
