import { Suspense } from "react";
import UnitManagementDashboard from "@/components/unit-management-dashboard";
import { UnitDashboardLoading } from "@/components/unit-manager-dashboard";
export default function Page() {
  return <Suspense fallback={<UnitDashboardLoading />}><UnitManagementDashboard /></Suspense>;
}
