// Full create -> verify -> delete cycle against a real content type (news).
// Runs only when admin credentials are configured, and always attempts to
// delete the test record it created — even if an assertion above it fails —
// so production never accumulates leftover [E2E TEST] articles.
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, skipIfNoAdminCredentials } = require('./helpers/admin');

test.describe('Admin — quản lý Tin tức (tạo/sửa/xóa)', () => {
  test('tạo bài viết test, xác nhận hiển thị trong danh sách, rồi xóa', async ({ page }) => {
    skipIfNoAdminCredentials(test);

    const stamp = Date.now();
    const title = `[E2E TEST] ${stamp}`;
    const slug = `e2e-test-${stamp}`;

    await loginAsAdmin(page);

    let created = false;
    try {
      await page.goto('/admin/resources/news');
      await page.getByRole('link', { name: '+ Thêm mới' }).click();
      await expect(page.getByRole('heading', { name: /Thêm Tin tức/ })).toBeVisible();

      await page.getByLabel('Tiêu đề').fill(title);
      await page.getByLabel('Đường dẫn').fill(slug);
      await page.getByLabel('Tóm tắt').fill('Bài viết test tự động — sẽ bị xóa ngay sau khi test chạy xong.');
      await page.getByLabel('Nội dung').fill('<p>Nội dung test tự động bởi Playwright.</p>');
      await page.getByLabel('Danh mục').selectOption({ index: 1 });
      await page.getByLabel('Ngày đăng').fill(new Date().toISOString().slice(0, 10));

      await page.getByRole('button', { name: 'Lưu' }).click();
      await expect(page).toHaveURL(/\/admin\/resources\/news$/);
      created = true;

      await page.getByLabel('Tìm kiếm').fill(title);
      await page.getByRole('button', { name: 'Tìm' }).click();

      const row = page.locator('tr', { hasText: title });
      await expect(row).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await row.getByRole('button', { name: 'Xóa' }).click();
      await expect(page.locator('tr', { hasText: title })).toHaveCount(0);
      created = false;
    } finally {
      if (created) {
        // Something failed before we could confirm the UI-driven delete —
        // fall back to the API directly by slug so no [E2E TEST] article
        // survives the test. Swallowed on purpose: a cleanup failure here
        // must never replace/mask the real assertion error above.
        try {
          const search = await page.request.get(
            `/api/admin-ui/resources/news?search=${encodeURIComponent(slug)}`
          );
          const { data } = await search.json();
          for (const article of data || []) {
            await page.request.delete(`/api/admin-ui/resources/news/${article.documentId}`);
          }
        } catch {
          // best-effort cleanup only
        }
      }
    }
  });
});
