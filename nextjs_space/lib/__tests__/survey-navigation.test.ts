import { describe, expect, it } from "vitest";
import {
  type NavCategory,
  buildSteps,
  categoryProgress,
  categorySummaries,
  displaySubCategories,
  estimateMinutes,
  findResumeStepIndex,
  overallProgress,
  stepProgress,
  unansweredInStep,
} from "../survey-navigation";

/**
 * Örnek yapı — üç farklı bölüm biçimini birden içerir:
 *   K1: doğrudan kategoriye bağlı sorular + alt seviyeli alt kategori
 *   K2: alt seviyesiz alt kategori
 *   K3: hiç sorusu olmayan alt kategori (atlanmalı)
 */
const categories: NavCategory[] = [
  {
    id: "k1",
    name: "Kategori 1",
    questions: [{ id: "q1" }, { id: "q2" }],
    subCategories: [
      {
        id: "a1",
        name: "Alt 1",
        hasSubLevels: true,
        subLevels: [
          { id: "s1", name: "Seviye 1", questions: [{ id: "q3" }, { id: "q4" }, { id: "q5" }] },
          { id: "s2", name: "Seviye 2", questions: [{ id: "q6" }] },
        ],
      },
    ],
  },
  {
    id: "k2",
    name: "Kategori 2",
    subCategories: [
      { id: "a2", name: "Alt 2", hasSubLevels: false, questions: [{ id: "q7" }, { id: "q8" }] },
    ],
  },
  {
    id: "k3",
    name: "Kategori 3",
    subCategories: [
      { id: "a3", name: "Boş alt kategori", hasSubLevels: false, questions: [] },
      { id: "a4", name: "Boş seviyeli", hasSubLevels: true, subLevels: [{ id: "s3", name: "Boş", questions: [] }] },
    ],
  },
];

describe("displaySubCategories", () => {
  it("doğrudan kategori sorularını sanal bir bölüme sarar ve başa koyar", () => {
    const sections = displaySubCategories(categories[0]);
    expect(sections).toHaveLength(2);
    expect(sections[0].isCategoryDirect).toBe(true);
    expect(sections[0].name).toBe("Kategori Soruları");
    expect(sections[1].name).toBe("Alt 1");
  });

  it("doğrudan soru yoksa sanal bölüm eklemez", () => {
    expect(displaySubCategories(categories[1])).toHaveLength(1);
  });

  it("kategori yoksa boş dizi döner", () => {
    expect(displaySubCategories(undefined)).toEqual([]);
  });
});

describe("buildSteps", () => {
  const steps = buildSteps(categories);

  it("her soru grubunu bir adıma çevirir", () => {
    // K1: doğrudan(1) + seviye1 + seviye2 = 3, K2: 1, K3: 0 (boşlar atlanır)
    expect(steps).toHaveLength(4);
  });

  it("sorusu olmayan bölümleri atlar — boş ekran gösterilmez", () => {
    expect(steps.some((step) => step.categoryId === "k3")).toBe(false);
  });

  it("adım etiketlerini doğru kurar", () => {
    expect(steps[0]).toMatchObject({
      categoryName: "Kategori 1",
      subCategoryName: "Kategori Soruları",
      subLevelName: null,
      questionIds: ["q1", "q2"],
    });
    expect(steps[1]).toMatchObject({
      subCategoryName: "Alt 1",
      subLevelName: "Seviye 1",
      questionIds: ["q3", "q4", "q5"],
    });
    expect(steps[3]).toMatchObject({
      categoryName: "Kategori 2",
      subCategoryName: "Alt 2",
      subLevelName: null,
    });
  });

  it("ağaçtaki indeksleri korur", () => {
    expect(steps[2]).toMatchObject({ categoryIndex: 0, subCategoryIndex: 1, subLevelIndex: 1 });
    expect(steps[3]).toMatchObject({ categoryIndex: 1, subCategoryIndex: 0, subLevelIndex: 0 });
  });

  it("boş ankette boş dizi döner", () => {
    expect(buildSteps([])).toEqual([]);
  });
});

describe("ilerleme hesapları", () => {
  const steps = buildSteps(categories);
  const responses = { q1: "a", q3: "b", q4: "c" };

  it("adım ilerlemesi yalnızca o ekranın sorularına bakar", () => {
    expect(stepProgress(steps[0], responses)).toEqual({ answered: 1, total: 2, percentage: 50 });
    // 3 sorunun 2'si → %67
    expect(stepProgress(steps[1], responses)).toEqual({ answered: 2, total: 3, percentage: 67 });
    expect(stepProgress(steps[3], responses)).toEqual({ answered: 0, total: 2, percentage: 0 });
  });

  it("kategori ilerlemesi kategorinin tüm adımlarını toplar", () => {
    // K1: q1..q6 → 6 soru, 3'ü cevaplı
    expect(categoryProgress(steps, "k1", responses)).toEqual({ answered: 3, total: 6, percentage: 50 });
    expect(categoryProgress(steps, "k2", responses)).toEqual({ answered: 0, total: 2, percentage: 0 });
  });

  it("genel ilerleme tüm soruları kapsar", () => {
    expect(overallProgress(steps, responses)).toEqual({ answered: 3, total: 8, percentage: 38 });
  });

  it("boş metin cevaplanmış sayılmaz", () => {
    expect(stepProgress(steps[0], { q1: "", q2: "" })).toMatchObject({ answered: 0 });
  });

  it("soru yoksa yüzde sıfıra bölünmez", () => {
    expect(stepProgress(undefined, {})).toEqual({ answered: 0, total: 0, percentage: 0 });
  });
});

describe("categorySummaries", () => {
  it("adım sırasını koruyarak kategorileri özetler", () => {
    const summaries = categorySummaries(buildSteps(categories));
    expect(summaries).toEqual([
      { categoryId: "k1", categoryName: "Kategori 1", firstStepIndex: 0, stepCount: 3 },
      { categoryId: "k2", categoryName: "Kategori 2", firstStepIndex: 3, stepCount: 1 },
    ]);
  });

  it("sorusu olmayan kategori haritada görünmez", () => {
    const summaries = categorySummaries(buildSteps(categories));
    expect(summaries.some((s) => s.categoryId === "k3")).toBe(false);
  });
});

describe("findResumeStepIndex", () => {
  const steps = buildSteps(categories);

  it("hiç cevap yoksa ilk adımdan başlar", () => {
    expect(findResumeStepIndex(steps, {})).toBe(0);
  });

  it("eksik sorusu olan ilk adıma götürür", () => {
    // 1. adım tam, 2. adımda eksik var
    const responses = { q1: "a", q2: "b", q3: "c" };
    expect(findResumeStepIndex(steps, responses)).toBe(1);
  });

  it("aradaki adım tamsa sonrakine atlar", () => {
    const responses = { q1: "a", q2: "b", q3: "c", q4: "d", q5: "e" };
    expect(findResumeStepIndex(steps, responses)).toBe(2);
  });

  it("her şey cevaplıysa son adıma götürür — tamamla düğmesi görünsün", () => {
    const all = Object.fromEntries(
      steps.flatMap((s) => s.questionIds).map((id) => [id, "x"])
    );
    expect(findResumeStepIndex(steps, all)).toBe(steps.length - 1);
  });

  it("adım yoksa sıfır döner", () => {
    expect(findResumeStepIndex([], {})).toBe(0);
  });
});

describe("unansweredInStep", () => {
  const steps = buildSteps(categories);

  it("eksik soru sayısını verir", () => {
    expect(unansweredInStep(steps[1], { q3: "a" })).toBe(2);
    expect(unansweredInStep(steps[1], { q3: "a", q4: "b", q5: "c" })).toBe(0);
  });

  it("adım yoksa sıfır döner", () => {
    expect(unansweredInStep(undefined, {})).toBe(0);
  });
});

describe("estimateMinutes", () => {
  it("ilk sorulara daha çok süre ayırır", () => {
    // 5 × 45 sn = 225 sn ≈ 4 dk
    expect(estimateMinutes(5)).toBe(4);
    // 225 + 25×20 = 725 sn ≈ 12 dk
    expect(estimateMinutes(30)).toBe(12);
  });

  it("soru yoksa sıfır, tek soruda en az bir dakika", () => {
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(1)).toBe(1);
  });

  it("uzun ankette makul bir süre verir", () => {
    // 71 soru → 225 + 66×20 = 1545 sn ≈ 26 dk
    expect(estimateMinutes(71)).toBe(26);
  });
});
