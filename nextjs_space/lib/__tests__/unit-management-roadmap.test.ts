import { describe, expect, it } from "vitest";
import { buildRoadmapAnalytics, rankRoadmapMembers } from "../unit-management-roadmap";
import { managementDashboard, managementDetails, NOW } from "../../test-fixtures/unit-management";

const roadmap = () => managementDashboard().analytics.roadmap;

describe("öneri uygulaması", () => {
  it("üye başına yol haritası durumunu, beyan edilen gelişimi ve gerçekleşme oranını hesaplar", () => {
    const [a, b, c] = roadmap().members;
    expect(a).toMatchObject({ unitName: "Akdeniz Tekstil", inRoadmap: 2, completed: 1, inProgress: 1, planned: 0, overdue: 1, ready: 2, declaredGain: 6, realization: 23, completedLast90: 1, gainPerItem: 6 });
    expect(b).toMatchObject({ inRoadmap: 1, completed: 0, planned: 1, declaredGain: 0, realization: 0, gainPerItem: null });
    // Geri alınıp yeniden tamamlanan öneri, son tamamlama tarihiyle sayılır.
    expect(c).toMatchObject({ completed: 2, declaredGain: 8, realization: 100, completedLast90: 1, gainPerItem: 4 });
    expect(roadmap().totals).toEqual({ inRoadmap: 5, completed: 3, open: 2, overdue: 1, notStarted: 0 });
  });
  it("en çok tamamlayan ile en çok ilerleyen ayrı sıralanır", () => {
    const members = roadmap().members;
    expect(rankRoadmapMembers(members, "completed").map(row => row.unitName)).toEqual(["Çınar Metal", "Akdeniz Tekstil", "Bora Gıda"]);
    expect(rankRoadmapMembers(members, "gain").map(row => row.declaredGain)).toEqual([8, 6, 0]);
    expect(rankRoadmapMembers(members, "efficiency").map(row => [row.unitName, row.gainPerItem])).toEqual([["Akdeniz Tekstil", 6], ["Çınar Metal", 4]]);
    expect(rankRoadmapMembers(members, "notStarted")).toEqual([]);
  });
  it("hiç yol haritası işi olmayan ama uygulanabilir önerisi olan üyeyi ayırır", () => {
    const details = managementDetails().slice(0, 2);
    for (const rec of details[1].recommendations) { rec.isInRoadmap = false; rec.status = null; }
    const result = buildRoadmapAnalytics({ details, categories: [], now: NOW });
    expect(rankRoadmapMembers(result.members, "notStarted").map(row => [row.unitName, row.ready])).toEqual([["Bora Gıda", 2]]);
    expect(result.totals.notStarted).toBe(1);
  });
  it("takılan, dokunulmamış ve benimsenen önerileri ayırır", () => {
    const result = roadmap();
    expect(result.stuck.map(rec => [rec.id, rec.open, rec.overdue])).toEqual([["rec-energy", 2, 1]]);
    expect(result.untouched.map(rec => [rec.id, rec.eligible, rec.adopted])).toEqual([["rec-carbon", 2, 0]]);
    expect(result.adopted.map(rec => [rec.id, rec.adopted, rec.completed])).toEqual([["rec-energy", 3, 1], ["rec-policy", 2, 2]]);
    expect(result.nextAction).toEqual({ kind: "untouched", id: "rec-carbon", title: "Karbon envanteri hazırla", reach: 2, overdue: 0 });
  });
  it("tamamlanan işlerin kategori ve strateji dağılımını verir", () => {
    const { focus } = roadmap();
    expect(focus.categories.map(row => [row.name, row.completed, row.open])).toEqual([["Çevre", 1, 2], ["Sosyal", 0, 0], ["Yönetişim", 2, 0]]);
    expect(focus.strategies).toEqual([{ key: "QUICK_WIN", completed: 2, open: 0 }, { key: "PROJECT", completed: 1, open: 2 }, { key: "BIG_BET", completed: 0, open: 0 }]);
  });
  it("geciken işleri sorumlusu ve gecikme günüyle listeler", () => {
    expect(roadmap().overdue).toEqual([expect.objectContaining({ title: "Enerji izleme sistemi kur", unitName: "Akdeniz Tekstil", assigneeName: "Ayşe Kaya", daysLate: 29 })]);
  });
  it("aylık tamamlamayı son 12 ay için İstanbul saatine göre ve geri alınanı düşerek sayar", () => {
    const monthly = roadmap().monthly;
    expect(monthly).toHaveLength(12);
    expect(monthly[0].month).toBe("2025-11"); expect(monthly.at(-1)).toEqual({ month: "2026-10", completed: 1 });
    expect(monthly.filter(row => row.completed).map(row => row.month)).toEqual(["2026-03", "2026-09", "2026-10"]);
    expect(buildRoadmapAnalytics({ details: managementDetails().slice(1, 2), categories: [], now: NOW }).monthly).toEqual([]);
  });
});
