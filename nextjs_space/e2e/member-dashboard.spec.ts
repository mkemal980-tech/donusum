import { expect, test, type Page } from "@playwright/test";
import { memberAssessmentView, unitRow } from "../test-fixtures/unit-dashboard";
import { buildUnitReportHtml } from "../lib/unit-dashboard-report";

async function mockApis(page: Page) {
  const actions: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === "POST") {
      actions.push({ path, body: request.postDataJSON() });
      if (path === "/api/html2pdf") return route.fulfill({ contentType: "application/pdf", body: Buffer.from("%PDF-1.4 member report") });
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/auth/session") return route.fulfill({ json: { user: { id: "member-1", email: "member@example.com", firstName: "Ayşe", role: "USER", unitId: "managed-unit" }, expires: "2099-01-01T00:00:00Z" } });
    if (path === "/api/dashboard/assessments") return route.fulfill({ json: { role: "member", hasAnonymousCampaigns: false, assessments: [unitRow()],
      units: [{ id: "managed-unit", name: "Esra'nın birimi", description: null, parentId: "root", assessmentCount: 1 }] } });
    if (path === "/api/dashboard/assessment") return route.fulfill({ json: memberAssessmentView() });
    if (path === "/api/dashboard/assessment/group-comparison") return route.fulfill({ json: { available: true, groupName: "Ege Sanayi Odası", count: 6,
      overall: { mine: 40, average: 45.5, difference: -5.5 }, categories: [{ id: "category-1", name: "Çevresel dönüşüm", mine: 40, average: 45.5, difference: -5.5 }], band: { value: 60, width: 50 } } });
    if (path === "/api/dashboard/assessment/documents") return route.fulfill({ json: [] });
    if (path === "/api/dashboard/assessment/export") return route.fulfill({ contentType: "text/html", body: buildUnitReportHtml(memberAssessmentView()) });
    return route.fulfill({ json: {} });
  });
  return actions;
}

test("birime bağlı çalışan biriminin sonucunu görür; planlama ve ekip ayrıntısı kapalıdır", async ({ page }, testInfo) => {
  await mockApis(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Değerlendirme sonucu" })).toBeVisible();
  await expect(page.locator("p.t-label").getByText("Ege Sanayi Odası içinde", { exact: true }).locator("..")).toContainText("Birim ortalaması %45,5");
  await expect(page.getByRole("link", { name: "Ankete git" }).first()).toBeVisible();
  for (const name of ["Excel", "Görev dağılımı", "Birim yönetimi", "Kendi değerlendirmem", "Yol haritasına ekle"]) await expect(page.getByRole("button", { name, exact: true }).or(page.getByRole("link", { name, exact: true }))).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Birim değerlendirmeleri" })).toHaveCount(0);
  const work = page.getByRole("region", { name: "Size düşen işler" });
  await expect(work).toContainText("Enerji yönetimi bölümünde belge eksik");
  await expect(work).not.toContainText("Atık yönetimi için sorumlu seçin");
  await expect(page.getByText("Bu bölüm başka bir ekip üyesine atanmış; cevapları onun görünümünde.")).toBeVisible();
  await expect(page.getByLabel("Ana gezinme").getByRole("link", { name: "Öneriler" })).toHaveAttribute("href", /^\/dashboard\?.*tab=recommendations/);
  await page.screenshot({ path: testInfo.outputPath("uye-panosu.png"), fullPage: true });
  await page.getByRole("tab", { name: "Görevlerim" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Ayşe Üye" })).toBeVisible();
  await page.getByRole("tab", { name: "Cevaplar" }).click();
  await page.locator("summary").filter({ hasText: "Çevresel dönüşüm" }).click();
  await expect(page.getByText("başka bir ekip üyesine atanmış; cevapları onun görünümünde")).toBeVisible();
  await expect(page.getByText("Atık miktarı izleniyor mu?")).toHaveCount(0);
});

test("çalışan yalnızca kendisine düşen işin durumunu günceller; plan alanları yoktur", async ({ page }) => {
  const actions = await mockApis(page);
  await page.goto("/dashboard?unitId=managed-unit&surveyId=survey-1&assessmentId=assessment-1&tab=roadmap");
  const card = page.getByRole("article").filter({ hasText: "Atık azaltma projesi" });
  await expect(card.getByRole("button", { name: "Planı kaydet" })).toHaveCount(0);
  await expect(card).toContainText("Sorumlu: Atanmamış");
  await card.getByLabel("Atık azaltma projesi durumu").selectOption("IN_PROGRESS");
  await expect.poll(() => actions.find(action => action.path === "/api/dashboard/assessment/roadmap")?.body).toEqual({ assessmentId: "assessment-1", recommendationId: "rec-2", status: "IN_PROGRESS" });
  await page.getByRole("tab", { name: "Öneriler" }).click();
  await expect(page.getByRole("article").filter({ hasText: "Enerji izleme planı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yol haritasına ekle" })).toHaveCount(0);
});

test("çalışan PDF raporunu alır", async ({ page }) => {
  const actions = await mockApis(page);
  await page.goto("/dashboard");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF raporu", exact: true }).click();
  await download;
  expect(actions.find(action => action.path === "/api/html2pdf")?.body.html).toContain("2026 dönemi");
});
