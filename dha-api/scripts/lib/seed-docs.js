'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { getDefaultNavItems } = require('../../src/defaults/default-items');
const { DEFAULT_CATEGORIES, guessCategories } = require('../../src/defaults/default-categories');

// id cố định theo (type, khoá) để chạy lại `import --replace` cho cùng kết quả.
function stableId(type, key) {
  return crypto.createHash('sha1').update(`${type}:${key}`).digest('hex').slice(0, 24);
}

function getOreGroup(item) {
  if (item.group === 'quang' && (item.uid || '').includes('sat')) return 'black-metal';
  if (item.group === 'rare-earth' || (item.name || '').toLowerCase().includes('đất hiếm')) return 'rare-earth';
  return 'color-metal';
}

function getOreSeedPrice(item) {
  const uid = item.uid || '';
  if (uid.includes('sat')) return 25000;
  if (uid.includes('nhom') || uid.includes('bauxite')) return 35000;
  if (uid.includes('chi')) return 65000;
  if (uid.includes('thiec')) return 120000;
  return 85000;
}

const COLLECTION_SEEDS = [
  {
    type: 'pricingPackage',
    file: 'pricing_packages.json',
    map: (item) => ({ metal: item.metal, lme_price: item.lme_price, domestic_price: item.domestic_price, unit: item.unit, change: item.change, trend: item.trend, updated: item.updated }),
  },
  {
    type: 'pricingAnalysis',
    file: 'pricing_analysis.json',
    map: (item) => ({ name: item.name, tech: item.tech, unit: item.unit, price: item.price, duration: item.duration, category: item.category }),
  },
  {
    type: 'pricingSurvey',
    file: 'pricing_survey.json',
    map: (item) => ({ name: item.name, price: item.price, description: item.description }),
  },
  {
    type: 'project',
    file: 'projects.json',
    map: (item) => ({ name: item.name, location: item.location, scale: item.scale, method: item.method, value: item.value }),
  },
  {
    type: 'product',
    file: 'products.json',
    map: (item) => ({
      uid: item.uid,
      name: item.name,
      group: item.group,
      categories: Array.isArray(item.categories) && item.categories.length ? item.categories : guessCategories(item),
      grade: item.grade,
      origin: item.origin,
      price: item.price,
      description: item.description,
      specs: item.specs,
      image: item.image,
      featured: item.featured,
      in_stock: item.in_stock,
      sort_order: item.sort_order,
    }),
  },
  {
    type: 'news',
    file: 'news.json',
    map: (item) => ({ title: item.title, slug: item.slug, summary: item.summary, content: item.content, category: item.category, date: item.date, image: item.image }),
  },
  {
    type: 'heroSlide',
    file: 'hero_slides.json',
    map: (item) => ({ subtitle: item.subtitle, title: item.title, image_url: item.image_url, image_alt: item.image_alt, sort_order: item.sort_order }),
  },
  {
    type: 'service',
    file: 'services.json',
    map: (item) => ({ title: item.title, description: item.description, features: item.features, icon_svg: item.icon_svg, link_url: item.link_url, link_text: item.link_text, sort_order: item.sort_order }),
  },
  {
    type: 'workflowStep',
    file: 'workflow_steps.json',
    map: (item) => ({ step_number: item.step_number, title: item.title, description: item.description, sort_order: item.sort_order }),
  },
  {
    type: 'ore',
    file: 'products.json',
    map: (item) => ({ uid: item.uid, name: item.name, group: getOreGroup(item), price: item.price || getOreSeedPrice(item) }),
  },
];

function readJson(dataDir, file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
}

function buildSeedDocuments({ dataDir, now = new Date().toISOString() }) {
  const stamps = { createdAt: now, publishedAt: now };
  const docs = [];

  for (const seed of COLLECTION_SEEDS) {
    readJson(dataDir, seed.file).forEach((item, index) => {
      docs.push({ _id: stableId(seed.type, `${seed.file}#${index}`), _type: seed.type, ...seed.map(item), ...stamps });
    });
  }

  for (const category of DEFAULT_CATEGORIES) {
    docs.push({ _id: stableId('productCategory', category.slug), _type: 'productCategory', ...category, ...stamps });
  }

  docs.push({ _id: 'siteSetting', _type: 'siteSetting', ...readJson(dataDir, 'site_setting.json'), ...stamps });
  docs.push({ _id: 'navigation', _type: 'navigation', items: getDefaultNavItems(), ...stamps });

  // JSON.stringify bỏ trường undefined; làm luôn ở đây để docs trong bộ nhớ
  // giống hệt thứ được ghi ra file.
  return docs.map((doc) => JSON.parse(JSON.stringify(doc)));
}

module.exports = { buildSeedDocuments, stableId, COLLECTION_SEEDS };
