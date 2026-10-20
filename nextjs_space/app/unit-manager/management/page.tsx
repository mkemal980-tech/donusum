import { Suspense } from "react";
import UnitManagementDashboard from "@/components/unit-management-dashboard";
import { AssessmentDashboardLoading as UnitDashboardLoading } from "@/components/assessment-dashboard";
export default function Page() {
  return <Suspense fallback={<UnitDashboardLoading />}><UnitManagementDashboard /></Suspense>;
}
