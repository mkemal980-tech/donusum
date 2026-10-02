import { Suspense } from "react";
import RoadmapClient from "./_components/roadmap-client";

export default async function RoadmapPage() {
  return (
    <Suspense fallback={<main id="icerik" className="p-6"><div className="skeleton h-[420px]" /></main>}>
      <RoadmapClient />
    </Suspense>
  );
}
