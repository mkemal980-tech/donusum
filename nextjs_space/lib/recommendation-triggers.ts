/**
 * Bir öneri, seçilen soruya verilen cevaba göre tetiklenir.
 *
 * Eşleştirme `lib/scoring.ts` içinde şöyle yapılır: kullanıcının kaydedilmiş
 * cevabı (`SurveyResponse.value`) küçük harfe indirilip önerinin
 * `triggerOptions` listesiyle karşılaştırılır. Bu yüzden tetikleyici değerler,
 * sorunun şık etiketleri değil, anket ekranının **kaydettiği değerler**
 * olmalıdır. Bu modül her soru tipi için o değerleri üretir.
 */

export type TriggerChoice = {
  /** SurveyResponse.value ile birebir eşleşen değer. */
  value: string;
  /** Yöneticiye gösterilecek etiket. */
  label: string;
};

export type TriggerSupport =
  | { supported: true; choices: TriggerChoice[] }
  | { supported: false; reason: string };

type QuestionLike = {
  type: string;
  options?: unknown;
};

function toOptionList(options: unknown): { value: string; label: string }[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is Record<string, unknown> => !!option && typeof option === "object")
    .map((option) => ({
      value: String(option.value ?? ""),
      label: String(option.label ?? option.value ?? ""),
    }))
    .filter((option) => option.value !== "");
}

export function triggerChoicesFor(question: QuestionLike): TriggerSupport {
  switch (question.type) {
    case "SCALE":
      // Anket ekranı 1-5 arası seçilen sayıyı metin olarak kaydeder.
      return {
        supported: true,
        choices: [1, 2, 3, 4, 5].map((level) => ({
          value: String(level),
          label: `${level} puan`,
        })),
      };

    case "YES_NO":
      // Anket ekranı her zaman "yes"/"no" kaydeder; sorunun şık değerleri
      // farklı yazılmış olsa bile tetikleme bu değerlerle çalışır.
      return {
        supported: true,
        choices: [
          { value: "yes", label: "Evet" },
          { value: "no", label: "Hayır" },
        ],
      };

    case "MULTIPLE_CHOICE": {
      const choices = toOptionList(question.options);
      if (choices.length === 0) {
        return { supported: false, reason: "Bu sorunun şıkkı yok. Önce soruya şık ekleyin." };
      }
      return { supported: true, choices };
    }

    case "CONDITIONAL_CHOICE":
      // Kademeli puanlamada cevap { threshold, selected } JSON'u olarak
      // kaydedilir; tek bir şık değeriyle eşleşmez.
      return {
        supported: false,
        reason:
          "Kademeli puanlama sorularında cevap birden fazla seçimden oluştuğu için şık bazlı tetikleme çalışmaz. Bu öneri puan aralığına göre gösterilir.",
      };

    default:
      return { supported: false, reason: "Bu soru tipi için şık bazlı tetikleme desteklenmiyor." };
  }
}
