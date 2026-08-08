import { test, expect } from "@playwright/test";

/**
 * Kimlik doğrulaması gerektirmeyen duman (smoke) testleri.
 * Tarayıcı kurulumundan sonra `npm run test:e2e` ile çalışır.
 */

test("ana sayfa yüklenir ve panoya çağrı bağlantısı görünür", async ({ page }) => {
  await page.goto("/");
  // Açılış sayfasında ayrı bir "Giriş" bağlantısı yok; bütün çağrılar panoya
  // gider ve oturumsuz kullanıcıyı /dashboard'ın kendisi /login'e yönlendirir.
  await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
});

test("giriş sayfası e-posta ve şifre alanları içerir", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
});

test("korumalı API kimlik doğrulamasız 401 döner", async ({ request }) => {
  // Faz 2'de withAuth'a taşınan uç noktalar oturumsuz erişimde 401 vermeli
  const res = await request.get("/api/survey/structure");
  expect([401, 403]).toContain(res.status());
});
