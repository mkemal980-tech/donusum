import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/api-utils";
import { resolveJoinCodeProfile } from "@/lib/organization-join-code-server";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rateLimit = checkRateLimit(`${ip}:join-code`, "auth");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kod doğrulama denemesi. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  try {
    const { joinCode } = await request.json();
    const result = await resolveJoinCodeProfile(joinCode);
    if (result.error || !result.code || !result.profile) {
      return NextResponse.json({ error: result.error ?? "Katılım kodu geçersiz." }, { status: 400 });
    }
    return NextResponse.json({
      valid: true,
      unitName: result.code.unit.name,
      sectorName: result.profile.sector?.name ?? null,
      subSectorName: result.profile.subSector?.name ?? null,
      surveyName: result.survey?.name ?? null,
    });
  } catch (error) {
    console.error("Join code validation error:", error);
    return NextResponse.json({ error: "Katılım kodu doğrulanamadı." }, { status: 500 });
  }
}
