import { ResellerProduct } from '../../models/ResellerProduct';
import { ProductDocument } from '../../models/Product';
import { ProductVersion } from '../../models/ProductVersion';
import { NotFoundError } from '../../common/errors';
import { computeEffectivePrice } from '../checkout/checkout.service';

export interface StorefrontItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
}

export async function listStorefront(tenantId: string): Promise<StorefrontItem[]> {
  const rows = await ResellerProduct.find({ tenantId, enabled: true }).populate<{
    productId: ProductDocument;
  }>('productId');

  return rows
    .filter((row) => Boolean(row.productId) && row.productId.status === 'published')
    .map((row) => {
      const product = row.productId;
      return {
        _id: product._id.toString(),
        name: product.name,
        description: product.description,
        type: product.type,
        thumbnailUrl: product.thumbnailUrl,
        price: computeEffectivePrice(product.basePrice, row),
        currency: product.currency,
        isFeatured: row.isFeatured,
      };
    });
}

export interface StorefrontDetail extends StorefrontItem {
  currentVersion: string | null;
  latestChangelog: string | null;
}

export async function getStorefrontProduct(
  tenantId: string,
  productId: string
): Promise<StorefrontDetail> {
  const row = await ResellerProduct.findOne({ tenantId, productId, enabled: true }).populate<{
    productId: ProductDocument;
  }>('productId');

  // A product the store does not sell is indistinguishable from one that does not exist.
  if (!row || !row.productId || row.productId.status !== 'published') {
    throw new NotFoundError('Product not found');
  }

  const product = row.productId;
  const latest = await ProductVersion.findOne({ productId: product._id }).sort({ createdAt: -1 });

  return {
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    type: product.type,
    thumbnailUrl: product.thumbnailUrl,
    price: computeEffectivePrice(product.basePrice, row),
    currency: product.currency,
    isFeatured: row.isFeatured,
    currentVersion: product.currentVersion,
    latestChangelog: latest ? latest.changelog : null,
  };
}
