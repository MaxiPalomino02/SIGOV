import { DashboardCard } from "@/components/ui/dashboard-card";
import { QuickAction } from "@/components/ui/quick-action";
import { SectionHeading } from "@/components/ui/section-heading";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="no-print">
        <SectionHeading loading titulo="Reportes" />
        <div className="mt-5">
          <DashboardCard loading titulo="Rango de fechas" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction loading />
          <QuickAction loading />
          <QuickAction loading />
          <QuickAction loading />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <DashboardCard loading titulo="Incidentes por tipo" />
          <DashboardCard loading titulo="Incidentes por mes" />
          <DashboardCard loading titulo="Horas de guardia por bombero" />
          <DashboardCard loading titulo="Cobertura de franjas" />
          <DashboardCard loading titulo="Chequeos con fallas" />
          <DashboardCard loading titulo="Tareas cumplidas" />
        </div>
      </div>
    </div>
  );
}
