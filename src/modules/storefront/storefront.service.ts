import { ResellerProduct } from '../../models/ResellerProduct';
import { ProductDocument } from '../../models/Product';
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
