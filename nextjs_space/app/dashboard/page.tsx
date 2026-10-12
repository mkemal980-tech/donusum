import { Suspense } from "react";
import DashboardHome, { DashboardLoading } from "./_components/dashboard-home";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardHome />
    </Suspense>
  );
}
