import { Suspense } from "react";
import { redirectUnitMemberToDashboard } from "@/lib/dashboard-redirect";
import RecommendationsClient from "./_components/recommendations-client";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  await redirectUnitMemberToDashboard("recommendations");
  return (
    <Suspense fallback={<main id="icerik" className="p-6"><div className="skeleton h-[420px]" /></main>}>
      <RecommendationsClient />
    </Suspense>
  );
}
