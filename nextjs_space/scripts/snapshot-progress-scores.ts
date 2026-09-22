/**
 * Her değerlendirme için bugünkü gelişim puanını skor geçmişine yazar.
 *
 * Yol haritası sayfasından yapılan tamamlamalar eskiden skor geçmişine
 * düşmüyordu; trend grafiği bu yüzden gerçek puanın gerisinde kalıyor.
 * Bu betik her değerlendirmeye tek bir "RECALC" noktası ekler; sonrası
 * artık her durum değişikliğinde kendiliğinden yazılıyor.
 *
 * Puan, değerlendirmenin bir üyesi adına hesaplanır (kuruluş
 * değerlendirmesinde birimin aktif bir kullanıcısı, kişisel değerlendirmede
 * sahibi). Üyesi kalmamış değerlendirme atlanır ve raporlanır.
 *
 * Varsayılan olarak yalnızca tamamlanmış önerisi olan değerlendirmelere
 * yazar; ötekilerde nokta mevcut puana eşit olur ve trende gürültü ekler.
 * `--all` hepsine yazar.
 *
 * Yerelden çalıştırırken `railway run` iç adresi çevirmez; Postgres
 * servisinin DATABASE_PUBLIC_URL değerini DATABASE_URL olarak verin.
 *
 * Kullanım:
 *   npx tsx --require dotenv/config scripts/snapshot-progress-scores.ts            # kuru çalışma
 *   npx tsx --require dotenv/config scripts/snapshot-progress-scores.ts --apply    # uygula
 *   npx tsx --require dotenv/config scripts/snapshot-progress-scores.ts --survey=ID --apply
 *   npx tsx --require dotenv/config scripts/snapshot-progress-scores.ts --all --apply
 */
import { PrismaClient } from "@prisma/client";
import { calculateProgressScores } from "../lib/scoring";

const prisma = new PrismaClient();
const TRIGGER = "RECALC";

async function memberFor(assessment: { ownerUserId: string | null; unitId: string | null }) {
  if (assessment.ownerUserId) {
    return prisma.user.findUnique({ where: { id: assessment.ownerUserId }, select: { id: true, email: true } });
  }
  if (assessment.unitId) {
    return prisma.user.findFirst({
      where: { unitId: assessment.unitId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const all = process.argv.includes("--all");
  const surveyArg = process.argv.find((a) => a.startsWith("--survey="))?.split("=")[1];

  const assessments = await prisma.assessment.findMany({
    where: surveyArg ? { surveyId: surveyArg } : {},
    select: {
      id: true,
      surveyId: true,
      unitId: true,
      ownerUserId: true,
      survey: { select: { name: true } },
      _count: { select: { responses: true, roadmapItems: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let written = 0;
  let skipped = 0;

  for (const assessment of assessments) {
    if (assessment._count.responses === 0) {
      skipped++;
      continue; // Cevabı olmayan değerlendirmenin puanı yok.
    }

    const member = await memberFor(assessment);
    if (!member) {
      console.log(`[atlandı] ${assessment.survey.name} / ${assessment.id}: üyesi kalmamış`);
      skipped++;
      continue;
    }

    const scores = await calculateProgressScores(member.id, { surveyId: assessment.surveyId });
    if (!all && scores.completedRecommendations === 0) {
      console.log(`[atlandı] ${assessment.survey.name} / ${assessment.id}: tamamlanmış öneri yok`);
      skipped++;
      continue;
    }
    const line =
      `${assessment.survey.name} / ${assessment.id}: puan ${scores.overallScore} ` +
      `(taban ${scores.baselineOverallScore}, katkı +${scores.delta}), ` +
      `${scores.completedRecommendations} tamamlanmış öneri`;

    if (!apply) {
      console.log(`[kuru] ${line}`);
      continue;
    }

    await prisma.scoreHistory.create({
      data: {
        assessmentId: assessment.id,
        surveyId: assessment.surveyId,
        overallScore: scores.overallScore,
        overallPercentage: scores.overallPercentage,
        velocityScore: scores.velocityScore,
        enduranceScore: scores.enduranceScore,
        quadrant: scores.quadrant,
        completedQuestions: scores.completedQuestions,
        totalQuestions: scores.totalQuestions,
        completedRecommendations: scores.completedRecommendations,
        triggerType: TRIGGER,
      },
    });
    written++;
    console.log(`[yazıldı] ${line}`);
  }

  console.log(`\n${assessments.length} değerlendirme, ${written} kayıt yazıldı, ${skipped} atlandı.`);
  if (!apply) console.log("Değişiklik yazılmadı. Uygulamak için --apply ekleyin.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
