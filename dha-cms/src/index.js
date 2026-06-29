'use strict';

const path = require('path');
const fs = require('fs');

function loadJsonFile(filename) {
  const filePath = path.join(__dirname, '..', '..', 'data', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Seed file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    console.log('--- CMS Bootstrapping: Seeding initial data if empty ---');

    const seedCollection = async (uid, filename, mapFn = (d) => d) => {
      try {
        const count = await strapi.db.query(uid).count();
        if (count > 0) return;

        console.log(`Seeding collection: ${uid}`);
        const data = loadJsonFile(filename);
        for (const item of data) {
          await strapi.db.query(uid).create({
            data: { ...mapFn(item), publishedAt: new Date() },
          });
        }
        console.log(`Seeded ${data.length} items for ${uid}`);
      } catch (err) {
        console.error(`Error seeding ${uid}:`, err.message);
      }
    };

    const seedSingleType = async (uid, filename, mapFn = (d) => d) => {
      try {
        const existing = await strapi.db.query(uid).findOne({});
        if (existing) return;

        console.log(`Seeding single type: ${uid}`);
        const data = loadJsonFile(filename);
        await strapi.db.query(uid).create({ data: mapFn(data) });
        console.log(`Seeded single type ${uid}`);
      } catch (err) {
        console.error(`Error seeding single type ${uid}:`, err.message);
      }
    };

    await seedCollection('api::pricing-package.pricing-package', 'pricing_packages.json', (item) => ({
      metal: item.metal,
      lme_price: item.lme_price,
      domestic_price: item.domestic_price,
      unit: item.unit,
      change: item.change,
      trend: item.trend,
      updated: item.updated,
    }));

    await seedCollection('api::pricing-analysis.pricing-analysis', 'pricing_analysis.json', (item) => ({
      name: item.name,
      tech: item.tech,
      unit: item.unit,
      price: item.price,
      duration: item.duration,
      category: item.category,
    }));

    await seedCollection('api::pricing-survey.pricing-survey', 'pricing_survey.json', (item) => ({
      name: item.name,
      price: item.price,
      description: item.description,
    }));

    await seedCollection('api::project.project', 'projects.json', (item) => ({
      name: item.name,
      location: item.location,
      scale: item.scale,
      method: item.method,
      value: item.value,
    }));

    await seedCollection('api::product.product', 'products.json', (item) => ({
      uid: item.uid,
      name: item.name,
      group: item.group,
      grade: item.grade,
      origin: item.origin,
      price: item.price,
      description: item.description,
      specs: item.specs,
      image: item.image,
      featured: item.featured,
      in_stock: item.in_stock,
      sort_order: item.sort_order,
    }));

    await seedCollection('api::news.news', 'news.json', (item) => ({
      title: item.title,
      slug: item.slug,
      summary: item.summary,
      content: item.content,
      category: item.category,
      date: item.date,
      image: item.image,
    }));

    await seedCollection('api::hero-slide.hero-slide', 'hero_slides.json', (item) => ({
      subtitle: item.subtitle,
      title: item.title,
      image_url: item.image_url,
      image_alt: item.image_alt,
      sort_order: item.sort_order,
    }));

    await seedCollection('api::service.service', 'services.json', (item) => ({
      title: item.title,
      description: item.description,
      features: item.features,
      icon_svg: item.icon_svg,
      link_url: item.link_url,
      link_text: item.link_text,
      sort_order: item.sort_order,
    }));

    await seedCollection('api::workflow-step.workflow-step', 'workflow_steps.json', (item) => ({
      step_number: item.step_number,
      title: item.title,
      description: item.description,
      sort_order: item.sort_order,
    }));

    await seedCollection('api::ore.ore', 'products.json', (item) => ({
      uid: item.uid,
      name: item.name,
      group: getOreGroup(item),
      price: item.price || getOreSeedPrice(item),
    }));

    await seedSingleType('api::site-setting.site-setting', 'site_setting.json');

    try {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      if (publicRole) {
        console.log('--- Granting public permissions ---');

        const actions = [
          'api::project.project.find',
          'api::project.project.findOne',
          'api::pricing-package.pricing-package.find',
          'api::pricing-package.pricing-package.findOne',
          'api::pricing-analysis.pricing-analysis.find',
          'api::pricing-analysis.pricing-analysis.findOne',
          'api::pricing-survey.pricing-survey.find',
          'api::pricing-survey.pricing-survey.findOne',
          'api::site-setting.site-setting.find',
          'api::product.product.find',
          'api::product.product.findOne',
          'api::ore.ore.find',
          'api::ore.ore.findOne',
          'api::news.news.find',
          'api::news.news.findOne',
          'api::hero-slide.hero-slide.find',
          'api::hero-slide.hero-slide.findOne',
          'api::service.service.find',
          'api::service.service.findOne',
          'api::workflow-step.workflow-step.find',
          'api::workflow-step.workflow-step.findOne',
          'api::contact-inquiry.contact-inquiry.create',
          'api::order-request.order-request.create',
        ];

        for (const action of actions) {
          const count = await strapi.db.query('plugin::users-permissions.permission').count({
            where: { action, role: publicRole.id },
          });
          if (count === 0) {
            console.log(`Granting: ${action}`);
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: { action, role: publicRole.id, publishedAt: new Date() },
            });
          }
        }

        console.log('--- Public permissions granted ---');
      }
    } catch (err) {
      console.error('Error granting public permissions:', err.message);
    }

    console.log('--- CMS Bootstrapping Complete ---');
  },
};
