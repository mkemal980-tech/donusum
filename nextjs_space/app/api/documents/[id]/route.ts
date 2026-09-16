export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl, deleteFile } from "@/lib/s3";
import { withAuth } from "@/lib/api-utils";
import { getAssessmentIds, getManagedUnitIds } from "@/lib/assessment";
import { getAccessibleSurveyIds } from "@/lib/scoring";

/**
 * Belgeye kim erişebilir?
 *
 * Yükleyen kişi, aynı değerlendirmeye katkı veren herkes, o kuruluşu yöneten
 * birim yöneticisi ve sistem yöneticisi.
 *
 * Önceden yalnızca `document.userId === userId` bakılıyordu. Oysa yükleme
 * tarafı yetkiyi bilinçle değerlendirmeye bağlamıştı ("Yetki artık kişiye
 * değil değerlendirmeye bakar", bkz. /api/upload/complete): ekibinden biri
 * kanıtı yüklüyor, koordinatör onu açamıyordu — çok kullanıcılı akışın tam
 * ortasındaki iş engelleniyordu.
 */
async function canAccessDocument(
  document: { userId: string; responseId: string | null },
  viewer: { id: string; role: string }
): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;
  if (document.userId === viewer.id) return true;
  if (!document.responseId) return false;

  const response = await prisma.surveyResponse.findUnique({
    where: { id: document.responseId },
    select: { assessment: { select: { id: true, unitId: true } } },
  });
  const assessment = response?.assessment;
  if (!assessment) return false;

  const accessible = await getAssessmentIds(
    viewer.id,
    await getAccessibleSurveyIds(viewer.id)
  );
  if (accessible.includes(assessment.id)) return true;

  // Kuruluşu yöneten birim yöneticisi kanıtı denetleyebilmeli.
  if (!assessment.unitId) return false;
  return (await getManagedUnitIds(viewer.id)).includes(assessment.unitId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const document = await prisma.document.findUnique({
      where: { id: params?.id }
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!(await canAccessDocument(document, { id: auth.userId, role: auth.user.role }))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const downloadUrl = await getFileUrl(
      document?.cloudStoragePath ?? '',
      document?.isPublic ?? false
    );

    return NextResponse.json({ downloadUrl, fileName: document?.fileName });
  } catch (error) {
    console.error("Error getting document URL:", error);
    return NextResponse.json(
      { error: "Failed to get document URL" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const document = await prisma.document.findUnique({
      where: { id: params?.id }
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Silme okumadan dar tutulur: kanıtı yükleyen ya da sistem yöneticisi.
    // Aynı değerlendirmeye katkı veren biri okuyabilir ama silemez.
    if (document.userId !== auth.userId && auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteFile(document?.cloudStoragePath ?? '');
    await prisma.document.delete({ where: { id: params?.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
