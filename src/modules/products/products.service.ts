import { Product, ProductDocument } from '../../models/Product';
import { uploadBuffer } from '../../common/cloudinary';

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
