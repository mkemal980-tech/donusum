import { describe, expect, it } from "vitest";
import {
  type QuestionContext,
  type RecommendationImportRow,
  buildRecommendationPayload,
  checkLadders,
  choicesForRow,
  isCascadeRow,
  isEmptyRow,
  matchQuestion,
  matchTrigger,
  normalizeRow,
  validateRecommendationRow,
} from "../recommendation-import";
import { RECOMMENDATION_COLUMNS, templateMatchesImportFields } from "../recommendation-template";

/** A=0, B=1, C=2, D=3 puanlı dört şıklı bir olgunluk sorusu. */
const question: QuestionContext = {
  id: "q1",
  text: "Tersaneniz emisyon azaltımı için hangi yaklaşımı izliyor?",
  type: "MULTIPLE_CHOICE",
  options: [
    { value: "takip_yok", label: "Takip yok", score: 0 },
    { value: "manuel", label: "Manuel takip", score: 1 },
    { value: "dijital", label: "Dijital takip", score: 2 },
    { value: "entegre", label: "Entegre sistem", score: 3 },
  ],
  categoryId: "cat-1",
  subCategoryId: "sub-1",
  subLevelId: "lvl-1",
};

const questions = [question];

function row(overrides: Partial<RecommendationImportRow> = {}): RecommendationImportRow {
  return {
    soru_metni: question.text,
    tetikleyici: "Takip yok",
    kademeli: "EVET",
    baslik: "Kapsam 1-2 emisyon envanteri oluşturun",
    aciklama: "Yakıt ve elektrik tüketiminizi aylık kayıt altına alın.",
    vade: "KISA",
    strateji: "HIZLI_KAZANIM",
    maliyet: "OPEX",
    etki: "7",
    puan: "",
    video_url: "",
    sira: "1",
    ...overrides,
  };
}

describe("şablon ile içe aktarma alanları", () => {
  it("kolon sırası ve adları birebir eşleşir", () => {
    // Uyuşmazsa Excel başlıkları okunamaz ve tüm satırlar boş görünür.
    expect(templateMatchesImportFields()).toBe(true);
    expect(RECOMMENDATION_COLUMNS.length).toBeGreaterThan(0);
  });
});

describe("normalizeRow / isEmptyRow", () => {
  it("bilinmeyen kolonları yok sayar, sayıyı metne çevirir", () => {
    const normalized = normalizeRow({ baslik: "Test", etki: 7, alakasiz: "x" });
    expect(normalized.baslik).toBe("Test");
    expect(normalized.etki).toBe("7");
    expect("alakasiz" in normalized).toBe(false);
  });

  it("tamamen boş satırı tanır", () => {
    expect(isEmptyRow(normalizeRow({}))).toBe(true);
    expect(isEmptyRow(normalizeRow({ baslik: "Test" }))).toBe(false);
  });
});

describe("matchQuestion", () => {
  it("büyük/küçük harf ve fazla boşluk farkını yok sayar", () => {
    const match = matchQuestion(
      row({ soru_metni: "  TERSANENİZ EMİSYON AZALTIMI İÇİN   HANGİ YAKLAŞIMI İZLİYOR?  " }),
      questions
    );
    expect(match.found).toBe(true);
  });

  it("eşleşme yoksa sebebini bildirir", () => {
    const match = matchQuestion(row({ soru_metni: "Ankette olmayan soru" }), questions);
    expect(match).toEqual({ found: false, reason: "missing" });
  });

  it("aynı metinli iki soru varsa belirsiz sayar", () => {
    const duplicate = { ...question, id: "q2" };
    const match = matchQuestion(row(), [question, duplicate]);
    expect(match).toEqual({ found: false, reason: "ambiguous" });
  });
});

describe("matchTrigger", () => {
  it("şık etiketiyle eşleşir", () => {
    const match = matchTrigger(row({ tetikleyici: "Dijital takip" }), question);
    expect(match.found).toBe(true);
    if (!match.found) return;
    expect(match.choice.score).toBe(2);
  });

  it("teknik şık değeriyle de eşleşir", () => {
    const match = matchTrigger(row({ tetikleyici: "entegre" }), question);
    expect(match.found).toBe(true);
    if (!match.found) return;
    expect(match.choice.score).toBe(3);
  });

  it("olmayan şıkta geçerli listeyi döner", () => {
    const match = matchTrigger(row({ tetikleyici: "Yok böyle bir şık" }), question);
    expect(match.found).toBe(false);
    if (match.found) return;
    expect(match.reason).toBe("missing");
    expect(match.choices).toHaveLength(4);
  });

  it("choicesForRow eşleşen sorunun şıklarını verir", () => {
    expect(choicesForRow(row(), questions)).toHaveLength(4);
    expect(choicesForRow(row({ soru_metni: "yok" }), questions)).toHaveLength(0);
  });
});

describe("validateRecommendationRow", () => {
  it("geçerli satırda hata üretmez", () => {
    expect(validateRecommendationRow(row(), question)).toEqual([]);
  });

  it("başlık boşsa hata verir", () => {
    const errors = validateRecommendationRow(row({ baslik: "" }), question);
    expect(errors.some((error) => error.field === "baslik")).toBe(true);
  });

  it("belirsiz eşleşmede metni kopyalamayı değil, kopya soruyu işaret eder", () => {
    const errors = validateRecommendationRow(row(), null, "ambiguous");
    const message = errors.find((error) => error.field === "soru_metni")?.message ?? "";
    expect(message).toContain("birden fazla soru");
    expect(message).not.toContain("kopyalayın");
  });

  it("soru eşleşmediyse soru_metni hatası verir", () => {
    const errors = validateRecommendationRow(row({ soru_metni: "yok" }), null);
    expect(errors.some((error) => error.field === "soru_metni")).toBe(true);
    // Bağlam olmadığı için tetikleyici kontrolü yapılmaz.
    expect(errors.some((error) => error.field === "tetikleyici")).toBe(false);
  });

  it("tetikleyici şık listesinde yoksa geçerli değerleri mesajda verir", () => {
    const errors = validateRecommendationRow(row({ tetikleyici: "Uydurma" }), question);
    const trigger = errors.find((error) => error.field === "tetikleyici");
    expect(trigger?.message).toContain("Entegre sistem");
  });

  it("vade ve strateji kısıtlı listeden olmalı", () => {
    const errors = validateRecommendationRow(row({ vade: "YAKINDA", strateji: "BELKI" }), question);
    expect(errors.some((error) => error.field === "vade")).toBe(true);
    expect(errors.some((error) => error.field === "strateji")).toBe(true);
  });

  it("etki 1-10 dışında olamaz", () => {
    expect(validateRecommendationRow(row({ etki: "0" }), question).some((e) => e.field === "etki")).toBe(true);
    expect(validateRecommendationRow(row({ etki: "11" }), question).some((e) => e.field === "etki")).toBe(true);
    expect(validateRecommendationRow(row({ etki: "abc" }), question).some((e) => e.field === "etki")).toBe(true);
  });

  it("kademeli öneride puan alanı yok sayılır, kademesizde doğrulanır", () => {
    // Kademelide katkı basamaktan türetildiği için girilen değer denetlenmez.
    expect(
      validateRecommendationRow(row({ kademeli: "EVET", puan: "abc" }), question).some(
        (error) => error.field === "puan"
      )
    ).toBe(false);
    expect(
      validateRecommendationRow(row({ kademeli: "HAYIR", puan: "abc" }), question).some(
        (error) => error.field === "puan"
      )
    ).toBe(true);
  });

  it("video bağlantısı http ile başlamalı", () => {
    const errors = validateRecommendationRow(row({ video_url: "youtube.com/x" }), question);
    expect(errors.some((error) => error.field === "video_url")).toBe(true);
  });
});

describe("buildRecommendationPayload", () => {
  it("kademeli satırda eşiği şık puanından alır ve tam eşleşmeyi boş bırakır", () => {
    const payload = buildRecommendationPayload(
      row({ tetikleyici: "Dijital takip", kademeli: "EVET" }),
      question,
      1
    );
    expect(payload.triggerMaxAnswerScore).toBe(2);
    expect(payload.triggerOptions).toBeNull();
    // Kademelide puan kullanılmaz.
    expect(payload.points).toBe(0);
  });

  it("kademesiz satırda tam eşleşme listesi kurar", () => {
    const payload = buildRecommendationPayload(
      row({ tetikleyici: "Entegre sistem", kademeli: "HAYIR", puan: "0,5" }),
      question,
      1
    );
    expect(payload.triggerMaxAnswerScore).toBeNull();
    expect(payload.triggerOptions).toBe(JSON.stringify(["entegre"]));
    expect(payload.points).toBe(0.5);
  });

  it("kapsamı sorunun yerleşiminden devralır", () => {
    const payload = buildRecommendationPayload(row(), question, 1);
    expect(payload.questionId).toBe("q1");
    expect(payload.subLevelId).toBe("lvl-1");
    // Alt seviye varsa alt kategori boş bırakılır (panel ile aynı kural).
    expect(payload.subCategoryId).toBeNull();
    expect(payload.categoryId).toBe("cat-1");
  });

  it("Türkçe anahtarları Prisma enum'larına çevirir", () => {
    const payload = buildRecommendationPayload(
      row({ vade: "UZUN", strateji: "BUYUK_YATIRIM", maliyet: "CAPEX" }),
      question,
      1
    );
    expect(payload.timeframe).toBe("LONG_TERM");
    expect(payload.strategicType).toBe("BIG_BET");
    expect(payload.costType).toBe("CAPEX");
  });

  it("sıra boşsa satır sırasını kullanır", () => {
    expect(buildRecommendationPayload(row({ sira: "" }), question, 7).order).toBe(7);
  });
});

describe("checkLadders", () => {
  const full = ["Takip yok", "Manuel takip", "Dijital takip", "Entegre sistem"].map((trigger, index) =>
    row({ tetikleyici: trigger, baslik: `Öneri ${index + 1}`, sira: String(index + 1) })
  );

  it("merdiven tamsa uyarı üretmez", () => {
    expect(checkLadders(full, questions)).toEqual([]);
  });

  it("eksik basamağı isimleriyle bildirir", () => {
    const warnings = checkLadders(full.slice(0, 2), questions);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("Dijital takip");
    expect(warnings[0].message).toContain("Entegre sistem");
  });

  it("kademeli ile tam eşleşme karışımını uyarır", () => {
    const mixed = [...full, row({ tetikleyici: "Manuel takip", kademeli: "HAYIR", baslik: "Ek" })];
    const warnings = checkLadders(mixed, questions);
    expect(
      warnings.some((warning) => warning.message.includes("hem kademeli hem tam eşleşme"))
    ).toBe(true);
  });

  it("aynı sorudaki yinelenen başlığı uyarır", () => {
    const duplicated = [...full, row({ tetikleyici: "Manuel takip", baslik: "Öneri 1" })];
    const warnings = checkLadders(duplicated, questions);
    expect(warnings.some((warning) => warning.message.includes("Aynı başlık"))).toBe(true);
  });

  it("eşleşmeyen soruların satırlarını sessizce atlar", () => {
    expect(checkLadders([row({ soru_metni: "yok" })], questions)).toEqual([]);
  });
});

describe("isCascadeRow", () => {
  it("yalnızca EVET kademeli sayılır", () => {
    expect(isCascadeRow(row({ kademeli: "EVET" }))).toBe(true);
    expect(isCascadeRow(row({ kademeli: "evet" }))).toBe(true);
    expect(isCascadeRow(row({ kademeli: "HAYIR" }))).toBe(false);
    expect(isCascadeRow(row({ kademeli: "" }))).toBe(false);
  });
});
