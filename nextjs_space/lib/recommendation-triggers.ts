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
  /**
   * Bu şık seçildiğinde `SurveyResponse.score` alanına yazılan puan.
   * Kademeli (devralmalı) tetiklemede eşik bu değerden hesaplanır; şıkların
   * olgunluk sıralamasını taşıyan tek bilgi budur.
   */
  score: number;
};

export type TriggerSupport =
  | { supported: true; choices: TriggerChoice[] }
  | { supported: false; reason: string };

type QuestionLike = {
  type: string;
  options?: unknown;
};

function toOptionList(options: unknown): TriggerChoice[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is Record<string, unknown> => !!option && typeof option === "object")
    .map((option) => {
      const score = Number(option.score);
      return {
        value: String(option.value ?? ""),
        label: String(option.label ?? option.value ?? ""),
        score: Number.isFinite(score) ? score : 0,
      };
    })
    .filter((option) => option.value !== "");
}

/** Evet/Hayır sorusunda şık puanı — anket motoruyla aynı varsayılanlar. */
function yesNoScore(options: unknown, value: "yes" | "no"): number {
  const match = toOptionList(options).find((option) => option.value === value);
  if (match) return match.score;
  return value === "yes" ? 5 : 1;
}

export function triggerChoicesFor(question: QuestionLike): TriggerSupport {
  switch (question.type) {
    case "SCALE":
      // Anket ekranı 1-5 arası seçilen sayıyı metin olarak kaydeder ve puan
      // doğrudan o sayıdır.
      return {
        supported: true,
        choices: [1, 2, 3, 4, 5].map((level) => ({
          value: String(level),
          label: `${level} puan`,
          score: level,
        })),
      };

    case "YES_NO":
      // Anket ekranı her zaman "yes"/"no" kaydeder; sorunun şık değerleri
      // farklı yazılmış olsa bile tetikleme bu değerlerle çalışır.
      return {
        supported: true,
        choices: [
          { value: "yes", label: "Evet", score: yesNoScore(question.options, "yes") },
          { value: "no", label: "Hayır", score: yesNoScore(question.options, "no") },
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
      // kaydedilir; tek bir şık değeriyle eşleşmez. Ancak cevabın puanı tekil
      // bir sayı olduğu için kademeli (puan eşiği) tetikleme çalışır.
      return {
        supported: false,
        reason:
          "Kademeli puanlama sorularında cevap birden fazla seçimden oluştuğu için şık bazlı tetikleme çalışmaz. Bunun yerine aşağıdaki kademeli tetiklemeyi (cevap puanı eşiği) kullanabilirsiniz.",
      };

    default:
      return { supported: false, reason: "Bu soru tipi için şık bazlı tetikleme desteklenmiyor." };
  }
}

/**
 * Kademeli tetiklemenin şık listesi üzerinden kurulabildiği soru tipleri.
 * CONDITIONAL_CHOICE'ta eşik doğrudan sayı olarak girilir.
 */
export function supportsCascadeByChoice(question: QuestionLike): boolean {
  const support = triggerChoicesFor(question);
  return support.supported && support.choices.length > 0;
}
