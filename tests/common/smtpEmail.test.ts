const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { smtpEmailService } from '../../src/common/smtpEmail';
import { Tenant } from '../../src/models/Tenant';
import { encryptSecret } from '../../src/common/cryptoSecrets';

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
  sendMailMock.mockClear();
});

afterAll(async () => {
  await stopTestDb();
});

describe('smtpEmailService', () => {
  it('sends mail via the platform transport when no tenant is given', async () => {
    await smtpEmailService.sendEmail('user@example.com', 'verify-email', { token: 'abc123' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify your email address',
        html: expect.stringContaining('abc123'),
        text: expect.any(String),
      })
    );
  });

  it('renders a branded, tenant-specific email when the tenant has its own SMTP config', async () => {
    const tenant = await Tenant.create({
      name: 'Acme Store',
      subdomain: 'acme-smtp',
      brandingJson: { logoUrl: 'https://acme.example.com/logo.png', themeColor: '#123456' },
      smtpConfigJson: {
        host: 'smtp.acme.example.com',
        port: 587,
        user: 'acme-user',
        passwordEncrypted: encryptSecret('acme-password'),
        fromEmail: 'orders@acme.example.com',
      },
    });

    await smtpEmailService.sendEmail(
      'buyer@example.com',
      'order-paid',
      { orderId: 'ORD-1' },
      tenant._id.toString()
    );

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Acme Store <orders@acme.example.com>',
        to: 'buyer@example.com',
        subject: 'Your order is confirmed',
        html: expect.stringContaining('ORD-1'),
      })
    );
  });

  it('falls back to the platform transport when the tenant has no SMTP config set', async () => {
    const tenant = await Tenant.create({ name: 'NoSmtp Co', subdomain: 'no-smtp' });

    await smtpEmailService.sendEmail('buyer2@example.com', 'order-paid', { orderId: 'ORD-2' }, tenant._id.toString());

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer2@example.com', subject: 'Your order is confirmed' })
    );
  });
});
