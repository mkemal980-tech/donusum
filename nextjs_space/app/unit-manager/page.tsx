import { Suspense } from "react";
import UnitManagerDashboard, { UnitDashboardLoading } from "@/components/unit-manager-dashboard";

export default function UnitManagerPage() {
  return <Suspense fallback={<UnitDashboardLoading />}><UnitManagerDashboard /></Suspense>;
}
