/**
 * Saklanan cevap puanlarını güncel soru tanımına göre yeniden hesaplar.
 *
 * Kullanım:
 *   npx tsx --require dotenv/config scripts/rescore-responses.ts              # tüm anketler, kuru çalışma
 *   npx tsx --require dotenv/config scripts/rescore-responses.ts --apply      # tüm anketler, uygula
 *   npx tsx --require dotenv/config scripts/rescore-responses.ts --survey=ID --apply
 */
import { PrismaClient } from "@prisma/client";
import { scoreResponse } from "../lib/scoring";
import { rescoreSurvey } from "../lib/rescore";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const surveyArg = process.argv.find((a) => a.startsWith("--survey="))?.split("=")[1];

  const surveys = surveyArg
    ? await prisma.survey.findMany({ where: { id: surveyArg }, select: { id: true, name: true } })
    : await prisma.survey.findMany({ select: { id: true, name: true } });

  if (surveys.length === 0) {
    console.log("Anket bulunamadı.");
    return;
  }

  for (const survey of surveys) {
    if (!apply) {
      // Kuru çalışma: neyin değişeceğini sayar, yazmaz.
      const responses = await prisma.surveyResponse.findMany({
        where: {
          question: {
            OR: [
              { category: { surveyId: survey.id } },
              { subCategory: { category: { surveyId: survey.id } } },
              { subLevel: { subCategory: { category: { surveyId: survey.id } } } },
            ],
          },
        },
        select: {
          score: true,
          value: true,
          question: { select: { type: true, options: true, conditionalOptions: true } },
        },
      });

      let wouldChange = 0;
      let invalid = 0;
      for (const response of responses) {
        const scored = scoreResponse(response.question, response.value);
        if (!scored.ok) invalid += 1;
        const next = scored.ok ? scored.score : 0;
        if (Math.abs(next - response.score) > 1e-9) wouldChange += 1;
      }
      console.log(
        `[kuru] ${survey.name}: ${responses.length} cevap, ${wouldChange} puan değişecek, ${invalid} geçersiz değer`
      );
      continue;
    }

    const result = await rescoreSurvey(survey.id, prisma);
    console.log(
      `[uygulandı] ${survey.name}: ${result.examined} cevap, ${result.updated} güncellendi, ${result.invalid} geçersiz`
    );
  }

  if (!apply) console.log("\nDeğişiklik yazılmadı. Uygulamak için --apply ekleyin.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
