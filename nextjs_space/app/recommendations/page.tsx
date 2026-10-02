import { Suspense } from "react";
import RecommendationsClient from "./_components/recommendations-client";

export default async function RecommendationsPage() {
  return (
    <Suspense fallback={<main id="icerik" className="p-6"><div className="skeleton h-[420px]" /></main>}>
      <RecommendationsClient />
    </Suspense>
  );
}
