import { generateOpaqueToken, hashToken } from '../../src/common/token';

describe('token utils', () => {
  it('generates unique opaque tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(64);
  });

  it('hashes deterministically', () => {
    const raw = generateOpaqueToken();
    expect(hashToken(raw)).toEqual(hashToken(raw));
    expect(hashToken(raw)).not.toEqual(raw);
  });
});
