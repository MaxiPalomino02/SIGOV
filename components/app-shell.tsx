"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { PieInstitucional } from "@/components/pie-institucional";
import { Sidebar } from "@/components/sidebar";
import type { SesionUI } from "@/components/user-menu";

type AppShellProps = {
  sesion: SesionUI | null;
  oficial: boolean;
  avisosNoLeidos: number;
  tareasPendientes?: number;
  children: ReactNode;
};

export function AppShell({
  sesion,
  oficial,
  avisosNoLeidos,
  tareasPendientes = 0,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-label">
      {sesion ? (
        <Sidebar
          sesion={sesion}
          oficial={oficial}
          avisosNoLeidos={avisosNoLeidos}
          tareasPendientes={tareasPendientes}
        />
      ) : null}

      <div className="min-h-screen lg:pl-[260px]">
        {sesion ? <main className="mx-auto w-full max-w-[1100px] px-4 pb-28 pt-4 lg:px-8 lg:pb-16 lg:pt-8">{children}</main> : null}
        {!sesion ? children : null}
        <PieInstitucional />
      </div>

      {sesion ? (
        <BottomNav
          sesion={sesion}
          oficial={oficial}
          avisosNoLeidos={avisosNoLeidos}
          tareasPendientes={tareasPendientes}
        />
      ) : null}
    </div>
  );
}
