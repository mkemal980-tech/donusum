import { Suspense } from "react";
import { redirectUnitMemberToDashboard } from "@/lib/dashboard-redirect";
import RoadmapClient from "./_components/roadmap-client";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  await redirectUnitMemberToDashboard("roadmap");
  return (
    <Suspense fallback={<main id="icerik" className="p-6"><div className="skeleton h-[420px]" /></main>}>
      <RoadmapClient />
    </Suspense>
  );
}
