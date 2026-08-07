import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCOPE,
  SCOPE_LEVELS,
  type ScopeRule,
  buildScopeResolver,
  levelFromScope,
  resolveScope,
  scopeFromLevel,
} from "../sector-scope";

const TARIM = "sektor-tarim";
const YAZILIM = "sektor-yazilim";
const SERACILIK = "alt-seracilik";

const BIYOCESITLILIK = "bolum-biyocesitlilik";
const VERI_GUVENLIGI = "bolum-veri-guvenligi";
const ENERJI = "bolum-enerji";

const rules: ScopeRule[] = [
  // Tarımda biyoçeşitlilik çok önemli, veri güvenliği hiç sorulmuyor
  { sectorId: TARIM, subSectorId: null, subCategoryId: BIYOCESITLILIK, applicable: true, weight: 2 },
  { sectorId: TARIM, subSectorId: null, subCategoryId: VERI_GUVENLIGI, applicable: false, weight: 0 },
  // Yazılımda tersi
  { sectorId: YAZILIM, subSectorId: null, subCategoryId: BIYOCESITLILIK, applicable: false, weight: 0 },
  { sectorId: YAZILIM, subSectorId: null, subCategoryId: VERI_GUVENLIGI, applicable: true, weight: 2 },
  // Seracılık, tarımın genel kuralını ezip enerjiyi öne çıkarıyor
  { sectorId: TARIM, subSectorId: SERACILIK, subCategoryId: ENERJI, applicable: true, weight: 2 },
];

describe("scopeFromLevel / levelFromScope", () => {
  it("dört seviye tanımlı ve varsayılan ortadadır", () => {
    expect(SCOPE_LEVELS.map((l) => l.key)).toEqual(["EXCLUDED", "LOW", "NORMAL", "HIGH"]);
    expect(scopeFromLevel("NORMAL")).toEqual(DEFAULT_SCOPE);
  });

  it("seviye ile kapsam karşılıklı çevrilir", () => {
    expect(scopeFromLevel("EXCLUDED")).toEqual({ applicable: false, weight: 0 });
    expect(scopeFromLevel("HIGH")).toEqual({ applicable: true, weight: 2 });
    expect(levelFromScope({ applicable: false, weight: 0 })).toBe("EXCLUDED");
    expect(levelFromScope({ applicable: true, weight: 2 })).toBe("HIGH");
    expect(levelFromScope({ applicable: true, weight: 0.5 })).toBe("LOW");
  });

  it("elle girilmiş ara ağırlığı en yakın seviyeye düşürür", () => {
    // Ekranda bir seçenek işaretli kalmalı; 1.7 "Çok önemli"ye en yakın.
    expect(levelFromScope({ applicable: true, weight: 1.7 })).toBe("HIGH");
    expect(levelFromScope({ applicable: true, weight: 0.7 })).toBe("LOW");
  });
});

describe("resolveScope", () => {
  it("sektöre özel kuralı uygular", () => {
    expect(resolveScope(rules, { sectorId: TARIM, subSectorId: null }, BIYOCESITLILIK)).toEqual({
      applicable: true,
      weight: 2,
    });
    expect(resolveScope(rules, { sectorId: YAZILIM, subSectorId: null }, BIYOCESITLILIK)).toEqual({
      applicable: false,
      weight: 0,
    });
  });

  it("aynı bölüm sektöre göre tersine dönebilir", () => {
    const tarim = resolveScope(rules, { sectorId: TARIM, subSectorId: null }, VERI_GUVENLIGI);
    const yazilim = resolveScope(rules, { sectorId: YAZILIM, subSectorId: null }, VERI_GUVENLIGI);
    expect(tarim.applicable).toBe(false);
    expect(yazilim.applicable).toBe(true);
  });

  it("kuralı olmayan bölüm varsayılana düşer — yeni bölüm kaybolmaz", () => {
    expect(resolveScope(rules, { sectorId: TARIM, subSectorId: null }, "yeni-bolum")).toEqual(
      DEFAULT_SCOPE
    );
  });

  it("sektörü olmayan kullanıcıya her şey sorulur", () => {
    expect(resolveScope(rules, { sectorId: null, subSectorId: null }, VERI_GUVENLIGI)).toEqual(
      DEFAULT_SCOPE
    );
  });

  it("alt sektör kuralı sektör genelini ezer", () => {
    // Enerji için sektör geneli kural yok, seracılık kuralı var.
    expect(resolveScope(rules, { sectorId: TARIM, subSectorId: SERACILIK }, ENERJI)).toEqual({
      applicable: true,
      weight: 2,
    });
    // Seracılık dışındaki tarım firması varsayılana düşer.
    expect(resolveScope(rules, { sectorId: TARIM, subSectorId: "alt-tarla" }, ENERJI)).toEqual(
      DEFAULT_SCOPE
    );
  });

  it("alt sektör kuralı yoksa sektör geneline düşer", () => {
    expect(resolveScope(rules, { sectorId: TARIM, subSectorId: SERACILIK }, BIYOCESITLILIK)).toEqual({
      applicable: true,
      weight: 2,
    });
  });

  it("başka sektörün kuralı sızmaz", () => {
    const yabanci: ScopeRule[] = [
      { sectorId: YAZILIM, subSectorId: null, subCategoryId: ENERJI, applicable: false, weight: 0 },
    ];
    expect(resolveScope(yabanci, { sectorId: TARIM, subSectorId: null }, ENERJI)).toEqual(
      DEFAULT_SCOPE
    );
  });
});

describe("buildScopeResolver", () => {
  it("aynı sonucu verir ve tekrar çağrıda önbellekten döner", () => {
    const resolve = buildScopeResolver(rules, { sectorId: TARIM, subSectorId: null });
    expect(resolve(BIYOCESITLILIK)).toEqual({ applicable: true, weight: 2 });
    expect(resolve(BIYOCESITLILIK)).toEqual({ applicable: true, weight: 2 });
    expect(resolve(VERI_GUVENLIGI).applicable).toBe(false);
  });

  it("bölüm kimliği yoksa varsayılan döner", () => {
    // Doğrudan kategoriye bağlı sorularda bölüm yoktur.
    const resolve = buildScopeResolver(rules, { sectorId: TARIM, subSectorId: null });
    expect(resolve(null)).toEqual(DEFAULT_SCOPE);
    expect(resolve(undefined)).toEqual(DEFAULT_SCOPE);
  });

  it("kural yoksa hiçbir şey elenmez — mevcut kurulumlar etkilenmez", () => {
    const resolve = buildScopeResolver([], { sectorId: TARIM, subSectorId: null });
    expect(resolve(VERI_GUVENLIGI)).toEqual(DEFAULT_SCOPE);
  });
});
