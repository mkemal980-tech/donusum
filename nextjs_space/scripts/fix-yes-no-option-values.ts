/**
 * Excel'den içe aktarılmış Evet/Hayır sorularının şık değerlerini düzeltir.
 *
 * Sorun: içe aktarım şık değerlerini "evet"/"hayir" olarak kaydediyordu, ama
 * anket ekranı cevabı her zaman "yes"/"no" olarak kaydeder. Değerler
 * eşleşmediği için puanlama seçeneği bulamıyor ve şablondaki evet_puani /
 * hayir_puani yok sayılıp herkese 5/1 veriliyordu.
 *
 * Bu betik yalnızca YES_NO sorularının options alanındaki value'ları
 * düzeltir; etiketleri ve puanları olduğu gibi bırakır. Kullanıcı cevapları
 * zaten "yes"/"no" olduğu için cevap tarafında değişiklik gerekmez.
 *
 * Önce ne değişeceğini görmek için:
 *   npx tsx --require dotenv/config scripts/fix-yes-no-option-values.ts
 * Değişikliği uygulamak için:
 *   npx tsx --require dotenv/config scripts/fix-yes-no-option-values.ts --apply
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALUE_MAP: Record<string, string> = {
  evet: "yes",
  hayir: "no",
  hayır: "no",
};

type Option = { value?: unknown; label?: unknown; score?: unknown };

async function main() {
  const apply = process.argv.includes("--apply");

  const questions = await prisma.question.findMany({
    where: { type: "YES_NO", archivedAt: null },
    select: { id: true, text: true, options: true },
  });

  let changed = 0;

  for (const question of questions) {
    const options = Array.isArray(question.options) ? (question.options as Option[]) : [];
    if (options.length === 0) continue;

    let needsFix = false;
    const fixed = options.map((option) => {
      const current = String(option?.value ?? "").toLowerCase().trim();
      const mapped = VALUE_MAP[current];
      if (mapped && mapped !== String(option?.value ?? "")) {
        needsFix = true;
        return { ...option, value: mapped };
      }
      return option;
    });

    if (!needsFix) continue;

    changed++;
    const before = options.map((o) => `${o.value}=${o.score}`).join(", ");
    const after = fixed.map((o) => `${o.value}=${o.score}`).join(", ");
    console.log(`${apply ? "DÜZELTİLDİ" : "DÜZELTİLECEK"}: ${question.text.slice(0, 70)}`);
    console.log(`   ${before}  →  ${after}`);

    if (apply) {
      await prisma.question.update({
        where: { id: question.id },
        data: { options: fixed as unknown as Prisma.InputJsonValue },
      });
    }
  }

  console.log(`\n${questions.length} Evet/Hayır sorusu incelendi, ${changed} tanesi ${apply ? "düzeltildi" : "düzeltilmeyi bekliyor"}.`);
  if (!apply && changed > 0) {
    console.log("Uygulamak için: npx tsx --require dotenv/config scripts/fix-yes-no-option-values.ts --apply");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
