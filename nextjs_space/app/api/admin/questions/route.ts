export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { archiveQuestion } from "@/lib/soft-delete";
import { rescoreQuestionResponses } from "@/lib/rescore";
import {
  canEditSurvey,
  surveyIdForCategory,
  surveyIdForQuestion,
  surveyIdForSubCategory,
  surveyIdForSubLevel,
} from "@/lib/survey-management";

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { text, type, options, conditionalOptions, order, requiresEvidence, subLevelId, subCategoryId, categoryId, weight, axisType } = body;

    /**
     * Soru **tam olarak bir** yere bağlanır.
     *
     * Kontrol "en az biri" diyordu; hem `categoryId` hem `subLevelId` dolu bir
     * soru kabul ediliyordu. Puanlamanın ön hazırlık geçişi böyle bir soruyu
     * hem `category.questions` hem `subLevel.questions` altında gördüğü için
     * tavana iki kez, alınan puana bir kez ekliyordu: tek soru tam puanla
     * cevaplandığında sonuç %100 yerine %50 çıkıyordu (testle doğrulandı).
     */
    const parents = [categoryId, subCategoryId, subLevelId].filter(Boolean);
    if (parents.length === 0) {
      return NextResponse.json({ error: "categoryId, subCategoryId veya subLevelId gerekli" }, { status: 400 });
    }
    if (parents.length > 1) {
      return NextResponse.json(
        { error: "Soru yalnızca tek bir yere bağlanabilir: kategori, alt kategori ya da alt seviye." },
        { status: 400 }
      );
    }

    const questionText = typeof text === "string" ? text.trim() : "";
    if (!questionText) {
      // Boş metin Prisma'ya kadar gidip jenerik 500 üretiyordu.
      return NextResponse.json({ error: "Soru metni gerekli" }, { status: 400 });
    }
    if (questionText.length > 2000) {
      return NextResponse.json({ error: "Soru metni en fazla 2000 karakter olabilir" }, { status: 400 });
    }

    /**
     * Ağırlık doğrulanır.
     *
     * `weight || 1.0` yazıldığı için 0 sessizce 1'e dönüşüyor, negatif değer
     * ise olduğu gibi kabul ediliyordu. Negatif ağırlık negatif tavan üretir
     * ve yüzdenin işaretini ters çevirir.
     */
    const parsedWeight = weight === undefined || weight === null ? 1 : Number(weight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 10) {
      return NextResponse.json(
        { error: "Ağırlık 0'dan büyük ve en fazla 10 olmalı." },
        { status: 400 }
      );
    }
    const surveyId = categoryId
      ? await surveyIdForCategory(categoryId)
      : subCategoryId
        ? await surveyIdForSubCategory(subCategoryId)
        : await surveyIdForSubLevel(subLevelId);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu ankete soru ekleme yetkiniz yok' }, { status: 403 });
    }

    const question = await prisma.question.create({
      data: { 
        text: questionText, 
        type: type || 'SCALE', 
        options, 
        conditionalOptions,  // Kademeli puanlama seçenekleri
        order: order || 1, 
        requiresEvidence: requiresEvidence || false,
        categoryId: categoryId || null,      // Doğrudan kategoriye bağlı sorular
        subLevelId: subLevelId || null,
        subCategoryId: subCategoryId || null,
        weight: parsedWeight,
        axisType: axisType || 'VELOCITY'  // Ironman için eksen tipi
      }
    });
    return NextResponse.json(question);
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, text, type, options, conditionalOptions, order, requiresEvidence, weight, axisType } = body;

    if (text !== undefined) {
      const trimmed = typeof text === "string" ? text.trim() : "";
      if (!trimmed) return NextResponse.json({ error: "Soru metni boş olamaz" }, { status: 400 });
      if (trimmed.length > 2000) {
        return NextResponse.json({ error: "Soru metni en fazla 2000 karakter olabilir" }, { status: 400 });
      }
    }

    let parsedWeight: number | undefined;
    if (weight !== undefined && weight !== null) {
      parsedWeight = Number(weight);
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 10) {
        return NextResponse.json(
          { error: "Ağırlık 0'dan büyük ve en fazla 10 olmalı." },
          { status: 400 }
        );
      }
    }

    const surveyId = await surveyIdForQuestion(id);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu soruyu düzenleme yetkiniz yok' }, { status: 403 });
    }

    /**
     * Tanım değiştiyse mevcut cevapların puanı yeniden hesaplanır.
     *
     * `SurveyResponse.score` cevap yazılırken hesaplanıp saklanıyor. Sorunun
     * tipi ya da şık puanları sonradan değiştiğinde eski cevaplar eski
     * tanımın puanıyla kalıyor ve kimse fark etmiyordu; ekip bundan bir kez
     * zarar görmüş (bkz. scripts/fix-yes-no-option-values.ts).
     */
    const definitionChanged =
      type !== undefined || options !== undefined || conditionalOptions !== undefined;

    const question = await prisma.question.update({
      where: { id },
      data: { 
        text: text === undefined ? undefined : String(text).trim(), 
        type, 
        options, 
        conditionalOptions,  // Kademeli puanlama seçenekleri
        order, 
        requiresEvidence, 
        weight: parsedWeight,
        axisType: axisType || 'VELOCITY'  // Ironman için eksen tipi
      }
    });

    const rescored = definitionChanged ? await rescoreQuestionResponses(id) : 0;

    return NextResponse.json({ ...question, rescoredResponses: rescored });
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const surveyId = await surveyIdForQuestion(id);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu soruyu silme yetkiniz yok' }, { status: 403 });
    }

    await archiveQuestion(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
