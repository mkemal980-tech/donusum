/**
 * "Dijital Olgunluk Değerlendirmesi (Demo)" anketini kurar.
 *
 * Bu anket kalıcıdır ve sistemi kullanacaklara referans olması için vardır.
 * İçerik `demo-survey-data.ts` içinde durur; bu betik yalnızca onu
 * veritabanına yazar. Böylece içerik git'te versiyonlanır ve anket her
 * ortamda birebir aynı şekilde kurulabilir.
 *
 * GÜVENLİK
 * Demo anketi zaten varsa betik hiçbir şey yapmaz. Yeniden kurmak için
 * `--reset` gerekir ve bu, ankete verilmiş TÜM cevapları da siler (Prisma
 * ilişkileri cascade). Bu yüzden --reset açıkça istenmeden asla çalışmaz.
 *
 * KULLANIM
 *   npm run seed:demo                 # yoksa kurar, varsa dokunmaz
 *   npm run seed:demo -- --reset      # siler ve baştan kurar (cevaplar gider)
 *   npm run seed:demo -- --dry-run    # ne kurulacağını yazar, yazmaz
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import {
  DEMO_CATEGORIES,
  DEMO_QUESTION_COUNT,
  DEMO_SURVEY_DESCRIPTION,
  DEMO_SURVEY_NAME,
  STEP_DEFAULTS,
  type DemoLevel,
  type DemoQuestion,
} from "./demo-survey-data";
import { derivePosition } from "../lib/recommendation-position";

const prisma = new PrismaClient();

/** Etiketten teknik şık değeri üretir: "Takip yok" → "takip_yok" */
const TR_TO_ASCII: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

function slugify(label: string): string {
  return label
    .trim()
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TR_TO_ASCII[char] ?? char)
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Soru tipine göre `options` alanını üretir. */
function buildOptions(question: DemoQuestion): { value: string; label: string; score: number }[] {
  if (question.type === "MULTIPLE_CHOICE") {
    return (question.levels ?? []).map((level) => ({
      value: slugify(level.label),
      label: level.label,
      score: level.score,
    }));
  }

  if (question.type === "YES_NO") {
    // Anket ekranı cevabı her zaman "yes"/"no" olarak kaydeder; değerler
    // bunlarla eşleşmezse puanlama şıkkı bulamaz.
    const no = (question.levels ?? []).find((level) => level.score === 0);
    const yes = (question.levels ?? []).find((level) => level.score > 0);
    return [
      { value: "yes", label: yes?.label ?? "Evet", score: yes?.score ?? 5 },
      { value: "no", label: no?.label ?? "Hayır", score: no?.score ?? 0 },
    ];
  }

  // SCALE: ekran 1-5 arası sayıyı kaydeder, şık listesi gerekmez.
  // CONDITIONAL_CHOICE: puan conditionalOptions'tan gelir.
  return [];
}

type Plan = {
  categories: number;
  subCategories: number;
  questions: number;
  recommendations: number;
};

function planOf(): Plan {
  let subCategories = 0;
  let questions = 0;
  let recommendations = 0;

  for (const category of DEMO_CATEGORIES) {
    subCategories += category.subCategories.length;
    for (const subCategory of category.subCategories) {
      for (const question of subCategory.questions) {
        questions++;
        recommendations += question.levels?.length ?? 0;
        recommendations += question.conditional?.rangeRecommendations.length ?? 0;
      }
    }
  }

  return { categories: DEMO_CATEGORIES.length, subCategories, questions, recommendations };
}

async function seed(dryRun: boolean) {
  const plan = planOf();

  console.log(`\n📋 ${DEMO_SURVEY_NAME}`);
  console.log(`   ${plan.categories} kategori · ${plan.subCategories} alt kategori · ` +
    `${plan.questions} soru · ${plan.recommendations} öneri\n`);

  if (plan.questions !== DEMO_QUESTION_COUNT) {
    throw new Error(`Soru sayısı tutarsız: ${plan.questions} ≠ ${DEMO_QUESTION_COUNT}`);
  }

  if (dryRun) {
    for (const category of DEMO_CATEGORIES) {
      console.log(`  ${category.name}`);
      for (const subCategory of category.subCategories) {
        console.log(`    ${subCategory.name}`);
        for (const question of subCategory.questions) {
          const steps = question.levels?.length ?? question.conditional?.rangeRecommendations.length ?? 0;
          console.log(`      [${question.type}] ${question.text}  (${steps} öneri)`);
        }
      }
    }
    console.log("\nÖn izleme bitti. Kurmak için --dry-run olmadan çalıştırın.\n");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const survey = await tx.survey.create({
      data: {
        name: DEMO_SURVEY_NAME,
        description: DEMO_SURVEY_DESCRIPTION,
        isActive: true,
        order: 0,
      },
    });

    let categoryOrder = 0;
    for (const categoryData of DEMO_CATEGORIES) {
      const category = await tx.category.create({
        data: {
          name: categoryData.name,
          description: categoryData.description,
          order: categoryOrder++,
          surveyId: survey.id,
        },
      });

      let subCategoryOrder = 0;
      for (const subCategoryData of categoryData.subCategories) {
        const subCategory = await tx.subCategory.create({
          data: {
            name: subCategoryData.name,
            description: subCategoryData.description,
            order: subCategoryOrder++,
            categoryId: category.id,
            // Sorular doğrudan alt kategoriye bağlanır; demo yapısı sade tutuldu.
            hasSubLevels: false,
          },
        });

        let questionOrder = 0;
        for (const questionData of subCategoryData.questions) {
          const options = buildOptions(questionData);

          const question = await tx.question.create({
            data: {
              text: questionData.text,
              type: questionData.type,
              weight: questionData.weight,
              axisType: questionData.axisType,
              order: questionOrder++,
              requiresEvidence: false,
              subCategoryId: subCategory.id,
              ...(options.length > 0 ? { options: options as unknown as Prisma.InputJsonValue } : {}),
              ...(questionData.conditional
                ? {
                    conditionalOptions: {
                      thresholdQuestion: questionData.conditional.thresholdQuestion,
                      yesLabel: questionData.conditional.yesLabel,
                      noLabel: questionData.conditional.noLabel,
                      options: questionData.conditional.options.map((option, index) => ({
                        value: String(index),
                        label: option.label,
                        score: option.score,
                      })),
                    } as unknown as Prisma.InputJsonValue,
                  }
                : {}),
            },
          });

          // Kademeli öneriler — her basamak bir üst basamağa çıkarır.
          const levels = questionData.levels ?? [];
          for (const [index, level] of levels.entries()) {
            const defaults = STEP_DEFAULTS[Math.min(index, STEP_DEFAULTS.length - 1)];
            const settings = { ...defaults, ...level.overrides };
            const position = derivePosition({
              strategicType: settings.strategicType,
              timeframe: settings.timeframe,
              estimatedImpact: settings.estimatedImpact,
            });

            await tx.recommendation.create({
              data: {
                title: level.action,
                description: level.detail,
                categoryId: category.id,
                subCategoryId: subCategory.id,
                questionId: question.id,
                // Kademeli tetikleme: bu şık ve altındaki tüm şıklarda gösterilir.
                triggerMaxAnswerScore: level.score,
                triggerOptions: null,
                // Kademelide puan basamaktan türetilir, elle girilmez.
                points: 0,
                costType: settings.costType,
                timeframe: settings.timeframe,
                strategicType: settings.strategicType,
                estimatedImpact: settings.estimatedImpact,
                minScoreThreshold: 0,
                maxScoreThreshold: 100,
                order: index + 1,
                ...position,
              },
            });
          }

          // Puan aralığına bağlı öneriler (kademeli puanlama sorusu).
          for (const [index, rec] of (questionData.conditional?.rangeRecommendations ?? []).entries()) {
            const position = derivePosition({
              strategicType: rec.strategicType,
              timeframe: rec.timeframe,
              estimatedImpact: rec.estimatedImpact,
            });

            await tx.recommendation.create({
              data: {
                title: rec.title,
                description: rec.description,
                categoryId: category.id,
                subCategoryId: subCategory.id,
                questionId: question.id,
                triggerMaxAnswerScore: null,
                triggerOptions: null,
                points: rec.points,
                costType: rec.costType,
                timeframe: rec.timeframe,
                strategicType: rec.strategicType,
                estimatedImpact: rec.estimatedImpact,
                minScoreThreshold: rec.minScoreThreshold,
                maxScoreThreshold: rec.maxScoreThreshold,
                order: index + 1,
                ...position,
              },
            });
          }
        }
      }
    }

    console.log(`✅ Anket kuruldu (id: ${survey.id})`);
  }, { timeout: 120_000 });
}

async function reset() {
  const existing = await prisma.survey.findFirst({ where: { name: DEMO_SURVEY_NAME } });
  if (!existing) return;

  // Kaç cevap silineceğini önce göster — sessizce veri kaybı olmasın.
  const responseCount = await prisma.surveyResponse.count({
    where: {
      question: {
        OR: [
          { category: { surveyId: existing.id } },
          { subCategory: { category: { surveyId: existing.id } } },
          { subLevel: { subCategory: { category: { surveyId: existing.id } } } },
        ],
      },
    },
  });

  if (responseCount > 0) {
    console.log(`⚠  Bu ankete verilmiş ${responseCount} cevap da silinecek.`);
  }

  await prisma.survey.delete({ where: { id: existing.id } });
  console.log("🗑  Eski demo anketi silindi.");
}

async function main() {
  const argv = process.argv.slice(2);
  const doReset = argv.includes("--reset");
  const dryRun = argv.includes("--dry-run");

  const existing = await prisma.survey.findFirst({
    where: { name: DEMO_SURVEY_NAME },
    select: { id: true },
  });

  if (existing && !doReset && !dryRun) {
    console.log(
      `\nℹ  Demo anketi zaten kurulu (id: ${existing.id}).\n` +
        "   Baştan kurmak için --reset ekleyin — bu, ankete verilmiş cevapları da siler.\n"
    );
    return;
  }

  if (doReset && !dryRun) {
    await reset();
  }

  await seed(dryRun);
}

main()
  .catch((error) => {
    console.error("\n❌ Hata:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
