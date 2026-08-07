/**
 * Geçmiş `ScoreHistory` kayıtlarını yeni eksen ölçeğine taşır.
 *
 * NEDEN
 * -----
 * Eksen puanları eskiden cevapların ham ağırlıklı ortalamasıydı (0-5 aralığı,
 * "cevap yok" ile "en kötü cevap" ikisi de 0'a yakın). Artık kategori
 * puanlarıyla aynı 1-5 ölçeği kullanılıyor: başarı oranı → oran × 4 + 1.
 * Dönüşüm yapılmazsa trend grafiğinde, yöntem değişikliğinin olduğu anda
 * gerçek olmayan bir basamak görünür.
 *
 * NE YAPMAZ — DİKKAT
 * ------------------
 * Bu betik geçmişi *yeniden hesaplamaz*, çünkü hesaplayamaz: bir kaydın
 * alındığı andaki cevaplar ve tamamlanmış öneriler hiçbir yerde saklanmıyor.
 * Yalnızca kaydedilmiş değerleri eski ölçekten yeni ölçeğe çevirir. Bunun iki
 * bilinen sınırı var:
 *
 *   1. Tavanı 5'in altında olan sorular (ör. en iyi şıkkı 3 puan veren) eski
 *      kayıtlarda zaten düşük yazılmıştı; dönüşüm bunu geri getiremez. O
 *      kayıtlar olduğundan bir miktar düşük kalmaya devam eder.
 *   2. Öneri tamamlama kayıtlarında bonus puan zaten değerin içindeydi;
 *      dönüşüm bonusu da 0.8 katsayısıyla sıkıştırır. Bonuslar küçük olduğu
 *      için sapma sınırlıdır ama sıfır değildir.
 *
 * Trendin *şekli* korunur (dönüşüm artan bir fonksiyondur), mutlak değerler
 * yaklaşıktır. Betikten sonra alınan her yeni kayıt zaten tam doğrudur.
 *
 * KULLANIM
 * --------
 * Önce ne değişeceğini görmek için (hiçbir şey yazmaz):
 *   npx tsx --require dotenv/config scripts/rescale-score-history.ts
 *
 * Uygulamak için (önce backups/ altına yedek yazar):
 *   npx tsx --require dotenv/config scripts/rescale-score-history.ts --apply
 *
 * Yalnızca belirli bir andan önceki kayıtlar (yeni sürümü dağıttıktan sonra
 * çalıştırıyorsanız, dağıtım anını verin — sonrasındakiler zaten yeni ölçekte):
 *   ... scripts/rescale-score-history.ts --before=2026-08-07T12:00:00Z --apply
 *
 * Bir kez çalıştırılmalıdır. İkinci kez çalıştırılırsa değerler tekrar
 * sıkıştırılır; bu durumda backups/ altındaki yedekten geri dönün.
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { classifyQuadrant, rawAverageToScaledScore } from "../lib/scoring";

const prisma = new PrismaClient();

function parseBefore(argv: string[]): Date {
  const flag = argv.find(arg => arg.startsWith("--before="));
  if (!flag) return new Date();

  const raw = flag.slice("--before=".length);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`--before değeri geçerli bir tarih değil: ${raw}`);
  }
  return parsed;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const before = parseBefore(process.argv);

  console.log(`\n📊 ScoreHistory ölçek dönüşümü ${apply ? "(UYGULANACAK)" : "(ÖN İZLEME)"}`);
  console.log(`   Kapsam: ${before.toISOString()} tarihinden önceki kayıtlar\n`);

  const rows = await prisma.scoreHistory.findMany({
    where: { recordedAt: { lt: before } },
    orderBy: { recordedAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("Dönüştürülecek kayıt yok.\n");
    return;
  }

  const updates = rows.map(row => {
    const overallScore = rawAverageToScaledScore(row.overallScore);
    const velocityScore = row.velocityScore === null ? null : rawAverageToScaledScore(row.velocityScore);
    const enduranceScore = row.enduranceScore === null ? null : rawAverageToScaledScore(row.enduranceScore);

    // Yüzde ve kadran, yeni puanlardan yeniden türetilir.
    const overallPercentage = Math.round(
      Math.min(100, Math.max(0, ((overallScore - 1) / 4) * 100))
    );
    const quadrant = classifyQuadrant(velocityScore ?? 0, enduranceScore ?? 0);

    return { row, overallScore, overallPercentage, velocityScore, enduranceScore, quadrant };
  });

  const quadrantChanges = updates.filter(u => u.quadrant !== u.row.quadrant).length;

  console.log(`Kayıt sayısı: ${rows.length}`);
  console.log(`Kadranı değişen kayıt: ${quadrantChanges}\n`);

  console.log("Örnek (ilk 10):");
  console.log("  tarih                 genel        hız          dayanıklılık  kadran");
  for (const u of updates.slice(0, 10)) {
    const date = u.row.recordedAt.toISOString().slice(0, 16).replace("T", " ");
    const pair = (from: number | null, to: number | null) =>
      `${(from ?? 0).toFixed(1)}→${(to ?? 0).toFixed(1)}`.padEnd(12);
    const quadrant =
      u.quadrant === u.row.quadrant ? u.quadrant : `${u.row.quadrant} → ${u.quadrant}`;
    console.log(
      `  ${date}   ${pair(u.row.overallScore, u.overallScore)} ` +
        `${pair(u.row.velocityScore, u.velocityScore)} ` +
        `${pair(u.row.enduranceScore, u.enduranceScore)} ${quadrant}`
    );
  }
  if (updates.length > 10) console.log(`  ... ve ${updates.length - 10} kayıt daha`);

  if (!apply) {
    console.log("\nÖn izleme bitti. Uygulamak için --apply ekleyin.\n");
    return;
  }

  // Geri dönebilmek için önce yedek al.
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `score-history-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`\n💾 Yedek yazıldı: ${backupPath}`);

  await prisma.$transaction(
    updates.map(u =>
      prisma.scoreHistory.update({
        where: { id: u.row.id },
        data: {
          overallScore: u.overallScore,
          overallPercentage: u.overallPercentage,
          velocityScore: u.velocityScore,
          enduranceScore: u.enduranceScore,
          quadrant: u.quadrant,
        },
      })
    )
  );

  console.log(`✅ ${updates.length} kayıt güncellendi.\n`);
}

main()
  .catch(error => {
    console.error("\n❌ Hata:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
