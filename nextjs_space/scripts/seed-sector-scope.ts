/**
 * Sektör × bölüm kapsam matrisinin başlangıç değerleri.
 *
 * NEDEN
 * Matris kurulu ama boştu: hiç kural girilmediği için her bölüm her sektörde
 * aynı ağırlıkta sayılıyordu. Bu, aracın en ayırt edici özelliğini kapalı
 * tutmak demek — siber güvenlik bir bankada da bir kuaförde de aynı ağırlıkta
 * puanlanıyordu.
 *
 * NE YAPILDI
 * Yalnızca **ağırlık** verildi, hiçbir bölüm kapsam dışı bırakılmadı. Dijital
 * olgunluk bölümlerinin hepsi her sektöre bir ölçüde hitap ediyor; "hiç sorma"
 * demek için sektörü tanımak gerekir, ağırlık vermek için sektörün neye
 * dayandığını bilmek yeter.
 *
 * "Çok önemli" (2) ölçütü: o sektörün işi doğrudan bu yetkinliğe dayanıyor mu?
 * Bankada veri ve güvenlik işin kendisidir, imalatta süreç ve entegrasyon
 * üretimin kendisidir. "Az önemli" (0.5) ölçütü: o sektörün tipik işletmesi bu
 * yetkinliği hiç kurmadan da çalışabiliyor mu?
 *
 * BU BİR BAŞLANGIÇ
 * Kurumun kendi görüşü bunun üstüne yazar: Yönetim → Sektör Kapsamı ekranından
 * her hücre değiştirilebilir ve betik kayıtlı kuralları ezmez (--force hariç).
 * Amaç boş bir matrisle başlamamak.
 *
 * KULLANIM
 *   npm run seed:scope                    # kurar (var olan kurallara dokunmaz)
 *   npm run seed:scope -- --dry-run       # ne yapılacağını yazar
 *   npm run seed:scope -- --force         # kayıtlı kuralları da günceller
 *   npm run seed:scope -- --survey <ad>   # anket adında geçen metin
 */

import { PrismaClient } from "@prisma/client";
import { scopeFromLevel, type ScopeLevelKey } from "../lib/sector-scope";

const prisma = new PrismaClient();

/** NACE bölüm harfleri (bkz. scripts/seed-nace.ts). */
type SectorCode = string;

type SectionRule = {
  /** Anketteki bölüm (alt kategori) adı. */
  section: string;
  /** İşi doğrudan bu yetkinliğe dayanan sektörler. */
  high: SectorCode[];
  /** Tipik işletmesi bu yetkinlik olmadan da çalışan sektörler. */
  low?: SectorCode[];
  /** Kararın gerekçesi — ekranda değil, burada okunsun diye. */
  why: string;
};

/**
 * Sektör kısaltmaları, okurken hatırlamak için:
 *   A tarım · B madencilik · C imalat · D elektrik/gaz · E su/atık · F inşaat
 *   G ticaret · H ulaştırma · I konaklama/yiyecek · J yayıncılık · K telekom/BT
 *   L finans/sigorta · M gayrimenkul · N mesleki/bilimsel · O idari destek
 *   P kamu · Q eğitim · R sağlık · S sanat/spor · T diğer hizmet
 *   U hane halkı · V uluslararası örgüt
 */
const RULES: SectionRule[] = [
  {
    section: "Dijital Vizyon",
    high: ["K", "J"],
    why: "Ürünü zaten dijital olan sektörlerde vizyonun netliği doğrudan rekabet konusu; diğerlerinde önemli ama belirleyici değil.",
  },
  {
    section: "Yönetişim ve Sahiplik",
    high: ["L", "P", "R"],
    why: "Regülasyonu ağır sektörlerde 'bu karardan kim sorumlu' sorusunun yazılı cevabı olmak zorunda.",
  },
  {
    section: "Süreç Dijitalleşmesi",
    high: ["C", "G", "H", "O", "P"],
    low: ["U"],
    why: "İşin kendisi tekrar eden süreçlerden oluşuyorsa dijitalleşme doğrudan maliyete yazıyor.",
  },
  {
    section: "Sistem Entegrasyonu",
    high: ["C", "G", "H", "L", "R"],
    low: ["T", "S", "U"],
    why: "Çok sistemli sektörlerde asıl kayıp sistemlerin arasında oluşuyor; tek uygulamayla dönen küçük işletmede böyle bir sorun yok.",
  },
  {
    section: "Veri Yönetimi",
    high: ["L", "K", "R", "P", "Q"],
    low: ["U"],
    why: "Kişisel ve düzenlemeye tabi veri taşıyan sektörlerde veri yönetimi hem risk hem varlık.",
  },
  {
    section: "Analitik Yetkinlik",
    high: ["G", "L", "K", "H", "C"],
    low: ["T", "U"],
    why: "Fiyat, talep, rota ve kapasite kararlarını günlük veren sektörlerde analitik doğrudan kâra dokunuyor.",
  },
  {
    section: "Altyapı ve Süreklilik",
    high: ["K", "L", "D", "E", "H", "R"],
    low: ["T", "U"],
    why: "Hizmetin kesilmesinin bedeli saatlerle ölçülen sektörler; kritik altyapı ve sağlıkta kesinti güvenlik sorunu.",
  },
  {
    section: "Siber Güvenlik",
    high: ["L", "K", "R", "P", "D", "E", "H"],
    why: "Finans ve sağlıkta veri, kritik altyapıda işletim hedef; bu sektörlerde olay maliyeti diğerleriyle kıyaslanmaz.",
  },
  {
    section: "Dijital Yetkinlik",
    high: ["K", "J", "N", "Q"],
    why: "İşi bilgi işi olan sektörlerde çalışanın dijital yetkinliği üretkenliğin kendisi.",
  },
  {
    section: "Değişim ve İnovasyon",
    high: ["K", "J", "N", "C"],
    low: ["U"],
    why: "Ürün döngüsü kısa olan sektörlerde değişimi yönetememek doğrudan pazar kaybı.",
  },
];

async function resolveSurvey(nameFilter?: string) {
  const surveys = await prisma.survey.findMany({
    where: {
      archivedAt: null,
      ...(nameFilter ? { name: { contains: nameFilter, mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });

  if (surveys.length === 0) throw new Error("Eşleşen anket bulunamadı.");
  if (surveys.length > 1) {
    throw new Error(
      `Birden fazla anket eşleşti; --survey ile daraltın:\n` +
        surveys.map((s) => `  ${s.name}`).join("\n")
    );
  }
  return surveys[0];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const surveyArg = process.argv.indexOf("--survey");
  const nameFilter = surveyArg >= 0 ? process.argv[surveyArg + 1] : undefined;

  const survey = await resolveSurvey(nameFilter);
  console.log(`\n📊 Anket: ${survey.name}`);

  const sectors = await prisma.sector.findMany({ select: { id: true, name: true, naicsCode: true } });
  const sectorByCode = new Map(sectors.filter((s) => s.naicsCode).map((s) => [s.naicsCode!, s]));

  const subCategories = await prisma.subCategory.findMany({
    where: { archivedAt: null, category: { surveyId: survey.id, archivedAt: null } },
    select: { id: true, name: true },
  });
  const sectionByName = new Map(subCategories.map((s) => [s.name, s]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const rule of RULES) {
    const section = sectionByName.get(rule.section);
    if (!section) {
      missing.push(rule.section);
      continue;
    }

    const cells: Array<{ code: string; level: ScopeLevelKey }> = [
      ...rule.high.map((code) => ({ code, level: "HIGH" as const })),
      ...(rule.low ?? []).map((code) => ({ code, level: "LOW" as const })),
    ];

    for (const cell of cells) {
      const sector = sectorByCode.get(cell.code);
      if (!sector) {
        missing.push(`${rule.section} → sektör [${cell.code}]`);
        continue;
      }

      const scope = scopeFromLevel(cell.level);
      const where = {
        sectorId: sector.id,
        subSectorId: null,
        surveyId: survey.id,
        subCategoryId: section.id,
      };

      // subSectorId null olduğu için @@unique upsert'e güvenilmez
      // (Postgres NULL'ları farklı sayar); açık arama yapılır.
      const existing = await prisma.sectorScopeRule.findFirst({ where });

      if (dryRun) {
        console.log(
          `  ${existing ? (force ? "güncellenecek" : "atlanacak   ") : "eklenecek   "} ` +
            `${rule.section} × ${sector.name} → ${cell.level}`
        );
        existing ? (force ? updated++ : skipped++) : created++;
        continue;
      }

      if (existing) {
        // Elle girilmiş kurallar korunur: bu betik başlangıç değeri verir,
        // kurumun kendi görüşünü ezmez.
        if (!force) {
          skipped++;
          continue;
        }
        await prisma.sectorScopeRule.update({
          where: { id: existing.id },
          data: { applicable: scope.applicable, weight: scope.weight },
        });
        updated++;
      } else {
        await prisma.sectorScopeRule.create({
          data: { ...where, applicable: scope.applicable, weight: scope.weight },
        });
        created++;
      }
    }
  }

  console.log(
    `\n${dryRun ? "Ön izleme" : "✅ Bitti"}: ${created} eklendi, ${updated} güncellendi, ` +
      `${skipped} kayıtlı kural korundu.`
  );

  if (missing.length > 0) {
    console.log(`\n⚠️  Eşleşmeyen ${missing.length} satır (ankette böyle bir bölüm yok):`);
    for (const line of missing) console.log(`  ${line}`);
  }

  console.log(
    "\nHiçbir bölüm kapsam dışı bırakılmadı; yalnızca ağırlık verildi.\n" +
      "Yönetim → Sektör Kapsamı ekranından her hücre değiştirilebilir.\n"
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
