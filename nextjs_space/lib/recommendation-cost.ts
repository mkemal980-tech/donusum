/**
 * Önerinin CAPEX / OPEX yükü (1-5 dolar işareti).
 *
 * Şablonda maliyetin *türü* var (OPEX mi CAPEX mi) ama *büyüklüğü* yok; toplu
 * yüklemede iki seviye de varsayılan 1'de kalıyordu, yani 284 önerinin
 * tamamı listede tek dolar işaretiyle görünüyordu — kolon hiçbir şey
 * ayırt etmiyordu.
 *
 * Burada seviye, önerinin zaten girilen alanlarından türetilir:
 *   strateji → işin büyüklüğü (hızlı kazanım küçük, büyük yatırım büyük)
 *   vade     → uzun vadeli iş daha pahalıya mal olur
 *   tür      → yükün hangi kalemde toplandığı
 *
 * `derivePosition` ile aynı yaklaşım: türetilmiş bir başlangıç değeri, yönetici
 * öneriyi açıp sürgüyle istediği gibi ezebilir.
 */

export type CostLevels = { capexLevel: number; opexLevel: number };

export type CostLevelInput = {
  costType?: string | null;
  strategicType?: string | null;
  timeframe?: string | null;
};

/** Stratejinin taşıdığı iş büyüklüğü. */
const STRATEGY_WEIGHT: Record<string, number> = {
  QUICK_WIN: 1,
  PROJECT: 3,
  BIG_BET: 5,
};

/** Vade, yükü bir kademe aşağı ya da yukarı kaydırır. */
const TIMEFRAME_SHIFT: Record<string, number> = {
  SHORT_TERM: -1,
  MEDIUM_TERM: 0,
  LONG_TERM: 1,
};

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function deriveCostLevels(input: CostLevelInput): CostLevels {
  const weight = STRATEGY_WEIGHT[input.strategicType ?? ""] ?? STRATEGY_WEIGHT.PROJECT;
  const shift = TIMEFRAME_SHIFT[input.timeframe ?? ""] ?? 0;
  const main = clamp(weight + shift);

  // CAPEX'li bir iş kurulduktan sonra işletme yükü de getirir: bakım, lisans,
  // eğitim. Tersi geçerli değil — prosedür ve eğitim işi yatırım gerektirmez.
  if ((input.costType ?? "").toLocaleUpperCase("tr") === "CAPEX") {
    return { capexLevel: main, opexLevel: clamp(main - 2) };
  }

  return { capexLevel: 1, opexLevel: main };
}
