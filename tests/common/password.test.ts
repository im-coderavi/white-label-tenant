import { hashPassword, comparePassword } from '../../src/common/password';

describe('password utils', () => {
  it('hashes and verifies a matching password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toEqual('correct-horse-battery-staple');
    await expect(comparePassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });
});
