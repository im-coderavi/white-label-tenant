import { Types } from 'mongoose';
import { Product, ProductDocument } from '../../models/Product';
import { ResellerProduct } from '../../models/ResellerProduct';
import { License } from '../../models/License';
import { Order, OrderDocument } from '../../models/Order';
import { Category } from '../../models/Category';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { getGatewayForTenant } from '../../common/paymentGateway';

/** Expands a category id to itself plus any child category ids, so filtering by a parent group (e.g. "AI Tools") includes its sub-categories. */
export async function resolveCategoryIds(categoryId: string): Promise<string[]> {
  const children = await Category.find({ parentId: categoryId }).select('_id');
  return [categoryId, ...children.map((c) => c._id.toString())];
}

export interface MarketplaceItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  basePrice: number;
  currency: string;
  syncMode: string;
  unlocked: boolean;
  licenseRequired: boolean;
  categoryId: string | null;
}

/**
 * Master catalog as seen by a reseller shopping for access to it (distinct from
 * resellerCatalog, which is the reseller curating what THEIR customers see). Global-sync
 * products are always unlocked; everything else needs a license key redemption or purchase.
 * `categoryId` optionally filters to one category (or any of its children, resolved by the caller).
 */
export async function listMarketplace(tenantId: string, categoryIds?: string[]): Promise<MarketplaceItem[]> {
  const filter: Record<string, unknown> = { status: 'published' };
  if (categoryIds && categoryIds.length > 0) {
    filter.categoryId = { $in: categoryIds };
  }
  const products = await Product.find(filter).sort({ createdAt: -1 });
  const entitlements = await ResellerProduct.find({ tenantId });
  const entitledIds = new Set(entitlements.filter((e) => e.enabled).map((e) => e.productId.toString()));

  return products
    .filter((product) => {
      if (product.syncMode === 'private' || product.syncMode === 'exclusive') {
        return product.tenantId?.toString() === tenantId || entitledIds.has(product._id.toString());
      }
      return true;
    })
    .map((product) => ({
      _id: product._id.toString(),
      name: product.name,
      description: product.description,
      type: product.type,
      thumbnailUrl: product.thumbnailUrl,
      basePrice: product.basePrice,
      currency: product.currency,
      syncMode: product.syncMode,
      unlocked: product.syncMode === 'global' || entitledIds.has(product._id.toString()),
      licenseRequired: product.syncMode !== 'global',
      categoryId: product.categoryId ? product.categoryId.toString() : null,
    }));
}

async function unlockForTenant(tenantId: string, productId: Types.ObjectId): Promise<void> {
  await ResellerProduct.findOneAndUpdate(
    { tenantId, productId },
    { $set: { enabled: true }, $setOnInsert: { tenantId, productId } },
    { upsert: true }
  );
}

export interface RedeemLicenseResult {
  productId: string;
  productName: string;
  unlocked: boolean;
}

/** Lets a reseller unlock catalog access using a license key already assigned to their tenant (e.g. issued by master admin support). */
export async function redeemLicenseKey(tenantId: string, key: string): Promise<RedeemLicenseResult> {
  const license = await License.findOne({ key: key.trim().toUpperCase() }).populate<{
    productId: ProductDocument;
  }>('productId');

  if (!license) throw new NotFoundError('License key not found');
  if (license.status === 'revoked') throw new ConflictError('This license key has been revoked');
  if (license.tenantId && license.tenantId.toString() !== tenantId) {
    throw new ForbiddenError('This license key belongs to a different account');
  }

  license.tenantId = new Types.ObjectId(tenantId);
  if (license.status === 'available' || license.status === 'reserved') {
    license.status = 'assigned';
  }
  await license.save();

  const product = license.productId as unknown as ProductDocument;
  await unlockForTenant(tenantId, product._id);

  return { productId: product._id.toString(), productName: product.name, unlocked: true };
}

export interface MarketplaceCheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

/**
 * Direct purchase path for a reseller to buy access to a master product for themselves
 * (distinct from checkout.service.ts, which is a reseller's *customer* buying from the
 * reseller's own storefront). On payment success (processMarketplaceWebhook) the product is
 * unlocked into the reseller's catalog and a license is assigned to their tenant.
 */
export async function createMarketplaceCheckout(input: {
  productId: string;
  tenantId: string;
  buyerUserId: string;
}): Promise<MarketplaceCheckoutResult> {
  const product = await Product.findById(input.productId);
  if (!product || product.status !== 'published') {
    throw new NotFoundError('Product not found');
  }
  if (product.syncMode === 'global') {
    throw new ConflictError('This product is already included in your plan');
  }

  const gateway = await getGatewayForTenant(input.tenantId);
  const order = await Order.create({
    tenantId: input.tenantId,
    // The buyer is the reseller_admin/staff user making the purchase for their own tenant,
    // not an end customer — distinct from checkout.service.ts's storefront flow.
    customerUserId: input.buyerUserId,
    productId: product._id,
    orderType: 'single_product',
    amount: product.basePrice,
    currency: product.currency,
    status: 'pending',
    paymentGateway: gateway.provider,
  });

  const { gatewayOrderId } = await gateway.createOrder({
    amount: product.basePrice,
    currency: product.currency,
    receipt: order._id.toString(),
  });
  order.paymentRef = gatewayOrderId;
  await order.save();

  return {
    orderId: (order._id as OrderDocument['_id']).toString(),
    gatewayOrderId,
    amount: product.basePrice,
    currency: product.currency,
  };
}

export async function confirmMarketplacePurchase(orderId: string, tenantId: string): Promise<OrderDocument> {
  const order = await Order.findById(orderId);
  if (!order || order.tenantId.toString() !== tenantId) {
    throw new NotFoundError('Order not found');
  }
  if (order.status !== 'pending') {
    throw new ConflictError('Order is not pending payment');
  }
  return markMarketplaceOrderPaid(order);
}

async function markMarketplaceOrderPaid(order: OrderDocument): Promise<OrderDocument> {
  order.status = 'paid';

  const license = await License.findOne({ productId: order.productId, status: 'available' });
  if (license) {
    license.tenantId = order.tenantId;
    license.orderId = order._id;
    license.status = 'assigned';
    await license.save();
    order.licenseId = license._id;
  }

  await unlockForTenant(order.tenantId.toString(), order.productId);
  await order.save();
  return order;
}

export async function processMarketplaceWebhook(gatewayOrderId: string, success: boolean): Promise<OrderDocument> {
  const order = await Order.findOne({ paymentRef: gatewayOrderId });
  if (!order) throw new NotFoundError('Order not found for gateway reference');

  if (!success) {
    order.status = 'failed';
    await order.save();
    return order;
  }

  return markMarketplaceOrderPaid(order);
}
