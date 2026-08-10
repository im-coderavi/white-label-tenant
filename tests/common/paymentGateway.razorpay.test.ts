const mockOrdersCreate = jest.fn();
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate },
  }));
});

import crypto from 'crypto';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { createRazorpayGateway, getGatewayForTenant, encryptGatewayCredentials } from '../../src/common/paymentGateway';
import { encryptSecret } from '../../src/common/cryptoSecrets';
import { Tenant } from '../../src/models/Tenant';

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
  mockOrdersCreate.mockReset();
});

afterAll(async () => {
  await stopTestDb();
});

describe('createRazorpayGateway', () => {
  it('creates an order in paise via the Razorpay SDK', async () => {
    mockOrdersCreate.mockResolvedValue({ id: 'order_rzp_123' });
    const gateway = createRazorpayGateway('rzp_test_key', 'rzp_test_secret');

    const result = await gateway.createOrder({ amount: 499.5, currency: 'INR', receipt: 'order-1' });

    expect(result.gatewayOrderId).toBe('order_rzp_123');
    expect(mockOrdersCreate).toHaveBeenCalledWith({ amount: 49950, currency: 'INR', receipt: 'order-1' });
  });

  it('verifies a valid Razorpay webhook signature and reports success on captured payment', () => {
    const gateway = createRazorpayGateway('rzp_test_key', 'rzp_test_secret');
    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_rzp_123', status: 'captured' } } },
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', 'rzp_test_secret').update(rawBody).digest('hex');

    const result = gateway.verifyAndParseWebhook(rawBody, signature);

    expect(result).toEqual({ gatewayOrderId: 'order_rzp_123', success: true });
  });

  it('rejects an invalid Razorpay webhook signature', () => {
    const gateway = createRazorpayGateway('rzp_test_key', 'rzp_test_secret');
    const rawBody = JSON.stringify({
      payload: { payment: { entity: { order_id: 'order_rzp_123', status: 'captured' } } },
    });

    const result = gateway.verifyAndParseWebhook(rawBody, 'deadbeef'.repeat(8));

    expect(result).toBeNull();
  });
});

describe('getGatewayForTenant', () => {
  it('returns the mock gateway when the tenant has no configured provider', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-gw-1' });
    const gateway = await getGatewayForTenant(tenant._id.toString());
    expect(gateway.provider).toBe('mock');
  });

  it('returns a Razorpay gateway built from the tenant’s decrypted credentials', async () => {
    const tenant = await Tenant.create({
      name: 'Acme',
      subdomain: 'acme-gw-2',
      paymentGatewayJson: {
        provider: 'razorpay',
        keyId: 'rzp_test_tenant_key',
        keySecretEncrypted: encryptSecret('tenant-secret-value'),
      },
    });

    mockOrdersCreate.mockResolvedValue({ id: 'order_rzp_tenant' });
    const gateway = await getGatewayForTenant(tenant._id.toString());
    expect(gateway.provider).toBe('razorpay');

    const rawBody = JSON.stringify({
      payload: { payment: { entity: { order_id: 'order_rzp_tenant', status: 'captured' } } },
    });
    const signature = crypto.createHmac('sha256', 'tenant-secret-value').update(rawBody).digest('hex');
    expect(gateway.verifyAndParseWebhook(rawBody, signature)).toEqual({
      gatewayOrderId: 'order_rzp_tenant',
      success: true,
    });
  });

  it('falls back to mock when tenant credentials look encrypted but fail to decrypt', async () => {
    const tenant = await Tenant.create({
      name: 'Acme',
      subdomain: 'acme-gw-3',
      paymentGatewayJson: {
        provider: 'razorpay',
        keyId: 'rzp_test_tenant_key',
        // Three dot-separated parts so isEncryptedSecret() treats it as our AES-GCM format,
        // but the payload itself is garbage — decryptSecret() must throw on it.
        keySecretEncrypted: 'bm90.bm90.bm90',
      },
    });

    const gateway = await getGatewayForTenant(tenant._id.toString());
    expect(gateway.provider).toBe('mock');
  });
});

describe('encryptGatewayCredentials', () => {
  it('encrypts the key secret and leaves the key id plaintext', () => {
    const result = encryptGatewayCredentials({
      provider: 'razorpay',
      keyId: 'rzp_test_key',
      keySecret: 'super-secret-value',
    });
    expect(result.keyId).toBe('rzp_test_key');
    expect(result.keySecretEncrypted).not.toBe('super-secret-value');
    expect(result.keySecretEncrypted!.split('.')).toHaveLength(3);
  });
});
