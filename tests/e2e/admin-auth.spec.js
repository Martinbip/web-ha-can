const { test, expect } = require('@playwright/test');
const { loginAsAdmin, skipIfNoAdminCredentials } = require('./helpers/admin');

test.describe('Admin — đăng nhập', () => {
  test('trang đăng nhập hiển thị đúng', async ({ page }) => {
    await page.goto('/admin/');
    await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mật khẩu')).toBeVisible();
  });

  test('sai mật khẩu báo lỗi rõ ràng, không crash trang', async ({ page }) => {
    await page.goto('/admin/');
    await page.getByLabel('Email').fill('khong-ton-tai@example.com');
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau-chac-chan');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.locator('.form-error')).toBeVisible();
  });

  test('đăng nhập đúng thì vào được dashboard, đăng xuất quay lại trang login', async ({ page }) => {
    skipIfNoAdminCredentials(test);
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
  });
});
