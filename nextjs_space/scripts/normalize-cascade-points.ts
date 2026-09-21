/**
 * Kademeli önerilerin puanını 0'a çeker (docs/GELISIM-PUANI.md, kural 2).
 *
 * Eski admin ekranı kademeli öneriyi düzenleyip kaydederken `points || 0.5`
 * gönderiyordu; bu kayıtlar motorda zaten sayılmıyor ama ekranda yanlış
 * "tam katkı" gösteriyordu. Sunucu artık kuralı zorluyor; bu betik eski
 * kayıtları hizalar.
 *
 * Kullanım:
 *   npx tsx --require dotenv/config scripts/normalize-cascade-points.ts           # kuru çalışma
 *   npx tsx --require dotenv/config scripts/normalize-cascade-points.ts --apply   # uygula
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  const offenders = await prisma.recommendation.findMany({
    where: { triggerMaxAnswerScore: { not: null }, points: { not: 0 } },
    select: { id: true, title: true, points: true, triggerMaxAnswerScore: true },
    orderBy: { title: "asc" },
  });

  if (offenders.length === 0) {
    console.log("Puanı 0 olmayan kademeli öneri yok; yapılacak bir şey yok.");
    return;
  }

  for (const rec of offenders) {
    console.log(`${apply ? "[uygulanacak]" : "[kuru]"} ${rec.title} — puan ${rec.points} → 0 (eşik ${rec.triggerMaxAnswerScore})`);
  }
  console.log(`\nToplam ${offenders.length} kademeli öneride puan 0'a çekilecek.`);

  if (!apply) {
    console.log("Değişiklik yazılmadı. Uygulamak için --apply ekleyin.");
    return;
  }

  const result = await prisma.recommendation.updateMany({
    where: { id: { in: offenders.map((rec) => rec.id) } },
    data: { points: 0 },
  });
  console.log(`[uygulandı] ${result.count} öneri güncellendi.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
