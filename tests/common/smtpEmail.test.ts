const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

import { smtpEmailService } from '../../src/common/smtpEmail';

describe('smtpEmailService', () => {
  it('sends mail with the expected recipient and content', async () => {
    await smtpEmailService.sendEmail('user@example.com', 'verify-email', { token: 'abc123' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('verify-email'),
      })
    );
  });
});
