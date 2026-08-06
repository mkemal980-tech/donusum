/**
 * Çoktan seçmeli (COKTAN_SECMELI) ve kademeli puanlama (KADEMELI_PUANLAMA)
 * sorularının seçenek metnini ayrıştırır.
 *
 * Önerilen yazım — tek hücrede, tek satır:
 *   Düşük = 1; Orta = 3; Yüksek = 5
 *
 * Geriye dönük olarak şunlar da kabul edilir:
 *   Düşük | 1; Orta | 3                (etiket|puan)
 *   dusuk|Düşük|1                      (eski biçim: deger|etiket|puan)
 *   her seçenek ayrı satırda           (Alt+Enter ile yazılmış eski şablonlar)
 *
 * Excel'in ücretsiz yazma kütüphanesi hücre biçimi (wrap text) yazamadığı için
 * satır sonlu hücreler tabloda birleşik görünür; bu yüzden şablonlarda tek
 * satırlık ";" biçimi kullanılır.
 */

export type ScoredOption = {
  value: string;
  label: string;
  score: number;
};

export type OptionParseResult = {
  options: ScoredOption[];
  errors: string[];
};

const TURKISH_TO_ASCII: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", İ: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
};

/** Etiketten otomatik `value` üretir: "Detaylı takip" → "detayli_takip" */
export function slugifyOptionValue(label: string): string {
  return label
    .trim()
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TURKISH_TO_ASCII[char] ?? char)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Puan metnini sayıya çevirir. Türkçe klavyede ondalık ayırıcı virgül
 * olduğu için "2,5" de "2.5" de kabul edilir. Sayı değilse null döner
 * (parseFloat'ın aksine "3abc" gibi girdiler sessizce 3'e dönüşmez).
 */
export function parseOptionScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitEntries(input: string): string[] {
  return input
    .split(/[\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type ParseFields = { rawValue: string; label: string; rawScore: string } | null;

function splitFields(entry: string): ParseFields {
  const parts = entry.split("|").map((part) => part.trim());

  // deger|etiket|puan (eski biçim) — etikette "|" varsa ortadaki parçalar birleştirilir
  if (parts.length >= 3) {
    return {
      rawValue: parts[0],
      label: parts.slice(1, -1).join("|").trim(),
      rawScore: parts[parts.length - 1],
    };
  }

  // etiket|puan
  if (parts.length === 2) {
    return { rawValue: "", label: parts[0], rawScore: parts[1] };
  }

  // etiket = puan — etiket "=" içerebilsin diye son "=" ayırıcı kabul edilir
  const separatorIndex = entry.lastIndexOf("=");
  if (separatorIndex === -1) return null;

  return {
    rawValue: "",
    label: entry.slice(0, separatorIndex).trim(),
    rawScore: entry.slice(separatorIndex + 1).trim(),
  };
}

/**
 * @param valueMode `auto` etiketten value üretir (çoktan seçmeli),
 *                  `index` value'ları option_1, option_2... yapar (kademeli puanlama).
 */
export function parseScoredOptions(
  input: unknown,
  { valueMode = "auto" }: { valueMode?: "auto" | "index" } = {}
): OptionParseResult {
  const errors: string[] = [];
  const options: ScoredOption[] = [];

  if (input === null || input === undefined) return { options, errors };

  const entries = splitEntries(String(input));
  const usedValues = new Set<string>();

  entries.forEach((entry, index) => {
    const fields = splitFields(entry);
    if (!fields) {
      errors.push(`"${entry}" seçeneğinin puanı yok. Doğru yazım: "Etiket = puan"`);
      return;
    }

    const { rawValue, label, rawScore } = fields;

    if (!label) {
      errors.push(`"${entry}" seçeneğinde etiket boş.`);
      return;
    }

    const score = parseOptionScore(rawScore);
    if (score === null) {
      errors.push(`"${entry}" seçeneğinde puan sayı değil ("${rawScore}").`);
      return;
    }
    if (score < 0) {
      errors.push(`"${entry}" seçeneğinde puan negatif olamaz.`);
      return;
    }

    let value: string;
    if (valueMode === "index") {
      value = `option_${options.length + 1}`;
    } else {
      const base = rawValue || slugifyOptionValue(label) || `secenek_${index + 1}`;
      value = base;
      let suffix = 2;
      while (usedValues.has(value)) {
        value = `${base}_${suffix}`;
        suffix += 1;
      }
    }

    usedValues.add(value);
    options.push({ value, label, score });
  });

  return { options, errors };
}

function toScoredOptions(input: unknown): ScoredOption[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((option): option is Record<string, unknown> => !!option && typeof option === "object")
    .map((option) => ({
      value: String(option.value ?? ""),
      label: String(option.label ?? ""),
      score: Number(option.score ?? 0),
    }));
}

/**
 * Kayıtlı seçenekleri düzenleme kutusunda gösterilecek metne çevirir.
 *
 * `value` etiketten türetilebiliyorsa kısa biçim ("Etiket = puan") kullanılır.
 * Türetilemiyorsa eski biçim ("deger|etiket|puan") korunur — aksi halde kayıt
 * sırasında value yeniden üretilir ve o seçeneği işaretlemiş mevcut cevaplar
 * eşleşmeyi kaybederdi.
 */
export function formatScoredOptions(input: unknown): string {
  return toScoredOptions(input)
    .map((option) =>
      option.value && option.value !== slugifyOptionValue(option.label)
        ? `${option.value}|${option.label}|${option.score}`
        : `${option.label} = ${option.score}`
    )
    .join("\n");
}

/** Kademeli puanlama alt seçenekleri konumsaldır; value gösterilmez. */
export function formatConditionalOptions(input: unknown): string {
  return toScoredOptions(input)
    .map((option) => `${option.label} = ${option.score}`)
    .join("\n");
}
