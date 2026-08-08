import { describe, expect, it } from "vitest";
import {
  type SectionAssignment,
  assigneeOf,
  buildSectionVisibility,
  pendingByAssignee,
  rollupByAssignee,
  sectionOfQuestion,
  sectionStatus,
} from "../section-assignment";

const AYSE = "kullanici-ayse";
const MEHMET = "kullanici-mehmet";
const KOORDINATOR = "kullanici-koordinator";

const ATIK = "bolum-atik";
const ENERJI = "bolum-enerji";
const SOSYAL = "bolum-sosyal";

const assignments: SectionAssignment[] = [
  { subCategoryId: ATIK, assigneeId: AYSE },
  { subCategoryId: ENERJI, assigneeId: MEHMET },
  { subCategoryId: SOSYAL, assigneeId: AYSE },
];

describe("buildSectionVisibility", () => {
  it("dağıtım yapılmamışsa herkes her şeyi görür", () => {
    // Dağıtım isteğe bağlı: kullanmayan ekibin anketi kilitlenmemeli.
    const visibility = buildSectionVisibility([], { userId: AYSE, isCoordinator: false });

    expect(visibility.distributed).toBe(false);
    expect(visibility.canSee(ATIK)).toBe(true);
    expect(visibility.canSee(ENERJI)).toBe(true);
    expect(visibility.canSeeDirect).toBe(true);
  });

  it("katkıcı yalnızca kendine atanan bölümleri görür", () => {
    const visibility = buildSectionVisibility(assignments, {
      userId: AYSE,
      isCoordinator: false,
    });

    expect(visibility.distributed).toBe(true);
    expect(visibility.canSee(ATIK)).toBe(true);
    expect(visibility.canSee(SOSYAL)).toBe(true);
    expect(visibility.canSee(ENERJI)).toBe(false);
    expect(visibility.mySectionIds).toEqual([ATIK, SOSYAL]);
  });

  it("koordinatör dağıtımdan bağımsız olarak hepsini görür", () => {
    // Atanmamış bölüm sahipsiz kalmasın diye koordinatör de doldurabilir.
    const visibility = buildSectionVisibility(assignments, {
      userId: KOORDINATOR,
      isCoordinator: true,
    });

    expect(visibility.canSee(ATIK)).toBe(true);
    expect(visibility.canSee(ENERJI)).toBe(true);
    expect(visibility.canSee("hic-atanmamis-bolum")).toBe(true);
    expect(visibility.canSeeDirect).toBe(true);
    expect(visibility.mySectionIds).toEqual([]);
  });

  it("hiç bölüm atanmamış katkıcı hiçbir şey göremez", () => {
    // Ekranda "size henüz bölüm atanmadı" demek, yarım anket göstermekten iyidir.
    const visibility = buildSectionVisibility(assignments, {
      userId: "kullanici-yeni",
      isCoordinator: false,
    });

    expect(visibility.distributed).toBe(true);
    expect(visibility.mySectionIds).toEqual([]);
    expect(visibility.canSee(ATIK)).toBe(false);
  });

  it("atanmamış bölüm katkıcıya kapalıdır", () => {
    const visibility = buildSectionVisibility(assignments, {
      userId: AYSE,
      isCoordinator: false,
    });

    expect(visibility.canSee("bolum-tedarik")).toBe(false);
  });

  it("dağıtım başlayınca kategoriye doğrudan bağlı sorular koordinatörde kalır", () => {
    // Bu sorular bir alt kategoriye bağlı olmadığı için atanamıyor; katkıcıya
    // açmak "bir bölüm tek kişiye" kuralını delerdi.
    const katkici = buildSectionVisibility(assignments, {
      userId: AYSE,
      isCoordinator: false,
    });
    const koordinator = buildSectionVisibility(assignments, {
      userId: KOORDINATOR,
      isCoordinator: true,
    });

    expect(katkici.canSeeDirect).toBe(false);
    expect(koordinator.canSeeDirect).toBe(true);
    expect(katkici.canSee(null)).toBe(false);
  });
});

describe("assigneeOf", () => {
  it("bölümün sorumlusunu döner", () => {
    expect(assigneeOf(assignments, ENERJI)).toBe(MEHMET);
    expect(assigneeOf(assignments, "bolum-tedarik")).toBeNull();
  });
});

describe("sectionOfQuestion", () => {
  it("doğrudan bölüme bağlı soruyu o bölüme sayar", () => {
    expect(sectionOfQuestion({ subCategoryId: ATIK })).toBe(ATIK);
  });

  it("alt seviyeye bağlı soruyu üstündeki bölüme sayar", () => {
    expect(sectionOfQuestion({ subCategoryId: null, subLevel: { subCategoryId: ENERJI } })).toBe(
      ENERJI
    );
  });

  it("kategoriye doğrudan bağlı soru hiçbir bölüme ait değildir", () => {
    expect(sectionOfQuestion({ subCategoryId: null, subLevel: null })).toBeNull();
  });
});

describe("sectionStatus", () => {
  it("hiç cevap yoksa boş, kısmen doluysa devam eder", () => {
    expect(sectionStatus({ questionCount: 8, answeredCount: 0 })).toBe("EMPTY");
    expect(sectionStatus({ questionCount: 8, answeredCount: 3 })).toBe("IN_PROGRESS");
    expect(sectionStatus({ questionCount: 8, answeredCount: 8 })).toBe("DONE");
  });

  it("sorusu olmayan bölüm bitmiş sayılır", () => {
    // Panoda kırmızı durup koordinatörü boşuna meşgul etmesin.
    expect(sectionStatus({ questionCount: 0, answeredCount: 0 })).toBe("DONE");
  });

  it("beklenenden çok cevap bölümü geri almaz", () => {
    // Bölümden soru çıkarılırsa cevap sayısı soru sayısını aşabilir.
    expect(sectionStatus({ questionCount: 3, answeredCount: 5 })).toBe("DONE");
  });
});

describe("pendingByAssignee", () => {
  const sections = [
    { id: ATIK, name: "Atık", assigneeId: AYSE, questionCount: 10, answeredCount: 10 },
    { id: SOSYAL, name: "Sosyal", assigneeId: AYSE, questionCount: 10, answeredCount: 4 },
    { id: ENERJI, name: "Enerji", assigneeId: MEHMET, questionCount: 4, answeredCount: 0 },
    { id: "bolum-tedarik", name: "Tedarik", assigneeId: null, questionCount: 6, answeredCount: 0 },
  ];

  it("kişi başına yalnızca eksik bölümleri toplar", () => {
    const pending = pendingByAssignee(sections);

    expect(pending).toEqual([
      {
        assigneeId: AYSE,
        sections: [{ name: "Sosyal", questionCount: 10, answeredCount: 4 }],
        missingQuestions: 6,
      },
      {
        assigneeId: MEHMET,
        sections: [{ name: "Enerji", questionCount: 4, answeredCount: 0 }],
        missingQuestions: 4,
      },
    ]);
  });

  it("atanmamış bölüm hatırlatılacak kimseye yazılmaz", () => {
    // Sahibi yok; koordinatörün kendi işi, posta gidecek adres değil.
    expect(pendingByAssignee(sections).some((row) => row.assigneeId === null)).toBe(false);
  });

  it("hepsini bitirmiş kişi listeye girmez", () => {
    const pending = pendingByAssignee([
      { id: ATIK, name: "Atık", assigneeId: AYSE, questionCount: 3, answeredCount: 3 },
    ]);

    expect(pending).toEqual([]);
  });
});

describe("rollupByAssignee", () => {
  const sections = [
    { id: ATIK, assigneeId: AYSE, questionCount: 10, answeredCount: 10 },
    { id: SOSYAL, assigneeId: AYSE, questionCount: 10, answeredCount: 5 },
    { id: ENERJI, assigneeId: MEHMET, questionCount: 4, answeredCount: 0 },
    { id: "bolum-tedarik", assigneeId: null, questionCount: 6, answeredCount: 3 },
  ];

  it("kişi başına yükü ve doluluğu toplar", () => {
    const rows = rollupByAssignee(sections);

    expect(rows.find((row) => row.assigneeId === AYSE)).toEqual({
      assigneeId: AYSE,
      sections: 2,
      questionCount: 20,
      answeredCount: 15,
      doneSections: 1,
      percentage: 75,
    });
    expect(rows.find((row) => row.assigneeId === MEHMET)?.percentage).toBe(0);
  });

  it("atanmamış bölümleri tek satırda toplar", () => {
    // Koordinatörün üzerinde kalan yük de panoda görünmeli.
    const unassigned = rollupByAssignee(sections).find((row) => row.assigneeId === null);

    expect(unassigned).toMatchObject({ sections: 1, questionCount: 6, answeredCount: 3 });
  });

  it("sorusuz bölüm yüzdeyi sıfıra bölmez", () => {
    const rows = rollupByAssignee([
      { id: ATIK, assigneeId: AYSE, questionCount: 0, answeredCount: 0 },
    ]);

    expect(rows[0].percentage).toBe(100);
    expect(rows[0].doneSections).toBe(1);
  });
});
