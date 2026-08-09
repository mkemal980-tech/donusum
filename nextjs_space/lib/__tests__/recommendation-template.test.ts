import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  RECOMMENDATION_COLUMNS,
  buildAiBriefSheet,
  buildCascadeGuideSheet,
  buildColumnGuideSheet,
  buildExampleRows,
  buildPrefilledRows,
  buildQuestionReferenceSheet,
  buildRecommendationSheet,
  templateColumnKeys,
  templateMatchesImportFields,
} from "../recommendation-template";
import {
  type QuestionContext,
  buildRecommendationPayload,
  checkLadders,
  isEmptyRow,
  matchQuestion,
  normalizeRow,
  validateRecommendationRow,
} from "../recommendation-import";

/**
 * Şablon ile ayrıştırıcının birbirinden kayması sessiz ve yıkıcı bir hatadır:
 * başlıklar tutmazsa her satır boş okunur ve kullanıcı "dosyada öneri yok"
 * mesajı alır. Bu yüzden zincirin tamamı — şablon üret, gerçek bir xlsx'e yaz,
 * yükleme rotasının yaptığı gibi geri oku, doğrula, kayıt yüküne çevir —
 * uçtan uca sınanır.
 */

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

/** Şablonu xlsx'e yazıp yükleme rotasının okuduğu gibi geri okur. */
function roundtrip(rows: Record<string, string>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildRecommendationSheet(rows), "Öneriler");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const reread = XLSX.read(buffer, { type: "buffer" });
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
    reread.Sheets[reread.SheetNames[0]]
  );

  return raw.map(normalizeRow).filter((row) => !isEmptyRow(row) && row.baslik);
}

describe("şablon kolonları", () => {
  it("içe aktarma alanlarıyla birebir aynı sırada", () => {
    expect(templateMatchesImportFields()).toBe(true);
  });

  it("her kolonun açıklaması ve örneği var", () => {
    for (const column of RECOMMENDATION_COLUMNS) {
      expect(column.description.length).toBeGreaterThan(10);
      expect(column.requirement.length).toBeGreaterThan(0);
    }
  });

  it("boş şablonda yalnızca başlık satırı bulunur", () => {
    const sheet = buildRecommendationSheet();
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(templateColumnKeys());
  });
});

describe("şablon → Excel → okuma → doğrulama zinciri", () => {
  const parsed = roundtrip(buildExampleRows());
  // Örnekler bilinçli olarak çeşitli: dört basamaklı bir merdiven, merdiven
  // kurulamayan tek şıklık bir öneri ve ölçek sorusundan bir örnek. Zincir
  // testleri merdiven kısmına bakar; diğerleri kendi kurallarıyla sınanır.
  const ladder = parsed.filter((row) => row.soru_metni === question.text);

  it("örnek satırların tamamı geri okunur", () => {
    expect(parsed.length).toBe(buildExampleRows().length);
    expect(ladder).toHaveLength(4);
  });

  it("merdiven satırları hatasız doğrulanır", () => {
    for (const row of ladder) {
      const match = matchQuestion(row, [question]);
      expect(match.found).toBe(true);
      expect(validateRecommendationRow(row, match.found ? match.question : null)).toEqual([]);
    }
  });

  it("örnek merdiven eksiksizdir — uyarı üretmez", () => {
    expect(checkLadders(ladder, [question])).toEqual([]);
  });

  it("kademe eşikleri şık puanlarıyla birebir eşleşir", () => {
    const thresholds = ladder.map(
      (row, index) => buildRecommendationPayload(row, question, index + 1).triggerMaxAnswerScore
    );
    expect(thresholds).toEqual([0, 1, 2, 3]);
  });

  it("kademeli örneklerde puan alanı boş kalır", () => {
    // Katkı basamaktan türetilir; elle puan girmek çift sayım olurdu.
    for (const [index, row] of ladder.entries()) {
      const payload = buildRecommendationPayload(row, question, index + 1);
      expect(payload.triggerOptions).toBeNull();
      expect(payload.points).toBe(0);
    }
  });

  it("kademesiz örnek tek şıkka bağlanır ve puanını kendisi taşır", () => {
    // Merdiven kurulamayan soruda devralma yok; katkı türetilemediği için
    // puan elle verilir. Örnek sayfası bu farkı göstermek zorunda.
    const single = parsed.find((row) => row.kademeli?.toUpperCase() === "HAYIR");
    expect(single).toBeTruthy();
    expect(Number(String(single!.puan).replace(",", "."))).toBeGreaterThan(0);
  });
});

describe("yardım sayfaları", () => {
  it("kolon açıklama sayfası her kolonu içerir", () => {
    const rows = XLSX.utils.sheet_to_json(buildColumnGuideSheet(), { header: 1 });
    // Başlık satırı + her kolon için bir satır
    expect(rows).toHaveLength(RECOMMENDATION_COLUMNS.length + 1);
  });

  it("kademeli tetikleme sayfası boş değil", () => {
    const rows = XLSX.utils.sheet_to_json(buildCascadeGuideSheet(), { header: 1 });
    expect(rows.length).toBeGreaterThan(5);
  });

  it("soru referans sayfası şıkları puanlarıyla listeler", () => {
    const sheet = buildQuestionReferenceSheet([
      { text: question.text, choices: [{ label: "Takip yok", score: 0 }] },
    ]);
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    expect(rows[1][0]).toBe(question.text);
    expect(rows[1][1]).toBe("Takip yok (0)");
  });
});

describe("buildPrefilledRows", () => {
  const questions = [
    {
      text: "Emisyon takibi nasıl yapılıyor?",
      choices: [
        { label: "Dijital takip", score: 2 },
        { label: "Takip yok", score: 0 },
        { label: "Manuel takip", score: 1 },
      ],
    },
    { text: "Açık uçlu soru", choices: [] },
  ];

  it("her şık için bir satır üretir", () => {
    expect(buildPrefilledRows(questions)).toHaveLength(3);
  });

  it("satırları en düşük basamaktan yükseğe sıralar", () => {
    // Merdiven gözle görünsün: alt satır "hiç yapmıyor", üst satır "en olgun".
    expect(buildPrefilledRows(questions).map((row) => row.tetikleyici)).toEqual([
      "Takip yok",
      "Manuel takip",
      "Dijital takip",
    ]);
  });

  it("soru metnini ve şık etiketini hazır doldurur", () => {
    // Elle kopyalamak en büyük hata kaynağıydı: metin eşleşmesi birebir.
    const [first] = buildPrefilledRows(questions);
    expect(first.soru_metni).toBe("Emisyon takibi nasıl yapılıyor?");
    expect(first.kademeli).toBe("EVET");
    expect(first.baslik).toBe("");
  });

  it("şıksız soruyu atlar", () => {
    // Tetikleyici yazılamayan soruya satır üretmek yükleme hatası doğururdu.
    expect(buildPrefilledRows(questions).every((row) => row.soru_metni !== "Açık uçlu soru")).toBe(
      true
    );
  });
});

describe("buildAiBriefSheet", () => {
  it("anket adını yönergeye yazar", () => {
    const sheet = buildAiBriefSheet("Tersane 2026");
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    expect(rows.some((row) => row[1] === "Tersane 2026")).toBe(true);
  });

  it("anket verilmediğinde de bozulmaz", () => {
    expect(() => buildAiBriefSheet()).not.toThrow();
  });
});
