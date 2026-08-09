/**
 * Tersane ESG anketi için dolu öneri şablonu üretir.
 *
 * Eşleştirmeyi göz kararı değil kod yapar: her satırın soru metni ve şık
 * etiketi veritabanından okunur, öneri metni numaraya göre eşlenir. Eksik ya
 * da fazla bir şey varsa dosya üretilmez — yarım bir şablonu yükleyip
 * sonradan hangi satırın kaybolduğunu aramak, baştan üretmekten pahalıdır.
 *
 * KULLANIM
 *   npx tsx --require dotenv/config scripts/build-tersane-oneriler.ts \
 *     --sorular /tmp/tersane-sorular.json --cikti /tmp/tersane-oneriler.xlsx
 *
 * `--sorular` dosyası üretim veritabanından çıkarılır (soru metni + şık
 * etiketleri). Böylece betik veritabanına bağlanmadan çalışır ve aynı dosya
 * tekrar tekrar kullanılabilir.
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { buildRecommendationSheet } from "../lib/recommendation-template";
import type { Oneri, OneriHaritasi } from "./tersane-oneri-tipi";
import { ONERILER } from "./tersane-oneri-verisi";

/** Belgeden çıkarılmış "1. adım" metinleri: öneri açıklamasının kaynağı. */
const ADIM1: Record<string, Partial<Record<"A" | "B" | "C" | "D", string>>> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "tersane-adim1.json"), "utf8"),
);

type Soru = {
  kategori: string;
  bolum: string;
  soru: string;
  siklar: { label: string; score: number }[];
};

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** Şık etiketinden harfi çıkarır: "A) Strateji yok." → "A" */
function harf(label: string): string | null {
  const match = label.match(/^\s*([A-D])\s*\)/);
  return match ? match[1] : null;
}

function main() {
  const sorular: Soru[] = JSON.parse(fs.readFileSync(arg("--sorular", "/tmp/tersane-sorular.json"), "utf8"));
  const harita: OneriHaritasi = ONERILER;

  const rows: Record<string, string>[] = [];
  const eksik: string[] = [];
  const fazla: string[] = [];
  // Elle yazılan özet ile belgedeki metin ayrıştıysa haber ver: metin belgeden gider.
  let sapma = 0;

  sorular.forEach((soru, index) => {
    const no = index + 1;
    const grup = harita[no];

    if (!grup) {
      eksik.push(`Soru ${no}: hiç öneri yok — ${soru.soru.slice(0, 60)}`);
      return;
    }

    // Şıkları puana göre sırala: merdiven en düşükten yükseğe kurulur.
    const sirali = [...soru.siklar].sort((a, b) => a.score - b.score);

    sirali.forEach((sik, sira) => {
      const letter = harf(sik.label);
      if (!letter) {
        eksik.push(`Soru ${no}: şık etiketi harfle başlamıyor — ${sik.label.slice(0, 50)}`);
        return;
      }

      const oneri: Oneri | undefined = grup[letter as "A" | "B" | "C" | "D"];
      if (!oneri) {
        eksik.push(`Soru ${no} şık ${letter}: öneri metni yok`);
        return;
      }

      const belgeMetni = ADIM1[String(no)]?.[letter as "A" | "B" | "C" | "D"];
      if (!belgeMetni) {
        eksik.push(`Soru ${no} şık ${letter}: belgede "1. adım" metni bulunamadı`);
        return;
      }
      if (belgeMetni !== oneri.a) sapma += 1;

      rows.push({
        soru_metni: soru.soru,
        // Etiket birebir: tek karakter fark satırı düşürür.
        tetikleyici: sik.label,
        // Merdiven: öneri kendi şıkkında ve altındakilerde görünür.
        kademeli: "EVET",
        baslik: oneri.b,
        // Açıklama belgeden birebir: özetleyip anlam kaydırmaktansa kaynağı taşı.
        aciklama: belgeMetni,
        vade: oneri.v,
        strateji: oneri.s,
        maliyet: oneri.m,
        etki: String(oneri.e),
        // Kademeli öneride katkı basamaktan türetilir; puan elle verilmez.
        puan: "",
        video_url: "",
        sira: String(sira + 1),
      });
    });
  });

  // Veri dosyasında ankette karşılığı olmayan numara var mı?
  for (const key of Object.keys(harita)) {
    const no = Number(key);
    if (no < 1 || no > sorular.length) fazla.push(`Soru ${no} veride var, ankette yok`);
  }

  const beklenen = sorular.reduce((sum, soru) => sum + soru.siklar.length, 0);

  console.log(`\nAnket: ${sorular.length} soru · ${beklenen} şık`);
  console.log(`Üretilen satır: ${rows.length}`);

  if (eksik.length > 0) {
    console.log(`\n❌ ${eksik.length} eksik:`);
    for (const line of eksik.slice(0, 30)) console.log(`   ${line}`);
    if (eksik.length > 30) console.log(`   ... ve ${eksik.length - 30} tane daha`);
  }
  if (fazla.length > 0) {
    console.log(`\n⚠️  ${fazla.length} fazla:`);
    for (const line of fazla) console.log(`   ${line}`);
  }

  if (rows.length !== beklenen) {
    console.log("\nDosya üretilmedi: eksikler kapatılmadan yüklenecek bir şablon yok.\n");
    process.exit(1);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildRecommendationSheet(rows), "Öneriler");

  const cikti = arg("--cikti", "/tmp/tersane-oneriler.xlsx");
  XLSX.writeFile(workbook, cikti);

  // Kaba bir denge kontrolü: her soruda dört basamak da dolu mu?
  const soruBasina = new Map<string, number>();
  for (const row of rows) soruBasina.set(row.soru_metni, (soruBasina.get(row.soru_metni) ?? 0) + 1);
  const eksikBasamak = [...soruBasina.entries()].filter(([, n]) => n !== 4);

  console.log(`\n✅ ${cikti}`);
  console.log(`   ${rows.length} öneri · ${soruBasina.size} soru`);
  if (sapma > 0) console.log(`   ℹ️  ${sapma} satırda açıklama belgeden alındı (veri dosyasındaki özet farklıydı)`);
  if (eksikBasamak.length > 0) {
    console.log(`   ⚠️  dört basamağı olmayan ${eksikBasamak.length} soru var`);
  }
  console.log();
}

main();
