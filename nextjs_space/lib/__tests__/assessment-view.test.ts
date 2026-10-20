import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";
import { unitDetail } from "../../test-fixtures/unit-dashboard";
import { ManagedAssessmentError } from "../managed-assessment";

const mocks = vi.hoisted(() => ({ managed: vi.fn(), build: vi.fn(), index: vi.fn(), ownIndex: vi.fn(), personalIndex: vi.fn(), access: vi.fn() }));
vi.mock("../managed-assessment", async original => ({ ...(await original<typeof import("../managed-assessment")>()), resolveManagedAssessment: mocks.managed }));
vi.mock("../unit-dashboard", async original => ({
  ...(await original<typeof import("../unit-dashboard")>()),
  buildAssessmentDetail: mocks.build, loadUnitDashboardIndex: mocks.index, loadOwnUnitDashboardIndex: mocks.ownIndex,
  loadPersonalDashboardIndex: mocks.personalIndex,
}));
vi.mock("../roadmap-access", () => ({ loadRoadmapAccess: mocks.access }));
import { loadAssessmentDocuments, loadAssessmentIndex, loadAssessmentView, resolveViewableAssessment } from "../assessment-view";
import { redactForMember } from "../unit-dashboard";

const manager = { userId: "manager", user: { role: "UNIT_MANAGER" } };
const member = { userId: "member-1", user: { role: "USER" } };
const assessment = {
  id: "as-1", unitId: "unit-b", surveyId: "s1", status: "SUBMITTED", submittedAt: null,
  unit: { id: "unit-b", name: "Bora Gıda", sectorId: null, subSectorId: null },
  survey: { id: "s1", name: "Anket", isActive: true, archivedAt: null, isDemo: false }, campaignRecipient: null,
};
const db = {
  user: { findUnique: vi.fn() }, assessment: { findFirst: vi.fn() },
  sectionAssignment: { findMany: vi.fn() }, document: { findMany: vi.fn() },
  benchmark: { findMany: vi.fn() }, ironmanBenchmark: { findMany: vi.fn() }, sector: { findUnique: vi.fn() },
  scoreTarget: { findMany: vi.fn() },
};
const client = db as unknown as DbClient;
const assignments = [{ subCategoryId: "section-1", assigneeId: "member-1" }, { subCategoryId: "section-2", assigneeId: "member-2" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.managed.mockRejectedValue(new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok."));
  db.user.findUnique.mockResolvedValue({ unitId: "unit-b" });
  db.assessment.findFirst.mockResolvedValue(assessment);
  db.sectionAssignment.findMany.mockResolvedValue(assignments);
  mocks.build.mockResolvedValue(unitDetail("as-1", "unit-b", "Bora Gıda"));
  mocks.personalIndex.mockResolvedValue(null);
  db.scoreTarget.findMany.mockResolvedValue([]);
});

describe("çalışan ayıklaması", () => {
  it("başkasına atanmış bölümün cevaplarını, sorumlusunu ve ilerlemesini çıkarır; puanı bırakır", () => {
    const detail = redactForMember(unitDetail(), "member-1", assignments);
    const [mine, other] = detail.categories[0].sections;
    expect(mine).toMatchObject({ id: "section-1", restricted: false, assigneeName: "Ayşe Üye" });
    expect(mine.questions).toHaveLength(1);
    expect(other).toMatchObject({ id: "section-2", restricted: true, assigneeId: null, assigneeName: "", answeredCount: 0, percentage: 0, questions: [] });
    expect(other.currentPercentage).toBe(unitDetail().categories[0].sections[1].currentPercentage);
  });
  it("kişi bazlı ekip ilerlemesini, üye listesini ve sorumlu atama işlerini çıkarır", () => {
    const detail = redactForMember(unitDetail(), "member-1", assignments);
    expect(detail.team.map(row => row.id)).toEqual(["member-1"]);
    expect(detail.members).toEqual([]);
    expect(detail.work.map(item => [item.kind, item.sectionId])).toEqual([["EVIDENCE", "section-1"]]);
    // Birimin sonucu aynı kalır.
    expect(detail.scores).toEqual(unitDetail().scores);
    expect(detail.recommendations).toEqual(unitDetail().recommendations);
  });
  it("dağıtım yoksa her bölüm açıktır; sorumlu seçme işi yine koordinatörde kalır", () => {
    const detail = redactForMember(unitDetail(), "member-1", []);
    expect(detail.categories[0].sections.every(section => !section.restricted)).toBe(true);
    expect(detail.work.some(item => item.kind === "UNASSIGNED")).toBe(false);
  });
});

describe("değerlendirmeyi açma", () => {
  it("yönetim kapsamındaysa yönetici olarak açar", async () => {
    mocks.managed.mockResolvedValue({ id: "as-1" });
    expect(await resolveViewableAssessment(manager, "as-1", client)).toEqual({ role: "manager", record: { id: "as-1" } });
    expect(db.assessment.findFirst).not.toHaveBeenCalled();
  });
  it("yönetim kapsamında değilse kişinin kendi birimiyse çalışan olarak açar", async () => {
    const { role, record } = await resolveViewableAssessment(manager, "as-1", client);
    expect(role).toBe("member");
    expect(record.context.isCoordinator).toBe(false);
    expect(db.assessment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "as-1", unitId: "unit-b", survey: { isDemo: false } } }));
  });
  it("normal kullanıcı yönetici yolunu hiç denemez; başka birimin değerlendirmesini açamaz", async () => {
    db.assessment.findFirst.mockResolvedValue(null);
    await expect(resolveViewableAssessment(member, "other", client)).rejects.toMatchObject({ status: 403 });
    expect(mocks.managed).not.toHaveBeenCalled();
  });
  it("birimi olmayan kullanıcı birim değerlendirmesi açamaz", async () => {
    db.user.findUnique.mockResolvedValue({ unitId: null });
    await expect(resolveViewableAssessment(member, "as-1", client)).rejects.toMatchObject({ status: 403 });
  });
  it("yetki dışı olmayan hatayı yutmaz", async () => {
    mocks.managed.mockRejectedValue(new ManagedAssessmentError("Geçersiz", 400));
    await expect(resolveViewableAssessment(manager, "", client)).rejects.toMatchObject({ status: 400 });
  });
});

describe("kişisel değerlendirme", () => {
  const owner = { firstName: "Bora", lastName: "Er", email: "bora@example.com", organization: "Bora Danışmanlık", sectorId: "sector-1", subSectorId: null, unitId: null };
  const personal = { ...assessment, id: "p1", unitId: null, unit: null, ownerUserId: "member-1", owner };
  it("birimsiz kullanıcının kendi değerlendirmesini sahip olarak açar; birim yerine sahibinin adı ve sektörü", async () => {
    db.assessment.findFirst.mockResolvedValueOnce(personal);
    const { role, record } = await resolveViewableAssessment(member, "p1", client);
    expect(role).toBe("owner");
    expect(record.unit).toEqual({ id: "self", name: "Bora Danışmanlık", sectorId: "sector-1", subSectorId: null });
    expect(record.scoring).toMatchObject({ id: "p1", sectorId: "sector-1" });
    expect(db.assessment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", ownerUserId: "member-1", unitId: null, survey: { isDemo: false } } }));
  });
  it("başkasının kişisel değerlendirmesini açmaz", async () => {
    db.assessment.findFirst.mockResolvedValueOnce({ ...personal, ownerUserId: "other" });
    db.user.findUnique.mockResolvedValue({ unitId: null });
    await expect(resolveViewableAssessment(member, "p1", client)).rejects.toMatchObject({ status: 403 });
  });
  it("sahibe planlama ve Excel yetkisi verir; dağıtım ve ayıklama yoktur", async () => {
    db.assessment.findFirst.mockResolvedValueOnce(personal);
    db.benchmark.findMany.mockResolvedValue([]);
    db.ironmanBenchmark.findMany.mockResolvedValue([]);
    db.sector.findUnique.mockResolvedValue({ name: "Danışmanlık" });
    const view = await loadAssessmentView(member, "p1", client);
    expect(view.benchmark).toEqual({ sectorName: "Danışmanlık", overall: null, categories: {}, ironman: null });
    expect(mocks.build).toHaveBeenCalledWith(member, expect.anything(), client, { ownUnit: true, member: false });
    expect(view.viewer).toEqual({ role: "owner", canManageRoadmap: true, canDistribute: false, canExportTeam: true, canSetTargets: true });
    // Kişisel değerlendirmenin hedefi sahibine aittir.
    expect(db.scoreTarget.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { surveyId: "s1", ownerUserId: "member-1" } }));
    expect(mocks.access).not.toHaveBeenCalled();
  });
});

describe("rol farkındalıklı görünüm", () => {
  it("çalışana ayıklanmış detayı ve yalnızca kendi işinde durum yetkisini verir", async () => {
    mocks.access.mockResolvedValue({ canManage: false, canUpdate: (id: string) => id === "rec-2" });
    const view = await loadAssessmentView(member, "as-1", client);
    expect(mocks.build).toHaveBeenCalledWith(member, expect.anything(), client, { ownUnit: true, member: true });
    expect(view.viewer).toEqual({ role: "member", canManageRoadmap: false, canDistribute: false, canExportTeam: false, canSetTargets: false });
    // rec-1 yol haritasında değil; rec-2 yol haritasında ve kendisine düşüyor.
    expect(view.recommendations.map(rec => [rec.id, rec.canUpdateStatus])).toEqual([["rec-1", false], ["rec-2", true]]);
  });
  it("yöneticiye tam detay ve bütün yetkileri verir", async () => {
    mocks.managed.mockResolvedValue(assessment);
    const view = await loadAssessmentView(manager, "as-1", client);
    expect(mocks.build).toHaveBeenCalledWith(manager, expect.anything(), client, { ownUnit: false, member: false });
    expect(view.viewer).toEqual({ role: "manager", canManageRoadmap: true, canDistribute: true, canExportTeam: true, canSetTargets: true });
    expect(view.recommendations.every(rec => rec.canUpdateStatus)).toBe(true);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("birimin hedefini görünüme ekler; çalışan da görür", async () => {
    db.scoreTarget.findMany.mockResolvedValue([{ categoryId: null, percentage: 70, targetDate: null }]);
    mocks.access.mockResolvedValue({ canManage: false, canUpdate: () => false });
    const view = await loadAssessmentView(member, "as-1", client);
    expect(view.targets).toEqual({ overall: { percentage: 70, targetDate: null }, categories: {} });
    expect(db.scoreTarget.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { surveyId: "s1", unitId: "unit-b" } }));
  });
});

describe("sektör kıyası", () => {
  it("alt sektör kaydını tercih eder, yoksa sektörün genel kaydını alır; 1-5'i yüzdeye çevirir", async () => {
    mocks.managed.mockResolvedValue({ ...assessment, unit: { ...assessment.unit, sectorId: "sector-1", subSectorId: "sub-1" } });
    const row = (level: string, targetId: string | null, subSectorId: string | null, averageScore: number) => ({ level, targetId, subSectorId, averageScore });
    db.benchmark.findMany.mockResolvedValue([
      row("OVERALL", null, null, 2), row("OVERALL", null, "sub-1", 3),
      row("CATEGORY", "category-1", null, 4), row("CATEGORY", "category-2", null, 1), row("CATEGORY", "category-2", "sub-1", 5),
    ]);
    db.ironmanBenchmark.findMany.mockResolvedValue([{ subSectorId: null, velocityAverage: 2.4, enduranceAverage: 2.8, velocityAverageTarget: 3, enduranceAverageTarget: 3.2 }]);
    db.sector.findUnique.mockResolvedValue({ name: "Gıda" });
    const view = await loadAssessmentView(manager, "as-1", client);
    expect(view.benchmark).toEqual({ sectorName: "Gıda", overall: 50, categories: { "category-1": 75, "category-2": 100 },
      ironman: { velocity: 2.4, endurance: 2.8, velocityTarget: 3, enduranceTarget: 3.2 } });
    expect(db.benchmark.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { surveyId: "s1", sectorId: "sector-1" } }));
  });
  it("sektörü olmayan birimde kıyas uydurmaz", async () => {
    mocks.managed.mockResolvedValue(assessment);
    const view = await loadAssessmentView(manager, "as-1", client);
    expect(view.benchmark).toEqual({ sectorName: null, overall: null, categories: {}, ironman: null });
    expect(db.benchmark.findMany).not.toHaveBeenCalled();
  });
});

describe("pano listesi ve belgeler", () => {
  it("yöneticide yönetilen birimleri, çalışanda yalnızca kendi birimini listeler", async () => {
    mocks.index.mockResolvedValue({ units: [{ id: "x" }], assessments: [], hasAnonymousCampaigns: false });
    mocks.ownIndex.mockResolvedValue({ units: [{ id: "unit-b" }], assessments: [], hasAnonymousCampaigns: false });
    expect(await loadAssessmentIndex(manager, client)).toMatchObject({ role: "manager", units: [{ id: "x" }] });
    expect(await loadAssessmentIndex(member, client)).toMatchObject({ role: "member", units: [{ id: "unit-b" }] });
    expect(mocks.ownIndex).toHaveBeenCalledWith(member, "unit-b", client);
    db.user.findUnique.mockResolvedValue({ unitId: null });
    expect(await loadAssessmentIndex(member, client)).toEqual({ role: "owner", units: [], assessments: [], hasAnonymousCampaigns: false });
  });
  it("birimi olmayan kullanıcının kişisel değerlendirmelerini kişisel birimin altında listeler", async () => {
    const personal = { unit: { id: "self", name: "Bora Danışmanlık", description: null, parentId: null, assessmentCount: 1 }, assessments: [{ id: "p1", unitId: "self" }] };
    mocks.personalIndex.mockResolvedValue(personal);
    db.user.findUnique.mockResolvedValue({ unitId: null });
    expect(await loadAssessmentIndex(member, client)).toEqual({ role: "owner", units: [personal.unit], assessments: personal.assessments, hasAnonymousCampaigns: false });
    // Birimi olmayan yönetici de kendi değerlendirmesini yönettiği birimlerin yanında görür.
    mocks.index.mockResolvedValue({ units: [{ id: "x" }], assessments: [{ id: "a1", unitId: "x" }], hasAnonymousCampaigns: false });
    expect(await loadAssessmentIndex(manager, client)).toMatchObject({ role: "manager", units: [{ id: "self" }, { id: "x" }], assessments: [{ id: "p1" }, { id: "a1" }] });
  });
  it("çalışana yalnızca görebildiği bölümlerin belgelerini verir", async () => {
    const doc = (id: string, section: string | null) => ({ id, response: { question: { text: "Soru", subCategoryId: section, subLevel: null } } });
    db.document.findMany.mockResolvedValue([doc("mine", "section-1"), doc("other", "section-2"), doc("direct", null)]);
    expect((await loadAssessmentDocuments(member, "as-1", client)).map(row => row.id)).toEqual(["mine"]);
    mocks.managed.mockResolvedValue(assessment);
    expect((await loadAssessmentDocuments(manager, "as-1", client)).map(row => row.id)).toEqual(["mine", "other", "direct"]);
  });
});
