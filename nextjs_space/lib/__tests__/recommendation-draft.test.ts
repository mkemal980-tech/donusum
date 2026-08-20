import { describe, expect, it } from "vitest";
import {
  buildDraftPrompt,
  checkPoolAdherence,
  draftToImportRow,
} from "../recommendation-draft";
import type { RecommendationImportRow } from "../recommendation-import";

const choices = [
  { value: "takip_yok", label: "Takip yok", score: 0 },
  { value: "manuel", label: "Manuel takip", score: 1 },
  { value: "dijital", label: "Dijital takip", score: 2 },
  { value: "entegre", label: "Entegre sistem", score: 3 },
];

const question = { text: "Emisyon azaltımı için hangi yaklaşımı izliyorsunuz?", choices };

const POOL = [
  "Kapsam 1-2 emisyon envanteri oluşturun",
  "Ölçümü dijital bir sisteme taşıyın",
  "Bilim temelli azaltım hedefi belirleyip doğrulatın",
];

function row(overrides: Partial<RecommendationImportRow> = {}): RecommendationImportRow {
  return { soru_metni: question.text, baslik: POOL[0], ...overrides };
}

describe("buildDraftPrompt", () => {
  it("şıkları olgunluk puanlarıyla sıralı verir", () => {
    const prompt = buildDraftPrompt(question, "Gemi İnşa");
    expect(prompt).toContain("Gemi İnşa");
    expect(prompt).toContain('1. "Takip yok" (olgunluk puanı 0)');
    expect(prompt).toContain('4. "Entegre sistem" (olgunluk puanı 3)');
  });

  it("havuz yoksa havuz bloğu eklenmez", () => {
    expect(buildDraftPrompt(question, "Genel")).not.toContain("HAVUZ:");
  });

  it("havuz verilirse maddeleri numaralı listeler", () => {
    const prompt = buildDraftPrompt(question, "Genel", POOL);
    expect(prompt).toContain("HAVUZ:");
    expect(prompt).toContain("1. Kapsam 1-2 emisyon envanteri oluşturun");
  });

  it("şık etiketinin birebir kopyalanmasını ister", () => {
    // Bu vurgu kalkarsa model kendi kelimeleriyle yazar ve tetikleyici eşleşmez.
    expect(buildDraftPrompt(question, "Genel")).toContain("BİREBİR");
  });
});

describe("draftToImportRow", () => {
  it("taslağı Excel satırıyla aynı biçime çevirir ve kademeli kurar", () => {
    const converted = draftToImportRow(
      {
        tetikleyici: "Manuel takip",
        baslik: "Ölçümü dijital bir sisteme taşıyın",
        aciklama: "Açıklama",
        vade: "orta",
        strateji: "proje",
        maliyet: "opex",
        etki: 6,
      },
      question.text,
      2
    );

    expect(converted.kademeli).toBe("EVET");
    expect(converted.vade).toBe("ORTA");
    expect(converted.strateji).toBe("PROJE");
    expect(converted.maliyet).toBe("OPEX");
    expect(converted.etki).toBe("6");
    // Kademeli olduğu için puan elle verilmez.
    expect(converted.puan).toBe("");
    expect(converted.sira).toBe("2");
  });

  it("eksik alanları boş metne düşürür — çökmez", () => {
    const converted = draftToImportRow({}, question.text, 1);
    expect(converted.baslik).toBe("");
    expect(converted.tetikleyici).toBe("");
    expect(converted.maliyet).toBe("OPEX");
  });
});

describe("checkPoolAdherence", () => {
  it("havuz verilmediyse denetim yapmaz", () => {
    expect(checkPoolAdherence([row({ baslik: "Uydurma" })], [], question.text)).toEqual([]);
  });

  it("tüm başlıklar havuzdaysa uyarı üretmez", () => {
    const rows = POOL.map((title) => row({ baslik: title }));
    expect(checkPoolAdherence(rows, POOL, question.text)).toEqual([]);
  });

  it("havuz dışı başlığı yakalar", () => {
    // Gözlemlenen gerçek davranış: prompt "sadece havuzdan seç" dese de model
    // zaman zaman kendi başlığını yazıyor.
    const rows = [row({ baslik: POOL[0] }), row({ baslik: "Entegre sistem kurarak veri birleştirin" })];
    const warnings = checkPoolAdherence(rows, POOL, question.text);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain("Havuz dışından 1 öneri");
    expect(warnings[0].message).toContain("Entegre sistem kurarak veri birleştirin");
  });

  it("havuz dışı varsa kullanılmayan maddeleri de bildirir", () => {
    const rows = [row({ baslik: POOL[0] }), row({ baslik: "Uydurma öneri" })];
    const warnings = checkPoolAdherence(rows, POOL, question.text);
    const unused = warnings.find((warning) => warning.message.includes("kullanılmayan"));

    expect(unused?.message).toContain(POOL[1]);
    expect(unused?.message).toContain(POOL[2]);
  });

  it("büyük/küçük harf, fazla boşluk ve sondaki noktalama farkını yok sayar", () => {
    const rows = [row({ baslik: "  KAPSAM 1-2 EMİSYON   ENVANTERİ OLUŞTURUN.  " })];
    expect(checkPoolAdherence(rows, [POOL[0]], question.text)).toEqual([]);
  });

  it("boş başlıklı satırları denetime katmaz", () => {
    expect(checkPoolAdherence([row({ baslik: "" })], POOL, question.text)).toEqual([]);
  });
});
