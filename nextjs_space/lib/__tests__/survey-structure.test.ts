import { describe, expect, it } from "vitest";
import { countStructureQuestions } from "../survey-structure";

/**
 * Soru sayımı tek kurala bağlı: alt seviye **varsa** sorular oradan, yoksa alt
 * kategoriden. Pano eskiden `hasSubLevels` bayrağına bakıyordu; bayrak ile
 * gerçek ağaç ayrıştığında sorular ya iki kez sayılıyor ya hiç sayılmıyordu.
 */
const category = (over: Record<string, unknown> = {}) => ({
  id: "cat-1",
  name: "Kategori",
  questions: [],
  subCategories: [],
  ...over,
}) as any;

describe("countStructureQuestions", () => {
  it("doğrudan kategoriye bağlı soruları sayar", () => {
    const result = countStructureQuestions([
      category({ questions: [{ id: "q1" }, { id: "q2" }] }),
    ]);
    expect(result[0].questionIds).toEqual(["q1", "q2"]);
  });

  it("alt seviye varsa soruları oradan sayar, alt kategorinin kendi sorularını saymaz", () => {
    const result = countStructureQuestions([
      category({
        subCategories: [
          {
            id: "sub-1",
            questions: [{ id: "dogrudan" }],
            subLevels: [{ id: "lvl-1", questions: [{ id: "q1" }, { id: "q2" }] }],
          },
        ],
      }),
    ]);
    expect(result[0].questionIds).toEqual(["q1", "q2"]);
  });

  it("alt seviye yoksa alt kategorinin sorularını sayar", () => {
    const result = countStructureQuestions([
      category({
        subCategories: [{ id: "sub-1", questions: [{ id: "q1" }], subLevels: [] }],
      }),
    ]);
    expect(result[0].questionIds).toEqual(["q1"]);
  });

  it("hasSubLevels bayrağı ile gerçek ağaç çelişirse ağaca uyar", () => {
    const result = countStructureQuestions([
      category({
        subCategories: [
          {
            id: "sub-1",
            hasSubLevels: true, // bayrak "alt seviye var" diyor
            questions: [{ id: "q1" }],
            subLevels: [], // ama yok
          },
        ],
      }),
    ]);
    // Eskiden bu soru hiç sayılmıyordu ve tamamlanma %100'e ulaşmıyordu.
    expect(result[0].questionIds).toEqual(["q1"]);
  });

  it("kategori kırılımını korur", () => {
    const result = countStructureQuestions([
      category({ id: "a", name: "A", questions: [{ id: "q1" }] }),
      category({ id: "b", name: "B", questions: [{ id: "q2" }, { id: "q3" }] }),
    ]);
    expect(result.map((c) => [c.id, c.questionIds.length])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });
});
