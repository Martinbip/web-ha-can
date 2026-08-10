// Uploads a tiny fixture image to Cloudinary via the admin UI, verifies it
// shows up in the library, then always deletes it — even on assertion
// failure — so production Cloudinary storage never accumulates test images.
//
// Safety: the folder used may already contain real production images, so
// this test never assumes "the first card" is the one it uploaded. It reads
// the exact public_id back from the upload API response and only ever
// targets that specific card for deletion.
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, skipIfNoAdminCredentials } = require('./helpers/admin');

test.describe('Admin — Thư viện ảnh (upload/xóa)', () => {
  test('upload ảnh test vào thư mục dha/settings rồi xóa lại đúng ảnh đó', async ({ page }) => {
    skipIfNoAdminCredentials(test);

    await loginAsAdmin(page);
    await page.goto('/admin/media');
    await expect(page.getByRole('heading', { name: 'Thư viện ảnh' })).toBeVisible();

    // dha/settings is the least likely folder to hold real content images.
    await page.locator('select').selectOption('dha/settings');

    const fixture = path.join(__dirname, 'fixtures', 'test-image.png');
    await page.getByLabel('Chọn ảnh').setInputFiles(fixture);

    const [uploadResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/media/upload') && res.request().method() === 'POST'),
      page.getByRole('button', { name: /Tải ảnh lên/ }).click(),
    ]);
    expect(uploadResponse.ok()).toBeTruthy();
    const { data: uploadedAsset } = await uploadResponse.json();
    const publicId = uploadedAsset.public_id;
    expect(publicId).toBeTruthy();

    let deleted = false;
    try {
      await expect(page.locator('.form-notice')).toHaveText('Tải ảnh lên thành công.');

      const card = page.locator('.media-card', { has: page.locator(`[title="${publicId}"]`) });
      await expect(card).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await card.getByRole('button', { name: 'Xóa' }).click();
      await expect(page.locator('.form-notice')).toHaveText('Đã xóa ảnh.');
      deleted = true;
    } finally {
      if (!deleted) {
        // Assertion above the delete click failed before we could confirm
        // cleanup through the UI — fall back to the delete endpoint
        // directly. Swallow errors here so a redundant/failed cleanup call
        // never masks the real assertion failure that got us into this
        // branch (a throw inside `finally` replaces the original error).
        try {
          await page.request.delete(`/api/admin-ui/media/${encodeURIComponent(publicId)}`);
        } catch {
          // best-effort cleanup only
        }
      }
    }
  });
});
