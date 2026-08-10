import { Types } from 'mongoose';
import { OwnProduct, OwnProductDocument } from '../../models/OwnProduct';
import { ConflictError, NotFoundError } from '../../common/errors';
import { getResellerEntitlements } from '../../common/planEntitlements';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function generateUniqueSlug(tenantId: string, name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await OwnProduct.exists({ tenantId, slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function listOwnProducts(tenantId: string): Promise<OwnProductDocument[]> {
  return OwnProduct.find({ tenantId }).sort({ createdAt: -1 });
}

export async function createOwnProduct(
  tenantId: string,
  input: {
    name: string;
    categoryId?: string | null;
    shortDescription?: string;
    description?: string;
    price: number;
    currency?: string;
    thumbnailUrl?: string | null;
    fileUrl?: string | null;
  }
): Promise<OwnProductDocument> {
  const entitlements = await getResellerEntitlements(tenantId);
  if (!entitlements.canAddOwnProducts) {
    throw new ConflictError('Your plan does not allow adding your own products. Upgrade to Premium or Agency.');
  }
  if (entitlements.maxOwnProducts !== undefined) {
    const currentCount = await OwnProduct.countDocuments({ tenantId });
    if (currentCount >= entitlements.maxOwnProducts) {
      throw new ConflictError(
        `Your plan allows up to ${entitlements.maxOwnProducts} own products. Upgrade to add more.`
      );
    }
  }

  const slug = await generateUniqueSlug(tenantId, input.name);
  return OwnProduct.create({
    tenantId,
    name: input.name,
    slug,
    categoryId: input.categoryId ?? null,
    shortDescription: input.shortDescription ?? '',
    description: input.description ?? '',
    price: input.price,
    currency: input.currency ?? 'INR',
    thumbnailUrl: input.thumbnailUrl ?? null,
    fileUrl: input.fileUrl ?? null,
    status: 'draft',
  });
}

async function getOwnProductForTenant(tenantId: string, id: string): Promise<OwnProductDocument> {
  const product = await OwnProduct.findOne({ _id: id, tenantId });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function updateOwnProduct(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    categoryId?: string | null;
    shortDescription?: string;
    description?: string;
    price?: number;
    currency?: string;
    thumbnailUrl?: string | null;
    fileUrl?: string | null;
    isFeatured?: boolean;
    status?: 'draft' | 'published';
  }
): Promise<OwnProductDocument> {
  const product = await getOwnProductForTenant(tenantId, id);

  if (input.name !== undefined) product.name = input.name;
  if (input.categoryId !== undefined) {
    product.categoryId = input.categoryId ? new Types.ObjectId(input.categoryId) : null;
  }
  if (input.shortDescription !== undefined) product.shortDescription = input.shortDescription;
  if (input.description !== undefined) product.description = input.description;
  if (input.price !== undefined) product.price = input.price;
  if (input.currency !== undefined) product.currency = input.currency;
  if (input.thumbnailUrl !== undefined) product.thumbnailUrl = input.thumbnailUrl;
  if (input.fileUrl !== undefined) product.fileUrl = input.fileUrl;
  if (input.isFeatured !== undefined) product.isFeatured = input.isFeatured;
  if (input.status !== undefined) product.status = input.status;

  await product.save();
  return product;
}

export async function deleteOwnProduct(tenantId: string, id: string): Promise<void> {
  const result = await OwnProduct.deleteOne({ _id: id, tenantId });
  if (result.deletedCount === 0) throw new NotFoundError('Product not found');
}
