/**
 * Bölüm bazlı görev dağılımı.
 *
 * Değerlendirmenin sahibi kuruluş olunca (bkz. lib/assessment) sıradaki soru
 * "kim neyi dolduracak" oluyor. Anketin tamamını herkese açık bırakmak iki
 * şeyi birden bozar: kimse kendini sorumlu hissetmez ve iki kişi aynı soruya
 * farklı cevap girip birbirinin üzerine yazar.
 *
 * Dağıtım **bölüm (alt kategori)** düzeyindedir. Kategori çok kaba — tek bir
 * "Çevre" başlığı üç departmanı birden ilgilendirir; soru çok ince — 71
 * satırlık bir dağıtım ekranı yönetilemez. Bölüm, bir departmanın bir
 * oturumda bitirebileceği doğal iş birimidir.
 *
 * Bir bölüm tek kişiye atanır. İki sorumluya izin verilseydi aynı soruya iki
 * cevap gelebilir ve "hangisi geçerli" diye bir çatışma çözümü başlığı açmak
 * gerekirdi; tek sorumlu bu başlığı hiç açtırmaz.
 *
 * Saf modül — prisma ve React bağımlılığı yoktur.
 */

export type SectionAssignment = {
  subCategoryId: string;
  assigneeId: string;
};

export type Viewer = {
  userId: string;
  /**
   * Koordinatör: birimin yöneticisi, sistem yöneticisi ya da tek kişilik
   * değerlendirmenin sahibi. Görevi dağıtan ve sonunda gönderen kişi.
   */
  isCoordinator: boolean;
};

export type SectionVisibility = {
  /** Değerlendirmede en az bir atama var mı? */
  distributed: boolean;
  /** Bu bölüm kullanıcıya gösterilir mi? */
  canSee: (subCategoryId: string | null | undefined) => boolean;
  /**
   * Doğrudan kategoriye bağlı sorular gösterilir mi?
   *
   * Bu sorular bir alt kategoriye bağlı olmadığı için atanamaz; dağıtım
   * başladığında koordinatörde kalırlar. Katkıcıya göstermek "bir bölüm tek
   * kişiye" kuralını delerdi.
   */
  canSeeDirect: boolean;
  /** Kullanıcıya atanmış bölümler. */
  mySectionIds: string[];
};

/**
 * Bir kullanıcının hangi bölümleri görebileceğini çözer.
 *
 * Kurallar:
 *   1. Hiç atama yoksa herkes her şeyi görür. Dağıtım isteğe bağlı bir
 *      özelliktir; kullanmayan ekibin anketi kilitlenmemeli.
 *   2. Koordinatör her zaman hepsini görür — atanmamış bölüm sahipsiz
 *      kalmasın diye onları kendisi de doldurabilir.
 *   3. Katkıcı yalnızca kendine atanan bölümleri görür.
 */
export function buildSectionVisibility(
  assignments: SectionAssignment[],
  viewer: Viewer
): SectionVisibility {
  const distributed = assignments.length > 0;
  const mySectionIds = assignments
    .filter((assignment) => assignment.assigneeId === viewer.userId)
    .map((assignment) => assignment.subCategoryId);

  if (!distributed || viewer.isCoordinator) {
    return {
      distributed,
      canSee: () => true,
      canSeeDirect: true,
      mySectionIds,
    };
  }

  const mine = new Set(mySectionIds);

  return {
    distributed,
    canSee: (subCategoryId) => (subCategoryId ? mine.has(subCategoryId) : false),
    canSeeDirect: false,
    mySectionIds,
  };
}

/** Bir bölümün sorumlusu; atanmamışsa null. */
export function assigneeOf(
  assignments: SectionAssignment[],
  subCategoryId: string
): string | null {
  const found = assignments.find((assignment) => assignment.subCategoryId === subCategoryId);
  return found?.assigneeId ?? null;
}

/** Kişi başına bölüm sayısı — dağıtımın dengeli olup olmadığını göstermek için. */
export function sectionCountByAssignee(
  assignments: SectionAssignment[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const assignment of assignments) {
    counts[assignment.assigneeId] = (counts[assignment.assigneeId] ?? 0) + 1;
  }
  return counts;
}
