const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

function hasAdminCredentials() {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

async function loginAsAdmin(page) {
  if (!hasAdminCredentials()) {
    throw new Error('E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set — call skipIfNoAdminCredentials(test) first.');
  }
  await page.goto('/admin/');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
}

function skipIfNoAdminCredentials(test) {
  test.skip(!hasAdminCredentials(), 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD chưa được cấu hình trong .env.e2e');
}

module.exports = { hasAdminCredentials, loginAsAdmin, skipIfNoAdminCredentials, ADMIN_EMAIL, ADMIN_PASSWORD };
