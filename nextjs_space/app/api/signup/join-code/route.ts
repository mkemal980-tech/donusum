import { NextRequest, NextResponse } from "next/server";
import { enforcePublicRateLimit } from "@/lib/api-utils";
import { resolveJoinCodeProfile } from "@/lib/organization-join-code-server";

export async function POST(request: NextRequest) {
  const throttled = await enforcePublicRateLimit(request, 'join-code');
  if (throttled) return throttled;

  try {
    const { joinCode } = await request.json();
    const result = await resolveJoinCodeProfile(joinCode);
    if (result.error || !result.code || !result.profile) {
      return NextResponse.json({ error: result.error ?? "Katılım kodu geçersiz." }, { status: 400 });
    }
    return NextResponse.json({
      valid: true,
      unitName: result.code.unit.name,
      /**
       * Birim seviyesi kodda kuruluş kaydı henüz yok: kaydolan kişinin yazdığı
       * şirket adından açılacak. Ekran bu yüzden "Kuruluş" alanını göstermeli.
       */
      requiresOrganization: result.code.createsMemberUnit,
      sectorName: result.profile.sector?.name ?? null,
      subSectorName: result.profile.subSector?.name ?? null,
      surveyName: result.survey?.name ?? null,
    });
  } catch (error) {
    console.error("Join code validation error:", error);
    return NextResponse.json({ error: "Katılım kodu doğrulanamadı." }, { status: 500 });
  }
}
