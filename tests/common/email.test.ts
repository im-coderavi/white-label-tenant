import { consoleEmailService } from '../../src/common/email';

describe('consoleEmailService', () => {
  it('logs the send and resolves', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(
      consoleEmailService.sendEmail('user@example.com', 'reset-password', { token: 'abc' })
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
