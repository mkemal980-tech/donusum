export type RecommendationPriorityInput = {
  id: string;
  title: string;
  description: string;
  strategicType: string;
  timeframe: string;
  costType: string;
  estimatedImpact: number;
  order: number;
  triggeredByQuestion?: boolean;
  isActionable?: boolean;
  stepDistance?: number;
};

const STRATEGY_ORDER: Record<string, number> = {
  QUICK_WIN: 0,
  PROJECT: 1,
  BIG_BET: 2,
};

const TIMEFRAME_ORDER: Record<string, number> = {
  SHORT_TERM: 0,
  MEDIUM_TERM: 1,
  LONG_TERM: 2,
};

function stepRank(stepDistance: number | undefined): number {
  const distance = stepDistance ?? 0;
  if (distance === 0) return 0;
  if (distance < 0) return 10 + Math.abs(distance);
  return 100 + distance;
}
/**
 * Alt kategori içindeki başlangıç adımlarını belirlenimci sıralar.
 * Uygulanabilir ve cevaba doğrudan bağlı öneriler önce gelir; etki, tür, vade
 * ve yönetici sırası eşitlikleri çözer. Kimlik son bağlayıcıdır, böylece aynı
 * veri her istekte aynı üçlüyü üretir.
 */
export function rankStartingRecommendations<T extends RecommendationPriorityInput>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const actionable = Number(a.isActionable === false) - Number(b.isActionable === false);
    if (actionable !== 0) return actionable;

    const steps = stepRank(a.stepDistance) - stepRank(b.stepDistance);
    if (steps !== 0) return steps;

    const triggered = Number(!a.triggeredByQuestion) - Number(!b.triggeredByQuestion);
    if (triggered !== 0) return triggered;

    const impact = (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0);
    if (impact !== 0) return impact;

    const strategy = (STRATEGY_ORDER[a.strategicType] ?? 9) - (STRATEGY_ORDER[b.strategicType] ?? 9);
    if (strategy !== 0) return strategy;

    const timeframe = (TIMEFRAME_ORDER[a.timeframe] ?? 9) - (TIMEFRAME_ORDER[b.timeframe] ?? 9);
    if (timeframe !== 0) return timeframe;

    const order = (a.order ?? 0) - (b.order ?? 0);
    return order !== 0 ? order : a.id.localeCompare(b.id);
  });
}

export function recommendationReasons(item: RecommendationPriorityInput): string[] {
  const reasons: string[] = [];
  if (item.triggeredByQuestion) reasons.push("Yanıtınıza göre");

  if ((item.stepDistance ?? 0) > 0) {
    reasons.push(`${item.stepDistance} basamak sonra`);
  } else if (item.strategicType === "QUICK_WIN" && item.timeframe === "SHORT_TERM") {
    reasons.push("Kısa vadeli hızlı kazanım");
  } else if ((item.estimatedImpact ?? 0) >= 7) {
    reasons.push("Yüksek etki");
  } else if (item.isActionable !== false) {
    reasons.push("Şimdi uygulanabilir");
  }

  return reasons.slice(0, 2);
}
