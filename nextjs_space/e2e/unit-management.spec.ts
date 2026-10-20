import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { managementDashboard, managementDetails, managementRows, managementUnits } from "../test-fixtures/unit-management";
import { assessmentView } from "../test-fixtures/unit-dashboard";
import { buildUnitManagementReportHtml, unitManagementReportTables } from "../lib/unit-management-report";

async function mockApis(page: Page, { role = "UNIT_MANAGER", denied = false, empty = false } = {}) {
  const units = structuredClone(managementUnits);
  const actions: { path: string; body: Record<string, unknown> | null }[] = [];
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
    if (path.endsWith("/remind")) { actions.push({ path, body: null }); return route.fulfill({ json: { success: true, message: "2 kişiye hatırlatma kuyruğa alındı." } }); }
    if (path === "/api/unit-manager/management" || path === "/api/unit-manager/management/export") {
      reads++;
      if (denied) return route.fulfill({ status: 403, json: { error: "Bu birime erişiminiz yok." } });
      const unitId = url.searchParams.get("unitId");
      if (unitId && unitId !== "root") return route.fulfill({ json: { kind: "member", unitId } });
      const data = managementDashboard({ empty, units });
      if (path.endsWith("/export")) {
        if (url.searchParams.get("format") === "html") return route.fulfill({ contentType: "text/html", body: buildUnitManagementReportHtml(data) });
        const workbook = XLSX.utils.book_new();
        for (const [name, rows] of Object.entries(unitManagementReportTables(data))) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
        return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
      }
      return route.fulfill({ json: data });
    }
    if (path === "/api/dashboard/assessments") return route.fulfill({ json: { role: "manager", units: units.map(unit => ({ ...unit, assessmentCount: managementRows.filter(row => row.unitId === unit.id).length })), assessments: managementRows, hasAnonymousCampaigns: false } });
    if (path === "/api/dashboard/assessment") return route.fulfill({ json: assessmentView(managementDetails().find(detail => detail.assessment.id === url.searchParams.get("assessmentId"))) });
    if (path === "/api/dashboard/assessment/group-comparison") return route.fulfill({ json: { available: true, groupName: "Ege Sanayi Odası", count: 6, overall: { mine: 48, average: 55.2, difference: -7.2 },
      categories: [{ id: "category-0", name: "Çevre", mine: 30, average: 44.7, difference: -14.7 }], band: { value: 50, width: 50 } } });
    if (path === "/api/admin/units") {
      const unit = (id: string) => ({ ...units.find(unit => unit.id === id), organization: null, admins: [], users: [], subUnits: [], _count: { users: 0, subUnits: 0 } });
      return route.fulfill({ json: [{ ...unit("root"), subUnits: [unit("unit-a"), unit("unit-b")], _count: { users: 0, subUnits: 2 } }] });
    }
    if (path === "/api/admin/users" || path === "/api/survey/assigned") return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return { actions, reads: () => reads };
}
const panel = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).first();

test("birim yönetimi cevap şeridini ve bütün bölümleri gerçek veri sözleşmesiyle açar", async ({ page }, testInfo) => {
  await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  await expect(page.getByRole("heading", { name: "Birim yönetimi", level: 1 })).toBeVisible();
  for (const title of ["Bulgular", "Katılım", "Kategoriler", "Üyeler", "Ortak gelişim alanları", "Öneri uygulaması", "Dönemler arası değişim", "Ironman analizi"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  const score = page.getByText("Birim puanı", { exact: true }).locator("..");
  await expect(score.getByText("%60,3", { exact: true })).toBeVisible();
  await expect(score.getByText("Önceki döneme göre +3,0 (2 üye) · Sektöre göre +7,0")).toBeVisible();
  await expect(page.getByText("En düşük puanlı kategori", { exact: true }).locator("..").getByText("Çevre")).toBeVisible();
  await expect(page.getByText("Öncelikli eylem", { exact: true }).locator("..").getByText("Karbon envanteri hazırla")).toBeVisible();
  // Taslak puana karışmaz; eski kapsam seçimleri kalktı.
  await expect(page.getByLabel("Sonuç kapsamı")).toHaveCount(0);
  await expect(page.getByLabel("Alt birimler dahil")).toHaveCount(0);
  await expect(page.getByText(/zayıf/i)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("birim-yonetimi.png"), fullPage: true });
});
test("üye tablosu kategoriye göre sıralanır ve sektöre göre gruplanır", async ({ page }) => {
  await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  const table = panel(page, "Üyeler");
  await table.getByRole("button", { name: "Çevre", exact: true }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Akdeniz Tekstil");
  await table.getByRole("button", { name: /^Çevre/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Bora Gıda");
  await expect(table.getByText("birim ortalamasının altında").first()).toBeAttached();
  await table.getByRole("button", { name: "Sektör", exact: true }).click();
  await expect(table.getByRole("columnheader", { name: "İmalat · 3 üye" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Sektör belirtilmedi · 1 üye" })).toBeVisible();
});
test("öneri uygulaması üyeleri ve önerileri farklı açılardan sıralar", async ({ page }) => {
  await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  const roadmap = panel(page, "Öneri uygulaması");
  await roadmap.getByRole("button", { name: "En çok ilerleyen" }).click();
  await expect(roadmap.getByRole("table").first().locator("tbody tr").first()).toContainText("Çınar Metal");
  await expect(roadmap.getByRole("cell", { name: /Karbon envanteri hazırla/ })).toBeVisible();
  await roadmap.getByRole("button", { name: "Takılanlar" }).click();
  await expect(page.getByLabel("Öneriler", { exact: true }).getByRole("cell", { name: /Enerji izleme sistemi kur/ })).toBeVisible();
  await expect(page.getByLabel("Hedef tarihi geçen işler").getByRole("row", { name: /Ayşe Kaya/ })).toContainText("29 gün");
});
test("üyesi olmayan birim seçilince o birimin panosu açılır", async ({ page }) => {
  await mockApis(page);
  await page.goto("/unit-manager/management?unitId=unit-b&surveyId=survey-1");
  await expect(page).toHaveURL(/\/dashboard\?unitId=unit-b&surveyId=survey-1/);
});
test("ADMIN üyesi olmayan birimde birim takibi sayfasına gider", async ({ page }) => {
  await mockApis(page, { role: "ADMIN" });
  await page.goto("/unit-manager/management?unitId=unit-b");
  await expect(page).toHaveURL(/\/unit-manager\?unitId=unit-b/);
});
test("kampanya döneminde bekleyen üyelere hatırlatma gönderir", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  await panel(page, "Katılım").getByRole("button", { name: "Hatırlatma gönder" }).click();
  await expect(page.getByText("2 kişiye hatırlatma kuyruğa alındı.")).toBeVisible();
  expect(api.actions.map(action => action.path)).toContain("/api/organization/campaigns/period-2026/remind");
});
test("çalışan sayısı seçili üyeye kaydedilir", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  await page.getByRole("button", { name: "Çalışan sayısı", exact: true }).click();
  await page.getByLabel("Üye", { exact: true }).selectOption("unit-c");
  await page.getByLabel("Çalışan sayısı", { exact: true }).fill("55");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect.poll(() => api.actions[0]?.body).toEqual({ unitId: "unit-c", employeeCount: 55 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("Excel ve PDF raporu özeti ve ayrıntı tablolarını taşır", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/unit-manager/management?unitId=root");
  const excel = page.waitForEvent("download"); await page.getByRole("button", { name: "Excel", exact: true }).click();
  const file = await excel; const workbook = XLSX.read(await readFile((await file.path())!), { type: "buffer" });
  expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Özet", "Üyeler", "Ortak gelişim alanları", "Öneri uygulaması", "Dönem değişimi"]));
  expect(workbook.Sheets["Özet"].B2.v).toBe("Ege Sanayi Odası");
  const pdf = page.waitForEvent("download"); await page.getByRole("button", { name: "PDF raporu", exact: true }).click(); await pdf;
  expect(String(api.actions.find(action => action.path === "/api/html2pdf")?.body?.html)).toContain("Öncelikli eylemler");
});
test("admin birim listesi üyesi olan birimde yönetimi, olmayanda panoyu açar", async ({ page }) => {
  await mockApis(page, { role: "ADMIN" });
  await page.goto("/admin/units");
  await expect(page.getByRole("link", { name: "Ege Sanayi Odası birim yönetimi" })).toBeVisible();
  await page.getByRole("button", { name: "Alt birimleri göster: Ege Sanayi Odası" }).click();
  await page.getByRole("link", { name: "Akdeniz Tekstil birim panosu" }).click();
  await expect(page).toHaveURL(/\/unit-manager\?unitId=unit-a/);
});
test("üye panosu birim ortalamasını gösterir ve birim yönetimine üst birimle döner", async ({ page }) => {
  await mockApis(page);
  await page.goto("/dashboard?unitId=unit-b&surveyId=survey-1&assessmentId=assessment-b");
  const comparison = page.getByText("Ege Sanayi Odası içinde", { exact: true }).locator("..");
  await expect(comparison).toContainText("-7,2");
  await expect(comparison).toContainText("Birim ortalaması %55,2 · ilk %50 dilimde");
  await expect(panel(page, "Kategoriler").getByRole("columnheader", { name: "Ege Sanayi Odası ort." })).toBeVisible();
  // Sol menüdeki bağlantı üye seçimini taşımaz; aksi hâlde üyesi olmayan birim aynı panoya geri gönderirdi.
  await expect(page.getByLabel("Ana gezinme").getByRole("link", { name: "Birim yönetimi" })).toHaveAttribute("href", "/unit-manager/management?surveyId=survey-1");
  await page.locator("#icerik").getByRole("link", { name: "Birim yönetimi", exact: true }).click();
  await expect(page).toHaveURL(/unitId=root.*surveyId=survey-1.*periodId=period-2026/);
  await expect(page.getByLabel("Birim", { exact: true })).toHaveValue("root");
});
test("boş dönem bütün bölümleri boş durumla gösterir", async ({ page }) => {
  await mockApis(page, { empty: true });
  await page.goto("/unit-manager/management?unitId=root");
  await expect(page.getByRole("heading", { name: "Ironman analizi" })).toBeVisible();
  await expect(page.getByText("Seçili dönemde atanmış değerlendirme yok.")).toBeVisible();
  await expect(page.getByText("Önceki dönemde de gönderen üye yok; karşılaştırma bir sonraki dönemde oluşur.")).toBeVisible();
});
test("yetkisiz birimde rapor ve analiz gösterilmez", async ({ page }) => {
  await mockApis(page, { denied: true });
  await page.goto("/unit-manager/management?unitId=outside");
  await expect(page.getByText("Bu birime erişiminiz yok.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Öneri uygulaması" })).toHaveCount(0);
});
test("normal kullanıcı birim yönetimine erişemez", async ({ page }) => {
  const api = await mockApis(page, { role: "USER" });
  await page.goto("/unit-manager/management");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(api.reads()).toBe(0);
});
