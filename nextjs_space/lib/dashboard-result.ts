export type DashboardResultState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_TO_SUBMIT"
  | "AWAITING_SUBMISSION"
  | "SUBMITTED";

export type ResultCategory = {
  name: string;
  percentage: number;
};

const MATURITY_LEVELS = [
  { label: "Başlangıç", minScore: 1 },
  { label: "Farkındalık", minScore: 1.8 },
  { label: "Gelişen", minScore: 2.6 },
  { label: "Olgun", minScore: 3.4 },
  { label: "Lider", minScore: 4.2 },
] as const;

export function getNextMaturityLevel(score: number): { label: string; pointsNeeded: number } | null {
  const safeScore = Math.min(5, Math.max(1, Number.isFinite(score) ? score : 1));
  const next = MATURITY_LEVELS.find((level) => level.minScore > safeScore + Number.EPSILON);
  if (!next) return null;
  return {
    label: next.label,
    pointsNeeded: Math.max(0, Math.round((next.minScore - safeScore) * 10) / 10),
  };
}

export function getDashboardResultState(input: {
  answeredQuestions: number;
  totalQuestions: number;
  submitted: boolean;
  isCoordinator: boolean;
}): DashboardResultState {
  if (input.submitted) return "SUBMITTED";
  if (input.answeredQuestions <= 0) return "NOT_STARTED";
  if (input.totalQuestions <= 0 || input.answeredQuestions < input.totalQuestions) {
    return "IN_PROGRESS";
  }
  return input.isCoordinator ? "READY_TO_SUBMIT" : "AWAITING_SUBMISSION";
}

/**
 * Sonuç cümlesi yalnızca ölçülen değerleri yorumlar. En düşük puanlı alanı
 * "öncelik" diye sunmaz; iş önceliği etki, efor ve kurum hedefleriyle ayrıca
 * belirlenir.
 */
export function buildDashboardResultSummary(input: {
  score: number;
  maturityLabel: string;
  categories: ResultCategory[];
  state: DashboardResultState;
}): string {
  if (input.state === "NOT_STARTED") {
    return "Ankete başladığınızda genel puanınız ve kategori kırılımınız burada oluşur.";
  }

  const validCategories = input.categories
    .filter((category) => Number.isFinite(category.percentage))
    .sort((a, b) => a.percentage - b.percentage);
  const lowest = validCategories[0];
  const highest = validCategories[validCategories.length - 1];
  const score = Math.round(Math.min(100, Math.max(0, input.score)));
  const prefix = input.state === "SUBMITTED" ? "Kesin" : "Mevcut taslak";

  if (!lowest || !highest) {
    return `${prefix} kurumsal olgunluk puanınız %${score} ile ${input.maturityLabel} seviyesindedir.`;
  }

  if (lowest.name === highest.name) {
    return `${prefix} kurumsal olgunluk puanınız %${score} ile ${input.maturityLabel} seviyesindedir. Ölçülen kategori ${highest.name} alanıdır.`;
  }

  return `${prefix} kurumsal olgunluk puanınız %${score} ile ${input.maturityLabel} seviyesindedir. ${highest.name} en yüksek, ${lowest.name} ise en düşük puanlı kategorinizdir.`;
}
