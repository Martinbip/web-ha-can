# WordPress-Style Custom Admin Design

Date: 2026-06-30
Project: Ha Can website + Strapi CMS

## Goal

Build a separate, WordPress-style admin interface for the public website. The new admin should be easier for non-technical editors than the default Strapi Content Manager while still using Strapi as the source of truth for content, authentication, publishing state, and API access.

The admin will be a React/Vite application served from the main website at `/admin`. Editors will sign in with their existing Strapi admin account. Images and media will be stored in Cloudinary instead of on the VPS.

## Current Context

The repository contains a static public website and a Strapi 5 CMS in `dha-cms`.

Relevant current content models:

- `news`: articles with title, slug, summary, rich text content, category, date, image, draft/publish.
- `product`: ore sample products with name, group, grade, origin, price, specs, image, featured, stock state, sort order.
- `project`: project case studies with name, location, scale, method, value, image, draft/publish.
- `service`: homepage service cards with title, description, features, icon SVG, link, sort order.
- `hero-slide`: homepage carousel slides with subtitle, title, image URL, alt text, sort order, draft/publish.
- `workflow-step`: process steps with step number, title, description, sort order, draft/publish.
- `pricing-package`: market metal prices.
- `pricing-analysis`: lab analysis prices.
- `pricing-survey`: survey service prices.
- `site-setting`: single website settings record for contact info, hero copy, certificates, stats, social links, tax code.
- `contact-inquiry`: incoming consultation requests.
- `order-request`: incoming ore sample orders.

The existing public website already reads from Strapi where available and falls back to static JSON files.

## Selected Approach

Use a dedicated React/Vite admin app at `/admin`, backed by custom Strapi routes under `/api/admin-ui`.

Reasons:

- A full admin experience is large enough that React/Vite will be easier to maintain than plain HTML/JS.
- The UI can be designed around editor workflows instead of exposing raw Strapi content types.
- Strapi can stay focused on storage, auth, validation, and publishing.
- A custom Strapi API layer prevents the frontend from depending directly on unstable Strapi internal admin endpoints.
- The public website and the custom admin can be deployed together under the main domain.

Rejected approaches:

- Customizing the default Strapi admin only: faster, but not enough to feel like WordPress.
- Building the admin in Next.js: powerful, but unnecessary for this static-site project and adds deployment complexity.
- Calling Strapi internal admin endpoints directly from React: fragile across Strapi upgrades and harder to secure.

## Architecture

### Frontend

Create a React/Vite app for the custom admin.

Expected location:

- Source: `admin/`
- Build output: a static `/admin` bundle that can be served with the public website.

Primary frontend responsibilities:

- Login screen.
- Session state and route guards.
- WordPress-style shell with sidebar, topbar, dashboard, list views, edit forms, media picker, and settings pages.
- Calls only the custom Strapi `admin-ui` API.
- No Cloudinary secrets, Strapi admin secrets, or unrestricted API tokens in browser code.

### Backend

Add custom Strapi API code under `dha-cms/src/api/admin-ui`.

Primary backend responsibilities:

- Authenticate against existing Strapi admin users.
- Issue and verify the custom admin session/token used by the React app.
- Expose whitelisted CRUD, publish, upload, and media endpoints.
- Validate fields and resource types before writing to Strapi.
- Upload/list/delete Cloudinary media.
- Normalize responses for a simpler frontend.

### Media

Use Cloudinary as the media store.

Cloudinary credentials live only in the Strapi environment:

- `CLOUDINARY_URL`, or
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The frontend uploads files to Strapi. Strapi uploads them to Cloudinary and returns safe metadata.

Suggested Cloudinary folders:

- `ha-can/news`
- `ha-can/products`
- `ha-can/projects`
- `ha-can/hero`
- `ha-can/services`
- `ha-can/settings`

Stored metadata:

- `secure_url`
- `public_id`
- `width`
- `height`
- `format`
- `bytes`
- optional alt text or caption where needed

Existing string image fields can store Cloudinary URLs. For `project.image`, which is currently a Strapi media field, the implementation should either migrate to a Cloudinary URL field or add a Cloudinary-specific image field and update public-site rendering consistently.

## Admin UI

The admin should feel familiar to WordPress users.

Global layout:

- Left sidebar navigation.
- Topbar with search, view website action, account menu, and logout.
- Main content area with dashboard cards, tables, and forms.
- Clear primary actions: Add new, Save draft, Publish, Update, Delete, Preview where supported.

Top-level navigation:

- Dashboard
- Tin tức
- Sản phẩm
- Dự án
- Dịch vụ
- Trang chủ
- Bảng giá
- Liên hệ
- Đơn đặt mẫu
- Thư viện ảnh
- Cài đặt website

Common list behavior:

- Search.
- Filter by status/category/group where relevant.
- Sort by date, title, order, or status.
- Pagination.
- Row actions for edit, preview, publish/unpublish, duplicate where useful, and delete.

Common form behavior:

- Vietnamese labels and helper text.
- Required field validation.
- Sectioned forms so editors do not face one long technical schema.
- Sticky save/update area.
- Toast success and error messages.
- Confirm before destructive actions.
- Rich text editor for long content.
- Image picker and preview for image fields.
- Friendly controls for technical fields such as `uid`, `sort_order`, and `specs`.

## Modules

### Dashboard

Show an operational overview:

- New contact inquiries.
- New order requests.
- Counts for articles, products, projects, and published homepage items.
- Quick actions for adding a news article, product, project, hero slide, or price item.
- Recent activity where practical.

### Tin tức

Manage `news`.

Fields:

- Title
- Slug
- Summary
- Rich text content
- Category
- Date
- Featured image from Cloudinary
- Publish state

### Sản phẩm

Manage `product`.

Fields:

- Name
- UID/slug
- Group
- Grade
- Origin
- Price
- Description
- Specs through a table-like UI instead of raw JSON
- Image from Cloudinary
- Featured
- In stock
- Sort order

### Dự án

Manage `project`.

Fields:

- Name
- Location
- Scale
- Method
- Value
- Image from Cloudinary
- Publish state

### Dịch vụ

Manage `service`.

Fields:

- Title
- Description
- Features through repeatable text rows
- Icon SVG or selected icon strategy
- Link URL
- Link text
- Sort order
- Publish state

### Trang chủ

Group homepage-specific editing into one section:

- Hero slides.
- Workflow steps.
- Hero tagline/title/description.
- Certificate label/value.
- Homepage stats.
- Brand bio.

This section writes to `hero-slide`, `workflow-step`, and `site-setting`.

### Bảng giá

Manage:

- `pricing-package`
- `pricing-analysis`
- `pricing-survey`

Editors should see these as clear price tables, not raw collections.

### Liên hệ

Manage `contact-inquiry`.

Behavior:

- Read inquiry details.
- Filter by status.
- Mark as new, contacted, or completed.
- No public publishing actions.

### Đơn đặt mẫu

Manage `order-request`.

Behavior:

- Read order details.
- Filter by status.
- Mark as new, processing, or done.
- No public publishing actions.

### Thư viện ảnh

Cloudinary-backed media library.

Features:

- Upload image.
- List recent images.
- Filter by folder/module.
- Preview image.
- Copy URL.
- Select image for a form field.
- Delete image by `public_id` after confirmation.

### Cài đặt website

Manage `site-setting`.

Fields:

- Hotline
- Secondary hotline
- Email
- Address
- Office name
- Tax code
- Facebook, YouTube, Zalo, Twitter URLs
- Brand bio
- Homepage hero copy
- Certificate text
- Stats

## API Design

All custom admin endpoints are under `/api/admin-ui`.

Authentication:

- `POST /api/admin-ui/auth/login`
- `GET /api/admin-ui/auth/me`
- `POST /api/admin-ui/auth/logout`

Resources:

- `GET /api/admin-ui/resources/:type`
- `POST /api/admin-ui/resources/:type`
- `GET /api/admin-ui/resources/:type/:id`
- `PUT /api/admin-ui/resources/:type/:id`
- `DELETE /api/admin-ui/resources/:type/:id`
- `POST /api/admin-ui/resources/:type/:id/publish`
- `POST /api/admin-ui/resources/:type/:id/unpublish`

Media:

- `GET /api/admin-ui/media`
- `POST /api/admin-ui/media/upload`
- `DELETE /api/admin-ui/media/:publicId`

The backend must whitelist resource types. The frontend must not be allowed to pass arbitrary Strapi UIDs.

Suggested resource aliases:

- `news`
- `products`
- `projects`
- `services`
- `hero-slides`
- `workflow-steps`
- `pricing-packages`
- `pricing-analyses`
- `pricing-surveys`
- `site-setting`
- `contact-inquiries`
- `order-requests`

## Authentication And Authorization

The custom admin uses existing Strapi admin accounts.

Implementation requirements:

- Do not expose Strapi API tokens in the React app.
- Do not expose Cloudinary API secrets in the React app.
- Authenticate credentials server-side in Strapi.
- Issue a short-lived custom admin session/token after login.
- Validate the session/token on every `admin-ui` request.
- Support logout by clearing the client token/cookie and invalidating server state if sessions are stored server-side.
- Keep a single authorization level for the first version: any valid Strapi admin user can use the custom admin.

Future extension:

- Map Strapi admin roles to custom admin module permissions if needed.

## Error Handling

Frontend behavior:

- Wrong credentials: show "Email hoặc mật khẩu không đúng".
- Expired session: redirect to login with a short notice.
- Lost Strapi connection: show a top-level connection banner.
- Validation errors: highlight fields and show clear Vietnamese messages.
- Upload errors: show file type, size, or Cloudinary failure information when available.
- Delete actions: require confirmation.

Backend behavior:

- Return consistent JSON errors.
- Log server-side details.
- Do not leak secrets, stack traces, or internal Strapi implementation details to the frontend.

## Testing And Verification

Backend:

- Login success and failure.
- Session `me`.
- Logout.
- Resource list/create/update/delete for representative modules.
- Publish/unpublish for draft-enabled modules.
- Cloudinary upload/list/delete using mock or safe test configuration.
- Whitelist enforcement for unknown resource types.

Frontend:

- Build React app.
- Login flow.
- Route guard behavior.
- Dashboard renders from API data.
- Create/edit/publish news article.
- Create/edit product with image and specs.
- Create/edit project with image.
- Upload and select Cloudinary image.
- Update website settings.
- Change inquiry/order status.

Manual browser verification:

- Start Strapi.
- Start or serve the public website with `/admin`.
- Login with a Strapi admin account.
- Create a news article with Cloudinary image.
- Confirm public website reads and displays the new content.

## Rollout Plan

1. Build backend `admin-ui` API and auth bridge in Strapi.
2. Add Cloudinary configuration and media service.
3. Scaffold React/Vite admin app.
4. Implement login and shell layout.
5. Implement reusable resource list/form framework.
6. Implement modules in priority order:
   - Dashboard
   - Media library
   - News
   - Products
   - Projects
   - Homepage
   - Services
   - Pricing
   - Contact inquiries
   - Order requests
   - Site settings
7. Verify end to end.
8. Document environment variables and deployment steps.

## Implementation Defaults

- Store the custom admin session in an HTTP-only cookie because the admin is planned for same-domain deployment.
- Add a Cloudinary URL field for projects and keep the existing `project.image` media field during transition. Public-site rendering should prefer the Cloudinary URL when present and fall back to the existing media field.
- Use a React rich text editor with a small integration surface and HTML/Markdown output that Strapi can store in the current `richtext` field.
- Before deleting Cloudinary media, check known content fields for references. If a reference exists, block deletion and show where the image is used.
