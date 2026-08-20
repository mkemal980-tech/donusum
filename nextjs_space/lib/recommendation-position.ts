/**
 * Öneri önceliklendirme grafiğinin (bubble chart) konum ve boyut kuralları.
 *
 * Grafik, kullanıcının Öneriler sayfasında ilk gördüğü görünümdür:
 *   X ekseni → "Kaynak → Önem → Aciliyet"
 *   Y ekseni → "Öncelik Puanı"
 *   Baloncuk boyutu → tahmini etki
 *
 * Konumlar önceden elle giriliyordu ve varsayılanları (5, 5) olduğu için
 * dokunulmayan öneriler grafikte tek bir noktada üst üste yığılıyordu.
 * Burada konum, önerinin zaten girilen alanlarından türetilir; yönetici
 * isterse elle ezebilir.
 */

export type StrategicType = "QUICK_WIN" | "PROJECT" | "BIG_BET";
export type Timeframe = "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";

export type BubblePosition = { xPosition: number; yPosition: number };

export type PositionInput = {
  strategicType?: string | null;
  timeframe?: string | null;
  estimatedImpact?: number | null;
};

/** X ekseni "kaynak" ucundan "aciliyet" ucuna gider. */
const STRATEGY_X: Record<StrategicType, number> = {
  BIG_BET: 2,   // kaynak yoğun, uzun soluklu
  PROJECT: 5,   // önem ekseni ortası
  QUICK_WIN: 8, // acil, hemen yapılabilir
};

/** Vade, aciliyeti öne veya arkaya kaydırır. */
const TIMEFRAME_SHIFT: Record<Timeframe, number> = {
  SHORT_TERM: 1,
  MEDIUM_TERM: 0,
  LONG_TERM: -1,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Önerinin diğer alanlarından grafikteki yerini üretir. */
export function derivePosition(input: PositionInput): BubblePosition {
  const strategy = (input.strategicType ?? "PROJECT") as StrategicType;
  const timeframe = (input.timeframe ?? "MEDIUM_TERM") as Timeframe;

  const baseX = STRATEGY_X[strategy] ?? STRATEGY_X.PROJECT;
  const shift = TIMEFRAME_SHIFT[timeframe] ?? 0;

  // Y doğrudan etkidir: yüksek etkili öneri grafikte yukarıda durur.
  const impact = clamp(Number(input.estimatedImpact ?? 5), 1, 10);

  return {
    xPosition: round(clamp(baseX + shift, 0.5, 9.5)),
    yPosition: round(clamp(impact, 0.5, 9.5)),
  };
}

/**
 * Etkiyi baloncuk yarıçapına çevirir.
 *
 * Önceki formül `max(15, min(40, etki × 3))` idi; 1-5 arası bütün değerler
 * aynı 15 pikseli veriyordu, yani aralığın yarısı görsel olarak ölüydü.
 * Burada 1-10 aralığının tamamı ayırt edilebilir bir yarıçapa yayılır.
 */
export const MIN_BUBBLE_RADIUS = 12;
export const MAX_BUBBLE_RADIUS = 38;

export function bubbleRadiusFor(estimatedImpact: number | null | undefined): number {
  const impact = clamp(Number(estimatedImpact ?? 5), 1, 10);
  const ratio = (impact - 1) / 9;
  return MIN_BUBBLE_RADIUS + ratio * (MAX_BUBBLE_RADIUS - MIN_BUBBLE_RADIUS);
}

/**
 * Aynı noktaya düşen baloncukları küçük bir sarmalla ayırır.
 *
 * Konum artık türetildiği için çakışma azaldı ama aynı strateji + aynı etki
 * değerine sahip öneriler hâlâ tam olarak üst üste gelir. Bu kaydırma
 * belirlenimcidir: aynı liste her zaman aynı yerleşimi verir.
 */
export function spreadOverlapping<T extends { xPosition: number; yPosition: number }>(
  items: T[]
): (T & BubblePosition)[] {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const key = `${round(item.xPosition)}|${round(item.yPosition)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);

    if (index === 0) return { ...item };

    // 0.55 birim yarıçaplı halkalar; her halkada 6 baloncuk.
    const ring = Math.floor((index - 1) / 6) + 1;
    const slot = (index - 1) % 6;
    const angle = (slot / 6) * Math.PI * 2 + ring * 0.4;
    const distance = 0.55 * ring;

    return {
      ...item,
      xPosition: round(clamp(item.xPosition + Math.cos(angle) * distance, 0.3, 9.7)),
      yPosition: round(clamp(item.yPosition + Math.sin(angle) * distance, 0.3, 9.7)),
    };
  });
}
