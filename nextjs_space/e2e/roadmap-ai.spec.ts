import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
    user: { name: "Test Kullanıcı", email: "roadmap@example.com", role: "USER" },
    expires: "2099-01-01T00:00:00.000Z",
  } }));
});

test("AI butonu bekleme durumunu gösterir ve oluşan planı takvimde açar", async ({ page }, testInfo) => {
  let generated = false;
  let calls = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const recommendation = {
    id: "ai-rec", title: "Enerji yönetim sistemini kurun", timeframe: "LONG_TERM",
    strategicType: "PROJECT", estimatedImpact: 8, points: 0.5,
  };
  await page.route("**/api/roadmap", (route) => route.fulfill({ json: {
    items: generated ? [{
      id: "item-1", recommendationId: recommendation.id, status: "NOT_STARTED",
      plannedQuarter: 2, plannedYear: 2028, recommendation, canUpdateStatus: true,
    }] : [],
    permissions: { canManage: true },
    summary: null,
  } }));
  await page.route("**/api/roadmap/generate", async (route) => {
    calls++;
    await waiting;
    generated = true;
    await route.fulfill({ json: {
      categoryCount: 1, selectedCount: 1, addedCount: 1, scheduledCount: 0, preservedCount: 0,
      selections: [{
        recommendationId: recommendation.id, title: recommendation.title,
        subCategoryId: "energy", subCategoryName: "Enerji", assessmentId: "assessment-1",
        plannedQuarter: 2, plannedYear: 2028, priority: 1,
        reason: "Yüksek etkili sistem kurulumu için hazırlık süresi gerekir.",
      }],
    } });
  });

  await page.goto("/roadmap");
  const button = page.getByRole("button", { name: "AI ile yol haritası oluştur" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole("button", { name: "Yol haritası oluşturuluyor…" })).toBeDisabled();
  await expect(page.getByText(/Önerilerin etkisi, maliyeti/)).toBeVisible();
  release();
  await expect(button).toBeEnabled();
  await expect(page.getByText("1 alt kategoriden 1 öneri seçildi.", { exact: false })).toBeVisible();
  await expect(page.getByText("Ç2 2028", { exact: true })).toBeVisible();
  await page.getByText("Seçilen öneriler ve gerekçeleri").click();
  await expect(page.getByText("Yüksek etkili sistem kurulumu için hazırlık süresi gerekir.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("roadmap-ai.png"), fullPage: true });
  expect(calls).toBe(1);
});

test("AI başarısız olduğunda hatayı gösterir ve yeniden denemeye izin verir", async ({ page }) => {
  await page.route("**/api/roadmap", (route) => route.fulfill({ json: { items: [], permissions: { canManage: true }, summary: null } }));
  await page.route("**/api/roadmap/generate", (route) => route.fulfill({
    status: 503, json: { error: "AI hizmeti şu anda kullanılamıyor." },
  }));
  await page.goto("/roadmap");
  const button = page.getByRole("button", { name: "AI ile yol haritası oluştur" });
  await button.click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("AI hizmeti şu anda kullanılamıyor.");
  await expect(button).toBeEnabled();
  await expect(page.getByText("Yol haritası boş", { exact: true })).toBeVisible();
});
