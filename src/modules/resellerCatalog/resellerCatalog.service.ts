import { ResellerProduct, ResellerProductDocument } from '../../models/ResellerProduct';
import { ProductDocument } from '../../models/Product';
import { NotFoundError, ValidationError } from '../../common/errors';

export interface CatalogItemView {
  _id: string;
  product: { _id: string; name: string; type: string; basePrice: number; currency: string };
  syncMode: 'global' | 'optional' | 'private' | 'exclusive';
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
}

interface PopulatedRow {
  _id: { toString(): string };
  enabled: boolean;
  customPrice: number | null;
  discountPercent: number | null;
  isFeatured: boolean;
  productId: ProductDocument;
}

function toView(row: PopulatedRow): CatalogItemView {
  const product = row.productId;
  return {
    _id: row._id.toString(),
    product: {
      _id: product._id.toString(),
      name: product.name,
      type: product.type,
      basePrice: product.basePrice,
      currency: product.currency,
    },
    syncMode: product.syncMode,
    enabled: row.enabled,
    customPrice: row.customPrice,
    discountPercent: row.discountPercent,
    isFeatured: row.isFeatured,
  };
}

export async function listCatalog(tenantId: string): Promise<CatalogItemView[]> {
  const rows = await ResellerProduct.find({ tenantId }).populate<{ productId: ProductDocument }>('productId');
  return rows
    .filter((row) => Boolean(row.productId) && row.productId.status === 'published')
    .map((row) => toView(row));
}

export async function updateCatalogItem(
  tenantId: string,
  resellerProductId: string,
  input: {
    enabled?: boolean;
    pricingMode?: 'default' | 'custom' | 'discount';
    customPrice?: number;
    discountPercent?: number;
    isFeatured?: boolean;
  }
): Promise<CatalogItemView> {
  const row = await ResellerProduct.findOne({ _id: resellerProductId, tenantId }).populate<{
    productId: ProductDocument;
  }>('productId');
  if (!row || !row.productId) {
    throw new NotFoundError('Catalog item not found');
  }

  if (input.enabled === false && row.productId.syncMode === 'global') {
    throw new ValidationError('Global products cannot be disabled');
  }

  if (input.enabled !== undefined) {
    row.enabled = input.enabled;
  }

  if (input.pricingMode === 'custom') {
    row.customPrice = input.customPrice as number;
    row.discountPercent = null;
  } else if (input.pricingMode === 'discount') {
    row.discountPercent = input.discountPercent as number;
    row.customPrice = null;
  } else if (input.pricingMode === 'default') {
    row.customPrice = null;
    row.discountPercent = null;
  }

  if (input.isFeatured !== undefined) {
    row.isFeatured = input.isFeatured;
  }

  await row.save();
  return toView(row);
}
