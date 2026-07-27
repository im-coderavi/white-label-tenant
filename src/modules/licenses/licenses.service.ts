import { License, LicenseDocument } from '../../models/License';
import { generateLicenseKey } from '../../common/licenseKey';
import { ConflictError } from '../../common/errors';

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
