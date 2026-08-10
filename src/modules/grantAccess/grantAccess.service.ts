import { Types } from 'mongoose';
import { License, LicenseDocument } from '../../models/License';
import { Product, ProductDocument } from '../../models/Product';
import { ResellerCustomer, ResellerCustomerDocument } from '../../models/ResellerCustomer';
import { ResellerProduct } from '../../models/ResellerProduct';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { smtpEmailService } from '../../common/smtpEmail';
import { logger } from '../../common/logger';

export interface GrantAccessResult {
  _id: string;
  licenseKey: string;
  status: string;
  expiresAt: Date | null;
  customer: { _id: string; name: string; email: string };
  product: { _id: string; name: string; type: string };
}

async function ensureProductAvailableToTenant(tenantId: string, productId: string): Promise<ProductDocument> {
  const row = await ResellerProduct.findOne({ tenantId, productId, enabled: true }).populate<{
    productId: ProductDocument;
  }>('productId');
  if (!row || !row.productId || row.productId.status !== 'published') {
    throw new ForbiddenError('Product is not available in this reseller store');
  }
  return row.productId;
}

function toResult(
  license: LicenseDocument,
  customer: ResellerCustomerDocument,
  product: ProductDocument
): GrantAccessResult {
  return {
    _id: license._id.toString(),
    licenseKey: license.key,
    status: license.status,
    expiresAt: license.expiresAt,
    customer: { _id: customer._id.toString(), name: customer.name, email: customer.email },
    product: { _id: product._id.toString(), name: product.name, type: product.type },
  };
}

/**
 * Manually grants a specific end user access to a single product without going through
 * checkout/payment — mirrors the competitor's "Grant Product Access" tool. Reuses the same
 * license-reservation approach as access codes (src/modules/resellerCustomers/resellerCustomers.service.ts
 * createAccessCode), but skips the redeem step: the license is assigned immediately and its key
 * is emailed straight to the customer.
 */
export async function grantProductAccess(
  tenantId: string,
  input: { customerId: string; productId: string; expiresAt?: string | null }
): Promise<GrantAccessResult> {
  const customer = await ResellerCustomer.findOne({ _id: input.customerId, tenantId, status: 'active' });
  if (!customer) throw new NotFoundError('Customer not found');

  const product = await ensureProductAvailableToTenant(tenantId, input.productId);

  // Prefer a license already reserved for this tenant (e.g. from access-code quota) before
  // reaching into the shared master pool, same ordering as createAccessCode.
  const license = await License.findOne({
    productId: product._id,
    tenantId: { $in: [null, new Types.ObjectId(tenantId)] },
    status: 'available',
  }).sort({ tenantId: -1, createdAt: 1 });

  if (!license) {
    throw new ConflictError('No available license key for this product');
  }

  license.tenantId = new Types.ObjectId(tenantId);
  license.status = 'assigned';
  license.grantedCustomerId = customer._id;
  license.expiresAt = input.expiresAt ? new Date(input.expiresAt) : license.expiresAt;
  await license.save();

  try {
    await smtpEmailService.sendEmail(
      customer.email,
      'grant-access',
      { productName: product.name, licenseKey: license.key },
      tenantId
    );
  } catch (err) {
    logger.error('Failed to send grant-access notification email', {
      customerId: customer._id.toString(),
      error: err instanceof Error ? err.stack : err,
    });
  }

  return toResult(license, customer, product);
}

export interface GrantedAccessView extends GrantAccessResult {
  grantedAt: Date;
}

export async function listGrantedAccess(tenantId: string): Promise<GrantedAccessView[]> {
  const licenses = await License.find({ tenantId, grantedCustomerId: { $ne: null } })
    .sort({ updatedAt: -1 })
    .populate<{ productId: ProductDocument }>('productId')
    .populate<{ grantedCustomerId: ResellerCustomerDocument }>('grantedCustomerId');

  return licenses.map((license) => {
    const customer = license.grantedCustomerId as unknown as ResellerCustomerDocument;
    const product = license.productId as unknown as ProductDocument;
    return {
      _id: license._id.toString(),
      licenseKey: license.key,
      status: license.status,
      expiresAt: license.expiresAt,
      grantedAt: license.updatedAt,
      customer: customer
        ? { _id: customer._id.toString(), name: customer.name, email: customer.email }
        : { _id: '', name: 'Unknown customer', email: '' },
      product: product
        ? { _id: product._id.toString(), name: product.name, type: product.type }
        : { _id: '', name: 'Unknown product', type: '' },
    };
  });
}
