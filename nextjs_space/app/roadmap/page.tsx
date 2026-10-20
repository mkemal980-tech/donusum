import { Suspense } from "react";
import { redirectToDashboardTab } from "@/lib/dashboard-redirect";
import RoadmapClient from "./_components/roadmap-client";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  await redirectToDashboardTab("roadmap");
  return (
    <Suspense fallback={<main id="icerik" className="p-6"><div className="skeleton h-[420px]" /></main>}>
      <RoadmapClient />
    </Suspense>
  );
}
