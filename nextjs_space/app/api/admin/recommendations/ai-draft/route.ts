export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { callLLMForJSON, isLLMConfigured } from "@/lib/llm";
import { buildSurveyQuestionWhere } from "@/lib/scoring";
import { triggerChoicesFor } from "@/lib/recommendation-triggers";
import {
  DRAFT_SYSTEM_PROMPT,
  type DraftResponse,
  buildDraftPrompt,
  checkPoolAdherence,
  draftToImportRow,
} from "@/lib/recommendation-draft";
import {
  type QuestionContext,
  type RecommendationImportRow,
  checkLadders,
  matchQuestion,
  validateRecommendationRow,
} from "@/lib/recommendation-import";

/**
 * Kademeli öneri taslağı üretir — kaydetmez.
 *
 * TASARIM KARARI: AI yalnızca *yazım anında* devrededir. Ürettiği satırlar
 * Excel'den gelen satırlarla birebir aynı biçimdedir ve aynı önizleme
 * ekranına düşer; yönetici onaylamadan hiçbir şey veritabanına yazılmaz.
 * Çalışma anında (kullanıcı öneri listesini görürken) AI hiç çağrılmaz,
 * böylece merdiven sabit, yol haritası korunmuş ve sektör kıyası anlamlı kalır.
 *
 * İki mod:
 *   - { questionIds: [...] }  → seçili sorular için taslak
 *   - { subLevelId } / { subCategoryId } → o gruptaki tüm sorular için
 *
 * `pool` verilirse (Excel'den okunan öneri havuzu) model yeni metin uydurmak
 * yerine havuzdan seçmeye zorlanır — halüsinasyon riski böyle düşer.
 */

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "ai" });
  if (!auth.success) return auth.response;

  if (!isLLMConfigured()) {
    return NextResponse.json(
      { error: "AI sağlayıcı yapılandırılmamış. Taslak üretmek için OPENAI_API_KEY tanımlayın." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const questionIds: string[] = Array.isArray(body?.questionIds) ? body.questionIds : [];
    const subLevelId = typeof body?.subLevelId === "string" ? body.subLevelId : null;
    const subCategoryId = typeof body?.subCategoryId === "string" ? body.subCategoryId : null;
    const surveyId = typeof body?.surveyId === "string" ? body.surveyId : null;
    const pool: string[] = Array.isArray(body?.pool)
      ? body.pool.map((entry: unknown) => String(entry)).filter(Boolean)
      : [];

    const where = questionIds.length
      ? { id: { in: questionIds } }
      : subLevelId
        ? { subLevelId }
        : subCategoryId
          ? { subCategoryId }
          : null;

    if (!where) {
      return NextResponse.json(
        { error: "questionIds, subLevelId veya subCategoryId gerekli" },
        { status: 400 }
      );
    }

    const questions = await prisma.question.findMany({
      where: { archivedAt: null, ...where },
      select: {
        id: true,
        text: true,
        type: true,
        options: true,
        categoryId: true,
        subCategoryId: true,
        subLevelId: true,
      },
      orderBy: { order: "asc" },
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
    }

    // Tek seferde çok fazla LLM çağrısı yapılmasın — panel zaten grup grup
    // çalışmaya elverişli.
    const MAX_QUESTIONS = 10;
    const targeted = questions.slice(0, MAX_QUESTIONS);
    const truncated = questions.length - targeted.length;

    const sectorName = auth.user.sectorId
      ? (await prisma.sector.findUnique({ where: { id: auth.user.sectorId }, select: { name: true } }))
          ?.name ?? "Genel"
      : "Genel";

    const rows: RecommendationImportRow[] = [];
    const failures: string[] = [];
    // Havuz verildiyse modelin gerçekten havuzdan seçtiği soru soru denetlenir.
    const poolWarnings: { questionText: string; message: string }[] = [];

    for (const question of targeted) {
      const support = triggerChoicesFor(question);
      if (!support.supported) {
        failures.push(`"${question.text}" — bu soru tipinde şık listesi yok, taslak üretilemedi.`);
        continue;
      }

      try {
        const result = await callLLMForJSON<DraftResponse>(
          buildDraftPrompt({ text: question.text, choices: support.choices }, sectorName, pool),
          DRAFT_SYSTEM_PROMPT,
          { temperature: 0.4, maxTokens: 2000 }
        );

        const drafts = Array.isArray(result?.oneriler) ? result.oneriler : [];
        if (drafts.length === 0) {
          failures.push(`"${question.text}" — model boş yanıt döndürdü.`);
          continue;
        }

        const questionRows = drafts.map((draft, index) =>
          draftToImportRow(draft, question.text, rows.length + index + 1)
        );
        rows.push(...questionRows);
        poolWarnings.push(...checkPoolAdherence(questionRows, pool, question.text));
      } catch (error) {
        console.error("AI draft error for question", question.id, error);
        failures.push(`"${question.text}" — taslak üretilemedi, tekrar deneyebilirsiniz.`);
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Hiç taslak üretilemedi.", failures },
        { status: 502 }
      );
    }

    // Aynı anketten tüm soruları getir ki eşleştirme ve merdiven kontrolü
    // Excel yüklemesiyle birebir aynı kurallarla çalışsın.
    const contextQuestions: QuestionContext[] = surveyId
      ? await prisma.question.findMany({
          where: { archivedAt: null, ...buildSurveyQuestionWhere(surveyId) },
          select: {
            id: true,
            text: true,
            type: true,
            options: true,
            categoryId: true,
            subCategoryId: true,
            subLevelId: true,
          },
        })
      : questions;

    return NextResponse.json({
      preview: true,
      source: "ai",
      skippedRows: 0,
      truncatedQuestions: truncated,
      failures,
      questions: contextQuestions,
      rows: rows.map((row, index) => {
        const match = matchQuestion(row, contextQuestions);
        return {
          rowNumber: index + 1,
          values: row,
          errors: validateRecommendationRow(row, match.found ? match.question : null),
        };
      }),
      warnings: [...checkLadders(rows, contextQuestions), ...poolWarnings],
    });
  } catch (error) {
    console.error("Error generating AI recommendation drafts:", error);
    return NextResponse.json({ error: "Taslak üretilirken hata oluştu" }, { status: 500 });
  }
}
