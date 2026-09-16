import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  question: { findMany: vi.fn() },
  surveyResponse: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock("../db", () => ({ prisma: mocks }));

import { rescoreQuestions } from "../rescore";

describe("rescoreQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.surveyResponse.update.mockResolvedValue({});
  });

  it("şık puanı değişince saklanan puanı günceller", async () => {
    mocks.question.findMany.mockResolvedValue([
      { id: "q1", type: "YES_NO", options: [{ value: "yes", score: 3 }, { value: "no", score: 1 }] },
    ]);
    mocks.surveyResponse.findMany.mockResolvedValue([
      { id: "r1", questionId: "q1", value: "yes", score: 5 }, // eski tanımda 5'ti
    ]);

    const result = await rescoreQuestions(["q1"]);

    expect(result).toEqual({ examined: 1, updated: 1, invalid: 0 });
    expect(mocks.surveyResponse.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { score: 3 },
    });
  });

  it("idempotenttir: tanım aynıysa hiçbir şey yazmaz", async () => {
    mocks.question.findMany.mockResolvedValue([
      { id: "q1", type: "SCALE", options: null },
    ]);
    mocks.surveyResponse.findMany.mockResolvedValue([
      { id: "r1", questionId: "q1", value: "4", score: 4 },
    ]);

    const result = await rescoreQuestions(["q1"]);

    expect(result).toEqual({ examined: 1, updated: 0, invalid: 0 });
    expect(mocks.surveyResponse.update).not.toHaveBeenCalled();
  });

  it("yeni tanıma göre geçersiz kalan cevabı sıfırlar ve sayar, silmez", async () => {
    mocks.question.findMany.mockResolvedValue([
      { id: "q1", type: "MULTIPLE_CHOICE", options: [{ value: "a", score: 4 }] },
    ]);
    mocks.surveyResponse.findMany.mockResolvedValue([
      { id: "r1", questionId: "q1", value: "kaldirilmis-sik", score: 2 },
    ]);

    const result = await rescoreQuestions(["q1"]);

    expect(result).toEqual({ examined: 1, updated: 1, invalid: 1 });
    expect(mocks.surveyResponse.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { score: 0 },
    });
  });

  it("boş listede sorgu yapmaz", async () => {
    const result = await rescoreQuestions([]);
    expect(result).toEqual({ examined: 0, updated: 0, invalid: 0 });
    expect(mocks.question.findMany).not.toHaveBeenCalled();
  });
});
