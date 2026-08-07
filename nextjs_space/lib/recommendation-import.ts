/**
 * Toplu öneri yüklemenin ortak çekirdeği.
 *
 * `lib/question-import.ts` ile aynı deseni izler: hem sunucuda (Excel'i okuyup
 * kaydeden route) hem tarayıcıda (önizleme ekranında satır düzenlendikçe anında
 * doğrulama) kullanılır, bu yüzden yalnızca saf fonksiyon içerir — prisma veya
 * xlsx bağımlılığı yoktur.
 *
 * Sunucu, önizlemede gönderdiği satırları kaydetmeden önce aynı doğrulamayı
 * tekrar çalıştırır; tarayıcıdan gelen veri hiçbir zaman doğrulanmış sayılmaz.
 *
 * AI taslak üretimi de aynı satır biçimini üretir ve aynı önizlemeye düşer;
 * böylece AI çıktısı da elle yazılmış Excel satırıyla birebir aynı yoldan
 * doğrulanır ve onaylanmadan hiçbir şey kaydedilmez.
 */

import { triggerChoicesFor, type TriggerChoice } from "./recommendation-triggers";

export const RECOMMENDATION_IMPORT_FIELDS = [
  "soru_metni",
  "tetikleyici",
  "kademeli",
  "baslik",
  "aciklama",
  "vade",
  "strateji",
  "maliyet",
  "etki",
  "puan",
  "video_url",
  "sira",
] as const;

export type RecommendationImportField = (typeof RECOMMENDATION_IMPORT_FIELDS)[number];

export type RecommendationImportRow = Partial<Record<RecommendationImportField, string>>;

export type FieldError = {
  /** Hatanın ait olduğu kolon; satırın tamamına ait hatalarda "_" */
  field: RecommendationImportField | "_";
  message: string;
};

/** Excel'deki soru metnini eşleştirebilmek için gereken en az bilgi. */
export type QuestionContext = {
  id: string;
  text: string;
  type: string;
  options?: unknown;
  categoryId: string | null;
  subCategoryId: string | null;
  subLevelId: string | null;
};

export const TIMEFRAME_KEYS = ["KISA", "ORTA", "UZUN"] as const;
export const STRATEGY_KEYS = ["HIZLI_KAZANIM", "PROJE", "BUYUK_YATIRIM"] as const;
export const COST_KEYS = ["OPEX", "CAPEX"] as const;
export const BOOLEAN_KEYS = ["EVET", "HAYIR"] as const;

const TIMEFRAME_MAP: Record<string, string> = {
  KISA: "SHORT_TERM",
  ORTA: "MEDIUM_TERM",
  UZUN: "LONG_TERM",
};

const STRATEGY_MAP: Record<string, string> = {
  HIZLI_KAZANIM: "QUICK_WIN",
  PROJE: "PROJECT",
  BUYUK_YATIRIM: "BIG_BET",
};

/** Excel hücresini metne çevirir. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "EVET" : "HAYIR";
  return String(value).trim();
}

export function normalizeRow(raw: Record<string, unknown>): RecommendationImportRow {
  const row: RecommendationImportRow = {};
  for (const field of RECOMMENDATION_IMPORT_FIELDS) {
    row[field] = cellToString(raw[field]);
  }
  return row;
}

export function isEmptyRow(row: RecommendationImportRow): boolean {
  return RECOMMENDATION_IMPORT_FIELDS.every((field) => !row[field]);
}

/** "1,5" ve "1.5" aynı sayıdır; sayı değilse null. */
export function parseNumeric(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Soru metnini eşleştirmek için normalize eder.
 * Excel'e kopyalarken araya giren fazla boşluk ve büyük/küçük harf farkı
 * eşleşmeyi bozmasın diye.
 */
export function normalizeQuestionText(text: string): string {
  return text.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

export type QuestionMatch =
  | { found: true; question: QuestionContext }
  | { found: false; reason: "empty" | "missing" | "ambiguous" };

/** Excel satırındaki soru metnine karşılık gelen soruyu bulur. */
export function matchQuestion(
  row: RecommendationImportRow,
  questions: QuestionContext[]
): QuestionMatch {
  const text = (row.soru_metni ?? "").trim();
  if (!text) return { found: false, reason: "empty" };

  const normalized = normalizeQuestionText(text);
  const matches = questions.filter((q) => normalizeQuestionText(q.text) === normalized);

  if (matches.length === 0) return { found: false, reason: "missing" };
  if (matches.length > 1) return { found: false, reason: "ambiguous" };
  return { found: true, question: matches[0] };
}

export type TriggerMatch =
  | { found: true; choice: TriggerChoice }
  | { found: false; reason: "empty" | "unsupported" | "missing"; choices: TriggerChoice[] };

/**
 * Tetikleyici hücresini sorunun şıklarından biriyle eşleştirir.
 * Yönetici etiketi de ("Takip yok") teknik değeri de ("takip_yok") yazabilir.
 */
export function matchTrigger(
  row: RecommendationImportRow,
  question: QuestionContext
): TriggerMatch {
  const raw = (row.tetikleyici ?? "").trim();
  const support = triggerChoicesFor(question);
  const choices = support.supported ? support.choices : [];

  if (!raw) return { found: false, reason: "empty", choices };
  if (!support.supported) return { found: false, reason: "unsupported", choices };

  const normalized = raw.toLocaleLowerCase("tr");
  const choice = choices.find(
    (entry) =>
      entry.value.toLocaleLowerCase("tr") === normalized ||
      entry.label.toLocaleLowerCase("tr") === normalized
  );

  if (!choice) return { found: false, reason: "missing", choices };
  return { found: true, choice };
}

/**
 * Satırın bağlı olduğu sorunun şık listesi.
 * Önizleme ekranı tetikleyiciyi serbest metin yerine liste olarak sunar.
 */
export function choicesForRow(
  row: RecommendationImportRow,
  questions: QuestionContext[]
): TriggerChoice[] {
  const match = matchQuestion(row, questions);
  if (!match.found) return [];
  const support = triggerChoicesFor(match.question);
  return support.supported ? support.choices : [];
}

export function isCascadeRow(row: RecommendationImportRow): boolean {
  return (row.kademeli ?? "").trim().toLocaleUpperCase("tr") === "EVET";
}

/**
 * Yapı dışındaki tüm alanları doğrular.
 *
 * `question` null ise soru eşleşmemiştir; o durumda soruya bağlı kontroller
 * (tetikleyici) atlanır, çünkü bağlam yoktur.
 */
export function validateRecommendationRow(
  row: RecommendationImportRow,
  question: QuestionContext | null
): FieldError[] {
  const errors: FieldError[] = [];

  if (!row.baslik?.trim()) {
    errors.push({ field: "baslik", message: "Öneri başlığı boş olamaz." });
  }

  if (!row.soru_metni?.trim()) {
    errors.push({ field: "soru_metni", message: "Soru metni boş olamaz." });
  } else if (!question) {
    errors.push({
      field: "soru_metni",
      message: "Bu metinle eşleşen bir soru bulunamadı. Soruyu ankette yazıldığı gibi kopyalayın.",
    });
  }

  const cascadeRaw = (row.kademeli ?? "").trim().toLocaleUpperCase("tr");
  if (cascadeRaw && !BOOLEAN_KEYS.includes(cascadeRaw as (typeof BOOLEAN_KEYS)[number])) {
    errors.push({ field: "kademeli", message: "Kademeli alanı EVET veya HAYIR olmalı." });
  }

  if (question) {
    const trigger = matchTrigger(row, question);
    if (!trigger.found) {
      if (trigger.reason === "empty") {
        errors.push({
          field: "tetikleyici",
          message: "Tetikleyici cevap boş olamaz — öneri hangi şıkta gösterilecek?",
        });
      } else if (trigger.reason === "unsupported") {
        errors.push({
          field: "tetikleyici",
          message:
            "Bu soru tipinde şık listesi yok. Kademeli tetikleme için eşiği panelden sayı olarak girin.",
        });
      } else {
        const list = trigger.choices.map((choice) => choice.label).join(", ");
        errors.push({
          field: "tetikleyici",
          message: `Bu sorunun şıkları arasında yok. Geçerli değerler: ${list}`,
        });
      }
    }
  }

  const timeframe = (row.vade ?? "").trim().toLocaleUpperCase("tr");
  if (!TIMEFRAME_KEYS.includes(timeframe as (typeof TIMEFRAME_KEYS)[number])) {
    errors.push({ field: "vade", message: `Vade şunlardan biri olmalı: ${TIMEFRAME_KEYS.join(", ")}` });
  }

  const strategy = (row.strateji ?? "").trim().toLocaleUpperCase("tr");
  if (!STRATEGY_KEYS.includes(strategy as (typeof STRATEGY_KEYS)[number])) {
    errors.push({
      field: "strateji",
      message: `Strateji şunlardan biri olmalı: ${STRATEGY_KEYS.join(", ")}`,
    });
  }

  const cost = (row.maliyet ?? "").trim().toLocaleUpperCase("tr");
  if (cost && !COST_KEYS.includes(cost as (typeof COST_KEYS)[number])) {
    errors.push({ field: "maliyet", message: "Maliyet OPEX veya CAPEX olmalı." });
  }

  const impact = parseNumeric(row.etki);
  if (impact === null) {
    errors.push({ field: "etki", message: "Tahmini etki 1-10 arası bir sayı olmalı." });
  } else if (impact < 1 || impact > 10) {
    errors.push({ field: "etki", message: "Tahmini etki 1 ile 10 arasında olmalı." });
  }

  // Puan yalnızca kademesiz önerilerde anlamlı; kademelide katkı basamaktan
  // türetilir ve girilen değer yok sayılır.
  if (!isCascadeRow(row) && row.puan) {
    const points = parseNumeric(row.puan);
    if (points === null) {
      errors.push({ field: "puan", message: "Puan sayı olmalı (örn: 0,5)." });
    } else if (points < 0 || points > 2) {
      errors.push({ field: "puan", message: "Puan 0 ile 2 arasında olmalı." });
    }
  }

  if (row.sira && parseNumeric(row.sira) === null) {
    errors.push({ field: "sira", message: "Sıra sayı olmalı." });
  }

  if (row.video_url && !/^https?:\/\//i.test(row.video_url.trim())) {
    errors.push({ field: "video_url", message: "Video bağlantısı http:// veya https:// ile başlamalı." });
  }

  return errors;
}

export type RecommendationPayload = {
  title: string;
  description: string;
  videoUrl: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  subLevelId: string | null;
  questionId: string;
  triggerOptions: string | null;
  triggerMaxAnswerScore: number | null;
  points: number;
  costType: string;
  timeframe: string;
  strategicType: string;
  estimatedImpact: number;
  order: number;
};

/**
 * Doğrulanmış satırı veritabanı kaydına çevirir.
 * Çağırmadan önce `validateRecommendationRow` hatasız dönmüş olmalıdır.
 */
export function buildRecommendationPayload(
  row: RecommendationImportRow,
  question: QuestionContext,
  fallbackOrder: number
): RecommendationPayload {
  const trigger = matchTrigger(row, question);
  const cascade = isCascadeRow(row);

  const timeframe = (row.vade ?? "").trim().toLocaleUpperCase("tr");
  const strategy = (row.strateji ?? "").trim().toLocaleUpperCase("tr");
  const cost = (row.maliyet ?? "").trim().toLocaleUpperCase("tr");

  return {
    title: (row.baslik ?? "").trim(),
    description: (row.aciklama ?? "").trim(),
    videoUrl: row.video_url?.trim() || null,
    // Öneri, bağlı olduğu sorunun yerleşimini devralır.
    categoryId: question.categoryId,
    subCategoryId: question.subLevelId ? null : question.subCategoryId,
    subLevelId: question.subLevelId,
    questionId: question.id,
    triggerOptions:
      !cascade && trigger.found ? JSON.stringify([trigger.choice.value]) : null,
    triggerMaxAnswerScore: cascade && trigger.found ? trigger.choice.score : null,
    points: cascade ? 0 : parseNumeric(row.puan) ?? 0.5,
    costType: COST_KEYS.includes(cost as (typeof COST_KEYS)[number]) ? cost : "OPEX",
    timeframe: TIMEFRAME_MAP[timeframe] ?? "SHORT_TERM",
    strategicType: STRATEGY_MAP[strategy] ?? "QUICK_WIN",
    estimatedImpact: parseNumeric(row.etki) ?? 5,
    order: parseNumeric(row.sira) ?? fallbackOrder,
  };
}

export type LadderWarning = {
  questionText: string;
  message: string;
};

/**
 * Merdiven bütünlüğü kontrolü — bu, düz bir Excel aktarımının vermediği asıl
 * değer. Hata değil *uyarı* üretir: yükleme engellenmez ama yönetici neyin
 * eksik kaldığını onaylamadan önce görür.
 *
 * Bakılanlar:
 *   1. Aynı soruda kademeli ve tam eşleşme karışmış mı (kullanıcı gözünde
 *      tutarsız davranır)
 *   2. Kademeli merdivende hangi şıklar boşta kalmış (o şıkkı seçen kullanıcı
 *      için "sıradaki adım" olmaz)
 *   3. Aynı soruda birebir aynı başlık tekrar etmiş mi
 */
export function checkLadders(
  rows: RecommendationImportRow[],
  questions: QuestionContext[]
): LadderWarning[] {
  const warnings: LadderWarning[] = [];

  const byQuestion = new Map<string, { question: QuestionContext; rows: RecommendationImportRow[] }>();

  for (const row of rows) {
    const match = matchQuestion(row, questions);
    if (!match.found) continue;
    const entry = byQuestion.get(match.question.id);
    if (entry) entry.rows.push(row);
    else byQuestion.set(match.question.id, { question: match.question, rows: [row] });
  }

  for (const { question, rows: questionRows } of byQuestion.values()) {
    const cascadeRows = questionRows.filter(isCascadeRow);
    const exactRows = questionRows.filter((row) => !isCascadeRow(row));

    if (cascadeRows.length > 0 && exactRows.length > 0) {
      warnings.push({
        questionText: question.text,
        message:
          "Bu soruda hem kademeli hem tam eşleşme öneri var. Karışık kullanım kullanıcıya tutarsız görünür; birini seçin.",
      });
    }

    const titles = questionRows.map((row) => (row.baslik ?? "").trim().toLocaleLowerCase("tr"));
    const duplicates = titles.filter((title, index) => title && titles.indexOf(title) !== index);
    if (duplicates.length > 0) {
      warnings.push({
        questionText: question.text,
        message: `Aynı başlık birden fazla kez geçiyor: ${Array.from(new Set(duplicates)).join(", ")}`,
      });
    }

    if (cascadeRows.length === 0) continue;

    const support = triggerChoicesFor(question);
    if (!support.supported) continue;

    const covered = new Set<number>();
    for (const row of cascadeRows) {
      const trigger = matchTrigger(row, question);
      if (trigger.found) covered.add(trigger.choice.score);
    }

    const missing = support.choices
      .filter((choice) => !covered.has(choice.score))
      .map((choice) => choice.label);

    if (missing.length > 0) {
      warnings.push({
        questionText: question.text,
        message: `Kademeli merdivende öneri verilmemiş şık(lar) var: ${missing.join(", ")}. Bu şıkları seçen kullanıcılar için o basamak boş kalır.`,
      });
    }
  }

  return warnings;
}
