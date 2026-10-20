import { test, expect, type Page } from "@playwright/test";

/**
 * Çalışan (birime bağlı, koordinatör olmayan) yol haritasını planlayamaz;
 * yalnızca kendisine düşen işin durumunu günceller (bkz. lib/roadmap-access).
 */
const recommendation = (id: string, title: string) => ({ id, title, timeframe: "SHORT_TERM", strategicType: "QUICK_WIN", estimatedImpact: 7, points: 0.5 });

async function asMember(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
    user: { name: "Ayşe Çalışan", email: "member@example.com", role: "USER" }, expires: "2099-01-01T00:00:00.000Z",
  } }));
  await page.route("**/api/roadmap", (route) => route.fulfill({ json: {
    items: [
      { id: "i1", recommendationId: "mine", status: "PLANNED", plannedQuarter: 1, plannedYear: 2027, recommendation: recommendation("mine", "Enerji ölçümünü başlat"), canUpdateStatus: true },
      { id: "i2", recommendationId: "other", status: "PLANNED", plannedQuarter: 1, plannedYear: 2027, recommendation: recommendation("other", "Atık envanteri çıkar"), canUpdateStatus: false },
    ],
    permissions: { canManage: false },
    summary: null,
  } }));
  await page.route("**/api/survey/assigned", (route) => route.fulfill({ json: [{ id: "survey-1", name: "Sürdürülebilirlik", isActive: true }] }));
  await page.route("**/api/recommendations/completion", (route) => route.fulfill({ json: { completions: [{ recommendationId: "mine", status: "IN_PROGRESS" }] } }));
  await page.route((url) => url.pathname === "/api/recommendations", (route) => route.fulfill({ json: [
    { ...recommendation("mine", "Enerji ölçümünü başlat"), isInRoadmap: true, isActionable: true, canManageRoadmap: false, canUpdateStatus: true },
    { ...recommendation("new", "Su tüketimini izle"), isInRoadmap: false, isActionable: true, canManageRoadmap: false, canUpdateStatus: false },
  ] }));
}

test("çalışan yol haritasında planlama yapamaz, yalnızca kendi işinin durumunu değiştirir", async ({ page }) => {
  await asMember(page);
  await page.goto("/roadmap");
  await expect(page.getByText("Yol haritasını birim yöneticiniz planlar.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI ile yol haritası oluştur" })).toHaveCount(0);
  await expect(page.getByLabel("Enerji ölçümünü başlat durumu")).toBeEnabled();
  await expect(page.getByLabel("Atık envanteri çıkar durumu")).toBeDisabled();
  await expect(page.getByRole("button", { name: /yol haritasından kaldır/ })).toHaveCount(0);
});

test("çalışan öneriler ekranında yol haritasına ekleyemez; yalnızca kendi işinin durumunu açar", async ({ page }) => {
  await asMember(page);
  await page.goto("/recommendations");
  await page.getByRole("tab", { name: "Liste" }).click();
  await expect(page.getByRole("heading", { name: "Su tüketimini izle" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Yol Haritasına Ekle/ })).toHaveCount(0);
  await expect(page.getByText("Yol Haritasında", { exact: true })).toBeVisible();
  await expect(page.getByText("Yol haritasını birim yöneticiniz planlar", { exact: false })).toBeVisible();
  // Kendi işinde durum menüsü açılır; başkasının işinde yalnızca durum etiketi var.
  await expect(page.getByRole("button", { name: "Devam Ediyor", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Başlanmadı", exact: true })).toHaveCount(0);
  await expect(page.locator(".theme-card").filter({ hasText: "Su tüketimini izle" }).getByText("Başlanmadı", { exact: true })).toBeVisible();
});
