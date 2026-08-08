import { describe, expect, it } from "vitest";
import {
  type SectionAssignment,
  assigneeOf,
  buildSectionVisibility,
  sectionCountByAssignee,
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

describe("assigneeOf / sectionCountByAssignee", () => {
  it("bölümün sorumlusunu döner", () => {
    expect(assigneeOf(assignments, ENERJI)).toBe(MEHMET);
    expect(assigneeOf(assignments, "bolum-tedarik")).toBeNull();
  });

  it("kişi başına bölüm sayısını çıkarır", () => {
    expect(sectionCountByAssignee(assignments)).toEqual({ [AYSE]: 2, [MEHMET]: 1 });
  });
});
