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

/**
 * Sorunun (dolayısıyla cevabın) hangi bölüme ait olduğu.
 *
 * Soru ya doğrudan bölüme ya da bölümün bir alt seviyesine bağlıdır. İkisi de
 * yoksa kategoriye doğrudan bağlıdır ve hiçbir bölüme ait değildir; bu sorular
 * atanamaz ve koordinatörde kalır.
 */
export function sectionOfQuestion(question: {
  subCategoryId?: string | null;
  subLevel?: { subCategoryId: string } | null;
}): string | null {
  return question.subCategoryId ?? question.subLevel?.subCategoryId ?? null;
}

/** Bir bölümün sorumlusu; atanmamışsa null. */
export function assigneeOf(
  assignments: SectionAssignment[],
  subCategoryId: string
): string | null {
  const found = assignments.find((assignment) => assignment.subCategoryId === subCategoryId);
  return found?.assigneeId ?? null;
}

/**
 * Koordinatör panosu.
 *
 * Dağıtımdan sonra koordinatörün tek bir sorusu kalıyor: "kim ne kadar
 * doldurdu, kimi arayayım?" Cevap bölüm bazlı ilerlemeden çıkar; kişi başına
 * toplam da aynı veriden türetilir, ayrıca sorgulanmaz.
 */

export type SectionProgress = {
  id: string;
  assigneeId: string | null;
  questionCount: number;
  answeredCount: number;
};

export type SectionStatus = "EMPTY" | "IN_PROGRESS" | "DONE";

/**
 * Bölümün durumu.
 *
 * Sorusuz bölüm "bitti" sayılır: doldurulacak bir şeyi yoktur ve panoda
 * kırmızı durması koordinatörü boşuna meşgul ederdi.
 */
export function sectionStatus(section: {
  questionCount: number;
  answeredCount: number;
}): SectionStatus {
  if (section.questionCount === 0) return "DONE";
  if (section.answeredCount === 0) return "EMPTY";
  return section.answeredCount >= section.questionCount ? "DONE" : "IN_PROGRESS";
}

/**
 * Kime ne kadar iş kaldığı — hatırlatma göndermek için.
 *
 * Her atamada tek tek posta atmak spam olur ve bildirimler okunmaz hâle
 * gelir: koordinatör on iki bölümü tek tek dağıtırken aynı kişiye on iki
 * posta gider. Bunun yerine kişi başına tek özet çıkarılır ve gönderme anını
 * koordinatör seçer.
 *
 * Bölümünü bitirmiş kişi listeye girmez: hatırlatılacak bir şeyi yok.
 */
export function pendingByAssignee(
  sections: Array<SectionProgress & { name: string }>
): Array<{
  assigneeId: string;
  sections: Array<{ name: string; questionCount: number; answeredCount: number }>;
  missingQuestions: number;
}> {
  const byAssignee = new Map<
    string,
    { assigneeId: string; sections: Array<{ name: string; questionCount: number; answeredCount: number }>; missingQuestions: number }
  >();

  for (const section of sections) {
    if (!section.assigneeId) continue;
    const missing = section.questionCount - Math.min(section.answeredCount, section.questionCount);
    if (missing === 0) continue;

    const row =
      byAssignee.get(section.assigneeId) ??
      { assigneeId: section.assigneeId, sections: [], missingQuestions: 0 };

    row.sections.push({
      name: section.name,
      questionCount: section.questionCount,
      answeredCount: section.answeredCount,
    });
    row.missingQuestions += missing;
    byAssignee.set(section.assigneeId, row);
  }

  return Array.from(byAssignee.values());
}

export type AssigneeRollup = {
  /** null → atanmamış bölümler; sorumluluğu koordinatörde. */
  assigneeId: string | null;
  sections: number;
  questionCount: number;
  answeredCount: number;
  /** Tamamlanmış bölüm sayısı — "3 bölümün 2'si bitti" demek için. */
  doneSections: number;
  percentage: number;
};

/**
 * Bölümleri sorumlularına göre toplar.
 *
 * Atanmamış bölümler tek bir `null` satırında toplanır; koordinatörün kendi
 * üzerinde kalan yükü de panoda görünsün diye — dağıtımın unutulan kısmı en
 * çok orada birikiyor.
 */
export function rollupByAssignee(sections: SectionProgress[]): AssigneeRollup[] {
  const rows = new Map<string | null, AssigneeRollup>();

  for (const section of sections) {
    const key = section.assigneeId ?? null;
    const row =
      rows.get(key) ??
      {
        assigneeId: key,
        sections: 0,
        questionCount: 0,
        answeredCount: 0,
        doneSections: 0,
        percentage: 0,
      };

    row.sections += 1;
    row.questionCount += section.questionCount;
    row.answeredCount += section.answeredCount;
    if (sectionStatus(section) === "DONE") row.doneSections += 1;
    rows.set(key, row);
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    percentage:
      row.questionCount > 0 ? Math.round((row.answeredCount / row.questionCount) * 100) : 100,
  }));
}
