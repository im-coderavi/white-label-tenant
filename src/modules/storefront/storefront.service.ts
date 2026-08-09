import { ResellerProduct } from '../../models/ResellerProduct';
import { ProductDocument } from '../../models/Product';
import { ProductVersion } from '../../models/ProductVersion';
import { AccessCode, AccessCodeDocument } from '../../models/AccessCode';
import { License } from '../../models/License';
import { Tenant } from '../../models/Tenant';
import { OwnProduct } from '../../models/OwnProduct';
import { NotFoundError, ConflictError } from '../../common/errors';
import { computeEffectivePrice } from '../checkout/checkout.service';
import { resolveTenantByHost } from '../../common/tenantResolver';

export interface StorefrontItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;
  currency: string;
  isFeatured: boolean;
  /** "master" = platform catalog product (checkout-ready); "own" = reseller's own listing (display only for now, no checkout yet). */
  source: 'master' | 'own';
}

export async function listStorefront(tenantId: string): Promise<StorefrontItem[]> {
  const rows = await ResellerProduct.find({ tenantId, enabled: true }).populate<{
    productId: ProductDocument;
  }>('productId');

  const masterItems: StorefrontItem[] = rows
    .filter((row) => Boolean(row.productId) && row.productId.status === 'published')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => {
      const product = row.productId;
      const overrides = row.overrides ?? {};
      return {
        _id: product._id.toString(),
        name: overrides.displayName ?? product.name,
        description: overrides.description ?? product.description,
        type: product.type,
        thumbnailUrl: overrides.thumbnailUrl ?? product.thumbnailUrl,
        price: computeEffectivePrice(product.basePrice, row),
        currency: product.currency,
        isFeatured: row.isFeatured,
        source: 'master' as const,
      };
    });

  const ownProducts = await OwnProduct.find({ tenantId, status: 'published' }).sort({ createdAt: -1 });
  const ownItems: StorefrontItem[] = ownProducts.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    type: 'own_product',
    thumbnailUrl: product.thumbnailUrl,
    price: product.price,
    currency: product.currency,
    isFeatured: product.isFeatured,
    source: 'own' as const,
  }));

  return [...masterItems, ...ownItems];
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

  if (!row || !row.productId || row.productId.status !== 'published') {
    throw new NotFoundError('Product not found');
  }

  const product = row.productId;
  const overrides = row.overrides ?? {};
  const latest = await ProductVersion.findOne({ productId: product._id }).sort({ createdAt: -1 });

  return {
    _id: product._id.toString(),
    name: overrides.displayName ?? product.name,
    description: overrides.description ?? product.description,
    type: product.type,
    thumbnailUrl: overrides.thumbnailUrl ?? product.thumbnailUrl,
    price: computeEffectivePrice(product.basePrice, row),
    currency: product.currency,
    isFeatured: row.isFeatured,
    source: 'master',
    currentVersion: product.currentVersion,
    latestChangelog: latest ? latest.changelog : null,
  };
}

export interface RedeemCodeResult {
  accessCode: string;
  productName: string;
  productType: string;
  licenseKey: string | null;
  status: string;
  redeemedAt: Date;
}

export async function redeemAccessCode(tenantId: string, codeStr: string): Promise<RedeemCodeResult> {
  const accessCode = await AccessCode.findOne({ code: codeStr.trim().toUpperCase(), tenantId })
    .populate<{ productId: ProductDocument }>('productId')
    .populate<{ licenseId: { key: string } | null }>('licenseId');

  if (!accessCode) {
    throw new NotFoundError('Invalid access code or code not found for this store');
  }

  if (accessCode.status === 'revoked') {
    throw new ConflictError('This access code has been revoked by the store administrator');
  }

  if (accessCode.expiresAt && new Date() > accessCode.expiresAt) {
    throw new ConflictError('This access code has expired');
  }

  accessCode.status = 'active';
  accessCode.redeemedAt = new Date();
  await accessCode.save();

  const product = accessCode.productId;
  const license = accessCode.licenseId;

  return {
    accessCode: accessCode.code,
    productName: product?.name ?? 'Digital Product',
    productType: product?.type ?? 'software',
    licenseKey: license?.key ?? null,
    status: accessCode.status,
    redeemedAt: accessCode.redeemedAt,
  };
}

export async function getStorePublicConfig(hostnameOrSubdomain: string) {
  let tenant = await resolveTenantByHost(hostnameOrSubdomain);
  if (!tenant) {
    // Fallback default (e.g. local dev hitting the bare platform host)
    tenant = await Tenant.findOne();
  }

  return tenant;
}

export async function getStorePublicConfigById(tenantId: string) {
  return Tenant.findById(tenantId);
}
