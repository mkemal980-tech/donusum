import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import SurveyPreviewClient from "./_components/survey-preview-client";

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

  if (!session) {
    redirect(`/login?callbackUrl=/survey-preview/${params.surveyId}`);
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <SurveyPreviewClient surveyId={params.surveyId} />;
}
