import { Types } from 'mongoose';
import { Product, ProductDocument } from '../../models/Product';
import { ProductVersion, ProductVersionDocument } from '../../models/ProductVersion';
import { Tenant, TenantDocument } from '../../models/Tenant';
import { ResellerProduct } from '../../models/ResellerProduct';
import { uploadBuffer } from '../../common/cloudinary';
import { NotFoundError, ConflictError } from '../../common/errors';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export interface ListProductsQuery {
  page: number;
  limit: number;
  type?: string;
  status?: string;
  search?: string;
}

export interface ListProductsResult {
  items: ProductDocument[];
  total: number;
  page: number;
  limit: number;
}

export async function listProducts(query: ListProductsQuery): Promise<ListProductsResult> {
  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .sort({ createdAt: -1 }),
    Product.countDocuments(filter),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function createProduct(
  input: { name: string; type: string; description?: string; basePrice: number; currency?: string },
  thumbnailFile?: Express.Multer.File
): Promise<ProductDocument> {
  const slug = await generateUniqueSlug(input.name);
  let thumbnailUrl: string | null = null;
  let thumbnailPublicId: string | null = null;
  if (thumbnailFile) {
    const uploaded = await uploadBuffer(thumbnailFile.buffer, 'toolzypro/product-thumbnails');
    thumbnailUrl = uploaded.secureUrl;
    thumbnailPublicId = uploaded.publicId;
  }
  return Product.create({
    name: input.name,
    slug,
    type: input.type,
    description: input.description ?? '',
    basePrice: input.basePrice,
    currency: input.currency ?? 'INR',
    thumbnailUrl,
    thumbnailPublicId,
  });
}

export async function getProductById(id: string): Promise<ProductDocument> {
  const product = await Product.findById(id);
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function updateProduct(
  id: string,
  input: { name?: string; description?: string; basePrice?: number; currency?: string },
  thumbnailFile?: Express.Multer.File
): Promise<ProductDocument> {
  const product = await getProductById(id);
  if (input.name !== undefined) product.name = input.name;
  if (input.description !== undefined) product.description = input.description;
  if (input.basePrice !== undefined) product.basePrice = input.basePrice;
  if (input.currency !== undefined) product.currency = input.currency;
  if (thumbnailFile) {
    const uploaded = await uploadBuffer(thumbnailFile.buffer, 'toolzypro/product-thumbnails');
    product.thumbnailUrl = uploaded.secureUrl;
    product.thumbnailPublicId = uploaded.publicId;
  }
  await product.save();
  return product;
}

export async function archiveProduct(id: string): Promise<ProductDocument> {
  const product = await getProductById(id);
  product.status = 'archived';
  await product.save();
  return product;
}

export async function publishProduct(id: string): Promise<ProductDocument> {
  const product = await getProductById(id);
  if (!product.currentVersion) {
    throw new ConflictError('Cannot publish a product with no version');
  }
  product.status = 'published';
  await product.save();
  return product;
}

export async function addVersion(
  productId: string,
  input: { version: string; changelog?: string },
  file?: Express.Multer.File
): Promise<ProductVersionDocument> {
  const product = await getProductById(productId);
  let fileUrl: string | null = null;
  let filePublicId: string | null = null;
  if (file) {
    const uploaded = await uploadBuffer(file.buffer, 'toolzypro/product-files');
    fileUrl = uploaded.secureUrl;
    filePublicId = uploaded.publicId;
  }
  const version = await ProductVersion.create({
    productId: product._id,
    version: input.version,
    changelog: input.changelog ?? '',
    fileUrl,
    filePublicId,
  });
  product.currentVersion = input.version;
  product.changelogJson = { version: input.version, changelog: input.changelog ?? '' };
  await product.save();
  return version;
}

export async function listVersions(productId: string): Promise<ProductVersionDocument[]> {
  await getProductById(productId);
  return ProductVersion.find({ productId }).sort({ createdAt: -1 });
}

export async function updateSyncMode(
  id: string,
  syncMode: ProductDocument['syncMode'],
  tenantId?: string
): Promise<ProductDocument> {
  const product = await getProductById(id);
  product.syncMode = syncMode;
  product.tenantId =
    (syncMode === 'private' || syncMode === 'exclusive') && tenantId ? new Types.ObjectId(tenantId) : null;
  await product.save();
  await syncProductToTenants(product);
  return product;
}

export async function syncProductToTenants(product: ProductDocument): Promise<void> {
  if (product.syncMode === 'global') {
    const tenants = await Tenant.find();
    await Promise.all(
      tenants.map((tenant) =>
        ResellerProduct.findOneAndUpdate(
          { tenantId: tenant._id, productId: product._id },
          { $set: { enabled: true }, $setOnInsert: { tenantId: tenant._id, productId: product._id } },
          { upsert: true, new: true }
        )
      )
    );
    return;
  }

  if (product.syncMode === 'private' || product.syncMode === 'exclusive') {
    if (!product.tenantId) return;
    const entitledTenantId = product.tenantId;
    await ResellerProduct.findOneAndUpdate(
      { tenantId: entitledTenantId, productId: product._id },
      { $set: { enabled: true }, $setOnInsert: { tenantId: entitledTenantId, productId: product._id } },
      { upsert: true, new: true }
    );
    await ResellerProduct.updateMany(
      { productId: product._id, tenantId: { $ne: entitledTenantId } },
      { $set: { enabled: false } }
    );
    return;
  }

  if (product.syncMode === 'optional') {
    const tenants = await Tenant.find();
    await Promise.all(
      tenants.map((tenant) =>
        ResellerProduct.findOneAndUpdate(
          { tenantId: tenant._id, productId: product._id },
          { $setOnInsert: { tenantId: tenant._id, productId: product._id, enabled: false } },
          { upsert: true, new: true }
        )
      )
    );
  }
}

export async function forceSync(id: string): Promise<ProductDocument> {
  const product = await getProductById(id);
  await syncProductToTenants(product);
  return product;
}

export async function listEntitledTenants(
  productId: string
): Promise<Array<{ _id: string; name: string; subdomain: string }>> {
  await getProductById(productId);
  const rows = await ResellerProduct.find({ productId, enabled: true }).populate<{
    tenantId: TenantDocument;
  }>('tenantId');
  return rows.map((row) => {
    const tenant = row.tenantId as unknown as TenantDocument;
    return { _id: tenant._id.toString(), name: tenant.name, subdomain: tenant.subdomain };
  });
}
