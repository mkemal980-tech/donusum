import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { loadCampaignDashboard } from "@/lib/organization-campaign";

export const dynamic = "force-dynamic";

const escapeCsv = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRow = (values: unknown[]) => values.map(escapeCsv).join(",");

export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const result = await loadCampaignDashboard(
      params.campaignId,
      auth.userId,
      auth.user.role
    );
    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json({ error: "Bu kampanyayı dışa aktarma yetkiniz yok" }, { status: 403 });
    }

    const lines = [
      csvRow(["Kampanya", result.campaign.name]),
      csvRow(["Anket", result.campaign.survey.name]),
      csvRow(["Kuruluş", result.campaign.tenantUnit.name]),
      csvRow(["Gizlilik", result.campaign.privacyMode === "ANONYMOUS" ? "Anonim" : "İsimli"]),
      csvRow(["Hedef üye", result.participation.total]),
      csvRow(["Gönderilen", result.participation.submitted]),
      csvRow(["Devam eden", result.participation.inProgress]),
      csvRow(["Başlamayan", result.participation.notStarted]),
      csvRow(["Katılım oranı", `${result.participation.completionRate}%`]),
      "",
    ];

    if (!result.results.visible) {
      lines.push(
        csvRow([
          "Sonuçlar gizli",
          `Anonim sonuçlar en az ${result.results.requiredCohortSize} gönderimden sonra açılır.`,
        ])
      );
    } else {
      lines.push(
        csvRow(["Ortalama puan", result.results.averagePercentage === null ? "" : `${result.results.averagePercentage}%`]),
        csvRow(["Medyan puan", result.results.medianPercentage === null ? "" : `${result.results.medianPercentage}%`]),
        csvRow(["Olgunluk", result.results.maturityLevel]),
        "",
        csvRow(["Kategori", "Ortalama", "En iyi", "En düşük", "Değerlendirme"]),
        ...result.results.categories.map((category) =>
          csvRow([
            category.name,
            category.average === null ? "" : `${category.average}%`,
            category.best === null ? "" : `${category.best}%`,
            category.lowest === null ? "" : `${category.lowest}%`,
            category.assessmentCount,
          ])
        )
      );
    }

    if (result.campaign.privacyMode === "IDENTIFIED") {
      lines.push(
        "",
        csvRow([
          "Üye kuruluş",
          "Durum",
          "İlerleme",
          "Sonuç",
          "Olgunluk",
          "Gönderim tarihi",
        ]),
        ...result.members.map((member) =>
          csvRow([
            member.memberName,
            member.status,
            `${member.answeredQuestions}/${member.totalQuestions} (%${member.completionPercentage})`,
            member.resultPercentage === null ? "" : `${member.resultPercentage}%`,
            member.maturityLevel,
            member.submittedAt ? new Date(member.submittedAt).toLocaleDateString("tr-TR") : "",
          ])
        )
      );
    }

    const slug = result.campaign.name
      .toLocaleLowerCase("tr-TR")
      .replace(/[^a-z0-9çğıöşü]+/gi, "-")
      .replace(/^-|-$/g, "") || "kampanya";

    return new NextResponse(`\uFEFF${lines.join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-uye-sonuclari.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Campaign export error:", error);
    return NextResponse.json({ error: "Rapor oluşturulamadı" }, { status: 500 });
  }
}
