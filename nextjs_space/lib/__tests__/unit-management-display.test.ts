import { describe, expect, it } from "vitest";
import { ironmanInsight, type IronmanSummary } from "../unit-management-display";

const base: IronmanSummary = {
  count: 6, velocity: 4, endurance: 3.6, threshold: 3,
  benchmarkVelocity: 2.5, benchmarkEndurance: 2.5,
  targetVelocity: 3, targetEndurance: 3,
  quadrant: "IRONMAN",
  distribution: [{ key: "IRONMAN", count: 6 }, { key: "SPRINTER", count: 0 }, { key: "MARATHON_RUNNER", count: 0 }, { key: "WALKER", count: 0 }],
};

describe("Ironman yorumu", () => {
  it("kadranı, sektör farkını, hedefi ve önceliği ölçülen değerlerden anlatır", () => {
    const { headline, points } = ironmanInsight(base);
    expect(headline).toBe("6 değerlendirmenin ortalaması Demir Adam kadranında: üyeler hem hızlı aksiyon alıyor hem de bunu politika ve süreçlerle kalıcı hâle getiriyor.");
    expect(points).toContain("Sektör ortalamasına (hız 2,5 · dayanıklılık 2,5) göre hızda 1,5 puan önde, dayanıklılıkta 1,1 puan önde.");
    expect(points).toContain("Sektörün gelecek yıl için beklenen ortalaması (hız 3,0 · dayanıklılık 3,0) iki eksende de şimdiden aşılmış.");
    expect(points).toContain("Öncelik konumu korumak. Görece düşük eksen dayanıklılık (3,6); ilerleme en çok burada kazanılır.");
    expect(points.some(point => point.startsWith("Ortalama dağılımı gizler"))).toBe(false);
  });

  it("kıyas kaydı yoksa sayı uydurmaz, hedefi atlar", () => {
    const { points } = ironmanInsight({ ...base, benchmarkVelocity: null, benchmarkEndurance: null, targetVelocity: null, targetEndurance: null });
    expect(points).toContain("Bu kapsamdaki sektörler için kayıtlı Ironman kıyası yok; konum sektöre göre yorumlanamıyor.");
    expect(points.some(point => point.includes("gelecek yıl"))).toBe(false);
  });

  it("hedefin yalnızca bir ekseni eksikse eksik olanı ve aşılanı ayrı söyler", () => {
    const { points } = ironmanInsight({ ...base, quadrant: "SPRINTER", velocity: 3.4, endurance: 2.3, targetVelocity: 3.2, targetEndurance: 3 });
    expect(points).toContain("Sektörün gelecek yıl için beklenen ortalaması (hız 3,2 · dayanıklılık 3,0) için dayanıklılıkta 0,7 puan artış gerekiyor. Hız bu seviyeyi zaten aşmış.");
    expect(points).toContain("Öncelik dayanıklılık: yapılan işleri yazılı politika, süreç ve ölçümle kalıcı hâle getirmek.");
  });

  it("Yaya kadranında eşiğe en yakın ekseni ve varılacak kadranı gösterir", () => {
    const { points } = ironmanInsight({ ...base, quadrant: "WALKER", velocity: 2.1, endurance: 2.6 });
    expect(points).toContain("Öncelik eşiğe en yakın eksen olan dayanıklılık (2,6): 0,4 puanlık artış üyeleri Maraton Koşucusu kadranına taşır.");
  });

  it("ortalamanın gizlediği dağılımı ve az veriyi belirtir", () => {
    const { headline, points } = ironmanInsight({
      ...base, count: 2,
      distribution: [{ key: "IRONMAN", count: 1 }, { key: "SPRINTER", count: 0 }, { key: "MARATHON_RUNNER", count: 0 }, { key: "WALKER", count: 1 }],
    });
    expect(headline.startsWith("2 değerlendirmenin ortalaması")).toBe(true);
    expect(points).toContain("Ortalama dağılımı gizler: Demir Adam 1 · Yaya 1 değerlendirme. Yaya kadranındaki üyeler ayrıca ele alınmalı.");
    expect(points).toContain("Yorum yalnızca 2 değerlendirmeye dayanıyor; daha çok üye gönderdikçe netleşir.");
  });

  it("iki eksen ölçülmemişse boş durumu açıklar", () => {
    const { headline } = ironmanInsight({ ...base, count: 0, velocity: null, endurance: null, quadrant: null });
    expect(headline).toBe("Henüz hız ve dayanıklılığın birlikte ölçüldüğü bir değerlendirme yok.");
  });
});
