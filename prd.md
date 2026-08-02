# ToolzyPro V2 — Product Requirements Document (PRD)

**Version:** 1.0
**Type:** Enterprise White-Label Multi-Tenant SaaS Platform
**Status:** Draft for Development
**Owner:** Avishek (Solo Development)

---

## 1. Overview

### 1.1 Product Summary
ToolzyPro is a centralized, multi-tenant white-label SaaS platform. The platform sells **reseller plans**, not individual software. Each reseller operates an independently branded software/digital-product marketplace on a subdomain or connected custom domain, while ToolzyPro centrally owns the backend, product catalog, licensing, infrastructure, and security.

### 1.2 Goals
- Allow Master Admin to manage the entire ecosystem (resellers, products, licenses, billing, notifications) from one control panel.
- Allow a Reseller to launch a fully branded storefront in minutes with zero code/hosting knowledge.
- Allow an End Customer to purchase, receive an auto-generated license key, and download products securely — all under the reseller's brand, with zero visibility into ToolzyPro.
- Support automatic and manual licensing, multi-tenant product sync, and centralized billing/notifications.

### 1.3 Non-Goals (Out of Scope for V1)
- Mobile native apps (future roadmap)
- Multi-language/i18n storefronts (future roadmap)
- Full drag-drop page-builder engine (basic block-based builder only in V1)
- Vendor marketplace / affiliate network (future roadmap)
- Multi-currency billing (future roadmap)

### 1.4 Definitions
| Term | Meaning |
|---|---|
| Tenant | A reseller account; every tenant-scoped table carries `tenant_id` |
| Master Admin | ToolzyPro's own super-admin, `tenant_id = null` |
| Sync Mode | How a master product is distributed to resellers: Global / Optional / Private / Exclusive |
| Access Code | Reseller-issued code that activates/redeems a purchase without exposing the license pool |
| License Key | Unique key (`TZP-YYYY-XXXXXXXX`) assigned to a customer's purchase, used for activation/download |

---

## 2. User Roles & Personas

| Role | Description | Primary Surface |
|---|---|---|
| **Master Admin** | ToolzyPro's own team. Full control over tenants, products, licenses, finance. | `admin.toolzypro.in` |
| **Reseller Admin** | Business owner running a branded store. Manages branding, pricing, customers, orders. | `panel.toolzypro.in` or reseller subdomain/admin path |
| **Reseller Staff** (future, Phase 7) | Limited-permission users under a reseller account. | Reseller panel, scoped |
| **Customer** | End buyer on a reseller's branded storefront. | `{reseller}.toolzypro.in` or reseller's custom domain |

---

## 3. System Architecture Summary

- **Pattern:** Single codebase, multi-tenant, shared database with `tenant_id` row-level isolation (MVP) — schema-per-tenant only if a large reseller demands stronger isolation later.
- **Backend:** NestJS (Node.js + TypeScript), modular by domain (auth, tenants, products, marketplace, licenses, billing, notifications, audit).
- **Frontend:** Next.js + Tailwind + shadcn/ui. Three route groups within one app: `/admin`, `/panel`, and a dynamically-themed storefront resolved by tenant domain/subdomain.
- **Database:** PostgreSQL (single instance, tenant-scoped tables).
- **Cache/Queue:** Redis + BullMQ (license generation, email queue, sync jobs).
- **Object Storage:** AWS S3 with signed URLs for all downloadable assets.
- **Domain/SSL:** Cloudflare for SaaS (custom hostname + automatic SSL provisioning).
- **Payments:** Razorpay (V1), Stripe (V2+).
- **Email:** Resend/Postmark with per-tenant sender identity.
- **Auth:** JWT with `role` + `tenant_id` claims; refresh-token rotation.

---

## 4. Functional Requirements by Module

### 4.1 Master Admin Module
- **Dashboard:** live KPIs — reseller count, active plans, customers, orders, revenue, pending approvals, license requests, server/queue health.
- **Reseller Management:** create/approve/suspend/restore/upgrade reseller; assign plan, limits, quotas, product access; impersonate-login (audit-logged).
- **White Label Manager:** branding policy, domain/subdomain, SSL status, SMTP, gateway config, SEO, legal pages, maintenance mode — per tenant.
- **Master Product Library:** CRUD for products (software, AI tools, themes, plugins, templates, bundles, courses, subscriptions); versioning, changelogs, publish workflow.
- **Product Sync Engine:** define sync mode per product (Global/Optional/Private/Exclusive); propagate updates.
- **Marketplace Management:** categories, featured products, promotions, coupons, publishing rules.
- **License & Access Engine:** license pool CRUD, manual request approval queue, access-code quota assignment.
- **Finance & Reports:** subscriptions, invoices, gateway status, renewals, refunds, revenue analytics, exports.
- **Security & Audit:** full action log (timestamp, user, IP, before/after values), RBAC, activity history.

### 4.2 Reseller Panel Module
- **Onboarding Wizard:** business info → branding → domain/subdomain → DNS verification → payment gateway → SMTP → SEO → legal pages → marketplace config → go-live checklist.
- **Dashboard:** revenue, orders, customers, downloads, licenses, expiring subscriptions, pending requests, recent activity.
- **Branding & White Label:** logo, favicon, colors, typography, banners, footer, social links, legal pages, analytics codes; ToolzyPro branding hidden.
- **Domain & DNS:** connect custom domain or activate free subdomain; guided DNS/SSL status.
- **Product Management:** enable/hide/categorize/price/discount/feature synced products.
- **Marketplace:** independent branded catalog — categories, bundles, offers, featured items.
- **Customer & Order Management:** view/search customers, orders, invoices, downloads, renewals, support tickets; export where permitted.
- **License Request Workflow:** submit manual license requests; track pending/approved/rejected/completed.
- **Communication:** SMTP config, email templates, announcement banners, alerts.

### 4.3 Customer Portal Module
- **Auth:** email/password, reset, verification, OTP (future: social login) — tenant-isolated.
- **Dashboard:** purchased products, active licenses, download history, renewal reminders, announcements, invoices, tickets.
- **Orders & Downloads:** order history, secure token-based downloads, version access per license rules.
- **License Center:** license keys, activation status, expiry, activation instructions, request status.
- **Marketplace Experience:** browse reseller's branded catalog only; categories, bundles, promotions, reviews.
- **Support Center:** ticketing — create, attach files, track, reply.
- **Profile & Security:** profile, billing info, password, sessions, notification preferences.

### 4.4 White Label Engine
- Single multi-tenant codebase; tenant resolved via verified domain/subdomain at request time.
- DNS verification, SSL auto-provisioning (Cloudflare for SaaS), routing validation.
- Per-tenant branding config with zero cross-tenant leakage.
- Reseller-branded outgoing email (sender identity + SMTP).
- Lifecycle: create reseller → wizard → connect DNS → verify → SSL issued → store live → ongoing centralized sync.

### 4.5 Marketplace Engine
- Master catalog: software, SaaS tools, themes, plugins, templates, source code, AI tools, bundles.
- Reseller catalog: filtered/synced view with independent pricing/branding.
- Sync modes: **Global** (all resellers), **Optional** (opt-in), **Private** (single reseller), **Exclusive** (one reseller only, hidden from others).
- Pricing: fixed, % discount, scheduled offers, bundles, coupons, featured listings.
- Catalog: categories, tags, filters, search, best-sellers, related products.
- Analytics: product performance, conversion, revenue, reseller rankings.

### 4.6 License & Access Code Engine
- Master license pool: import/generate/reserve/assign/revoke/recycle.
- Reseller access codes drawn from quota — activate purchases without exposing pool.
- Auto licensing (instant, on payment success) and manual licensing (approval queue).
- Activation workflow: validate ownership, tenant permission, product eligibility, device/activation limits.
- Lifecycle states: `draft → available → reserved → assigned → activated → suspended → expired → revoked`.
- Key format: `TZP-YYYY-XXXXXXXX` (8-char uppercase alphanumeric, collision-checked).

### 4.7 Billing & Payment Engine
- Reseller subscription plans: Starter / Premium / Enterprise — pricing, cycle, limits, feature flags.
- Customer-facing plans: single-product purchase + subscription (monthly/annual/lifetime) access to enabled catalog.
- Gateways: Razorpay (V1), Stripe (V2), per-tenant credentials.
- Invoices: number, tax calc, status, downloadable PDF; GST/VAT modules.
- Renewal lifecycle: trial, renewal, grace period, expiry, reminders.
- Refunds: full/partial, reversal, manual adjustment, approval history.
- Reporting: MRR, one-time sales, reseller earnings, success rates, refunds, taxes.

### 4.8 Notification & Communication Engine
- Channels: email, in-app, push (V1); WhatsApp, SMS (V2+).
- Event-driven: registration, purchase, payment, invoice, license approval, activation, renewal, password reset, ticket, product update.
- Templates: Master-defined, reseller-customized branding/sender/content; dynamic variables.
- Queue: async, retry policy, priority, delivery tracking, failure logs, webhooks.
- Announcement Center: reseller-published banners/notices to customer dashboards.
- Analytics: delivery/open/click rates, failures, channel performance.

---

## 5. Database Schema (Core Tables)

```
tenants
  id UUID PK
  name, subdomain UNIQUE, custom_domain UNIQUE NULLABLE
  plan ENUM(starter,premium,enterprise)
  status ENUM(pending,active,suspended)
  branding_json JSONB
  smtp_config_json JSONB
  payment_gateway_json JSONB
  created_at, updated_at

users
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants   -- null for master admin
  role ENUM(master_admin, reseller_admin, reseller_staff, customer)
  email UNIQUE (scoped with tenant_id for customers)
  password_hash, status, last_login_at
  created_at, updated_at

products
  id UUID PK                              -- master-level, no tenant_id
  name, slug, type ENUM(software,ai_tool,theme,plugin,script,template,
                          landing_page,bundle,course,digital_download,subscription)
  description, base_price, currency
  current_version, changelog_json
  status ENUM(draft,published,archived)
  s3_key, thumbnail_s3_key
  sync_mode ENUM(global,optional,private,exclusive)
  created_at, updated_at

reseller_products
  id UUID PK
  tenant_id UUID FK -> tenants
  product_id UUID FK -> products
  enabled BOOLEAN
  custom_price, discount_percent
  is_featured BOOLEAN
  category_id UUID FK -> categories
  created_at, updated_at
  UNIQUE(tenant_id, product_id)

categories
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants   -- null = master category
  name, slug, parent_id NULLABLE

orders
  id UUID PK
  tenant_id UUID FK -> tenants
  customer_user_id UUID FK -> users
  product_id UUID NULLABLE FK -> products  -- null for subscription-only orders
  order_type ENUM(single_product, subscription)
  amount, currency, status ENUM(pending,paid,failed,refunded,partial_refund)
  payment_gateway, payment_ref
  invoice_id UUID NULLABLE FK -> invoices
  created_at, updated_at

licenses
  id UUID PK
  product_id UUID FK -> products
  tenant_id UUID NULLABLE FK -> tenants     -- null while in master pool
  order_id UUID NULLABLE FK -> orders
  key VARCHAR UNIQUE                        -- TZP-YYYY-XXXXXXXX
  status ENUM(draft,available,reserved,assigned,activated,suspended,expired,revoked)
  activation_limit INT, activations_used INT
  expires_at NULLABLE
  created_at, updated_at

license_requests
  id UUID PK
  tenant_id UUID FK -> tenants
  product_id UUID FK -> products
  requested_by UUID FK -> users
  status ENUM(pending,approved,rejected,completed)
  assigned_license_id UUID NULLABLE FK -> licenses
  notes, created_at, updated_at

access_codes
  id UUID PK
  tenant_id UUID FK -> tenants
  code UNIQUE
  quota_total INT, quota_used INT
  created_at

download_tokens
  id UUID PK
  order_id UUID FK -> orders
  s3_key, expires_at, used BOOLEAN, ip_address

subscriptions
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants     -- reseller-level subscription
  customer_user_id UUID NULLABLE FK -> users -- customer-level subscription
  plan_id UUID FK -> plans
  status ENUM(trial,active,grace,expired,cancelled)
  current_period_end, created_at, updated_at

plans
  id UUID PK
  scope ENUM(reseller,customer)
  name ENUM(starter,premium,enterprise) NULLABLE  -- for reseller scope
  price, billing_cycle ENUM(monthly,annual,lifetime)
  feature_flags_json, limits_json

invoices
  id UUID PK
  tenant_id UUID FK -> tenants
  order_id UUID NULLABLE FK -> orders
  subscription_id UUID NULLABLE FK -> subscriptions
  invoice_number UNIQUE, amount, tax_amount, status
  pdf_s3_key, created_at

coupons
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants     -- null = master coupon
  code UNIQUE, discount_type ENUM(fixed,percent)
  discount_value, usage_limit, usage_count
  valid_from, valid_until

support_tickets
  id UUID PK
  tenant_id UUID FK -> tenants
  customer_user_id UUID FK -> users
  subject, status ENUM(open,pending,resolved,closed)
  created_at, updated_at

ticket_messages
  id UUID PK
  ticket_id UUID FK -> support_tickets
  sender_user_id UUID FK -> users
  message, attachment_s3_key NULLABLE
  created_at

notifications_log
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants
  user_id UUID FK -> users
  channel ENUM(email,in_app,push,whatsapp,sms)
  template_key, status ENUM(queued,sent,failed)
  payload_json, sent_at

notification_templates
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants     -- null = master default
  event_key, channel, subject, body_html
  variables_json

audit_logs
  id UUID PK
  tenant_id UUID NULLABLE FK -> tenants
  user_id UUID FK -> users
  action, entity_type, entity_id
  before_json, after_json
  ip_address, user_agent, created_at

referrals
  id UUID PK
  tenant_id UUID FK -> tenants
  referrer_user_id UUID FK -> users
  referred_user_id UUID FK -> users
  status ENUM(pending,converted,paid)
  reward_amount, created_at
```

---

## 6. Full API Specification

Base path: `/api/v1`. All routes except auth/public require `Authorization: Bearer <JWT>`. Tenant scoping middleware auto-injects `tenant_id` filter based on token claims, except for Master Admin routes which operate cross-tenant explicitly.

### 6.1 Auth & Session
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register (customer or reseller signup, tenant-scoped) |
| POST | `/auth/login` | Login, returns access + refresh token |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/forgot-password` | Trigger reset email |
| POST | `/auth/reset-password` | Reset with token |
| POST | `/auth/verify-email` | Verify via token/OTP |
| GET | `/auth/me` | Current user profile + role + tenant context |

### 6.2 Master Admin — Reseller Management
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/resellers` | List all resellers (filter/search/paginate) |
| POST | `/admin/resellers` | Create reseller account |
| GET | `/admin/resellers/:id` | Reseller detail |
| PATCH | `/admin/resellers/:id` | Update reseller (plan, limits, status) |
| POST | `/admin/resellers/:id/approve` | Approve pending reseller |
| POST | `/admin/resellers/:id/suspend` | Suspend reseller |
| POST | `/admin/resellers/:id/restore` | Restore suspended reseller |
| POST | `/admin/resellers/:id/impersonate` | Generate impersonation session (audit-logged) |
| GET | `/admin/resellers/:id/audit-log` | Reseller-specific audit trail |

### 6.3 Master Admin — Product Library
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/products` | List master products |
| POST | `/admin/products` | Create product |
| GET | `/admin/products/:id` | Product detail |
| PATCH | `/admin/products/:id` | Update product |
| DELETE | `/admin/products/:id` | Archive product |
| POST | `/admin/products/:id/publish` | Publish new version |
| POST | `/admin/products/:id/versions` | Add version + changelog |
| GET | `/admin/products/:id/versions` | Version history |
| PATCH | `/admin/products/:id/sync-mode` | Set sync mode (global/optional/private/exclusive) |
| POST | `/admin/products/:id/sync` | Force re-sync to eligible resellers |

### 6.4 Master Admin — Marketplace
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/categories` | List master categories |
| POST | `/admin/categories` | Create category |
| PATCH | `/admin/categories/:id` | Update category |
| GET | `/admin/coupons` | List master-level coupons |
| POST | `/admin/coupons` | Create coupon |
| PATCH | `/admin/coupons/:id` | Update coupon |
| DELETE | `/admin/coupons/:id` | Deactivate coupon |

### 6.5 Master Admin — Licensing
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/licenses` | List/search licenses (filter by product/tenant/status) |
| POST | `/admin/licenses/generate` | Bulk-generate licenses into pool |
| POST | `/admin/licenses/import` | Import external license keys |
| PATCH | `/admin/licenses/:id/revoke` | Revoke license |
| GET | `/admin/license-requests` | List manual license requests (pending queue) |
| POST | `/admin/license-requests/:id/approve` | Approve + assign license |
| POST | `/admin/license-requests/:id/reject` | Reject request |
| POST | `/admin/resellers/:id/access-codes` | Issue access-code quota to reseller |

### 6.6 Master Admin — Finance
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/invoices` | List all invoices |
| GET | `/admin/subscriptions` | List reseller subscriptions |
| POST | `/admin/refunds` | Process refund/partial refund |
| GET | `/admin/reports/revenue` | Revenue analytics |
| GET | `/admin/reports/reseller-performance` | Reseller ranking/performance |
| GET | `/admin/reports/export` | Export report (CSV/PDF) |

### 6.7 Master Admin — Dashboard & Settings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/dashboard/kpis` | Live KPI widgets |
| GET | `/admin/settings/platform` | Global platform settings |
| PATCH | `/admin/settings/platform` | Update global settings |
| GET | `/admin/notification-templates` | List master templates |
| POST | `/admin/notification-templates` | Create master template |
| PATCH | `/admin/notification-templates/:id` | Update template |

### 6.8 Reseller Panel — Onboarding & Settings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reseller/onboarding/status` | Wizard progress |
| PATCH | `/reseller/onboarding/business-info` | Save step: business info |
| PATCH | `/reseller/branding` | Update logo/colors/typography/banners |
| GET | `/reseller/domain` | Current domain/subdomain + SSL status |
| POST | `/reseller/domain/connect` | Connect custom domain, trigger DNS check |
| POST | `/reseller/domain/verify` | Re-check DNS/SSL status |
| PATCH | `/reseller/smtp` | Configure SMTP |
| PATCH | `/reseller/payment-gateway` | Configure gateway credentials |
| PATCH | `/reseller/seo` | SEO metadata + analytics codes |
| PATCH | `/reseller/legal-pages` | Terms/privacy/refund page content |

### 6.9 Reseller Panel — Products & Marketplace
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reseller/products` | List synced products (enabled/disabled) |
| PATCH | `/reseller/products/:id` | Enable/disable, set custom price/discount |
| PATCH | `/reseller/products/:id/feature` | Mark as featured |
| GET | `/reseller/categories` | Reseller's category tree |
| POST | `/reseller/categories` | Create reseller category |
| GET | `/reseller/coupons` | Reseller's coupons |
| POST | `/reseller/coupons` | Create coupon |

### 6.10 Reseller Panel — Customers, Orders, Licensing
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reseller/customers` | List/search customers |
| GET | `/reseller/customers/:id` | Customer detail |
| GET | `/reseller/orders` | List/search/export orders |
| GET | `/reseller/orders/:id` | Order detail |
| GET | `/reseller/invoices` | Reseller-facing invoice list |
| POST | `/reseller/license-requests` | Submit manual license request |
| GET | `/reseller/license-requests` | Track own requests |
| GET | `/reseller/access-codes` | View own access-code quota/usage |

### 6.11 Reseller Panel — Dashboard & Communication
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reseller/dashboard/kpis` | Revenue/orders/customers/licenses widgets |
| GET | `/reseller/notification-templates` | Own templates (branded) |
| PATCH | `/reseller/notification-templates/:id` | Customize template |
| POST | `/reseller/announcements` | Publish announcement banner |
| GET | `/reseller/referrals` | Referral tracking (Phase 4.5) |

### 6.12 Storefront (Public, Tenant-Resolved)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/store/config` | Resolved tenant branding/theme (by domain/subdomain) |
| GET | `/store/products` | Public catalog (filters, search, category) |
| GET | `/store/products/:slug` | Product detail page data |
| GET | `/store/plans` | Subscription plans available on this store |
| POST | `/store/leads` | Capture CRM lead (abandoned checkout, interest form) |

### 6.13 Customer Portal — Auth, Purchases, Downloads
| Method | Endpoint | Description |
|---|---|---|
| POST | `/customer/checkout` | Create order + payment session |
| POST | `/customer/checkout/webhook` | Payment gateway webhook — triggers license generation |
| GET | `/customer/orders` | Own order history |
| GET | `/customer/orders/:id/invoice` | Download invoice PDF |
| GET | `/customer/downloads/:orderId` | Generate/return signed download URL |
| GET | `/customer/licenses` | Own license keys + status |
| POST | `/customer/licenses/:id/activate` | Activate license (device binding, limit check) |
| GET | `/customer/subscription` | Own subscription status |

### 6.14 Customer Portal — Support & Profile
| Method | Endpoint | Description |
|---|---|---|
| GET | `/customer/tickets` | List own tickets |
| POST | `/customer/tickets` | Create ticket (with attachment) |
| POST | `/customer/tickets/:id/reply` | Reply to ticket |
| GET | `/customer/profile` | Profile data |
| PATCH | `/customer/profile` | Update profile/billing info |
| PATCH | `/customer/notification-preferences` | Update channel preferences |
| GET | `/customer/notifications` | In-app notification feed |

### 6.15 Internal/System (Not User-Facing)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/internal/licenses/auto-generate` | Called post-payment to mint a license key |
| POST | `/internal/sync/run` | Cron-triggered product sync job |
| POST | `/internal/notifications/dispatch` | Queue worker — sends queued notification |
| POST | `/internal/domains/dns-check` | Scheduled DNS/SSL verification sweep |
| POST | `/internal/subscriptions/expire-check` | Daily job — expire/grace-period subscriptions |

---

## 7. Non-Functional Requirements

- **Tenant Isolation:** every tenant-scoped query MUST pass through middleware injecting `tenant_id`; no controller may accept a raw `tenant_id` from client input for data reads/writes.
- **Security:** bcrypt/argon2 password hashing, JWT short-lived access + rotating refresh tokens, rate limiting on auth and checkout endpoints, encrypted storage of gateway/SMTP credentials (KMS or app-level encryption), signed S3 URLs with short TTL for downloads.
- **Performance:** p95 API response < 300ms for read endpoints under normal load; async job queue for anything non-instant (license gen can be sync since it's fast, but emails/sync always async).
- **Availability:** target 99.5% uptime for V1 (single-region); backups daily, point-in-time recovery on Postgres.
- **Auditability:** every state-changing Master Admin/Reseller action logged with before/after values.
- **Scalability path:** shared-DB row-isolation now; documented migration path to schema-per-tenant if a large reseller requires it later.

---

## 8. MVP Scope Reminder (Phase 1)

Per the agreed execution plan: Master Admin (lite), Reseller onboarding + subdomain-only white-label, single-product + basic lifetime-subscription purchase, auto-license generation (`TZP-YYYY-XXXXXXXX`), Razorpay, signed S3 downloads, transactional email only. Manual licensing, custom domains, multi-gateway, WhatsApp/SMS, full audit/RBAC, and the page builder are explicitly Phase 2+ (see execution plan doc for full phase breakdown).

---

## 9. Open Questions for Client Sign-Off

1. Tax handling — which regions need GST/VAT support in V1 vs later?
2. Does V1 need reseller-to-reseller product visibility restrictions beyond sync modes (e.g. competitor blocking)?
3. Confirm license activation limit default (e.g. 1 device, 3 devices?) per product type.
4. Confirm minimum viable subscription tiers for customer-facing plans at launch (monthly only, or monthly+lifetime from day one?).