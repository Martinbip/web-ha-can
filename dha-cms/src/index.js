'use strict';

const path = require('path');
const fs = require('fs');

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    console.log('--- CMS Bootstrapping: Seeding initial data if empty ---');

    // Helper: seed a collection type from a JSON file if the collection is empty
    const seedCollection = async (uid, filename, mapFn = (d) => d) => {
      try {
        const count = await strapi.db.query(uid).count();
        if (count === 0) {
          console.log(`Seeding collection: ${uid}`);
          const filePath = path.join(__dirname, '..', '..', 'data', filename);
          if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            for (const item of data) {
              await strapi.db.query(uid).create({
                data: { ...mapFn(item), publishedAt: new Date() }
              });
            }
            console.log(`Seeded ${data.length} items for ${uid}`);
          }
        }
      } catch (err) {
        console.error(`Error seeding ${uid}:`, err);
      }
    };

    // Helper: seed a single type from a JSON file if it doesn't exist yet
    const seedSingleType = async (uid, filename, mapFn = (d) => d) => {
      try {
        const existing = await strapi.db.query(uid).findOne({});
        if (!existing) {
          console.log(`Seeding single type: ${uid}`);
          const filePath = path.join(__dirname, '..', '..', 'data', filename);
          if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            await strapi.db.query(uid).create({ data: mapFn(data) });
            console.log(`Seeded single type ${uid}`);
          }
        }
      } catch (err) {
        console.error(`Error seeding single type ${uid}:`, err);
      }
    };

    // --- Seed Collection Types ---
    await seedCollection('api::ore.ore', 'ores.json', (item) => ({
      uid: item.uid,
      name: item.name,
      group: item.group,
      price: item.price,
    }));

    await seedCollection('api::pricing-package.pricing-package', 'pricing_packages.json', (item) => ({
      title: item.title,
      price: item.price,
      unit: item.unit,
      description: item.description,
      specs: item.specs,
      popular: item.popular,
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

    // --- Seed Single Types ---
    await seedSingleType('api::site-setting.site-setting', 'site_setting.json');

    // --- Grant Public Permissions ---
    try {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      if (publicRole) {
        console.log('--- Granting public permissions ---');

        const actions = [
          // Read access for display content types
          'api::project.project.find',
          'api::project.project.findOne',
          'api::ore.ore.find',
          'api::ore.ore.findOne',
          'api::pricing-package.pricing-package.find',
          'api::pricing-package.pricing-package.findOne',
          'api::pricing-analysis.pricing-analysis.find',
          'api::pricing-analysis.pricing-analysis.findOne',
          'api::pricing-survey.pricing-survey.find',
          'api::pricing-survey.pricing-survey.findOne',
          // Read access for site settings (public info: phone, address, socials)
          'api::site-setting.site-setting.find',
          // Read access for product catalog
          'api::product.product.find',
          'api::product.product.findOne',
          // Write access for contact form submissions (create only — no read for public)
          'api::contact-inquiry.contact-inquiry.create',
          // Write access for product order requests (create only)
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
      console.error('Error granting public permissions:', err);
    }

    console.log('--- CMS Bootstrapping Complete ---');
  },
};
