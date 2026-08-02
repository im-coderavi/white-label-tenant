import { License, LicenseDocument } from '../../models/License';
import { ProductDocument } from '../../models/Product';
import { generateLicenseKey } from '../../common/licenseKey';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../common/errors';
import { User } from '../../models/User';

async function generateUniqueLicenseKey(): Promise<string> {
  let key = generateLicenseKey();
  // eslint-disable-next-line no-await-in-loop
  while (await License.exists({ key })) {
    key = generateLicenseKey();
  }
  return key;
}

export interface ListLicensesQuery {
  page: number;
  limit: number;
  productId?: string;
  tenantId?: string;
  status?: string;
}

export interface ListLicensesResult {
  items: LicenseDocument[];
  total: number;
  page: number;
  limit: number;
}

export async function listLicenses(query: ListLicensesQuery): Promise<ListLicensesResult> {
  const filter: Record<string, unknown> = {};
  if (query.productId) filter.productId = query.productId;
  if (query.tenantId) filter.tenantId = query.tenantId;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    License.find(filter)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .sort({ createdAt: -1 }),
    License.countDocuments(filter),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function generateLicenses(input: {
  productId: string;
  quantity: number;
  expiresAt?: string;
}): Promise<LicenseDocument[]> {
  const licenses: LicenseDocument[] = [];
  for (let i = 0; i < input.quantity; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const key = await generateUniqueLicenseKey();
    // eslint-disable-next-line no-await-in-loop
    const license = await License.create({
      productId: input.productId,
      key,
      status: 'available',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    licenses.push(license);
  }
  return licenses;
}

export async function importLicenses(input: {
  productId: string;
  keys: string[];
}): Promise<LicenseDocument[]> {
  const existing = await License.findOne({ key: { $in: input.keys } });
  if (existing) {
    throw new ConflictError('One or more license keys already exist');
  }
  const docs = await License.insertMany(
    input.keys.map((key) => ({ productId: input.productId, key, status: 'available' }))
  );
  return docs as unknown as LicenseDocument[];
}

export async function getLicenseById(id: string): Promise<LicenseDocument> {
  const license = await License.findById(id);
  if (!license) throw new NotFoundError('License not found');
  return license;
}

export async function revokeLicense(id: string): Promise<LicenseDocument> {
  const license = await getLicenseById(id);
  license.status = 'revoked';
  await license.save();
  return license;
}

export async function assignLicense(licenseId: string, userId: string): Promise<LicenseDocument> {
  const license = await getLicenseById(licenseId);
  if (license.status !== 'available') {
    throw new ConflictError('License is not available for assignment');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  license.assignedUserId = user._id;
  license.tenantId = user.tenantId;
  license.status = 'assigned';
  await license.save();
  return license;
}

export interface CustomerLicenseView {
  _id: string;
  key: string;
  status: string;
  activationLimit: number;
  activationsUsed: number;
  expiresAt: Date | null;
  orderId: string | null;
  product: { _id: string; name: string; type: string } | null;
}

/** The customer view carries the product, so the UI never has to resolve ids itself. */
export async function listLicensesForUser(userId: string): Promise<CustomerLicenseView[]> {
  const licenses = await License.find({ assignedUserId: userId })
    .sort({ createdAt: -1 })
    .populate<{ productId: ProductDocument }>('productId');

  return licenses.map((license) => ({
    _id: license._id.toString(),
    key: license.key,
    status: license.status,
    activationLimit: license.activationLimit,
    activationsUsed: license.activationsUsed,
    expiresAt: license.expiresAt,
    orderId: license.orderId ? license.orderId.toString() : null,
    product: license.productId
      ? {
          _id: license.productId._id.toString(),
          name: license.productId.name,
          type: license.productId.type,
        }
      : null,
  }));
}

export async function activateLicense(id: string, userId: string): Promise<LicenseDocument> {
  const license = await getLicenseById(id);
  if (!license.assignedUserId || license.assignedUserId.toString() !== userId) {
    throw new UnauthorizedError('This license is not assigned to you');
  }
  if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
    license.status = 'expired';
    await license.save();
    throw new UnauthorizedError('License has expired');
  }
  if (license.activationsUsed >= license.activationLimit) {
    throw new ConflictError('Activation limit reached');
  }
  license.activationsUsed += 1;
  license.status = 'activated';
  await license.save();
  return license;
}
