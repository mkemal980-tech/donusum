import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { managementDashboard, managementDetails, managementRows, managementUnits } from "../test-fixtures/unit-management";
import { buildUnitManagementReportHtml, unitManagementReportTables } from "../lib/unit-management-report";

async function mockApis(page: Page, { role = "UNIT_MANAGER", denied = false, empty = false } = {}) {
  const units = structuredClone(managementUnits);
  const actions: { path: string; body: Record<string, unknown> }[] = [];
  let reads = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path === "/api/auth/session") return route.fulfill({ json: { user: { id: "manager", name: "Birim Yöneticisi", email: "manager@example.com", role, unitId: null }, expires: "2099-01-01T00:00:00Z" } });
    if (path === "/api/unit-manager/management" && request.method() === "PATCH") {
      const body = request.postDataJSON(); actions.push({ path, body });
      const unit = units.find(unit => unit.id === body.unitId)!; unit.employeeCount = body.employeeCount;
      return route.fulfill({ json: { id: unit.id, employeeCount: unit.employeeCount } });
    }
    if (path === "/api/html2pdf") { actions.push({ path, body: request.postDataJSON() }); return route.fulfill({ contentType: "application/pdf", body: Buffer.from("%PDF-1.4 management report") }); }
    if (path === "/api/unit-manager/management" || path === "/api/unit-manager/management/export") {
      reads++;
      if (denied) return route.fulfill({ status: 403, json: { error: "Bu birime erişiminiz yok." } });
      const data = managementDashboard({ unitId: url.searchParams.get("unitId") ?? "root", basis: url.searchParams.get("basis") === "submitted" ? "submitted" : "answered", includeDescendants: url.searchParams.get("includeDescendants") !== "false", empty, units });
      if (path.endsWith("/export")) {
        if (url.searchParams.get("format") === "html") return route.fulfill({ contentType: "text/html", body: buildUnitManagementReportHtml(data) });
        const workbook = XLSX.utils.book_new();
        for (const [name, rows] of Object.entries(unitManagementReportTables(data))) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
        return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
      }
      return route.fulfill({ json: data });
    }
    if (path === "/api/unit-manager/team") return route.fulfill({ json: { units: units.map(unit => ({ ...unit, assessmentCount: managementRows.filter(row => row.unitId === unit.id).length })), assessments: managementRows, hasAnonymousCampaigns: false } });
    if (path === "/api/unit-manager/dashboard") return route.fulfill({ json: managementDetails().find(detail => detail.assessment.id === url.searchParams.get("assessmentId")) });
    if (path === "/api/admin/units") {
      const unit = (id: string) => ({ ...units.find(unit => unit.id === id), organization: null, admins: [], users: [], subUnits: [], _count: { users: 0, subUnits: 0 } });
      return route.fulfill({ json: [{ ...unit("root"), subUnits: [unit("unit-a"), unit("unit-b")], _count: { users: 0, subUnits: 2 } }] });
    }
    if (path === "/api/admin/users" || path === "/api/survey/assigned") return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return { actions, reads: () => reads };
}

test("demo yönetici ekranının alt bölümleri birim yöneticisine gerçek veri sözleşmesiyle açılır", async ({ page }, testInfo) => {
  await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  await expect(page.getByRole("heading", { name: "Birim yönetici alanı" })).toBeVisible();
  for (const title of ["Katılım durumu", "E–S–G değerlendirmesi", "Yanıtların gelişimi", "Olgunluk dağılımı", "Ironman analizi", "Sürdürülebilirlik başlıkları", "Şirket ölçeğine göre", "Sektör karşılaştırması", "Öneri portföyü", "Yönetici içgörüleri", "Birim değerlendirmeleri"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Çevresel, sosyal ve yönetişim sonuçları ile sektör kıyasları")).toBeVisible();
  await expect(page.getByRole("img", { name: /Ironman kadranı: Demir Adam/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo yönetici", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("birim-yonetici-alani.png"), fullPage: true });
  await page.getByLabel("Öneri türüne göre filtrele").selectOption("QUICK_WIN");
  await expect(page.getByRole("cell", { name: "Enerji izleme planı" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Atık azaltma projesi" })).toHaveCount(0);
});
test("kök ve alt birim sonuçları ile taslak ve gönderilmiş kapsam ayrılır", async ({ page }) => {
  await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  const metric = page.getByText("Ortalama olgunluk", { exact: true }).locator("..");
  await expect(metric.getByText("%70,0", { exact: true })).toBeVisible();
  await page.getByLabel("Sonuç kapsamı", { exact: true }).selectOption("submitted");
  await expect(metric.getByText("%80,0", { exact: true })).toBeVisible();
  await page.getByLabel("Birim", { exact: true }).selectOption("unit-b");
  await expect(metric.getByText("—", { exact: true })).toBeVisible();
  await page.getByLabel("Sonuç kapsamı", { exact: true }).selectOption("answered");
  await expect(metric.getByText("%60,0", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Birim", { exact: true })).toHaveValue("unit-b");
  await page.getByLabel("Birim", { exact: true }).selectOption("root");
  await page.getByLabel("Alt birimler dahil").uncheck();
  await expect(metric.getByText("—", { exact: true })).toBeVisible();
});
test("kuruluş profili seçili birime çalışan sayısını kaydeder", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  await page.getByRole("button", { name: "Kuruluş profili", exact: true }).click();
  await page.getByLabel("Profili düzenlenecek birim").selectOption("unit-c");
  await page.getByLabel("Çalışan sayısı", { exact: true }).fill("55");
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect.poll(() => api.actions[0]?.body).toEqual({ unitId: "unit-c", employeeCount: 55 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const scale = page.locator("section").filter({ has: page.getByRole("heading", { name: "Şirket ölçeğine göre", exact: true }) });
  await expect(scale.getByText("Orta (50–249)", { exact: true })).toBeVisible();
  await expect(scale.getByText("Orta (50–249)", { exact: true }).locator("../..").getByText("1 birim · 0 sonuç", { exact: true })).toBeVisible();
});
test("Excel ve PDF raporu alt analizleri ve seçili birimi taşır", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/unit-manager/management?unitId=unit-a");
  const excel = page.waitForEvent("download"); await page.getByRole("button", { name: "Excel", exact: true }).click();
  const file = await excel; const workbook = XLSX.read(await readFile((await file.path())!), { type: "buffer" });
  expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Ironman", "Şirket ölçeği", "Sektörler", "Öneriler", "İçgörüler"]));
  expect(workbook.Sheets["Özet"].B2.v).toBe("Üretim birimi");
  const pdf = page.waitForEvent("download"); await page.getByRole("button", { name: "PDF raporu", exact: true }).click(); await pdf;
  expect(api.actions.find(action => action.path === "/api/html2pdf")?.body.html).toContain("Öneri durumları");
});
test("ana admin birim listesindeki her birimden yönetici alanına girer", async ({ page }) => {
  await mockApis(page, { role: "ADMIN" });
  await page.goto("/admin/units");
  await page.getByRole("button", { name: "Alt birimleri göster: Dönüşüm birimi" }).click();
  await expect(page.getByRole("link", { name: "Dönüşüm birimi yönetici alanı" })).toBeVisible();
  await page.getByRole("link", { name: "Üretim birimi yönetici alanı" }).click();
  await expect(page).toHaveURL(/unitId=unit-a/);
  await expect(page.getByRole("heading", { name: "Birim yönetici alanı" })).toBeVisible();
});
test("birim panosunun yönetici alanı bağlantısı birim ve dönemi korur", async ({ page }) => {
  await mockApis(page);
  await page.goto("/dashboard?unitId=unit-a&surveyId=survey-1&assessmentId=assessment-a");
  await page.getByRole("link", { name: "Yönetici alanı", exact: true }).click();
  await expect(page).toHaveURL(/unitId=unit-a.*surveyId=survey-1.*periodId=period-2026/);
  await expect(page.getByLabel("Birim", { exact: true })).toHaveValue("unit-a");
});
test("boş birim bütün analiz başlıklarını boş durumla gösterir", async ({ page }) => {
  await mockApis(page, { empty: true });
  await page.goto("/unit-manager/management?unitId=unit-c");
  await expect(page.getByRole("heading", { name: "Ironman analizi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Öneri portföyü" })).toBeVisible();
  await expect(page.getByText("Bu birim ve dönemde atanmış değerlendirme yok.")).toBeVisible();
  await expect(page.getByText("2.000", { exact: true })).toHaveCount(0);
});
test("yetkisiz birimde rapor ve analiz gösterilmez", async ({ page }) => {
  await mockApis(page, { denied: true });
  await page.goto("/unit-manager/management?unitId=outside");
  await expect(page.getByText("Bu birime erişiminiz yok.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Öneri portföyü" })).toHaveCount(0);
});
test("normal kullanıcı yönetici alanına erişemez", async ({ page }) => {
  const api = await mockApis(page, { role: "USER" });
  await page.goto("/unit-manager/management");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(api.reads()).toBe(0);
});
