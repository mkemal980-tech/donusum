import { expect, test, type Page } from "@playwright/test";
import { personalAssessmentView, personalRow } from "../test-fixtures/unit-dashboard";

async function mockApis(page: Page, { empty = false } = {}) {
  const actions: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === "POST") {
      actions.push({ path, body: request.postDataJSON() });
      if (path === "/api/roadmap/generate") return route.fulfill({ json: { categoryCount: 1, selectedCount: 2, addedCount: 2, scheduledCount: 0, preservedCount: 0, selections: [] } });
      if (path === "/api/assessment/submission") return route.fulfill({ json: { success: true, status: "SUBMITTED", submittedAt: "2026-10-21T09:00:00Z" } });
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/auth/session") return route.fulfill({ json: { user: { id: "owner-1", email: "bora@example.com", firstName: "Bora", role: "USER", unitId: null }, expires: "2099-01-01T00:00:00Z" } });
    if (path === "/api/dashboard/assessments") return route.fulfill({ json: empty ? { role: "owner", units: [], assessments: [], hasAnonymousCampaigns: false } : {
      role: "owner", hasAnonymousCampaigns: false,
      units: [{ id: "self", name: "Bora Danışmanlık", description: null, parentId: null, assessmentCount: 2 }],
      assessments: [personalRow(), { ...personalRow("pending:self:survey-2", "survey-2", "İklim anketi"), assessmentId: null, status: "NOT_STARTED", responseCount: 0, score: null, maturityScore: null }],
    } });
    if (path === "/api/dashboard/assessment") return route.fulfill({ json: personalAssessmentView() });
    if (path === "/api/dashboard/assessment/group-comparison") return route.fulfill({ json: { available: false, reason: "NO_GROUP", groupName: null } });
    return route.fulfill({ json: {} });
  });
  return actions;
}

test("birimi olmayan kullanıcı kendi sonucunu tek panoda görür, planlar ve gönderir", async ({ page }, testInfo) => {
  const actions = await mockApis(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Değerlendirme sonucu" })).toBeVisible();
  await expect(page.getByLabel("Kuruluş", { exact: true })).toHaveValue("self");
  await expect(page.getByRole("heading", { name: "Bora Danışmanlık", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Ekip ve görevler|Görevlerim/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Görev dağılımı" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excel", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("kisisel-pano.png"), fullPage: true });

  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Kategori analizi" }) }).first().getByRole("button", { name: "Yol haritasına ekle" }).click();
  await expect.poll(() => actions.find(action => action.path === "/api/dashboard/assessment/roadmap")?.body).toEqual({ assessmentId: "personal-1", recommendationId: "rec-1", status: "PLANNED" });

  await page.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(page.getByText("Gönderimden sonra cevapları değiştirmek için değerlendirmeyi yeniden açmanız gerekir.")).toBeVisible();
  await page.getByRole("button", { name: "Gönder ve kesinleştir" }).click();
  await expect.poll(() => actions.find(action => action.path === "/api/assessment/submission")?.body).toEqual({ surveyId: "survey-1", action: "submit" });

  await page.getByRole("tab", { name: "Yol haritası", exact: true }).click();
  await expect(page.getByRole("article").filter({ hasText: "Atık azaltma projesi" }).getByRole("button", { name: "Planı kaydet" })).toBeVisible();
  await page.getByRole("button", { name: "Yapay zekâ ile plan oluştur" }).click();
  await expect(page.getByText("2 öneri yol haritasına eklendi, 0 iş zamanlandı.")).toBeVisible();
  expect(actions.find(action => action.path === "/api/roadmap/generate")?.body).toEqual({ assessmentId: "personal-1" });
});

test("atanmış ama başlanmamış anket ilk cevaba kadar ankete yönlendirir", async ({ page }) => {
  await mockApis(page);
  await page.goto("/dashboard");
  await page.getByLabel("Anket", { exact: true }).selectOption("survey-2");
  await expect(page.getByText("Anket size atanmış, henüz başlanmamış")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ankete başla" })).toHaveAttribute("href", "/survey");
});

test("anketi olmayan kullanıcı boş durumu görür", async ({ page }) => {
  await mockApis(page, { empty: true });
  await page.goto("/dashboard");
  await expect(page.getByText("Size henüz anket atanmadı")).toBeVisible();
});
