/**
 * Sektöre göre kapsam ve ağırlık.
 *
 * Aynı anket her sektöre aynı ölçüde hitap etmez: bir bölüm bir sektörde
 * kritikken diğerinde hiç sorulmaması gerekir. Bunu her sektöre ayrı anket
 * yazarak çözmek bakımı imkânsız hâle getirir (bir düzeltme N yerde
 * tekrarlanır ve sektörler kıyaslanamaz olur). Bunun yerine anket tek kalır;
 * sektör × bölüm matrisi hangi bölümün sorulacağını ve ne kadar sayılacağını
 * belirler.
 *
 * Kural bölüm (alt kategori) düzeyindedir, soru düzeyinde değil: soru düzeyi
 * daha hassas olurdu ama matris yönetilemez boyuta çıkar (15 sektör × 71 soru).
 *
 * Saf modül — prisma ve React bağımlılığı yoktur.
 */

/** Yöneticinin gördüğü dört seçenek. */
export const SCOPE_LEVELS = [
  { key: "EXCLUDED", label: "Sorma", weight: 0, applicable: false },
  { key: "LOW", label: "Az önemli", weight: 0.5, applicable: true },
  { key: "NORMAL", label: "Orta", weight: 1, applicable: true },
  { key: "HIGH", label: "Çok önemli", weight: 2, applicable: true },
] as const;

export type ScopeLevelKey = (typeof SCOPE_LEVELS)[number]["key"];

/** Varsayılan: kapsamda ve normal ağırlıkta.
 *
 * Kritik: varsayılan "sorulsun" olmalı. Aksi hâlde ankete yeni bir bölüm
 * eklendiğinde hiçbir sektörde görünmez ve bu fark edilmez. Yeni içerik
 * herkese açılır, sonra bilinçli olarak kapatılır.
 */
export const DEFAULT_SCOPE: ResolvedScope = { applicable: true, weight: 1 };

export type ResolvedScope = { applicable: boolean; weight: number };

export type ScopeRule = {
  sectorId: string;
  /** null → sektörün tamamı için geçerli. */
  subSectorId: string | null;
  subCategoryId: string;
  applicable: boolean;
  weight: number;
};

export type UserSector = {
  sectorId: string | null;
  subSectorId: string | null;
};

/** Seviye anahtarından çözülmüş kapsama. */
export function scopeFromLevel(key: ScopeLevelKey): ResolvedScope {
  const level = SCOPE_LEVELS.find((entry) => entry.key === key) ?? SCOPE_LEVELS[2];
  return { applicable: level.applicable, weight: level.weight };
}

/** Kaydedilmiş kuraldan yöneticiye gösterilecek seviye anahtarı. */
export function levelFromScope(scope: ResolvedScope): ScopeLevelKey {
  if (!scope.applicable) return "EXCLUDED";
  // En yakın tanımlı ağırlığa yuvarla; elle girilmiş ara değerler de bir
  // seçeneğe düşsün.
  const candidates = SCOPE_LEVELS.filter((level) => level.applicable);
  let closest = candidates[0];
  for (const level of candidates) {
    if (Math.abs(level.weight - scope.weight) < Math.abs(closest.weight - scope.weight)) {
      closest = level;
    }
  }
  return closest.key;
}

/**
 * Bir bölümün kullanıcı için kapsamını çözer.
 *
 * Geri düşme zinciri:
 *   1. Alt sektöre özel kural
 *   2. Sektör geneli kural (subSectorId = null)
 *   3. Varsayılan (kapsamda, ağırlık 1)
 *
 * Kullanıcının sektörü yoksa hiçbir kural uygulanmaz — herkese her şey sorulur.
 */
export function resolveScope(
  rules: ScopeRule[],
  user: UserSector,
  subCategoryId: string
): ResolvedScope {
  if (!user.sectorId) return DEFAULT_SCOPE;

  const forSubCategory = rules.filter(
    (rule) => rule.subCategoryId === subCategoryId && rule.sectorId === user.sectorId
  );

  if (user.subSectorId) {
    const exact = forSubCategory.find((rule) => rule.subSectorId === user.subSectorId);
    if (exact) return { applicable: exact.applicable, weight: exact.weight };
  }

  const sectorWide = forSubCategory.find((rule) => rule.subSectorId === null);
  if (sectorWide) return { applicable: sectorWide.applicable, weight: sectorWide.weight };

  return DEFAULT_SCOPE;
}

/**
 * Kuralları bir kez indeksleyip tekrar tekrar çözmek için.
 * Puanlama her soru için çağırdığından lineer aramadan kaçınılır.
 */
export function buildScopeResolver(rules: ScopeRule[], user: UserSector) {
  const cache = new Map<string, ResolvedScope>();

  return (subCategoryId: string | null | undefined): ResolvedScope => {
    if (!subCategoryId) return DEFAULT_SCOPE;
    const cached = cache.get(subCategoryId);
    if (cached) return cached;
    const resolved = resolveScope(rules, user, subCategoryId);
    cache.set(subCategoryId, resolved);
    return resolved;
  };
}
