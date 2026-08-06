/**
 * Toplu soru yüklemenin ortak çekirdeği.
 *
 * Bu modül hem sunucuda (Excel'i okuyup kaydeden route'lar) hem tarayıcıda
 * (önizleme ekranında satır düzenlendikçe anında doğrulama) kullanılır, bu
 * yüzden yalnızca saf fonksiyon içerir — prisma veya xlsx bağımlılığı yoktur.
 *
 * Sunucu, önizlemede gönderdiği satırları kaydetmeden önce aynı doğrulamayı
 * tekrar çalıştırır; tarayıcıdan gelen veri hiçbir zaman doğrulanmış sayılmaz.
 */

import { parseScoredOptions } from "./question-options";

export const QUESTION_TYPES = ["COKTAN_SECMELI", "OLCEK_1_5", "EVET_HAYIR", "KADEMELI_PUANLAMA"] as const;
export type QuestionTypeKey = (typeof QUESTION_TYPES)[number];

export const AXIS_TYPES = ["VELOCITY", "ENDURANCE"] as const;
export type AxisTypeKey = (typeof AXIS_TYPES)[number];

export type PrismaQuestionType = "SCALE" | "YES_NO" | "MULTIPLE_CHOICE" | "CONDITIONAL_CHOICE";

export const IMPORT_FIELDS = [
  "kategori_adi",
  "alt_kategori_adi",
  "alt_seviye_adi",
  "soru_metni",
  "soru_tipi",
  "soru_agirligi",
  "ironman_ekseni",
  "sira",
  "kanit_gerekli",
  "secenekler",
  "evet_puani",
  "hayir_puani",
  "esik_sorusu",
  "evet_etiketi",
  "hayir_etiketi",
  "alt_secenekler",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type ImportRow = Partial<Record<ImportField, string>>;

export type FieldError = {
  /** Hatanın ait olduğu kolon; satırın tamamına ait hatalarda "_" */
  field: ImportField | "_";
  message: string;
};

/** Anketin yapısındaki geçerli kategori → alt kategori → alt seviye üçlüsü. */
export type StructureOption = {
  categoryId: string;
  category: string;
  subCategoryId: string;
  subCategory: string;
  hasSubLevels: boolean;
  subLevelId: string | null;
  subLevel: string | null;
};

export type PreviewRow = {
  /** Excel'deki satır numarası (başlık satırı 1'dir). */
  rowNumber: number;
  values: ImportRow;
};

const NUMERIC_FIELDS: ImportField[] = ["soru_agirligi", "evet_puani", "hayir_puani", "sira"];

/** Excel hücresini metne çevirir; Türkçe ondalık virgülünü de sayı olarak okur. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

export function normalizeRow(raw: Record<string, unknown>): ImportRow {
  const row: ImportRow = {};
  for (const field of IMPORT_FIELDS) {
    row[field] = cellToString(raw[field]);
  }
  return row;
}

export function isEmptyRow(row: ImportRow): boolean {
  return IMPORT_FIELDS.every((field) => !row[field]);
}

/** "1,5" ve "1.5" aynı sayıdır; sayı değilse null. */
export function parseNumeric(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapQuestionType(type: string): PrismaQuestionType {
  switch (type.toUpperCase()) {
    case "OLCEK_1_5":
      return "SCALE";
    case "EVET_HAYIR":
      return "YES_NO";
    case "COKTAN_SECMELI":
      return "MULTIPLE_CHOICE";
    case "KADEMELI_PUANLAMA":
      return "CONDITIONAL_CHOICE";
    default:
      return "SCALE";
  }
}

/** Soru tipine göre doldurulması gereken kolonlar — önizleme ekranı da bunu kullanır. */
export function fieldsForType(type: string): ImportField[] {
  switch (type.toUpperCase()) {
    case "COKTAN_SECMELI":
      return ["secenekler"];
    case "EVET_HAYIR":
      return ["evet_puani", "hayir_puani"];
    case "KADEMELI_PUANLAMA":
      return ["esik_sorusu", "evet_etiketi", "hayir_etiketi", "alt_secenekler"];
    default:
      return [];
  }
}

/**
 * Yapı dışındaki tüm alanları doğrular. Yapı (kategori/alt kategori/alt seviye)
 * ayrı doğrulanır çünkü yalnızca anket geneli yüklemesinde anlamlıdır.
 */
export function validateQuestionRow(row: ImportRow): FieldError[] {
  const errors: FieldError[] = [];

  if (!row.soru_metni) {
    errors.push({ field: "soru_metni", message: "Soru metni boş olamaz." });
  }

  const type = (row.soru_tipi ?? "").toUpperCase();
  if (!QUESTION_TYPES.includes(type as QuestionTypeKey)) {
    errors.push({
      field: "soru_tipi",
      message: `Soru tipi şunlardan biri olmalı: ${QUESTION_TYPES.join(", ")}`,
    });
  }

  const weight = parseNumeric(row.soru_agirligi);
  if (weight === null) {
    errors.push({ field: "soru_agirligi", message: "Soru ağırlığı sayı olmalı (örn: 1 veya 1,5)." });
  } else if (weight <= 0) {
    errors.push({ field: "soru_agirligi", message: "Soru ağırlığı sıfırdan büyük olmalı." });
  }

  const axis = (row.ironman_ekseni ?? "").toUpperCase();
  if (!AXIS_TYPES.includes(axis as AxisTypeKey)) {
    errors.push({ field: "ironman_ekseni", message: "Eksen VELOCITY veya ENDURANCE olmalı." });
  }

  if (row.sira && parseNumeric(row.sira) === null) {
    errors.push({ field: "sira", message: "Sıra sayı olmalı." });
  }

  if (type === "COKTAN_SECMELI") {
    if (!row.secenekler) {
      errors.push({
        field: "secenekler",
        message: "Çoktan seçmeli soruda şıklar boş olamaz. Örnek: Düşük = 1; Orta = 3; Yüksek = 5",
      });
    } else {
      const parsed = parseScoredOptions(row.secenekler);
      parsed.errors.forEach((message) => errors.push({ field: "secenekler", message }));
      if (parsed.options.length === 1) {
        errors.push({ field: "secenekler", message: "En az iki şık olmalı." });
      }
    }
  }

  if (type === "EVET_HAYIR") {
    if (parseNumeric(row.evet_puani) === null) {
      errors.push({ field: "evet_puani", message: "Evet puanı sayı olmalı." });
    }
    if (parseNumeric(row.hayir_puani) === null) {
      errors.push({ field: "hayir_puani", message: "Hayır puanı sayı olmalı." });
    }
  }

  if (type === "KADEMELI_PUANLAMA") {
    if (!row.esik_sorusu) {
      errors.push({ field: "esik_sorusu", message: "Kademeli puanlamada eşik sorusu boş olamaz." });
    }
    if (!row.alt_secenekler) {
      errors.push({
        field: "alt_secenekler",
        message: "Alt seçenekler boş olamaz. Örnek: ISO 9001 = 2; ISO 14001 = 2",
      });
    } else {
      const parsed = parseScoredOptions(row.alt_secenekler, { valueMode: "index" });
      parsed.errors.forEach((message) => errors.push({ field: "alt_secenekler", message }));
    }
  }

  return errors;
}

const TURKISH_TO_ASCII: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", İ: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
};

/**
 * Kategori adlarını karşılaştırmak için sadeleştirir.
 *
 * Düz `toLowerCase()` Türkçe'de yanılır: "AZALTIM" → "azaltim" olurken
 * "Azaltım" → "azaltım" olur ve aynı isim eşleşmez. Bu yüzden önce Türkçe
 * harfler ASCII karşılığına çevrilir; böylece büyük/küçük harf, aksan ve
 * fazladan boşluk farkları eşleşmeyi bozmaz.
 */
function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TURKISH_TO_ASCII[char] ?? char)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type StructureResolution = {
  match: StructureOption | null;
  errors: FieldError[];
};

/** Satırdaki kategori adlarını anketin yapısındaki gerçek kayıtla eşleştirir. */
export function resolveStructure(row: ImportRow, structure: StructureOption[]): StructureResolution {
  const errors: FieldError[] = [];

  if (!row.kategori_adi) {
    errors.push({ field: "kategori_adi", message: "Kategori seçilmeli." });
  }
  if (!row.alt_kategori_adi) {
    errors.push({ field: "alt_kategori_adi", message: "Alt kategori seçilmeli." });
  }
  if (errors.length > 0) return { match: null, errors };

  const categoryKey = normalizeKey(row.kategori_adi);
  const subCategoryKey = normalizeKey(row.alt_kategori_adi);

  const inCategory = structure.filter((option) => normalizeKey(option.category) === categoryKey);
  if (inCategory.length === 0) {
    return {
      match: null,
      errors: [{ field: "kategori_adi", message: `Kategori bulunamadı: "${row.kategori_adi}"` }],
    };
  }

  const inSubCategory = inCategory.filter((option) => normalizeKey(option.subCategory) === subCategoryKey);
  if (inSubCategory.length === 0) {
    return {
      match: null,
      errors: [
        {
          field: "alt_kategori_adi",
          message: `"${row.kategori_adi}" içinde alt kategori bulunamadı: "${row.alt_kategori_adi}"`,
        },
      ],
    };
  }

  const requiresSubLevel = inSubCategory[0].hasSubLevels;

  if (!requiresSubLevel) {
    return { match: inSubCategory[0], errors: [] };
  }

  if (!row.alt_seviye_adi) {
    return {
      match: null,
      errors: [
        {
          field: "alt_seviye_adi",
          message: `"${row.alt_kategori_adi}" alt seviye gerektiriyor, alt seviye seçilmeli.`,
        },
      ],
    };
  }

  const subLevelKey = normalizeKey(row.alt_seviye_adi);
  const match = inSubCategory.find((option) => normalizeKey(option.subLevel) === subLevelKey);

  if (!match) {
    return {
      match: null,
      errors: [
        {
          field: "alt_seviye_adi",
          message: `"${row.alt_kategori_adi}" içinde alt seviye bulunamadı: "${row.alt_seviye_adi}"`,
        },
      ],
    };
  }

  return { match, errors: [] };
}

export type ConditionalOptions = {
  thresholdQuestion: string;
  yesLabel: string;
  noLabel: string;
  options: { value: string; label: string; score: number }[];
};

export type QuestionPayload = {
  text: string;
  type: PrismaQuestionType;
  options: { value: string; label: string; score: number }[];
  conditionalOptions?: ConditionalOptions;
  order: number;
  requiresEvidence: boolean;
  weight: number;
  axisType: AxisTypeKey;
};

/**
 * Doğrulanmış bir satırı veritabanına yazılacak alanlara çevirir.
 *
 * `conditionalOptions` yalnızca kademeli puanlamada dolar; diğer tiplerde alan
 * hiç gönderilmez — Prisma'da nullable Json alanına düz `null` geçilemez.
 */
export function buildQuestionPayload(row: ImportRow, fallbackOrder: number): QuestionPayload {
  const type = mapQuestionType(row.soru_tipi ?? "");

  let options: QuestionPayload["options"] = [];
  let conditionalOptions: ConditionalOptions | undefined;

  if (type === "MULTIPLE_CHOICE") {
    options = parseScoredOptions(row.secenekler).options;
  } else if (type === "YES_NO") {
    options = [
      { value: "evet", label: "Evet", score: parseNumeric(row.evet_puani) ?? 5 },
      { value: "hayir", label: "Hayır", score: parseNumeric(row.hayir_puani) ?? 1 },
    ];
  } else if (type === "CONDITIONAL_CHOICE") {
    conditionalOptions = {
      thresholdQuestion: row.esik_sorusu || (row.soru_metni ?? ""),
      yesLabel: row.evet_etiketi || "Evet",
      noLabel: row.hayir_etiketi || "Hayır",
      options: parseScoredOptions(row.alt_secenekler, { valueMode: "index" }).options,
    };
  }

  return {
    text: (row.soru_metni ?? "").trim(),
    type,
    options,
    ...(conditionalOptions ? { conditionalOptions } : {}),
    order: parseNumeric(row.sira) ?? fallbackOrder,
    requiresEvidence: (row.kanit_gerekli ?? "").toUpperCase() === "TRUE",
    weight: parseNumeric(row.soru_agirligi) ?? 1,
    axisType: (row.ironman_ekseni ?? "VELOCITY").toUpperCase() as AxisTypeKey,
  };
}

export { NUMERIC_FIELDS };
