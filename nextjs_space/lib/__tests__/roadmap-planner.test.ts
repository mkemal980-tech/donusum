import { describe, expect, it } from "vitest";
import { currentRoadmapQuarter, roadmapTimelineQuarters } from "../roadmap-calendar";
import {
  eligibleRoadmapCandidates, validateRoadmapSelection, buildRoadmapPlanningPrompt,
  type RoadmapCandidate, type RoadmapPlanningGroup,
} from "../roadmap-planner";

const start = { q: 4, year: 2026, label: "Ç4 2026" };
const candidate = (id: string, extra: Partial<RoadmapCandidate> = {}): RoadmapCandidate => ({
  id, title: id, description: "Öneri açıklaması", strategicType: "PROJECT", costType: "OPEX",
  estimatedImpact: 5, order: 0, timeframe: "SHORT_TERM", isActionable: true,
  stepDistance: 0, resolvedSubCategoryId: "sub-1", ...extra,
});
const group = (candidates: RoadmapCandidate[]): RoadmapPlanningGroup => ({
  subCategoryId: "sub-1", subCategoryName: "Enerji", categoryName: "Çevre", assessmentId: "assessment-1", candidates,
});
const response = (items: { recommendationId: string; quarterOffset: number; reason: string }[]) => ({
  groups: [{ subCategoryId: "sub-1", items }],
});
const item = (recommendationId: string, quarterOffset = 0) => ({
  recommendationId, quarterOffset, reason: "Yüksek etki ve uygun uygulama süresi.",
});

describe("roadmap calendar", () => {
  it("yıl ve çeyrek sınırını İstanbul saatine göre hesaplar", () => {
    expect(currentRoadmapQuarter(new Date("2026-12-31T21:01:00Z"))).toEqual({ q: 1, year: 2027, label: "Ç1 2027" });
    expect(currentRoadmapQuarter(new Date("2026-09-30T21:01:00Z"))).toEqual(start);
  });

  it("sekiz çeyreği, geçmiş atamaları ve ufuk dışındaki mevcut planı gösterir", () => {
    expect(roadmapTimelineQuarters([], start)).toHaveLength(8);
    const quarters = roadmapTimelineQuarters([
      { plannedQuarter: 1, plannedYear: 2026 }, { plannedQuarter: 3, plannedYear: 2029 },
      { plannedQuarter: null, plannedYear: null },
    ], start);
    expect(quarters[0].label).toBe("Ç1 2026");
    expect(quarters.at(-1)?.label).toBe("Ç3 2029");
  });
});

describe("roadmap AI selection", () => {
  it("tamamlanan, iptal, kilitli, geçilmiş ve alt kategorisiz önerileri eler", () => {
    const candidates = [
      candidate("available"), candidate("done"), candidate("cancelled"),
      candidate("locked", { isActionable: false, stepDistance: 1 }),
      candidate("passed", { stepDistance: -1 }), candidate("general", { resolvedSubCategoryId: null }),
    ];
    const existing = ["done", "cancelled"].map((recommendationId, index) => ({
      recommendationId, assessmentId: "assessment-1", status: index === 0 ? "COMPLETED" : "CANCELLED",
      plannedQuarter: null, plannedYear: null,
    }));
    expect(eligibleRoadmapCandidates(candidates, existing).map((row) => row.id)).toEqual(["available"]);
  });

  it("üç öneriyi vadelerine göre tarihlendirir ve yıl devrini doğru yapar", () => {
    const candidates = [candidate("short"), candidate("medium", { timeframe: "MEDIUM_TERM" }), candidate("long", { timeframe: "LONG_TERM" })];
    const selections = validateRoadmapSelection(response([item("short", 7), item("medium", 0), item("long", 0)]), [group(candidates)], start);
    expect(selections.map((row) => [row.plannedQuarter, row.plannedYear])).toEqual([[1, 2027], [2, 2027], [2, 2028]]);
    expect(selections[0].title).toBe("short");
  });

  it("üçten az aday varsa tümünü seçer", () => {
    expect(validateRoadmapSelection(response([item("only")]), [group([candidate("only")])], start)).toHaveLength(1);
  });

  it.each([
    ["eksik seçim", response([item("a")])],
    ["uydurma kimlik", response([item("a"), item("b"), item("other")])],
    ["tekrar", response([item("a"), item("b"), item("a")])],
    ["geçersiz tarih", response([item("a", -1), item("b"), item("c")])],
    ["eksik alt kategori", { groups: [] }],
    ["yanlış alt kategori", { groups: [{ subCategoryId: "other", items: [item("a"), item("b"), item("c")] }] }],
  ])("%s durumunda yanıtı reddeder", (_name, value) => {
    expect(() => validateRoadmapSelection(value, [group([candidate("a"), candidate("b"), candidate("c")])], start)).toThrow();
  });

  it("modelin adaylarına mevcut tarih ve çeyrek yükünü ekler", () => {
    const prompt = JSON.parse(buildRoadmapPlanningPrompt([group([candidate("a")])], start, [{
      recommendationId: "a", assessmentId: "assessment-1", status: "IN_PROGRESS", plannedQuarter: 1, plannedYear: 2027,
    }]));
    expect(prompt.existingWorkload).toEqual({ "Ç1 2027": 1 });
    expect(prompt.groups[0].candidates[0].existingPlan.plannedQuarter).toBe(1);
  });
});
