/**
 * AI taslak üretiminin gerçekten çalıştığını doğrular.
 *
 * Üretimdeki prompt'un ve dönüşümün ta kendisini kullanır (lib/recommendation-draft),
 * benzerini değil — böylece burada geçen bir kontrol panelde de geçer.
 *
 * Asıl sınanan risk: model, şık etiketlerini BİREBİR döndürüyor mu? Kendi
 * kelimeleriyle yazarsa tetikleyici eşleşmez ve her satır önizlemede hata
 * olarak işaretlenir. Bu betik onu tek çağrıda ortaya çıkarır.
 *
 * KULLANIM
 *   # Sentetik bir soruyla (veritabanı gerekmez):
 *   npx tsx --require dotenv/config scripts/check-ai-draft.ts
 *
 *   # Anketteki gerçek bir soruyla:
 *   npx tsx --require dotenv/config scripts/check-ai-draft.ts --question-id=<id>
 *
 *   # Öneri havuzunu zorlayarak (uydurma riskini ölçmek için):
 *   npx tsx --require dotenv/config scripts/check-ai-draft.ts --pool
 *
 * Hiçbir şey veritabanına yazmaz.
 */

import { PrismaClient } from "@prisma/client";
import { callLLMForJSON, isLLMConfigured } from "../lib/llm";
import {
  DRAFT_SYSTEM_PROMPT,
  type DraftResponse,
  buildDraftPrompt,
  checkPoolAdherence,
  draftToImportRow,
} from "../lib/recommendation-draft";
import {
  type QuestionContext,
  checkLadders,
  matchQuestion,
  matchTrigger,
  validateRecommendationRow,
} from "../lib/recommendation-import";
import { triggerChoicesFor } from "../lib/recommendation-triggers";

const prisma = new PrismaClient();

/** Veritabanı gerekmeden çalışabilmek için örnek bir olgunluk sorusu. */
const DEMO_QUESTION: QuestionContext = {
  id: "demo",
  text: "Tersaneniz emisyon azaltımı için hangi yaklaşımı izliyor?",
  type: "MULTIPLE_CHOICE",
  options: [
    { value: "takip_yok", label: "Takip yok", score: 0 },
    { value: "manuel", label: "Manuel takip", score: 1 },
    { value: "dijital", label: "Dijital takip", score: 2 },
    { value: "entegre", label: "Entegre sistem", score: 3 },
  ],
  categoryId: null,
  subCategoryId: null,
  subLevelId: null,
};

const DEMO_POOL = [
  "Kapsam 1-2 emisyon envanteri oluşturun",
  "Ölçümü dijital bir sisteme taşıyın",
  "Bilim temelli azaltım hedefi belirleyip doğrulatın",
  "Tedarik zinciri (Kapsam 3) emisyonlarını kapsama alın",
];

async function resolveQuestion(questionId: string | null): Promise<QuestionContext> {
  if (!questionId) return DEMO_QUESTION;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      text: true,
      type: true,
      options: true,
      categoryId: true,
      subCategoryId: true,
      subLevelId: true,
    },
  });

  if (!question) throw new Error(`Soru bulunamadı: ${questionId}`);
  return question;
}

async function main() {
  if (!isLLMConfigured()) {
    console.error(
      "\n❌ OPENAI_API_KEY tanımlı değil.\n" +
        "   nextjs_space/.env dosyasındaki OPENAI_API_KEY satırını doldurup tekrar deneyin.\n"
    );
    process.exitCode = 1;
    return;
  }

  const argv = process.argv.slice(2);
  const questionId = argv.find((arg) => arg.startsWith("--question-id="))?.split("=")[1] ?? null;
  const usePool = argv.includes("--pool");

  const question = await resolveQuestion(questionId);
  const support = triggerChoicesFor(question);

  if (!support.supported) {
    console.error(`\n❌ Bu soru tipinde şık listesi yok: ${support.reason}\n`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n🤖 Model: ${process.env.OPENAI_MODEL || "gpt-4.1-mini"}`);
  console.log(`   Soru: ${question.text}`);
  console.log(`   Şıklar: ${support.choices.map((c) => `${c.label}(${c.score})`).join(", ")}`);
  console.log(`   Havuz: ${usePool ? `${DEMO_POOL.length} öneri zorlanıyor` : "yok"}\n`);

  const started = Date.now();
  const result = await callLLMForJSON<DraftResponse>(
    buildDraftPrompt({ text: question.text, choices: support.choices }, "Gemi İnşa", usePool ? DEMO_POOL : []),
    DRAFT_SYSTEM_PROMPT,
    { temperature: 0.4, maxTokens: 2000 }
  );
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const drafts = Array.isArray(result?.oneriler) ? result.oneriler : [];
  console.log(`⏱  ${elapsed} sn — ${drafts.length} taslak döndü (beklenen: ${support.choices.length})\n`);

  if (drafts.length === 0) {
    console.error("❌ Model boş yanıt döndürdü.\n");
    process.exitCode = 1;
    return;
  }

  const rows = drafts.map((draft, index) => draftToImportRow(draft, question.text, index + 1));

  let invalid = 0;
  let triggerMismatch = 0;

  rows.forEach((row, index) => {
    const match = matchQuestion(row, [question]);
    const errors = validateRecommendationRow(row, match.found ? match.question : null);
    const trigger = match.found ? matchTrigger(row, match.question) : null;

    const status = errors.length === 0 ? "✅" : "❌";
    console.log(`${status} ${index + 1}. "${row.tetikleyici}" → ${row.baslik}`);
    console.log(
      `      ${row.vade} / ${row.strateji} / ${row.maliyet} / etki ${row.etki}` +
        (trigger?.found ? ` / eşik ${trigger.choice.score}` : "")
    );
    if (row.aciklama) console.log(`      ${row.aciklama}`);

    if (errors.length > 0) {
      invalid++;
      errors.forEach((error) => console.log(`      ⚠ ${error.field}: ${error.message}`));
      if (errors.some((error) => error.field === "tetikleyici")) triggerMismatch++;
    }
    console.log("");
  });

  const warnings = [
    ...checkLadders(rows, [question]),
    ...checkPoolAdherence(rows, usePool ? DEMO_POOL : [], question.text),
  ];

  console.log("─".repeat(60));
  console.log(`Geçerli satır : ${rows.length - invalid}/${rows.length}`);
  console.log(`Şık eşleşmedi : ${triggerMismatch}`);
  console.log(`Uyarı: ${warnings.length}`);
  warnings.forEach((warning) => console.log(`  ⚠ ${warning.message}`));

  if (triggerMismatch > 0) {
    console.log(
      "\n⚠ Model şık etiketlerini birebir döndürmüyor. Panelde bu satırlar hata olarak\n" +
        "  işaretlenir ve yönetici listeden seçmek zorunda kalır. Prompt'taki\n" +
        '  "BİREBİR yaz" vurgusu güçlendirilmeli ya da daha güçlü bir model kullanılmalı.'
    );
  } else if (invalid === 0 && warnings.length === 0) {
    console.log("\n✅ Taslak üretimi sağlam: tüm satırlar geçerli, merdiven eksiksiz.");
  }

  console.log("");
  if (invalid > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\n❌ Hata:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
