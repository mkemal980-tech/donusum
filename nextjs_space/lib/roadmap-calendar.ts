export type RoadmapQuarter = { q: number; year: number; label: string };

/** Sunucu ve tarayıcı, takvim sınırlarında İstanbul saatini kullanır. */
export function currentRoadmapQuarter(date = new Date()): RoadmapQuarter {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return roadmapQuarterAt(year * 4 + Math.floor((month - 1) / 3));
}

export function roadmapQuarterIndex(quarter: { q: number; year: number }): number {
  return quarter.year * 4 + quarter.q - 1;
}

export function roadmapQuarterAt(index: number): RoadmapQuarter {
  const year = Math.floor(index / 4);
  const q = index % 4 + 1;
  return { q, year, label: `Ç${q} ${year}` };
}

export function hasRoadmapTiming(item: {
  plannedQuarter?: number | null; plannedYear?: number | null;
}): boolean {
  return Number.isInteger(item.plannedQuarter) && item.plannedQuarter! >= 1 &&
    item.plannedQuarter! <= 4 && Number.isInteger(item.plannedYear) && item.plannedYear! > 0;
}

/** Yeni planın sekiz çeyreğini ve mevcut atamaların tamamını görünür tutar. */
export function roadmapTimelineQuarters(
  items: { plannedQuarter?: number | null; plannedYear?: number | null }[],
  start = currentRoadmapQuarter(),
): RoadmapQuarter[] {
  const indices = items.filter(hasRoadmapTiming).map((item) =>
    roadmapQuarterIndex({ q: item.plannedQuarter!, year: item.plannedYear! })
  );
  const current = roadmapQuarterIndex(start);
  const first = Math.min(current, ...indices);
  const last = Math.max(current + 7, ...indices);
  return Array.from({ length: last - first + 1 }, (_, offset) => roadmapQuarterAt(first + offset));
}
