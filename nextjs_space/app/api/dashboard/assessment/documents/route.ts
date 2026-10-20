import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getFileUrl } from "@/lib/s3";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadAssessmentDocuments } from "@/lib/assessment-view";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const id = request.nextUrl.searchParams.get("assessmentId");
  if (!id) return NextResponse.json({ error: "Değerlendirme seçilmeli." }, { status: 400 });
  try {
    const documents = await loadAssessmentDocuments(auth, id);
    // Nesne anahtarı yanıtta dönmez; yalnızca imzalı indirme adresi.
    return NextResponse.json(await Promise.all(documents.map(async ({ cloudStoragePath, isPublic, response: _response, ...doc }) => {
      try {
        return { ...doc, downloadUrl: await getFileUrl(cloudStoragePath, isPublic) };
      } catch {
        return { ...doc, downloadUrl: null };
      }
    })));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Belgeler yüklenemedi:", error);
    return NextResponse.json({ error: "Belgeler yüklenemedi." }, { status: 500 });
  }
}
