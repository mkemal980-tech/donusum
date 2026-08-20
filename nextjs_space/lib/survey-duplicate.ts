/**
 * Anket çoğaltma.
 *
 * Bir sonraki yılın ya da başka bir sektörün anketi, öncekinin küçük farklarla
 * tekrarıdır: 13 bölüm ve 71 soru elle yeniden yazılacak şeyler değil.
 * Çoğaltma, üzerine çalışılacak bir taslak verir.
 *
 * NE KOPYALANIR
 *   anket → kategori → alt kategori → alt seviye → soru
 *   öneriler (yeni sorulara/bölümlere bağlanmış hâlde)
 *   sektör kapsam kuralları ve kıyas değerleri
 *
 * NE KOPYALANMAZ — ve neden
 *   cevaplar, değerlendirmeler, yol haritası, puan geçmişi: bunlar kuruluşun
 *     verdiği cevaplardır, anketin parçası değil. Kopyaya taşımak bir
 *     kuruluşun cevaplarını başka bir ankete iliştirmek olurdu.
 *   kullanıcı atamaları: kopya kimseye atanmış gelmemeli, yoksa gözden
 *     geçirilmemiş bir anket kullanıcıların ekranında belirir.
 *   arşivlenmiş (silinmiş) içerik: kullanıcı onları silmişti; kopyaya geri
 *     getirmek sessizce diriltmek olurdu.
 *
 * Saf modül — prisma ve React bağımlılığı yoktur.
 */

/** Kopya adının eki. */
const COPY_SUFFIX = "kopya";

/**
 * Bir adın kopya ekinden arındırılmış hâli.
 *
 * Kopyanın kopyası "X (kopya) (kopya)" olmamalı; "X (kopya 2)" olmalı.
 */
export function stripCopySuffix(name: string): string {
  return name.replace(new RegExp(`\\s*\\(${COPY_SUFFIX}(\\s+\\d+)?\\)\\s*$`, "i"), "").trim();
}

/**
 * Çakışmayan bir kopya adı üretir.
 *
 * Aynı adda iki anket listede ayırt edilemez; numara vermek şart. Ad alanı
 * veritabanında benzersiz değil, yani bu kontrol yalnızca burada var.
 */
export function nextCopyName(baseName: string, existingNames: string[]): string {
  const base = stripCopySuffix(baseName) || baseName.trim();
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));

  const candidate = `${base} (${COPY_SUFFIX})`;
  if (!taken.has(candidate.toLowerCase())) return candidate;

  for (let index = 2; index < 1000; index++) {
    const numbered = `${base} (${COPY_SUFFIX} ${index})`;
    if (!taken.has(numbered.toLowerCase())) return numbered;
  }

  // Bin kopya makul bir sınır; buraya gelinirse ad çakışması kullanıcının
  // sorunu değil, veri temizliği sorunudur.
  throw new Error("Kopya adı üretilemedi: çok fazla kopya var.");
}

/**
 * Kopyalanan kayıtların özeti — ekranda "ne kopyalandı" demek için.
 */
export type DuplicateSummary = {
  categories: number;
  subCategories: number;
  subLevels: number;
  questions: number;
  recommendations: number;
  scopeRules: number;
  benchmarks: number;
};

/** Özeti tek cümleye indirir; bildirimde uzun liste okunmuyor. */
export function summarizeDuplicate(summary: DuplicateSummary): string {
  return (
    `${summary.categories} kategori, ${summary.subCategories} bölüm, ` +
    `${summary.questions} soru, ${summary.recommendations} öneri kopyalandı.`
  );
}
