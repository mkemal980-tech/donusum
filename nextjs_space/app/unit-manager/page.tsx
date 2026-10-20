import { Suspense } from "react";
import AssessmentDashboard, { AssessmentDashboardLoading } from "@/components/assessment-dashboard";

export default function UnitManagerPage() {
  return <Suspense fallback={<AssessmentDashboardLoading />}><AssessmentDashboard title="Birim takibi" managersOnly /></Suspense>;
}
