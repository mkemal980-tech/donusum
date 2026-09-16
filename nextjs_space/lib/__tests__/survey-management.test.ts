import { describe, expect, it } from "vitest";
import { canEditSurveyRecord } from "@/lib/survey-management";

describe("tenant survey editing", () => {
  it("platform yöneticisine tüm anketleri açar", () => {
    expect(canEditSurveyRecord("ADMIN", null, [])).toBe(true);
    expect(canEditSurveyRecord("ADMIN", "unit-b", ["unit-a"])).toBe(true);
  });

  it("birim yöneticisine yalnızca yönettiği kuruluşa ait anketi açar", () => {
    expect(canEditSurveyRecord("UNIT_MANAGER", "unit-a", ["unit-a"])).toBe(true);
    expect(canEditSurveyRecord("UNIT_MANAGER", "unit-b", ["unit-a"])).toBe(false);
  });

  it("ortak platform anketini doğrudan düzenletmez", () => {
    expect(canEditSurveyRecord("UNIT_MANAGER", null, ["unit-a"])).toBe(false);
  });
});
