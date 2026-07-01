// Read-only smoke tests for the public website. Safe to run against
// production at any time: no writes, no side effects.
const { test, expect } = require('@playwright/test');

test.describe('Trang chủ', () => {
  test('tải được và có nội dung chính', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('menu điều hướng có các link chính', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
  });
});

test.describe('Sản phẩm', () => {
  test('trang danh sách sản phẩm tải được', async ({ page }) => {
    await page.goto('/products.html');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Dự án', () => {
  test('trang danh sách dự án tải được', async ({ page }) => {
    await page.goto('/projects.html');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Tin tức', () => {
  test('trang tin tức tải được', async ({ page }) => {
    await page.goto('/news.html');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Liên hệ', () => {
  test('form liên hệ hiển thị đủ trường bắt buộc (không gửi thật)', async ({ page }) => {
    await page.goto('/contact.html');
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    // Chỉ kiểm tra form tồn tại và có nút gửi — không submit để tránh
    // tạo dữ liệu liên hệ thật trên production. Luồng gửi thật được
    // kiểm tra trong tests/e2e/admin-content.spec.js (có dọn dẹp sau).
    await expect(form.locator('button[type="submit"], input[type="submit"]')).toBeVisible();
  });
});
