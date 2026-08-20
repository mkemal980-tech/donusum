import { describe, expect, it } from "vitest";
import {
  ImportRow,
  StructureOption,
  buildQuestionPayload,
  fieldsForType,
  isEmptyRow,
  normalizeRow,
  parseNumeric,
  resolveStructure,
  validateQuestionRow,
} from "../question-import";

const structure: StructureOption[] = [
  {
    categoryId: "cat1",
    category: "Çevre",
    subCategoryId: "sub1",
    subCategory: "Emisyon Yönetimi",
    hasSubLevels: true,
    subLevelId: "lvl1",
    subLevel: "Ölçüm ve İzleme",
  },
  {
    categoryId: "cat1",
    category: "Çevre",
    subCategoryId: "sub1",
    subCategory: "Emisyon Yönetimi",
    hasSubLevels: true,
    subLevelId: "lvl2",
    subLevel: "Azaltım",
  },
  {
    categoryId: "cat2",
    category: "Sosyal",
    subCategoryId: "sub2",
    subCategory: "Çalışan Hakları",
    hasSubLevels: false,
    subLevelId: null,
    subLevel: null,
  },
];

const validRow: ImportRow = {
  kategori_adi: "Çevre",
  alt_kategori_adi: "Emisyon Yönetimi",
  alt_seviye_adi: "Azaltım",
  soru_metni: "Emisyon azaltım hedefiniz var mı?",
  soru_tipi: "COKTAN_SECMELI",
  soru_agirligi: "1,5",
  ironman_ekseni: "VELOCITY",
  sira: "3",
  kanit_gerekli: "FALSE",
  secenekler: "Yok = 1; Var = 5",
};

describe("normalizeRow", () => {
  it("Excel'den gelen sayı ve boolean hücreleri metne çevirir", () => {
    const row = normalizeRow({ soru_agirligi: 1.5, kanit_gerekli: true, soru_metni: "  Soru  " });

    expect(row.soru_agirligi).toBe("1.5");
    expect(row.kanit_gerekli).toBe("TRUE");
    expect(row.soru_metni).toBe("Soru");
  });

  it("eksik kolonları boş metin yapar", () => {
    const row = normalizeRow({});
    expect(row.secenekler).toBe("");
    expect(isEmptyRow(row)).toBe(true);
  });
});

describe("parseNumeric", () => {
  it("virgüllü ve noktalı ondalıkları okur", () => {
    expect(parseNumeric("1,5")).toBe(1.5);
    expect(parseNumeric("1.5")).toBe(1.5);
    expect(parseNumeric("abc")).toBeNull();
    expect(parseNumeric("")).toBeNull();
  });
});

describe("validateQuestionRow", () => {
  it("geçerli satırda hata üretmez", () => {
    expect(validateQuestionRow(validRow)).toEqual([]);
  });

  it("boş soru metnini yakalar", () => {
    const errors = validateQuestionRow({ ...validRow, soru_metni: "" });
    expect(errors.some((error) => error.field === "soru_metni")).toBe(true);
  });

  it("tanımsız soru tipini yakalar", () => {
    const errors = validateQuestionRow({ ...validRow, soru_tipi: "COKTAN" });
    expect(errors.some((error) => error.field === "soru_tipi")).toBe(true);
  });

  it("ağırlığı sayı olmayan satırı yakalar", () => {
    const errors = validateQuestionRow({ ...validRow, soru_agirligi: "orta" });
    expect(errors.some((error) => error.field === "soru_agirligi")).toBe(true);
  });

  it("çoktan seçmelide boş şıkları yakalar", () => {
    const errors = validateQuestionRow({ ...validRow, secenekler: "" });
    expect(errors.some((error) => error.field === "secenekler")).toBe(true);
  });

  it("tek şıklı çoktan seçmeliyi yakalar", () => {
    const errors = validateQuestionRow({ ...validRow, secenekler: "Var = 5" });
    expect(errors.some((error) => error.message.includes("En az iki şık"))).toBe(true);
  });

  it("evet/hayır puanlarının sayı olmasını ister", () => {
    const errors = validateQuestionRow({
      ...validRow,
      soru_tipi: "EVET_HAYIR",
      secenekler: "",
      evet_puani: "5",
      hayir_puani: "",
    });
    expect(errors.some((error) => error.field === "hayir_puani")).toBe(true);
    expect(errors.some((error) => error.field === "evet_puani")).toBe(false);
  });

  it("kademeli puanlamada eşik sorusu ve alt seçenekleri ister", () => {
    const errors = validateQuestionRow({
      ...validRow,
      soru_tipi: "KADEMELI_PUANLAMA",
      secenekler: "",
    });
    expect(errors.some((error) => error.field === "esik_sorusu")).toBe(true);
    expect(errors.some((error) => error.field === "alt_secenekler")).toBe(true);
  });
});

describe("fieldsForType", () => {
  it("tipe göre doldurulacak kolonları verir", () => {
    expect(fieldsForType("COKTAN_SECMELI")).toEqual(["secenekler"]);
    expect(fieldsForType("EVET_HAYIR")).toEqual(["evet_puani", "hayir_puani"]);
    expect(fieldsForType("OLCEK_1_5")).toEqual([]);
  });
});

describe("resolveStructure", () => {
  it("alt seviyeli alt kategoriyi doğru eşleştirir", () => {
    const { match, errors } = resolveStructure(validRow, structure);

    expect(errors).toEqual([]);
    expect(match?.subLevelId).toBe("lvl2");
  });

  it("büyük/küçük harf, boşluk ve Türkçe aksan farkını yok sayar", () => {
    // "AZALTIM".toLowerCase() → "azaltim", "Azaltım" → "azaltım": düz
    // küçültme bu ikisini eşleştiremez, sadeleştirme eşleştirmeli.
    const { match } = resolveStructure(
      { ...validRow, kategori_adi: "  çevre ", alt_seviye_adi: "AZALTIM" },
      structure
    );
    expect(match?.subLevelId).toBe("lvl2");
  });

  it("aksansız yazılmış adı da eşleştirir", () => {
    const { match } = resolveStructure(
      { ...validRow, kategori_adi: "Cevre", alt_kategori_adi: "Emisyon Yonetimi", alt_seviye_adi: "Azaltim" },
      structure
    );
    expect(match?.subLevelId).toBe("lvl2");
  });

  it("alt seviyesiz alt kategoride alt seviye istemez", () => {
    const { match, errors } = resolveStructure(
      { kategori_adi: "Sosyal", alt_kategori_adi: "Çalışan Hakları" },
      structure
    );

    expect(errors).toEqual([]);
    expect(match?.subCategoryId).toBe("sub2");
    expect(match?.hasSubLevels).toBe(false);
  });

  it("alt seviye gerektiren alt kategoride boş alt seviyeyi yakalar", () => {
    const { match, errors } = resolveStructure({ ...validRow, alt_seviye_adi: "" }, structure);

    expect(match).toBeNull();
    expect(errors[0].field).toBe("alt_seviye_adi");
  });

  it("bilinmeyen kategoriyi yakalar", () => {
    const { match, errors } = resolveStructure({ ...validRow, kategori_adi: "Yönetişim" }, structure);

    expect(match).toBeNull();
    expect(errors[0].field).toBe("kategori_adi");
    expect(errors[0].message).toContain("Yönetişim");
  });

  it("başka kategorinin alt kategorisini kabul etmez", () => {
    const { match, errors } = resolveStructure(
      { ...validRow, kategori_adi: "Sosyal", alt_kategori_adi: "Emisyon Yönetimi" },
      structure
    );

    expect(match).toBeNull();
    expect(errors[0].field).toBe("alt_kategori_adi");
  });
});

describe("buildQuestionPayload", () => {
  it("çoktan seçmeliyi şıklarıyla kurar", () => {
    const payload = buildQuestionPayload(validRow, 99);

    expect(payload.type).toBe("MULTIPLE_CHOICE");
    expect(payload.weight).toBe(1.5);
    expect(payload.order).toBe(3);
    expect(payload.axisType).toBe("VELOCITY");
    expect(payload.requiresEvidence).toBe(false);
    expect(payload.options).toEqual([
      { value: "yok", label: "Yok", score: 1 },
      { value: "var", label: "Var", score: 5 },
    ]);
    expect(payload.conditionalOptions).toBeUndefined();
  });

  it("sira boşsa sıradaki numarayı kullanır", () => {
    expect(buildQuestionPayload({ ...validRow, sira: "" }, 42).order).toBe(42);
  });

  it("evet/hayır sorusunu iki seçenek olarak kurar", () => {
    const payload = buildQuestionPayload(
      { ...validRow, soru_tipi: "EVET_HAYIR", secenekler: "", evet_puani: "4", hayir_puani: "0" },
      1
    );

    // Değerler anket ekranının gönderdiğiyle aynı olmalı ("yes"/"no");
    // aksi halde puanlama eşleştiremez ve girilen puanlar yok sayılır.
    expect(payload.type).toBe("YES_NO");
    expect(payload.options).toEqual([
      { value: "yes", label: "Evet", score: 4 },
      { value: "no", label: "Hayır", score: 0 },
    ]);
  });

  it("kademeli puanlamayı eşik sorusu ve alt seçeneklerle kurar", () => {
    const payload = buildQuestionPayload(
      {
        ...validRow,
        soru_tipi: "KADEMELI_PUANLAMA",
        secenekler: "",
        esik_sorusu: "ISO sertifikanız var mı?",
        evet_etiketi: "Evet, var",
        alt_secenekler: "ISO 9001 = 2; ISO 14001 = 2",
      },
      1
    );

    expect(payload.type).toBe("CONDITIONAL_CHOICE");
    expect(payload.conditionalOptions).toEqual({
      thresholdQuestion: "ISO sertifikanız var mı?",
      yesLabel: "Evet, var",
      noLabel: "Hayır",
      options: [
        { value: "option_1", label: "ISO 9001", score: 2 },
        { value: "option_2", label: "ISO 14001", score: 2 },
      ],
    });
  });

  it("kanit_gerekli TRUE ise belge ister", () => {
    expect(buildQuestionPayload({ ...validRow, kanit_gerekli: "TRUE" }, 1).requiresEvidence).toBe(true);
  });
});
