import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { scoreResponse } from "./scoring";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Saklanan cevap puanlarını güncel soru tanımına göre yeniden hesaplar.
 *
 * `SurveyResponse.score` türetilmiş bir değer ama yazma anında dondurulup
 * saklanıyor. Sorunun tipi ya da şık puanları sonradan değişince eski cevaplar
 * eski tanımın puanıyla kalıyordu ve bunu düzeltecek hiçbir mekanizma yoktu:
 * `grep -r "recalculat\|rescore"` sıfır sonuç veriyordu.
 *
 * Bu soyut bir risk değildi; ekip bir kez zarar görmüş. scripts/
 * fix-yes-no-option-values.ts başındaki not tam bu sınıfı anlatıyor:
 * "Değerler eşleşmediği için puanlama seçeneği bulamıyor ve şablondaki
 * evet_puani / hayir_puani yok sayılıp herkese 5/1 veriliyordu."
 *
 * İdempotenttir: aynı tanımla ikinci kez çalıştırmak hiçbir şeyi değiştirmez.
 * Değeri yeni tanıma göre geçersiz olan cevaplar **silinmez**; puanları 0'a
 * çekilir ve sayıma girer, çünkü sessizce yok etmek denetim izini bozar.
 */
export type RescoreResult = {
  examined: number;
  updated: number;
  invalid: number;
};

export async function rescoreQuestionResponses(
  questionId: string,
  db: DbClient = prisma
): Promise<number> {
  const result = await rescoreQuestions([questionId], db);
  return result.updated;
}

export async function rescoreQuestions(
  questionIds: string[],
  db: DbClient = prisma
): Promise<RescoreResult> {
  if (questionIds.length === 0) return { examined: 0, updated: 0, invalid: 0 };

  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, type: true, options: true, conditionalOptions: true },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));

  const responses = await db.surveyResponse.findMany({
    where: { questionId: { in: questionIds } },
    select: { id: true, questionId: true, value: true, score: true },
  });

  let updated = 0;
  let invalid = 0;

  for (const response of responses) {
    const question = byId.get(response.questionId);
    if (!question) continue;

    const scored = scoreResponse(question, response.value);
    const nextScore = scored.ok ? scored.score : 0;
    if (!scored.ok) invalid += 1;

    if (Math.abs(nextScore - response.score) > 1e-9) {
      await db.surveyResponse.update({
        where: { id: response.id },
        data: { score: nextScore },
      });
      updated += 1;
    }
  }

  return { examined: responses.length, updated, invalid };
}

/** Bir anketin bütün cevaplarını yeniden puanlar. */
export async function rescoreSurvey(
  surveyId: string,
  db: DbClient = prisma
): Promise<RescoreResult> {
  const questions = await db.question.findMany({
    where: {
      OR: [
        { category: { surveyId } },
        { subCategory: { category: { surveyId } } },
        { subLevel: { subCategory: { category: { surveyId } } } },
      ],
    },
    select: { id: true },
  });
  return rescoreQuestions(questions.map((question) => question.id), db);
}
