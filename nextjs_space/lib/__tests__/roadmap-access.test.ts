import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../scoring";

const mocks = vi.hoisted(() => ({ isUserCoordinator: vi.fn() }));
vi.mock("../assessment", () => ({ isUserCoordinator: mocks.isUserCoordinator }));
import { loadRoadmapAccess } from "../roadmap-access";

const db = { roadmapItem: { findMany: vi.fn() }, sectionAssignment: { findMany: vi.fn() } };
const client = db as unknown as DbClient;
const rec = (section: { subCategoryId?: string; subLevel?: string; question?: string }) => ({
  subCategoryId: section.subCategoryId ?? null,
  subLevel: section.subLevel ? { subCategoryId: section.subLevel } : null,
  question: section.question ? { subCategoryId: section.question, subLevel: null } : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isUserCoordinator.mockResolvedValue(false);
  db.sectionAssignment.findMany.mockResolvedValue([
    { assessmentId: "a1", subCategoryId: "energy", assigneeId: "ayse" },
    { assessmentId: "a1", subCategoryId: "waste", assigneeId: "ali" },
  ]);
  db.roadmapItem.findMany.mockResolvedValue([
    { assessmentId: "a1", recommendationId: "assigned-to-ayse", assigneeId: "ayse", recommendation: rec({ subCategoryId: "waste" }) },
    { assessmentId: "a1", recommendationId: "assigned-to-ali", assigneeId: "ali", recommendation: rec({ subCategoryId: "energy" }) },
    { assessmentId: "a1", recommendationId: "energy-section", assigneeId: null, recommendation: rec({ subLevel: "energy" }) },
    { assessmentId: "a1", recommendationId: "energy-question", assigneeId: null, recommendation: rec({ question: "energy" }) },
    { assessmentId: "a1", recommendationId: "waste-section", assigneeId: null, recommendation: rec({ subCategoryId: "waste" }) },
    { assessmentId: "a1", recommendationId: "no-section", assigneeId: null, recommendation: rec({}) },
  ]);
});

describe("yol haritası yetkisi", () => {
  it("koordinatör her işi yönetir; iş listesi okunmaz", async () => {
    mocks.isUserCoordinator.mockResolvedValue(true);
    const access = await loadRoadmapAccess("manager", ["a1"], client);
    expect(access.canManage).toBe(true);
    expect(access.canUpdate("anything")).toBe(true);
    expect(db.roadmapItem.findMany).not.toHaveBeenCalled();
  });
  it("çalışan yalnızca kendisine atanan ya da sorumlusu olmayıp bölümü kendisinde olan işi günceller", async () => {
    const access = await loadRoadmapAccess("ayse", ["a1"], client);
    expect(access.canManage).toBe(false);
    const allowed = ["assigned-to-ayse", "assigned-to-ali", "energy-section", "energy-question", "waste-section", "no-section", "not-in-roadmap"].filter(access.canUpdate);
    // İşe doğrudan atanan sorumlu, bölüm sorumlusunun önüne geçer.
    expect(allowed).toEqual(["assigned-to-ayse", "energy-section", "energy-question"]);
  });
});
