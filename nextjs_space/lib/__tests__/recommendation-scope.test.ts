import { describe, expect, it } from "vitest";
import {
  type ScopeCategory,
  type ScopedRecommendation,
  buildScopeIndex,
  buildScopeTree,
  describeScope,
  matchesScope,
  resolvePaths,
  resolveRecommendationPath,
  scopesEqual,
} from "../recommendation-scope";

/**
 * Örnek ağaç — bağlanma biçimlerinin hepsi bir arada:
 *   c1 / sc1 (alt seviyesiz, iki soru)
 *   c1 / sc2 (alt seviyeli) / sl1 (bir soru)
 *   c2 / sc3 — başka ankete ait
 */
const categories: ScopeCategory[] = [
  {
    id: "c1",
    name: "Çevresel",
    surveyId: "s1",
    subCategories: [
      {
        id: "sc1",
        name: "Enerji",
        hasSubLevels: false,
        questions: [
          { id: "q1", text: "Soru bir" },
          { id: "q2", text: "Soru iki" },
        ],
      },
      {
        id: "sc2",
        name: "Atık",
        hasSubLevels: true,
        subLevels: [{ id: "sl1", name: "Seviye 1", questions: [{ id: "q3", text: "Soru üç" }] }],
      },
    ],
  },
  {
    id: "c2",
    name: "Sosyal",
    surveyId: "s2",
    subCategories: [
      { id: "sc3", name: "İnsan", hasSubLevels: false, questions: [{ id: "q4", text: "Soru dört" }] },
    ],
  },
];

const index = buildScopeIndex(categories);

/** Her satır farklı bir bağlanma biçimi. */
const recommendations: ScopedRecommendation[] = [
  { id: "r1", questionId: "q1", subCategoryId: "sc1" },
  { id: "r2", subCategoryId: "sc1" },
  { id: "r3", subLevelId: "sl1" },
  { id: "r4", questionId: "q3", subLevelId: "sl1" },
  { id: "r5", categoryId: "c1" },
  { id: "r6" },
  // Arşivlenmiş soruya bağlı: dizinde yok, bir üst seviyeye düşmeli.
  { id: "r7", questionId: "silinmis", subCategoryId: "sc1" },
];

const paths = resolvePaths(recommendations, index);
const pathOf = (id: string) => paths.get(id)!;

describe("buildScopeIndex", () => {
  it("alt seviyedeki sorunun yolunu tepeye kadar çıkarır", () => {
    expect(index.pathOfQuestion.get("q3")).toEqual({
      surveyId: "s1",
      categoryId: "c1",
      subCategoryId: "sc2",
      subLevelId: "sl1",
      questionId: "q3",
    });
  });

  it("alt seviyesiz bölümün sorusunda subLevelId boş kalır", () => {
    expect(index.pathOfQuestion.get("q1")?.subLevelId).toBeNull();
    expect(index.pathOfQuestion.get("q1")?.subCategoryId).toBe("sc1");
  });

  it("kategorinin anketini kaydeder", () => {
    expect(index.surveyOfCategory.get("c1")).toBe("s1");
    expect(index.surveyOfCategory.get("c2")).toBe("s2");
  });
});

describe("resolveRecommendationPath", () => {
  it("soruya bağlı öneri en derin yoldan çözülür", () => {
    expect(pathOf("r1").questionId).toBe("q1");
    expect(pathOf("r1").surveyId).toBe("s1");
  });

  it("alt seviyeye bağlı öneri bölümü ve kategoriyi de taşır", () => {
    expect(pathOf("r3")).toEqual({
      surveyId: "s1",
      categoryId: "c1",
      subCategoryId: "sc2",
      subLevelId: "sl1",
      questionId: null,
    });
  });

  it("yalnızca kategoriye bağlı öneri anketini kategoriden alır", () => {
    // Anket filtresi bu yolu hiç saymıyordu; öneri ankete göre süzülünce
    // kayboluyordu.
    expect(pathOf("r5")).toEqual({
      surveyId: "s1",
      categoryId: "c1",
      subCategoryId: null,
      subLevelId: null,
      questionId: null,
    });
  });

  it("hiçbir yere bağlanmamış öneri boş yol döner", () => {
    expect(pathOf("r6").categoryId).toBeNull();
    expect(pathOf("r6").surveyId).toBeNull();
  });

  it("arşivlenmiş soruya bağlı öneri bir üst seviyeye düşer, kaybolmaz", () => {
    expect(pathOf("r7").subCategoryId).toBe("sc1");
    expect(pathOf("r7").surveyId).toBe("s1");
    // Soru kimliği korunur; "bir soruya bağlıydı" bilgisi kaybolmamalı.
    expect(pathOf("r7").questionId).toBe("silinmis");
  });
});

describe("matchesScope", () => {
  const idsIn = (scope: Parameters<typeof matchesScope>[1]) =>
    recommendations.filter((rec) => matchesScope(pathOf(rec.id), scope)).map((rec) => rec.id);

  it("all her şeyi alır", () => {
    expect(idsIn({ kind: "all" })).toHaveLength(7);
  });

  it("kategori alt seviyeleri de kapsar", () => {
    expect(idsIn({ kind: "category", id: "c1" })).toEqual(["r1", "r2", "r3", "r4", "r5", "r7"]);
  });

  it("bölüm altındaki soruları da kapsar", () => {
    expect(idsIn({ kind: "subCategory", id: "sc1" })).toEqual(["r1", "r2", "r7"]);
  });

  it("bölüme doğrudan bağlı olanlar soruya bağlı olanları dışarıda bırakır", () => {
    expect(idsIn({ kind: "subCategoryDirect", id: "sc1" })).toEqual(["r2"]);
  });

  it("alt seviyeye inmiş öneri bölümün doğrudan sayımına girmez", () => {
    // Girseydi aynı öneri hem seviyede hem burada görünür, toplam şişerdi.
    expect(idsIn({ kind: "subCategoryDirect", id: "sc2" })).toEqual([]);
    expect(idsIn({ kind: "subLevelDirect", id: "sl1" })).toEqual(["r3"]);
  });

  it("soru kapsamı tam eşleşir", () => {
    expect(idsIn({ kind: "question", id: "q3" })).toEqual(["r4"]);
    expect(idsIn({ kind: "question", id: "q2" })).toEqual([]);
  });

  it("unplaced yalnızca hiçbir yere bağlanmamışları alır", () => {
    expect(idsIn({ kind: "unplaced" })).toEqual(["r6"]);
  });
});

describe("buildScopeTree", () => {
  const tree = buildScopeTree(categories, paths, "s1");

  it("başka ankete ait kategoriyi dışarıda bırakır", () => {
    expect(tree.map((node) => node.label)).toEqual(["Çevresel"]);
  });

  it("anket verilmezse hepsini getirir", () => {
    expect(buildScopeTree(categories, paths).map((node) => node.label)).toEqual([
      "Çevresel",
      "Sosyal",
    ]);
  });

  it("her seviyede öneri sayısını taşır", () => {
    expect(tree[0].count).toBe(6);
    expect(tree[0].children.map((node) => [node.label, node.count])).toEqual([
      ["Enerji", 3],
      ["Atık", 2],
    ]);
  });

  it("önerisi olmayan soruyu da listeler", () => {
    // "Bu soruya hiç öneri bağlanmamış" bilgisi elenirse görünmez olur.
    const energy = tree[0].children[0];
    expect(energy.children.map((node) => [node.label, node.count])).toEqual([
      ["Soru bir", 1],
      ["Soru iki", 0],
      ["Soruya bağlı olmayanlar", 1],
    ]);
  });

  it("doğrudan bağlı öneri yoksa o satırı hiç çizmez", () => {
    const waste = tree[0].children[1];
    expect(waste.children.map((node) => node.label)).toEqual(["Seviye 1"]);

    const level = waste.children[0];
    expect(level.count).toBe(2);
    expect(level.children.map((node) => [node.label, node.count])).toEqual([
      ["Soru üç", 1],
      ["Soruya bağlı olmayanlar", 1],
    ]);
  });
});

describe("describeScope", () => {
  const tree = buildScopeTree(categories, paths, "s1");

  it("seçili yerin tam yolunu yazar", () => {
    expect(describeScope({ kind: "question", id: "q3" }, tree)).toBe("Çevresel › Atık › Seviye 1 › Soru üç");
  });

  it("tümü seçiliyken bir şey yazmaz", () => {
    expect(describeScope({ kind: "all" }, tree)).toBeNull();
  });

  it("ağaçta olmayan kapsam için null döner", () => {
    expect(describeScope({ kind: "question", id: "yok" }, tree)).toBeNull();
  });
});

describe("scopesEqual", () => {
  it("tür ve kimlik birlikte karşılaştırılır", () => {
    expect(scopesEqual({ kind: "question", id: "q1" }, { kind: "question", id: "q1" })).toBe(true);
    expect(scopesEqual({ kind: "question", id: "q1" }, { kind: "subCategory", id: "q1" })).toBe(false);
    expect(scopesEqual({ kind: "all" }, { kind: "all" })).toBe(true);
  });
});

describe("resolveRecommendationPath boş girdi", () => {
  it("boş ağaçta çökmez", () => {
    const emptyIndex = buildScopeIndex([]);
    expect(resolveRecommendationPath({ id: "x", questionId: "q1" }, emptyIndex).categoryId).toBeNull();
    expect(buildScopeTree([], new Map())).toEqual([]);
  });
});
