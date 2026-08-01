# Customer Storefront & Checkout — Design Spec

## Goal

Give customers a working storefront: browse the products their reseller's tenant has enabled, buy one, and watch the (mock) payment complete. This replaces the placeholder `CustomerHomePage` and is the first Customer Portal sub-project — order history, license management, and downloads are deferred to a follow-up.

## Context

- The backend already has checkout (`POST /customer/checkout`), order listing (`GET /customer/orders`), license listing/activation (`GET/POST /customer/licenses`), and download-token generation — but **no way for a customer to discover what they can buy**. `POST /customer/checkout` requires a `productId` the customer would already have to know.
- The payment gateway (`src/common/paymentGateway.ts`) is a mock: `mockPaymentGateway.createOrder()` returns a fake gateway order id, and completion normally happens via a signed webhook (`POST /auth/register-reseller/webhook`-style pattern, HMAC-signed with `MOCK_WEBHOOK_SECRET`). The frontend cannot hold that secret, so it cannot call the webhook directly to simulate a successful payment.
- `checkout.service.ts`'s `createCheckout` already computes an effective price from a `ResellerProduct` entitlement (`customPrice ?? discountPercent-adjusted ?? basePrice`) — this logic needs to be reused by the new browse endpoint so displayed prices match what checkout actually charges.

## Out of scope (deferred to the next Customer Portal sub-project)

- Order history screen (`GET /customer/orders` already exists but has no UI yet).
- License list/activation screen (`GET/POST /customer/licenses` already exists but has no UI yet).
- Download flow (download-token generation already exists but has no UI yet).
- Product categories, search/filtering, reviews, cart (single-item buy only).

## Backend

### Shared pricing helper: `src/modules/checkout/checkout.service.ts`

Extract the existing inline calculation into an exported function so the new storefront module can reuse it without duplicating logic:

```ts
export function computeEffectivePrice(
  basePrice: number,
  entitlement: { customPrice: number | null; discountPercent: number | null }
): number {
  return (
    entitlement.customPrice ??
    (entitlement.discountPercent
      ? Number((basePrice * (1 - entitlement.discountPercent / 100)).toFixed(2))
      : basePrice)
  );
}
```

`createCheckout` calls this instead of its current inline expression.

### New module: `src/modules/storefront/`

Files: `storefront.routes.ts`, `storefront.controller.ts`, `storefront.service.ts`.

Mounted in `src/app.ts`:
```ts
app.use('/api/v1/customer/products', storefrontRouter);
```

Route: `GET /customer/products` — `requireAuth, requireRole('customer')`.

Service queries `ResellerProduct.find({ tenantId: req.tenantId, enabled: true }).populate('productId')`, filters to `status: 'published'` products (same populate/filter pattern as `resellerCatalog.service.ts`), and maps to:

```ts
export interface StorefrontItem {
  _id: string;          // productId
  name: string;
  description: string;
  type: string;
  thumbnailUrl: string | null;
  price: number;        // computeEffectivePrice() result
  currency: string;
  isFeatured: boolean;
}
```

Response shape: `{ items: StorefrontItem[] }`.

### Checkout module additions: `src/modules/checkout/`

Refactor `processWebhook` to extract its post-verification body into a reusable function:

```ts
async function markOrderPaid(order: OrderDocument): Promise<OrderDocument> {
  order.status = 'paid';
  const license = await License.findOne({ productId: order.productId, status: 'available' });
  if (license) {
    license.assignedUserId = order.customerUserId;
    license.tenantId = order.tenantId;
    license.orderId = order._id;
    license.status = 'assigned';
    await license.save();
    order.licenseId = license._id;
  }
  await order.save();
  const customer = await User.findById(order.customerUserId);
  if (customer) {
    await smtpEmailService.sendEmail(customer.email, 'order-paid', { orderId: order._id.toString() });
  }
  return order;
}
```

`processWebhook` becomes: look up order by `paymentRef`, if `!success` mark `failed` and return, else `return markOrderPaid(order)`.

New function:
```ts
export async function confirmPayment(orderId: string, userId: string): Promise<OrderDocument> {
  const order = await Order.findById(orderId);
  if (!order || order.customerUserId.toString() !== userId) {
    throw new NotFoundError('Order not found');
  }
  if (order.status !== 'pending') {
    throw new ConflictError('Order is not pending payment');
  }
  return markOrderPaid(order);
}
```

New route: `POST /customer/orders/:id/confirm-payment` — `requireAuth, requireRole('customer')`, new handler `confirmPaymentHandler` calling `checkoutService.confirmPayment(req.params.id, req.user!.id)`, responds `{ order }`.

This route is added to the existing `checkoutRouter` (already mounted at `/api/v1/customer`), so the full path is `/api/v1/customer/orders/:id/confirm-payment`. Note this is a distinct path prefix (`/customer/orders/...`) from the existing `/customer/checkout` and `/customer/downloads/...` paths already on that router — Express matches them independently, no conflict.

## Frontend

### `client/src/api/storefront.ts`
```ts
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
export async function listStorefrontProducts(): Promise<StorefrontItem[]>;
```

### `client/src/api/customerOrders.ts`
```ts
export interface CheckoutResult { orderId: string; gatewayOrderId: string; amount: number; currency: string; }
export interface CustomerOrder {
  _id: string; productId: string; amount: number; currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';
}
export async function createCheckout(productId: string): Promise<CheckoutResult>;
export async function confirmPayment(orderId: string): Promise<CustomerOrder>;
```
(`confirmPayment` calls `POST /customer/orders/:id/confirm-payment`; `createCheckout` calls the existing `POST /customer/checkout`.)

### `client/src/pages/customer/CustomerLayout.tsx`
Same structure as `AdminLayout`/`ResellerLayout`: header with email + logout, nav with a "Store" link, `<Outlet/>`.

### `client/src/pages/customer/StorefrontPage.tsx`
- `useQuery(['storefront'], listStorefrontProducts)`.
- Renders each item (name, description, type, price+currency, a "Featured" badge when `isFeatured`).
- "Buy" button calls `createCheckout(item._id)`, then `navigate(`/account/orders/${result.orderId}`)`. Inline `role="alert"` error message on failure (e.g. product no longer available), matching the existing pattern.

### `client/src/pages/customer/OrderConfirmationPage.tsx`
- Reads `orderId` from the route param. Since there's no `GET /customer/orders/:id` endpoint (out of scope — order history is deferred), the page gets its initial order data from `location.state` (passed via `navigate(path, { state: checkoutResult })` in `StorefrontPage`) rather than fetching it. If `location.state` is missing (e.g. direct URL visit), it shows "Order not found — return to store" with a link back to `/account/store`.
- Shows amount, currency, and status. While status is `pending` (tracked in local state, seeded from the navigation state), shows a "Simulate Payment" button calling `confirmPayment(orderId)`; on success, updates local status to `paid` and shows a confirmation message.

### Routing (`client/src/App.tsx`)
Replace the single `/account` route:
```tsx
<Route path="/account" element={<ProtectedRoute allowedRoles={['customer']}><CustomerLayout/></ProtectedRoute>}>
  <Route index element={<Navigate to="/account/store" replace />} />
  <Route path="store" element={<StorefrontPage />} />
  <Route path="orders/:orderId" element={<OrderConfirmationPage />} />
</Route>
```
Delete `client/src/pages/CustomerHomePage.tsx`.

## Error Handling

- `GET /customer/products` returns an empty `items: []` if the tenant has nothing enabled (not an error).
- `POST /customer/checkout` unchanged: 404 unpublished/missing product, 403 not entitled.
- `POST /customer/orders/:id/confirm-payment`: 404 if the order doesn't exist or isn't the caller's; 409 (`ConflictError`) if the order isn't `pending` (already paid/failed — prevents double-confirmation or confirming a failed order).
- Frontend: inline `role="alert"` messages on buy/confirm failure, consistent with every other sub-project's pattern. No toast system.

## Testing

**Backend** (Jest + Supertest + mongodb-memory-server):
- `computeEffectivePrice`: unit tests for custom price, discount percent, and neither-set fallback (the existing checkout discount tests already cover this behavior end-to-end; add a couple of direct unit tests for the extracted function too).
- `storefront` module: RBAC (non-customer roles 403); only returns published + enabled-for-tenant items; a different tenant's enabled items don't leak; price reflects `customPrice`/`discountPercent`/`basePrice` correctly.
- `checkout` module: new tests for `confirm-payment` — 404 for another customer's order, 409 for an already-paid order, 200 + `status: 'paid'` + license assigned for a valid pending order. Existing webhook tests continue to pass unchanged (behavior-preserving refactor).

**Frontend** (Vitest + RTL):
- `CustomerLayout`: renders nav + outlet + logout (same shape as `AdminLayout.test.tsx`).
- `StorefrontPage`: renders fetched items with price/currency; clicking "Buy" calls `createCheckout` and navigates to the order confirmation route with the result in navigation state; shows an inline alert if checkout fails.
- `OrderConfirmationPage`: renders pending order from navigation state with a "Simulate Payment" button; clicking it calls `confirmPayment` and shows the paid confirmation; shows a "not found" state when navigation state is missing.
- `App.test.tsx`: update/add a customer login test expecting landing on the store screen instead of the old placeholder text.
