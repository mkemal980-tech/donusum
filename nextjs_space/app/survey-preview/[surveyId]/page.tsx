import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import SurveyPreviewClient from "./_components/survey-preview-client";
import { canReadSurveyTemplate } from "@/lib/survey-management";

export const dynamic = "force-dynamic";

/**
 * Anketin yönetici önizlemesi.
 *
 * Bilerek /admin altında değil: kullanıcının gördüğü ekranı birebir
 * göstermesi gerektiği için yönetim panelinin kenar çubuğunu ve
 * genişlik kısıtını almamalı.
 */
export default async function SurveyPreviewPage({ params }: { params: { surveyId: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session) {
    redirect(`/login?callbackUrl=/survey-preview/${params.surveyId}`);
  }
  if (
    !userId ||
    (role !== "ADMIN" && role !== "UNIT_MANAGER") ||
    !(await canReadSurveyTemplate(userId, role, params.surveyId))
  ) {
    redirect("/dashboard");
  }

  return <SurveyPreviewClient surveyId={params.surveyId} />;
}
