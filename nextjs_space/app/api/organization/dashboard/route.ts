import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { loadCampaignDashboard } from "@/lib/organization-campaign";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;

  const campaignId = new URL(request.url).searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId gerekli" }, { status: 400 });
  }

  try {
    const result = await loadCampaignDashboard(
      campaignId,
      auth.userId,
      auth.user.role
    );
    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json({ error: "Bu kampanyayı görme yetkiniz yok" }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Organization dashboard error:", error);
    return NextResponse.json({ error: "Üye sonuçları yüklenemedi" }, { status: 500 });
  }
}
