const FRONTEND_URL = 'https://smadesign.vn';

const PREVIEW_TYPE_MAP = {
  'api::hero-slide.hero-slide': 'hero-slide',
  'api::service.service': 'service',
  'api::workflow-step.workflow-step': 'workflow-step',
  'api::site-setting.site-setting': 'site-setting',
  'api::product.product': 'product',
  'api::project.project': 'project',
  'api::news.news': 'news',
  'api::ore.ore': 'product',
  'api::pricing-package.pricing-package': 'pricing-package',
};

module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
    docLinks: env.bool('FLAG_DOC_LINKS', true),
  },
  preview: {
    enabled: true,
    config: {
      allowedOrigins: [FRONTEND_URL],
      async handler(uid, { documentId, locale, status }) {
        const type = PREVIEW_TYPE_MAP[uid];
        if (!type) return null;
        const params = new URLSearchParams({ type });
        if (documentId) params.set('documentId', documentId);
        return `${FRONTEND_URL}/preview.html?${params.toString()}`;
      },
    },
  },
});
