import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { assessmentView, personalAssessmentView, personalRow, unitDetail, unitRow } from "../test-fixtures/unit-dashboard";
import { buildUnitReportHtml, unitReportTables } from "../lib/unit-dashboard-report";

async function mockApis(page: Page, { role = "UNIT_MANAGER", empty = false, failed = false, pending = false, denied = false, emptyFirst = false, personal = false } = {}) {
  let assignmentRequests = 0;
  const actions: { path: string; body: Record<string, unknown> }[] = [];
  let rows = empty ? [] : [unitRow(), unitRow("assessment-2", "unit-2", "Enerji birimi"), { ...unitRow("assessment-old"), periodId: "period-2025", periodName: "2025 dönemi", status: "SUBMITTED" as const, locked: true }];
  if (pending) rows = [{ ...unitRow(), id: "pending:managed-unit:survey-1:internal", assessmentId: null, responseCount: 0, status: "NOT_STARTED", score: null, maturityScore: null }];
  const details = new Map(rows.filter(row => row.assessmentId).map(row => {
    const data = unitDetail(row.id, row.unitId, row.unitName);
    data.assessment.periodName = row.periodName;
    data.assessment.status = row.status;
    data.assessment.locked = row.locked;
    return [row.id, data];
  }));

  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown = {};
    let status = 200;
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      actions.push({ path, body: payload });
      if (path === "/api/unit-manager/dashboard") {
        const row = unitRow("assessment-started");
        rows = [row];
        details.set(row.id, unitDetail(row.id));
        body = { assessmentId: row.id };
        status = 201;
      } else if (path === "/api/dashboard/assessment/roadmap") {
        const detail = details.get(payload.assessmentId as string)!;
        const rec = detail.recommendations.find(row => row.id === payload.recommendationId)!;
        if (payload.status) { rec.status = payload.status as typeof rec.status; rec.isInRoadmap = true; }
        if ("assigneeId" in payload) { rec.assigneeId = payload.assigneeId as string | null; rec.assigneeName = rec.assigneeId ? "Ayşe Üye" : "Atanmamış"; }
        if ("dueDate" in payload) rec.dueDate = payload.dueDate ? payload.dueDate + "T20:59:59.999Z" : null;
        body = { success: true };
      } else if (path === "/api/assessment/sections" || path === "/api/assessment/submission") body = { success: true };
      else if (path === "/api/html2pdf") {
        await route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 test report") });
        return;
      }
    } else if (path === "/api/auth/session") {
      body = { user: { id: "esra", email: "esra@example.com", firstName: "Esra", role, unitId: null }, expires: "2099-01-01T00:00:00Z" };
    } else if (path === "/api/dashboard/assessments" && role === "USER") {
      body = { role: "owner", units: [], assessments: [], hasAnonymousCampaigns: false };
    } else if (path === "/api/dashboard/assessments") {
      status = failed ? 500 : 200;
      body = failed ? { error: "Birim verileri yüklenemedi." } : { role: "manager",
        units: [...(personal ? [{ id: "self", name: "Bora Danışmanlık", description: null, parentId: null, assessmentCount: 1 }] : []), ...(emptyFirst ? [{ id: "empty-unit", name: "ABC Tersane", description: null, parentId: "root", assessmentCount: 0 },
          { id: "root", name: "Tersane2026", description: null, parentId: null, assessmentCount: 0 }] : []),
          { id: "managed-unit", name: "Esra'nın birimi", description: null, parentId: emptyFirst ? "root" : null, assessmentCount: empty ? 0 : 2 },
          { id: "unit-2", name: "Enerji birimi", description: null, parentId: null, assessmentCount: empty ? 0 : 1 }],
        assessments: [...(personal ? [personalRow()] : []), ...rows], hasAnonymousCampaigns: false,
      };
    } else if (path === "/api/dashboard/assessment" && url.searchParams.get("assessmentId") === "personal-1") {
      body = personalAssessmentView();
    } else if (path === "/api/dashboard/assessment") {
      const detail = details.get(url.searchParams.get("assessmentId")!);
      status = denied || !detail ? 403 : 200;
      body = status === 403 ? { error: "Bu değerlendirmeye erişiminiz yok." } : assessmentView(detail!);
    } else if (path === "/api/dashboard/assessment/group-comparison") {
      body = { available: false, reason: "NO_GROUP", groupName: null };
    } else if (path === "/api/survey/assigned") {
      assignmentRequests++;
      body = [];
    } else if (path === "/api/dashboard/assessment/documents") {
      body = [{ id: "document-1", fileName: "Birim raporu.pdf", fileType: "application/pdf", createdAt: "2026-10-01T09:00:00Z", downloadUrl: null,
        user: { id: "member-1", email: "member@example.com", firstName: "Ayşe", lastName: "Üye" }, response: null }];
    } else if (path === "/api/assessment/sections") {
      const detail = details.get(url.searchParams.get("assessmentId")!)!;
      body = {
        surveyId: detail.assessment.surveyId, surveyName: detail.assessment.surveyName, unitName: detail.assessment.unitName,
        assessmentId: detail.assessment.id, unitId: detail.assessment.unitId, isCoordinator: true, status: detail.assessment.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
        locked: detail.assessment.locked, submittedAt: detail.assessment.submittedAt,
        members: [{ id: "member-1", firstName: "Ayşe", lastName: "Üye", email: "member@example.com" }],
        categories: detail.categories.map(category => ({ id: category.id, name: category.name, directQuestionCount: 0, directAnsweredCount: 0,
          sections: category.sections.map(section => ({ id: section.id, name: section.name, questionCount: section.questionCount, answeredCount: section.answeredCount, assigneeId: section.assigneeId, lastAnsweredAt: section.lastActivityAt })) })),
      };
    } else if (path === "/api/dashboard/assessment/export") {
      const detail = assessmentView(details.get(url.searchParams.get("assessmentId")!)!);
      if (url.searchParams.get("format") === "html") {
        await route.fulfill({ contentType: "text/html", body: buildUnitReportHtml(detail) });
        return;
      }
      const workbook = XLSX.utils.book_new();
      for (const [name, values] of Object.entries(unitReportTables(detail))) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(values), name);
      await route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
      return;
    } else if (path === "/api/admin/dashboard/unit-check") body = { hasResponses: false };
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { assignments: () => assignmentRequests, actions };
}

test("kişisel ataması ve birim üyeliği olmayan yönetici sonuç, eksik ve belgeleri görür", async ({ page }, testInfo) => {
  const api = await mockApis(page);
  await page.goto("/dashboard?unitId=managed-unit");
  await expect(page.getByRole("heading", { name: "Birim panosu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Esra'nın birimi", exact: true })).toBeVisible();
  await expect(page.getByText("Atık yönetimi için sorumlu seçin")).toBeVisible();
  await expect(page.getByText("Enerji yönetimi bölümünde belge eksik")).toBeVisible();
  await expect(page.getByText("Size henüz anket atanmadı")).toHaveCount(0);
  expect(api.assignments()).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("birim-panosu.png"), fullPage: true });
  await page.getByRole("tab", { name: "Belgeler" }).click();
  await expect(page.getByText("Birim raporu.pdf")).toBeVisible();
  // Kişisel değerlendirmesi olmayan yöneticide "Kendi değerlendirmem" yoktur.
  await expect(page.getByRole("button", { name: "Kendi değerlendirmem" })).toHaveCount(0);
});

test("birimi olmayan yönetici kendi değerlendirmesini aynı panoda açar", async ({ page }) => {
  await mockApis(page, { personal: true });
  await page.goto("/dashboard");
  // Yönetici panosu kişisel değerlendirmeyle değil, yönetilen birimlerle açılır.
  await expect(page.getByLabel("Birim", { exact: true })).toHaveValue("all");
  await expect(page.getByRole("cell", { name: "Bora Danışmanlık" })).toHaveCount(0);
  await page.getByRole("button", { name: "Kendi değerlendirmem" }).click();
  await expect(page).toHaveURL(/unitId=self.*assessmentId=personal-1/);
  await expect(page.getByRole("heading", { name: "Bora Danışmanlık", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Görev dağılımı" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Ekip ve görevler" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Değerlendirmeyi gönder" })).toBeVisible();
});

test("sonuçlar sekmesi puanı, kıyasları ve sonraki adımları tek yerde gösterir", async ({ page }, testInfo) => {
  const api = await mockApis(page);
  await page.goto("/dashboard?unitId=managed-unit&surveyId=survey-1&assessmentId=assessment-1");
  const card = (label: string) => page.locator("p.t-label").getByText(label, { exact: true }).locator("..");
  await expect(card("Mevcut puan")).toContainText("%40,0");
  await expect(card("Önceki döneme göre")).toContainText("+10,0");
  await expect(card("Önceki döneme göre")).toContainText("2025 dönemi · %30");
  await expect(card("Sektöre göre")).toContainText("+5,0");
  await expect(card("Sektöre göre")).toContainText("Enerji ortalaması %35,0");
  await expect(card("Veri durumu")).toContainText("1/2 soru");
  const row = page.getByRole("row").filter({ hasText: "Çevresel dönüşüm" });
  for (const value of ["%40,0", "Gelişen", "+10,0", "%35,0", "1/2"]) await expect(row).toContainText(value);
  await expect(page.getByText("Cevaplanan bütün sorular ölçeğin en üstünde; 1 soru cevapsız ve puana sıfır olarak giriyor.")).toBeVisible();
  const roadmap = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sıradaki işler" }) }).first();
  await expect(roadmap.getByText("Hedef tarihi geçen", { exact: true }).locator("..")).toContainText("1");
  await expect(roadmap.getByRole("listitem").filter({ hasText: "Atık azaltma projesi" })).toContainText("Gecikti");
  const analysis = page.locator("section").filter({ has: page.getByRole("heading", { name: "Kategori analizi" }) }).first();
  await expect(analysis.getByText("%40,0 · Gelişen · Olgun seviyesine 20,0 puan")).toBeVisible();
  await expect(analysis.getByText("Enerji izleme planı", { exact: true })).toBeVisible();
  await expect(page.getByText("Hız ve dayanıklılık, iki eksene bağlı sorular cevaplandığında birlikte ölçülür.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Puan geçmişi: ilk kayıt %30, son kayıt %40" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("pano-sonuclar.png"), fullPage: true });
  await analysis.getByRole("button", { name: "Yol haritasına ekle" }).click();
  await expect.poll(() => api.actions.find(action => action.path === "/api/dashboard/assessment/roadmap")?.body).toEqual({ assessmentId: "assessment-1", recommendationId: "rec-1", status: "PLANNED" });
});

test("birim ve dönem seçimi URL'de korunur; kategori ve ekip detayları açılır", async ({ page }) => {
  await mockApis(page);
  await page.goto("/dashboard?unitId=managed-unit");
  await expect(page.getByText("Atık yönetimi için sorumlu seçin")).toBeVisible();
  await page.getByLabel("Birim", { exact: true }).selectOption("unit-2");
  await expect(page).toHaveURL(/assessmentId=assessment-2/);
  await expect(page.getByRole("heading", { name: "Enerji birimi", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Cevaplar" }).click();
  await page.locator("summary").filter({ hasText: "Çevresel dönüşüm" }).click();
  await page.locator("summary").filter({ hasText: "Enerji yönetimi" }).click();
  await expect(page.getByText("Enerji tüketimi izleniyor mu?", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ekip ve görevler" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Ayşe Üye" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Birim", { exact: true })).toHaveValue("unit-2");
  await expect(page.getByRole("tab", { name: "Ekip ve görevler" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Birim", { exact: true }).selectOption("managed-unit");
  await page.getByLabel("Dönem", { exact: true }).selectOption("assessment-old");
  await expect(page.getByRole("link", { name: "Görevleri görüntüle", exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Geçmiş ve dönemler" }).click();
  await expect(page.getByRole("heading", { name: "Dönem karşılaştırması" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Puan kayıtları" })).toBeVisible();
});

test("görev dağılımı kişisel atama istemez ve seçili değerlendirmeye yazar", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/dashboard?unitId=unit-2&surveyId=survey-1&assessmentId=assessment-2");
  await page.getByRole("link", { name: "Görev dağılımı", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Görev dağılımı", exact: true })).toBeVisible();
  await page.getByLabel("Atık yönetimi sorumlusu").selectOption("member-1");
  await expect.poll(() => api.actions.find(action => action.path === "/api/assessment/sections")?.body.assessmentId).toBe("assessment-2");
  expect(api.assignments()).toBe(0);
  await page.getByRole("button", { name: "Birim panosuna dön" }).click();
  await expect(page).toHaveURL(/assessmentId=assessment-2/);
});

test("öneri, sorumlu, tarih ve durum seçili birimin yol haritasına kaydedilir", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/dashboard?unitId=managed-unit&surveyId=survey-1&assessmentId=assessment-1&tab=recommendations");
  await page.getByRole("button", { name: "Yol haritasına ekle" }).click();
  await expect.poll(() => api.actions[0]?.body.assessmentId).toBe("assessment-1");
  await page.getByRole("tab", { name: "Yol haritası", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: "Enerji izleme planı" });
  await card.getByLabel("Enerji izleme planı sorumlusu").selectOption("member-1");
  await card.getByLabel("Enerji izleme planı hedef tarihi").fill("2026-12-01");
  await card.getByRole("button", { name: "Planı kaydet" }).click();
  await expect.poll(() => api.actions.find(action => action.body.dueDate === "2026-12-01")?.body.assigneeId).toBe("member-1");
  await expect(card.getByLabel("Enerji izleme planı durumu")).toBeEnabled();
  await card.getByLabel("Enerji izleme planı durumu").selectOption("COMPLETED");
  await expect.poll(() => api.actions.find(action => action.body.status === "COMPLETED")?.body.assessmentId).toBe("assessment-1");
});

test("atanmış ama başlanmamış anket açık bir başlatma işlemiyle değerlendirmeye dönüşür", async ({ page }) => {
  const api = await mockApis(page, { pending: true });
  await page.goto("/dashboard?unitId=managed-unit");
  await page.getByRole("button", { name: "Değerlendirmeyi başlat" }).click();
  await expect(page).toHaveURL(/assessmentId=assessment-started/);
  await expect(page.getByText("Atık yönetimi için sorumlu seçin")).toBeVisible();
  expect(api.actions[0].body.unitId).toBe("managed-unit");
});

test("PDF ve Excel raporu seçili birim ve dönemi kullanır", async ({ page }) => {
  const api = await mockApis(page);
  await page.goto("/dashboard?unitId=unit-2&surveyId=survey-1&assessmentId=assessment-2");
  const downloadedXlsx = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  const file = await downloadedXlsx;
  const workbook = XLSX.read(await readFile((await file.path())!), { type: "buffer" });
  expect(workbook.SheetNames).toContain("Cevaplar");
  expect(workbook.Sheets["Özet"].B2.v).toBe("Enerji birimi");
  const downloadedPdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF raporu", exact: true }).click();
  await downloadedPdf;
  const pdf = api.actions.find(action => action.path === "/api/html2pdf")!;
  expect(pdf.body.html).toContain("Enerji birimi");
  expect(pdf.body.html).toContain("2026 dönemi");
});

test("veri yokluğu, ağ hatası ve erişim hatası ayrı gösterilir", async ({ browser }) => {
  const page = await browser.newPage();
  await mockApis(page, { empty: true });
  await page.goto("/dashboard");
  await expect(page.getByText("Yönettiğiniz birimlerde henüz değerlendirme başlatılmadı ve aktif anket ataması yok.")).toBeVisible();
  await page.close();
  const failed = await browser.newPage();
  await mockApis(failed, { failed: true });
  await failed.goto("/dashboard");
  await expect(failed.getByText("Veriler yüklenemedi", { exact: true })).toBeVisible();
  await expect(failed.getByText("Yönettiğiniz birim yok")).toHaveCount(0);
  await failed.close();
  const denied = await browser.newPage();
  await mockApis(denied, { denied: true });
  await denied.goto("/dashboard?unitId=managed-unit");
  await expect(denied.getByText("Bu değerlendirmeye erişiminiz yok.")).toBeVisible();
  await expect(denied.getByText("Enerji tüketimi izleniyor mu?", { exact: true })).toHaveCount(0);
  await denied.close();
});

test("üst birim yöneticisi ilk açılışta boş alt birime düşmeden bütün sonuçları görür", async ({ page }, testInfo) => {
  const api = await mockApis(page, { emptyFirst: true });
  await page.goto("/dashboard");
  await expect(page.getByLabel("Birim", { exact: true })).toHaveValue("all");
  await expect(page.getByRole("heading", { name: "Tüm yönetilen birimler" })).toBeVisible();
  const table = page.getByRole("region", { name: "Birim değerlendirmeleri" });
  await expect(table.getByRole("columnheader", { name: "Birim", exact: true })).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("cell", { name: "Enerji birimi", exact: true })).toBeVisible();
  await expect(table.getByRole("cell", { name: "Esra'nın birimi", exact: true })).toHaveCount(2);
  expect(api.assignments()).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("birim-ozeti.png"), fullPage: true });
  await table.getByRole("row").filter({ hasText: "Enerji birimi" }).getByRole("button", { name: "Sonucu görüntüle" }).click();
  await expect(page).toHaveURL(/unitId=unit-2.*assessmentId=assessment-2/);
  await expect(page.getByRole("heading", { name: "Enerji birimi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tüm birimler", exact: true }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
  await page.getByLabel("Birim", { exact: true }).selectOption("empty-unit");
  await expect(page.getByText("Bu birimde henüz değerlendirme başlatılmadı ve aktif anket ataması yok.")).toBeVisible();
  await page.getByRole("button", { name: "Diğer birimlerin değerlendirmelerini göster" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);
});

test("toplu görünümün anket ve dönem seçimi korunur; birim detayı filtrelerden etkilenmez", async ({ page }) => {
  await mockApis(page);
  await page.goto("/unit-manager");
  const table = page.getByRole("region", { name: "Birim değerlendirmeleri" });
  await page.getByLabel("Anket", { exact: true }).selectOption("survey-1");
  await page.getByLabel("Dönem", { exact: true }).selectOption("period-2025");
  await expect(page).toHaveURL(/unitId=all.*surveyId=survey-1.*periodId=period-2025/);
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("cell", { name: "Gönderildi", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Dönem", { exact: true })).toHaveValue("period-2025");
  await page.getByRole("link", { name: "Pano", exact: true }).click();
  await expect(page).toHaveURL(/periodId=period-2025/);
  await page.getByLabel("Birim", { exact: true }).selectOption("unit-2");
  await expect(page).toHaveURL(/assessmentId=assessment-2/);
  expect(new URL(page.url()).searchParams.has("periodId")).toBe(false);
  await expect(page.getByRole("heading", { name: "Enerji birimi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tüm birimler", exact: true }).click();
  await page.getByLabel("Değerlendirme durumuna göre filtrele").selectOption("SUBMITTED");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page.getByLabel("Değerlendirme durumuna göre filtrele").selectOption("ALL");
  await expect(table.getByRole("row")).toHaveCount(4);
});

test("birimi ve anketi olmayan kullanıcı tek panoda boş durumu görür", async ({ page }) => {
  const api = await mockApis(page, { role: "USER" });
  await page.goto("/dashboard");
  await expect(page.getByText("Size henüz anket atanmadı")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Birim panosu" })).toHaveCount(0);
  expect(api.assignments()).toBe(0);
});

test("ADMIN /dashboard'da bütün birimlerin panosunu açar", async ({ page }) => {
  await mockApis(page, { role: "ADMIN" });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Birim panosu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tüm yönetilen birimler" })).toBeVisible();
});
