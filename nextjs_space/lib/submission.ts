/**
 * Gönderim adımı.
 *
 * Değerlendirme bir noktada bitmeli: kuruluş "bu bizim cevabımız" demeden
 * puan hep taslak kalır, kıyaslanamaz ve kimse ona dayanarak karar veremez.
 * Gönderim bu çizgiyi çeker — cevaplar ve görev dağılımı kilitlenir, puanın
 * o günkü hâli geçmişe kaydedilir.
 *
 * İki karar, ikisi de bilinçli:
 *
 * 1. **Eksik varken gönderim engellenmiyor.** Bazı sorular kuruluş için
 *    gerçekten cevaplanamaz olabilir; %100 dayatmak insanları rastgele cevap
 *    girmeye iter ve puanı bozar. Bunun yerine ekran neyin eksik olduğunu
 *    sayarak söyler ve onay ister — sorumluluk koordinatörde kalır.
 * 2. **Geri alma koordinatörde.** Yazım hatası yüzünden sistem yöneticisini
 *    beklemek işi durdurur. Geri alma geçmişi silmez: gönderim anındaki puan
 *    kaydı yerinde kalır, yeni gönderim yeni bir kayıt üretir.
 *
 * Saf modül — prisma ve React bağımlılığı yoktur.
 */

export type AssessmentStatus = "IN_PROGRESS" | "SUBMITTED";

/** Gönderilmiş değerlendirmede cevap ve görev dağılımı değişmez. */
export function isLocked(status: AssessmentStatus | null | undefined): boolean {
  return status === "SUBMITTED";
}

export type ReadinessSection = {
  name: string;
  questionCount: number;
  answeredCount: number;
};

export type IncompleteSection = {
  name: string;
  missing: number;
};

export type SubmissionReadiness = {
  totalQuestions: number;
  answeredQuestions: number;
  percentage: number;
  /** Boş soru kalmamış mı? */
  complete: boolean;
  /** Eksiği olan bölümler, en çok eksiği olan başta. */
  incompleteSections: IncompleteSection[];
  /** Toplam boş soru sayısı. */
  missingQuestions: number;
};

/**
 * Gönderim öncesi durum özeti.
 *
 * Bölüme bağlı olmayan sorular da (kategoriye doğrudan bağlı olanlar) sayıya
 * girer; onlar da cevaplanmadan değerlendirme tam sayılmaz. Ayrı bir bölüm
 * satırı olarak listelenmeleri için çağıran taraf isim verir.
 */
export function submissionReadiness(sections: ReadinessSection[]): SubmissionReadiness {
  let totalQuestions = 0;
  let answeredQuestions = 0;
  const incompleteSections: IncompleteSection[] = [];

  for (const section of sections) {
    totalQuestions += section.questionCount;
    // Sorusu çıkarılmış bölümde cevap sayısı soruyu aşabilir; eksi eksik olmaz.
    const answered = Math.min(section.answeredCount, section.questionCount);
    answeredQuestions += answered;

    const missing = section.questionCount - answered;
    if (missing > 0) {
      incompleteSections.push({ name: section.name, missing });
    }
  }

  incompleteSections.sort((a, b) => b.missing - a.missing);

  const missingQuestions = totalQuestions - answeredQuestions;

  return {
    totalQuestions,
    answeredQuestions,
    percentage:
      totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 100,
    complete: missingQuestions === 0,
    incompleteSections,
    missingQuestions,
  };
}

/**
 * Gönderim düğmesinin altında yazacak tek cümle.
 *
 * Sayı vermek şart: "eksikler var" uyarısı koordinatöre hiçbir şey
 * söylemezken "3 bölümde 7 soru boş" doğrudan işe dönüşür.
 */
export function readinessSummary(readiness: SubmissionReadiness): string {
  if (readiness.totalQuestions === 0) return "Bu ankette cevaplanacak soru yok.";
  if (readiness.complete) return "Bütün sorular cevaplandı.";

  const sectionCount = readiness.incompleteSections.length;
  return `${sectionCount} bölümde ${readiness.missingQuestions} soru boş.`;
}
