import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildUnitManagementAnalytics, managementGroups, ROOT_GROUP, unitSizeLabel } from "../unit-management-analytics";
import { managementDashboard, managementDetails, managementRows, managementUnits, memberUnits, NOW } from "../../test-fixtures/unit-management";
import { buildUnitManagementReportHtml, unitManagementReportTables } from "../unit-management-report";
import { ironmanInsight } from "../unit-management-display";

const analytics = () => managementDashboard().analytics;

describe("birim ve üyeleri", () => {
  it("birim yalnızca hemen altındaki üyeleri karşılaştırır; üyenin departmanı kendi grubunda kalır", () => {
    const groups = managementGroups(managementUnits);
    expect(groups.map(group => group.id)).toEqual(["root", "unit-a"]);
    expect(groups[0].memberIds).toEqual(["unit-a", "unit-b", "unit-c", "unit-d", "unit-e", "unit-f"]);
    expect(groups[1]).toEqual({ id: "unit-a", name: "Ege Sanayi Odası › Akdeniz Tekstil", memberIds: ["unit-a1"] });
  });
  it("yetki kapsamında birden çok en üst birim varsa onları ayrıca karşılaştırır", () => {
    const groups = managementGroups([{ id: "x", name: "X Holding", parentId: null }, { id: "y", name: "Y Odası", parentId: "outside" }]);
    expect(groups).toEqual([{ id: ROOT_GROUP, name: "Yönetilen en üst birimler", memberIds: ["x", "y"] }]);
    expect(managementGroups([{ id: "x", name: "X", parentId: null }])).toEqual([]);
  });
  it("hiyerarşi döngüsünde sonlanır", () => {
    const groups = managementGroups([{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }]);
    expect(groups.map(group => group.memberIds)).toEqual([["a"], ["b"]]);
  });
});

describe("birim yönetim analizi", () => {
  it("sonuçları yalnızca gönderilmiş değerlendirmelerden hesaplar; taslak puana karışmaz", () => {
    const { results } = analytics();
    expect(results).toMatchObject({ count: 3, average: 60.3, median: 61, benchmark: 53.3, benchmarkCount: 3, difference: 7 });
    expect(results.levels.map(level => level.count)).toEqual([0, 0, 1, 2, 0]);
  });
  it("önceki dönemi yalnızca iki dönemde de gönderen üyelerle karşılaştırır", () => {
    const { results, categories } = analytics();
    expect(results).toMatchObject({ previousAverage: 57, pairedCount: 2, change: 3 });
    expect(categories.map(category => [category.name, category.change, category.pairedCount])).toEqual([["Çevre", 2, 2], ["Sosyal", 4, 2], ["Yönetişim", 4, 2]]);
  });
  it("kategori kartında en yüksek ve en düşük üyeyi, ortalamaya ve Gelişen eşiğine göre sayıları verir", () => {
    const environment = analytics().categories[0];
    expect(environment).toMatchObject({ average: 44.7, median: 44, highest: { unitName: "Akdeniz Tekstil", value: 60 }, lowest: { unitName: "Bora Gıda", value: 30 }, above: 1, below: 2, belowDeveloping: 1 });
    expect(environment.levels.map(level => level.count)).toEqual([0, 1, 1, 1, 0]);
    expect(environment.points.map(point => point.unitName)).toEqual(["Akdeniz Tekstil", "Çınar Metal", "Bora Gıda"]);
  });
  it("kayıtlı kategori kıyası yoksa genel kıyası kategoriye kopyalamaz", () => {
    expect(analytics().categories.map(category => [category.benchmark, category.benchmarkCount])).toEqual([[50, 2], [null, 0], [null, 0]]);
  });
  it("üye tablosu atanmamış üyeleri de listeler, puanı yalnızca gönderene verir", () => {
    const members = analytics().members;
    expect(members.map(row => [row.unitName, row.status, row.score, row.change, row.benchmarkDifference])).toEqual([
      ["Akdeniz Tekstil", "SUBMITTED", 72, 8, 12], ["Bora Gıda", "SUBMITTED", 48, -2, 8], ["Çınar Metal", "SUBMITTED", 61, null, 1],
      ["Deniz Lojistik", "IN_PROGRESS", null, null, null], ["Ece Kimya", "NOT_STARTED", null, null, null], ["Fırat Enerji", null, null, null, null],
    ]);
    expect(members[0].categories).toEqual({ "category-0": 60, "category-1": 80, "category-2": 76 });
    expect(members[1].evidence).toEqual({ required: 2, documented: 0 });
  });
  it("birden çok üyenin ölçeğin alt yarısında kaldığı soruları ilgili öneriyle listeler", () => {
    const gaps = analytics().commonGaps;
    expect(gaps.map(gap => [gap.id, gap.low, gap.answered, gap.share, gap.recommendation?.id])).toEqual([["q-carbon", 2, 3, 67, "rec-carbon"], ["q-energy", 2, 3, 67, "rec-energy"]]);
    // Tam yarıdaki cevap alt yarıya sayılmaz.
    expect(gaps.some(gap => gap.id === "q-water")).toBe(false);
    expect(analytics().categories[0].lowestQuestion?.id).toBe("q-carbon");
    expect(analytics().categories[1].lowestQuestion).toBeNull();
  });
  it("katılımda bekleyen üyeleri gecikene öncelik vererek ve bekleyen işiyle gösterir", () => {
    const { participation } = analytics();
    expect(participation).toMatchObject({ members: 6, assigned: 5, unassigned: 1, submitted: 3, inProgress: 1, notStarted: 1, overdue: 1, completionRate: 60 });
    expect(participation.pending.map(row => [row.unitName, row.nextGap?.assigneeName ?? null])).toEqual([["Deniz Lojistik", "Deniz Ak"], ["Ece Kimya", null]]);
  });
  it("anketle ölçülen değişimi önceki dönemde beyan edilen gelişimle yan yana koyar", () => {
    const { change } = analytics();
    expect(change).toMatchObject({ pairedCount: 2, measured: 4, declared: 4 });
    expect(change.rows.map(row => [row.unitName, row.previousSurvey, row.currentSurvey, row.measured, row.declared, row.gap])).toEqual([
      ["Bora Gıda", 46, 48, 2, 4, 2], ["Akdeniz Tekstil", 60, 66, 6, 4, -2],
    ]);
  });
  it("cevap şeridi en düşük kategoriyi, öncelikli eylemi ve veri durumunu verir", () => {
    expect(analytics().answer).toEqual({
      score: 60.3, change: 3, pairedCount: 2, benchmarkDifference: 7,
      lowestCategory: { id: "category-0", name: "Çevre", average: 44.7, belowDeveloping: 1, count: 3 },
      nextAction: { kind: "untouched", id: "rec-carbon", title: "Karbon envanteri hazırla", reach: 2, overdue: 0 },
      data: { members: 6, assigned: 5, submitted: 3, evidenceRequired: 7, evidenceDocumented: 4, evidenceRate: 57 },
    });
  });
  it("yazılı özet yalnızca ölçülen değerleri söyler, yargı kelimesi kullanmaz", () => {
    const summary = analytics().summary;
    expect(summary[0]).toBe("Birim puanı %60,3, gönderilen 3 değerlendirmeden hesaplandı; aynı 2 üyede önceki döneme göre +3 puan; sektör kıyasına göre +7 puan.");
    expect(summary).toContain("Atanan 5 üyenin 3 tanesi gönderdi; gönderilmeyen değerlendirmeler sonuçlara katılmaz.");
    expect(summary.join(" ")).not.toMatch(/zayıf/i);
  });
  it("Ironman'de her üyeyi ayrı nokta olarak ve dağılımı verir", () => {
    const { ironman } = analytics();
    expect(ironman).toMatchObject({ count: 3, velocity: 3.2, endurance: 3, quadrant: "IRONMAN", benchmarkCount: 2 });
    expect(ironman.distribution.map(item => item.count)).toEqual([1, 1, 0, 1]);
    expect(ironman.points.map(point => [point.unitName, point.quadrant])).toEqual([["Akdeniz Tekstil", "IRONMAN"], ["Bora Gıda", "WALKER"], ["Çınar Metal", "SPRINTER"]]);
  });
  it("liste okunduktan sonra birimi değişen değerlendirmeyi eski üyeye mal etmez", () => {
    const details = managementDetails(); details[0].assessment.unitId = "outside";
    const data = buildUnitManagementAnalytics({ members: memberUnits, rows: managementRows, details, now: NOW });
    expect(data.results.count).toBe(2); expect(data.results.average).toBe(54.5);
  });
  it("cevapsız gönderime puan, kategori veya öneri üretmez", () => {
    const details = managementDetails().map(detail => ({ ...detail, answeredQuestions: 0 }));
    const data = buildUnitManagementAnalytics({ members: memberUnits, rows: managementRows, details, now: NOW });
    expect(data.results.average).toBeNull();
    expect(data.categories.every(category => category.average === null)).toBe(true);
    expect(data.roadmap.recommendations).toEqual([]);
  });
  it("boş birimde bütün bölümler boş veri sözleşmesini korur", () => {
    const data = managementDashboard({ empty: true }).analytics;
    expect(data.results).toMatchObject({ count: 0, average: null, median: null, change: null });
    expect(data.answer).toMatchObject({ score: null, lowestCategory: null, nextAction: null });
    expect(data.ironman.quadrant).toBeNull(); expect(data.commonGaps).toEqual([]); expect(data.change.rows).toEqual([]);
    expect(data.roadmap.monthly).toEqual([]); expect(data.summary).toEqual([]);
    expect(data.members).toHaveLength(6);
  });
  it("kullanıcı sayısından şirket ölçeği uydurmaz", () => {
    expect(unitSizeLabel(null)).toBe("Belirtilmedi");
    expect([0, 9, 10, 49, 50, 249, 250].map(unitSizeLabel)).toEqual(["Çalışan yok", "Mikro (1–9)", "Küçük (10–49)", "Küçük (10–49)", "Orta (50–249)", "Orta (50–249)", "Büyük (250+)"]);
  });
  it("alt sektör kıyasını genel sektör kıyasından önce kullanır", () => {
    const members = structuredClone(memberUnits); members[0].subSectorId = "sub-a";
    const data = buildUnitManagementAnalytics({ members, rows: managementRows.slice(0, 1), details: managementDetails().slice(0, 1), now: NOW, benchmarks: [
      { sectorId: "sector-a", subSectorId: null, level: "OVERALL", targetId: null, averageScore: 3 },
      { sectorId: "sector-a", subSectorId: "sub-a", level: "OVERALL", targetId: null, averageScore: 4 },
    ] });
    expect(data.results).toMatchObject({ benchmark: 75, difference: -3 });
  });
});

describe("birim yönetimi raporu", () => {
  it("özet sayfasını ve ayrıntı tablolarını içerir, HTML metnini ve Excel formüllerini güvenli tutar", () => {
    const data = managementDashboard(); data.selection.unitName = '<script>alert("x")</script>';
    data.analytics.roadmap.recommendations[2].title = "=HYPERLINK(\"bad\")";
    const html = buildUnitManagementReportHtml(data);
    expect(html).not.toContain('<script>alert("x")</script>'); expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Öncelikli eylemler"); expect(html).toContain("Karbon envanteri hazırla — 2 üyeye uygulanabilir, henüz başlanmadı");
    const tables = unitManagementReportTables(data);
    expect(Object.keys(tables)).toEqual(expect.arrayContaining(["Özet", "Kategoriler", "Üyeler", "Ortak gelişim alanları", "Öneri uygulaması", "Takılan öneriler", "Dokunulmamış fırsatlar", "Geciken işler", "Dönem değişimi", "Ironman", "Katılım", "Öneri durumları"]));
    expect(Object.keys(tables).every(name => name.length <= 31)).toBe(true);
    const sheet = XLSX.utils.aoa_to_sheet(tables["Tüm öneriler"]);
    expect(sheet.A4).toMatchObject({ t: "s", v: "=HYPERLINK(\"bad\")" }); expect(sheet.A4.f).toBeUndefined();
  });
  it("üye tablosu her kategoriyi ayrı sütunda taşır", () => {
    const rows = unitManagementReportTables(managementDashboard())["Üyeler"];
    expect(rows[0]).toEqual(expect.arrayContaining(["Çevre %", "Sosyal %", "Yönetişim %"]));
    expect(rows[1].slice(0, 7)).toEqual(["Akdeniz Tekstil", "İmalat", "Büyük (250+)", "Gönderildi", 100, 72, "Olgun"]);
    expect(rows.at(-1)?.[3]).toBe("Atanmadı");
  });
  it("Ironman tablosuna panodaki yorumu ekler", () => {
    const data = managementDashboard();
    const rows = unitManagementReportTables(data)["Ironman"];
    expect(rows.find(row => row[0] === "Yorum")?.[1]).toBe(ironmanInsight(data.analytics.ironman).headline);
  });
});
