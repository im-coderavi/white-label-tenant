import crypto from 'crypto';
import { Types } from 'mongoose';
import { AccessCode, AccessCodeDocument } from '../../models/AccessCode';
import { License } from '../../models/License';
import { Product, ProductDocument } from '../../models/Product';
import { ResellerCustomer, ResellerCustomerDocument } from '../../models/ResellerCustomer';
import { ResellerProduct } from '../../models/ResellerProduct';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';

export interface CustomerView {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string;
  status: string;
  accessCodes: number;
  createdAt: Date;
}

export interface AccessCodeView {
  _id: string;
  code: string;
  status: string;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  createdAt: Date;
  customer: { _id: string; name: string; email: string } | null;
  product: { _id: string; name: string; type: string } | null;
  licenseKey: string | null;
}

type PopulatedAccessCode = AccessCodeDocument & {
  customerId: ResellerCustomerDocument;
  productId: ProductDocument;
  licenseId: { key?: string } | null;
};

function codePrefix(): string {
  return `TZP-${new Date().getFullYear()}`;
}

async function generateUniqueAccessCode(): Promise<string> {
  let code = '';
  do {
    code = `${codePrefix()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    // eslint-disable-next-line no-await-in-loop
  } while (await AccessCode.exists({ code }));
  return code;
}

async function ensureProductAvailableToTenant(
  tenantId: string,
  productId: string
): Promise<ProductDocument> {
  const row = await ResellerProduct.findOne({
    tenantId,
    productId,
    enabled: true,
  }).populate<{ productId: ProductDocument }>('productId');

  if (!row || !row.productId || row.productId.status !== 'published') {
    throw new ForbiddenError('Product is not available in this reseller store');
  }

  return row.productId;
}

function toCustomerView(customer: ResellerCustomerDocument, accessCodes = 0): CustomerView {
  return {
    _id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
    status: customer.status,
    accessCodes,
    createdAt: customer.createdAt,
  };
}

function toAccessCodeView(code: PopulatedAccessCode): AccessCodeView {
  const customer = code.customerId;
  const product = code.productId;
  const license = code.licenseId;
  return {
    _id: code._id.toString(),
    code: code.code,
    status: code.status,
    expiresAt: code.expiresAt,
    redeemedAt: code.redeemedAt,
    createdAt: code.createdAt,
    customer: customer
      ? { _id: customer._id.toString(), name: customer.name, email: customer.email }
      : null,
    product: product ? { _id: product._id.toString(), name: product.name, type: product.type } : null,
    licenseKey: license?.key ?? null,
  };
}

export async function listCustomers(tenantId: string): Promise<CustomerView[]> {
  const customers = await ResellerCustomer.find({ tenantId }).sort({ createdAt: -1 });
  const counts = await AccessCode.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { tenantId: new Types.ObjectId(tenantId) } },
    { $group: { _id: '$customerId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [row._id.toString(), row.count]));
  return customers.map((customer) => toCustomerView(customer, countMap.get(customer._id.toString()) ?? 0));
}

export async function createCustomer(
  tenantId: string,
  input: { name: string; email: string; phone?: string; notes?: string }
): Promise<CustomerView> {
  try {
    const customer = await ResellerCustomer.create({
      tenantId,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      notes: input.notes ?? '',
    });
    return toCustomerView(customer);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new ConflictError('Customer email already exists in this reseller account');
    }
    throw err;
  }
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  input: { name?: string; email?: string; phone?: string | null; notes?: string; status?: 'active' | 'blocked' }
): Promise<CustomerView> {
  const customer = await ResellerCustomer.findOne({ _id: customerId, tenantId });
  if (!customer) throw new NotFoundError('Customer not found');

  if (input.name !== undefined) customer.name = input.name;
  if (input.email !== undefined) customer.email = input.email.toLowerCase();
  if (input.phone !== undefined) customer.phone = input.phone;
  if (input.notes !== undefined) customer.notes = input.notes;
  if (input.status !== undefined) customer.status = input.status;

  try {
    await customer.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new ConflictError('Customer email already exists in this reseller account');
    }
    throw err;
  }
  return toCustomerView(customer);
}

export async function createAccessCode(
  tenantId: string,
  customerId: string,
  input: { productId: string; expiresAt?: Date | null }
): Promise<AccessCodeView> {
  const customer = await ResellerCustomer.findOne({ _id: customerId, tenantId, status: 'active' });
  if (!customer) throw new NotFoundError('Customer not found');

  const product = await ensureProductAvailableToTenant(tenantId, input.productId);
  const license = await License.findOne({
    productId: product._id,
    tenantId: { $in: [null, new Types.ObjectId(tenantId)] },
    status: 'available',
  }).sort({ tenantId: -1, createdAt: 1 });

  if (!license) {
    throw new ConflictError('No available license key for this product');
  }

  const accessCode = await AccessCode.create({
    tenantId,
    customerId: customer._id,
    productId: product._id,
    licenseId: license._id,
    code: await generateUniqueAccessCode(),
    expiresAt: input.expiresAt ?? null,
  });

  license.tenantId = new Types.ObjectId(tenantId);
  license.status = 'reserved';
  await license.save();

  const populated = await AccessCode.findById(accessCode._id)
    .populate('customerId')
    .populate('productId')
    .populate('licenseId');

  if (!populated) throw new NotFoundError('Access code not found');
  return toAccessCodeView(populated as unknown as PopulatedAccessCode);
}

export async function listAccessCodes(tenantId: string): Promise<AccessCodeView[]> {
  const codes = await AccessCode.find({ tenantId })
    .sort({ createdAt: -1 })
    .populate('customerId')
    .populate('productId')
    .populate('licenseId');
  return codes.map((code) => toAccessCodeView(code as unknown as PopulatedAccessCode));
}

export async function revokeAccessCode(tenantId: string, id: string): Promise<AccessCodeView> {
  const accessCode = await AccessCode.findOne({ _id: id, tenantId });
  if (!accessCode) throw new NotFoundError('Access code not found');

  accessCode.status = 'revoked';
  await accessCode.save();

  if (accessCode.licenseId) {
    await License.findOneAndUpdate(
      { _id: accessCode.licenseId, status: 'reserved' },
      { status: 'available', tenantId: null }
    );
  }

  const populated = await AccessCode.findById(accessCode._id)
    .populate('customerId')
    .populate('productId')
    .populate('licenseId');
  if (!populated) throw new NotFoundError('Access code not found');
  return toAccessCodeView(populated as unknown as PopulatedAccessCode);
}
