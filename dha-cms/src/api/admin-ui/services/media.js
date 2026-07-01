'use strict';

const cloudinary = require('cloudinary').v2;
const auth = require('./auth');
const { RESOURCE_CONFIG } = require('./resource-config');
const { sendError } = require('./errors');

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function normalizeAsset(asset) {
  return {
    public_id: asset.public_id,
    secure_url: asset.secure_url,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    bytes: asset.bytes,
    created_at: asset.created_at,
    folder: asset.folder,
  };
}

async function list(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  configureCloudinary();

  const prefix = String(ctx.query.prefix || 'ha-can/').replace(/^\/+/, '');
  const result = await cloudinary.api.resources({
    resource_type: 'image',
    type: 'upload',
    prefix,
    max_results: Math.min(Number(ctx.query.limit || 30), 100),
    next_cursor: ctx.query.cursor || undefined,
    direction: 'desc',
  });

  ctx.body = {
    data: result.resources.map(normalizeAsset),
    next_cursor: result.next_cursor || null,
  };
}

async function upload(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  if (!auth.requireTrustedOrigin(ctx)) return;
  configureCloudinary();

  const file = ctx.request.files && ctx.request.files.file;
  if (!file) {
    return sendError(ctx, 400, 'NO_FILE', 'Vui lòng chọn ảnh để tải lên.');
  }

  const folder = String(ctx.request.body.folder || 'ha-can/uploads').replace(/^\/+/, '');
  if (!folder.startsWith('ha-can/')) {
    return sendError(ctx, 400, 'INVALID_FOLDER', 'Thư mục ảnh không hợp lệ.');
  }

  const result = await cloudinary.uploader.upload(file.filepath || file.path, {
    resource_type: 'image',
    folder,
    overwrite: false,
    tags: ['ha-can-admin'],
  });

  ctx.body = { data: normalizeAsset(result) };
}

async function findReferences(publicId) {
  const references = [];
  for (const [type, config] of Object.entries(RESOURCE_CONFIG)) {
    const fields = Object.entries(config.fields || {})
      .filter(([, field]) => field.type === 'cloudinary-image' || field.publicIdField)
      .flatMap(([name, field]) => [name, field.publicIdField].filter(Boolean));

    for (const field of fields) {
      const matches = await strapi.documents(config.uid).findMany({
        filters: { [field]: { $contains: publicId } },
        limit: 5,
        publicationState: 'preview',
      });
      for (const match of matches) {
        references.push({
          type,
          label: config.pluralLabel,
          documentId: match.documentId,
          title: match[config.titleField] || match.documentId,
          field,
        });
      }
    }
  }
  return references;
}

async function remove(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  if (!auth.requireTrustedOrigin(ctx)) return;
  configureCloudinary();

  const publicId = decodeURIComponent(ctx.params.publicId || '');
  if (!publicId.startsWith('ha-can/')) {
    return sendError(ctx, 400, 'INVALID_PUBLIC_ID', 'Ảnh không thuộc thư viện của website.');
  }

  const references = await findReferences(publicId);
  if (references.length) {
    return sendError(ctx, 409, 'MEDIA_IN_USE', 'Ảnh này đang được sử dụng.', { references });
  }

  const result = await cloudinary.api.delete_resources([publicId], {
    resource_type: 'image',
    invalidate: true,
  });

  ctx.body = { data: result.deleted || {} };
}

module.exports = {
  list,
  upload,
  delete: remove,
  findReferences,
};
