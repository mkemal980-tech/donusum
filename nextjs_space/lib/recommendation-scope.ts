/**
 * Önerinin ankette nereye düştüğünü çözen tek kaynak.
 *
 * Bir öneri dört ayrı yerden bağlanabiliyor: soru, alt seviye, alt kategori
 * veya doğrudan kategori. Öneri ekranı bu zinciri üç ayrı yerde elle
 * yazıyordu (kategori filtresi, anket filtresi, anket adı sütunu) ve üçü
 * birbirini tutmuyordu — kategori filtresi `rec.question.…` yollarını
 * sayıyor, anket filtresi saymıyordu. Yani soruya bağlı bir öneri kategoriye
 * göre süzülünce görünüyor, ankete göre süzülünce kayboluyordu.
 *
 * Burada zincir bir kez çözülür; filtreleme, sayım ve gezinme ağacı aynı
 * sonucu kullanır.
 *
 * Saf modül — React ve prisma bağımlılığı yoktur, testten doğrudan çağrılır.
 */

export type ScopeQuestion = { id: string; text: string };

export type ScopeSubLevel = {
  id: string;
  name: string;
  questions?: ScopeQuestion[];
};

export type ScopeSubCategory = {
  id: string;
  name: string;
  hasSubLevels?: boolean;
  subLevels?: ScopeSubLevel[];
  questions?: ScopeQuestion[];
};

export type ScopeCategory = {
  id: string;
  name: string;
  surveyId?: string | null;
  subCategories?: ScopeSubCategory[];
};

/** Filtrelemek için önerinin yalnızca bağlantı alanları gerekir. */
export type ScopedRecommendation = {
  id: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
  subLevelId?: string | null;
  questionId?: string | null;
};

/** Önerinin ağaçtaki tam yeri. Bağlı olmadığı seviyeler null kalır. */
export type ResolvedPath = {
  surveyId: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  subLevelId: string | null;
  questionId: string | null;
};

export type ScopeIndex = {
  pathOfQuestion: Map<string, ResolvedPath>;
  pathOfSubLevel: Map<string, ResolvedPath>;
  pathOfSubCategory: Map<string, ResolvedPath>;
  surveyOfCategory: Map<string, string | null>;
};

/** Ağacı bir kez gezip her düğümün yukarı doğru yolunu çıkarır. */
export function buildScopeIndex(categories: ScopeCategory[]): ScopeIndex {
  const index: ScopeIndex = {
    pathOfQuestion: new Map(),
    pathOfSubLevel: new Map(),
    pathOfSubCategory: new Map(),
    surveyOfCategory: new Map(),
  };

  for (const category of categories ?? []) {
    const surveyId = category.surveyId ?? null;
    index.surveyOfCategory.set(category.id, surveyId);

    for (const subCategory of category.subCategories ?? []) {
      const subCategoryPath: ResolvedPath = {
        surveyId,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        subLevelId: null,
        questionId: null,
      };
      index.pathOfSubCategory.set(subCategory.id, subCategoryPath);

      for (const question of subCategory.questions ?? []) {
        index.pathOfQuestion.set(question.id, { ...subCategoryPath, questionId: question.id });
      }

      for (const subLevel of subCategory.subLevels ?? []) {
        const subLevelPath: ResolvedPath = { ...subCategoryPath, subLevelId: subLevel.id };
        index.pathOfSubLevel.set(subLevel.id, subLevelPath);

        for (const question of subLevel.questions ?? []) {
          index.pathOfQuestion.set(question.id, { ...subLevelPath, questionId: question.id });
        }
      }
    }
  }

  return index;
}

/**
 * Önerinin yolunu en derin bağlantıdan başlayarak çözer.
 *
 * Arşivlenmiş ya da silinmiş bir düğüme bağlı öneri dizinde bulunamaz; o
 * durumda bir üst seviyeye düşülür. Önceden böyle bir öneri "hiçbir yere ait
 * değil" sayılıp bütün filtrelerden düşüyordu.
 */
export function resolveRecommendationPath(
  recommendation: ScopedRecommendation,
  index: ScopeIndex
): ResolvedPath {
  const questionId = recommendation.questionId ?? null;

  if (questionId) {
    const path = index.pathOfQuestion.get(questionId);
    if (path) return path;
  }

  if (recommendation.subLevelId) {
    const path = index.pathOfSubLevel.get(recommendation.subLevelId);
    if (path) return { ...path, questionId };
  }

  if (recommendation.subCategoryId) {
    const path = index.pathOfSubCategory.get(recommendation.subCategoryId);
    if (path) return { ...path, questionId };
  }

  if (recommendation.categoryId) {
    return {
      surveyId: index.surveyOfCategory.get(recommendation.categoryId) ?? null,
      categoryId: recommendation.categoryId,
      subCategoryId: null,
      subLevelId: null,
      questionId,
    };
  }

  return { surveyId: null, categoryId: null, subCategoryId: null, subLevelId: null, questionId };
}

/** Öneri listesinin yollarını bir kez çözer; sayım ve filtre aynı haritayı kullanır. */
export function resolvePaths(
  recommendations: ScopedRecommendation[],
  index: ScopeIndex
): Map<string, ResolvedPath> {
  const paths = new Map<string, ResolvedPath>();
  for (const recommendation of recommendations ?? []) {
    paths.set(recommendation.id, resolveRecommendationPath(recommendation, index));
  }
  return paths;
}

/**
 * Gezinme ağacında seçili olan yer.
 *
 * `…Direct` biçimleri "tam bu seviyeye bağlı, daha aşağısına değil" demek.
 * Bölüme tıklamak altındaki soruların önerilerini de getirdiği için,
 * yalnızca bölümün kendisine bağlı olanlar ayrı bir hedef olmalı — yoksa
 * onları hiçbir tıklamayla yalnız başına göremezsiniz.
 */
export type Scope =
  | { kind: "all" }
  | { kind: "category"; id: string }
  | { kind: "subCategory"; id: string }
  | { kind: "subCategoryDirect"; id: string }
  | { kind: "subLevel"; id: string }
  | { kind: "subLevelDirect"; id: string }
  | { kind: "question"; id: string }
  | { kind: "unplaced" };

export function matchesScope(path: ResolvedPath, scope: Scope): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "category":
      return path.categoryId === scope.id;
    case "subCategory":
      return path.subCategoryId === scope.id;
    case "subCategoryDirect":
      /* Alt seviyeye inmiş öneri bölümün "doğrudan" sayımına girmez; yoksa
         aynı öneri hem seviyede hem burada görünür ve sayılar toplamı aşar. */
      return path.subCategoryId === scope.id && path.subLevelId === null && path.questionId === null;
    case "subLevel":
      return path.subLevelId === scope.id;
    case "subLevelDirect":
      return path.subLevelId === scope.id && path.questionId === null;
    case "question":
      return path.questionId === scope.id;
    case "unplaced":
      return path.categoryId === null;
  }
}

export function scopeKey(scope: Scope): string {
  return "id" in scope ? `${scope.kind}:${scope.id}` : scope.kind;
}

export function scopesEqual(a: Scope, b: Scope): boolean {
  return scopeKey(a) === scopeKey(b);
}

/* ── Gezinme ağacı ──────────────────────────────────────────────────────── */

export type ScopeNode = {
  key: string;
  label: string;
  scope: Scope;
  /** Bu kapsama düşen öneri sayısı. */
  count: number;
  children: ScopeNode[];
};

function countIn(paths: Map<string, ResolvedPath>, scope: Scope): number {
  let total = 0;
  for (const path of paths.values()) if (matchesScope(path, scope)) total++;
  return total;
}

/**
 * Anket ağacını öneri sayılarıyla birlikte gezilebilir bir ağaca çevirir.
 *
 * Sorusu olan her düğüm, önerisi olmasa bile listelenir: "bu soruya hiç
 * öneri bağlanmamış" yöneticinin en çok ihtiyaç duyduğu bilgilerden biri ve
 * boş düğümleri elemek onu görünmez yapardı.
 */
export function buildScopeTree(
  categories: ScopeCategory[],
  paths: Map<string, ResolvedPath>,
  surveyId?: string | null
): ScopeNode[] {
  const nodes: ScopeNode[] = [];

  for (const category of categories ?? []) {
    if (surveyId && (category.surveyId ?? null) !== surveyId) continue;

    const children: ScopeNode[] = [];

    for (const subCategory of category.subCategories ?? []) {
      const grandChildren: ScopeNode[] = [];

      const useSubLevels = (subCategory.hasSubLevels ?? true) && (subCategory.subLevels?.length ?? 0) > 0;

      if (useSubLevels) {
        for (const subLevel of subCategory.subLevels ?? []) {
          const levelChildren: ScopeNode[] = (subLevel.questions ?? []).map((question) => ({
            key: `question:${question.id}`,
            label: question.text,
            scope: { kind: "question", id: question.id },
            count: countIn(paths, { kind: "question", id: question.id }),
            children: [],
          }));

          const levelDirect = countIn(paths, { kind: "subLevelDirect", id: subLevel.id });
          if (levelDirect > 0) {
            levelChildren.push({
              key: `subLevelDirect:${subLevel.id}`,
              label: "Soruya bağlı olmayanlar",
              scope: { kind: "subLevelDirect", id: subLevel.id },
              count: levelDirect,
              children: [],
            });
          }

          grandChildren.push({
            key: `subLevel:${subLevel.id}`,
            label: subLevel.name,
            scope: { kind: "subLevel", id: subLevel.id },
            count: countIn(paths, { kind: "subLevel", id: subLevel.id }),
            children: levelChildren,
          });
        }
      } else {
        for (const question of subCategory.questions ?? []) {
          grandChildren.push({
            key: `question:${question.id}`,
            label: question.text,
            scope: { kind: "question", id: question.id },
            count: countIn(paths, { kind: "question", id: question.id }),
            children: [],
          });
        }
      }

      /* Bölüme bağlı ama soruya bağlanmamış öneriler: bölüme tıklamak
         alttakileri de getirdiği için ayrı bir hedef gerekiyor. Hiç yoksa
         satır çizilmez. */
      const directCount = countIn(paths, { kind: "subCategoryDirect", id: subCategory.id });
      if (directCount > 0) {
        grandChildren.push({
          key: `subCategoryDirect:${subCategory.id}`,
          label: "Soruya bağlı olmayanlar",
          scope: { kind: "subCategoryDirect", id: subCategory.id },
          count: directCount,
          children: [],
        });
      }

      children.push({
        key: `subCategory:${subCategory.id}`,
        label: subCategory.name,
        scope: { kind: "subCategory", id: subCategory.id },
        count: countIn(paths, { kind: "subCategory", id: subCategory.id }),
        children: grandChildren,
      });
    }

    nodes.push({
      key: `category:${category.id}`,
      label: category.name,
      scope: { kind: "category", id: category.id },
      count: countIn(paths, { kind: "category", id: category.id }),
      children,
    });
  }

  return nodes;
}

/** Seçili kapsamın okunur adı — tablonun üstünde ne süzüldüğünü söylemek için. */
export function describeScope(scope: Scope, nodes: ScopeNode[]): string | null {
  if (scope.kind === "all") return null;
  if (scope.kind === "unplaced") return "Ankete bağlanmamış öneriler";

  const key = scopeKey(scope);
  const trail: string[] = [];

  const walk = (list: ScopeNode[], ancestors: string[]): boolean => {
    for (const node of list) {
      const next = [...ancestors, node.label];
      if (node.key === key) {
        trail.push(...next);
        return true;
      }
      if (walk(node.children, next)) return true;
    }
    return false;
  };

  walk(nodes, []);
  return trail.length > 0 ? trail.join(" › ") : null;
}
