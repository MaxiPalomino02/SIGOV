"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  Home,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { IsotipoSigov } from "@/components/marca";
import { UserMenu, type SesionUI } from "@/components/user-menu";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";

export type ItemNav = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export type GrupoNav = {
  titulo: string;
  items: ItemNav[];
};

function conBadge(item: ItemNav, valor: number): ItemNav {
  return valor > 0 ? { ...item, badge: valor } : item;
}

export function esActivoRuta(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function itemsPrincipales(avisosNoLeidos: number, tareasPendientes = 0): ItemNav[] {
  return [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/guardias", label: "Guardias", icon: Calendar },
    conBadge({ href: "/tareas", label: "Tareas", icon: ClipboardList }, tareasPendientes),
    conBadge({ href: "/avisos", label: "Avisos", icon: Bell }, avisosNoLeidos),
  ];
}

export function gruposNav(
  oficial: boolean,
  avisosNoLeidos: number,
  tareasPendientes = 0,
): GrupoNav[] {
  return [
    { titulo: "Principal", items: itemsPrincipales(avisosNoLeidos, tareasPendientes) },
    {
      titulo: "Cuartel",
      items: [
        { href: "/calendario", label: "Calendario", icon: CalendarDays },
        { href: "/alertas", label: "Alertas", icon: TriangleAlert },
        { href: "/historial", label: "Historial", icon: History },
      ],
    },
    {
      titulo: "Registro",
      items: [
        { href: "/incidentes", label: "Incidentes", icon: ClipboardList },
        { href: "/equipamiento", label: "Equipamiento", icon: Wrench },
        { href: "/chequeo", label: "Chequeo", icon: ClipboardCheck },
        { href: "/prevencion", label: "Prevención", icon: ShieldCheck },
      ],
    },
    {
      titulo: "Conocimiento",
      items: [
        { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
        { href: "/reportes", label: "Reportes", icon: FileText },
      ],
    },
    ...(oficial
      ? [{ titulo: "Administración", items: [{ href: "/admin", label: "Administración", icon: ShieldAlert }] }]
      : []),
  ];
}

function BadgeNumero({ valor }: { valor: number }) {
  if (valor <= 0) return null;
  return (
    <span
      className="num rounded-full bg-red px-1.5 py-0.5 text-[12px] font-semibold text-surface"
      aria-label={`${valor} no leídos`}
    >
      {valor}
    </span>
  );
}

export function BotonAlarma() {
  return (
    <Link
      href="/alarma"
      aria-label="Alarma del cuartel"
      className="tap inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-red px-4 text-[15px] font-semibold text-surface transition-colors duration-200 hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
    >
      <Siren size={22} strokeWidth={1.75} aria-hidden />
      <span>Alarma</span>
    </Link>
  );
}

export function Sidebar({
  sesion,
  oficial,
  avisosNoLeidos,
  tareasPendientes = 0,
}: {
  sesion: SesionUI;
  oficial: boolean;
  avisosNoLeidos: number;
  tareasPendientes?: number;
}) {
  const pathname = usePathname();
  const grupos = gruposNav(oficial, avisosNoLeidos, tareasPendientes);

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-separator bg-surface lg:flex">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-separator px-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-2">
          <IsotipoSigov size={40} priority alt="" />
        </span>
        <span className="min-w-0">
          <span className="block text-[17px] font-bold leading-tight text-label">{PRODUCTO.nombre}</span>
          <span className="block truncate text-[13px] leading-tight text-label-2">{CUARTEL.nombre}</span>
        </span>
      </div>

      <nav aria-label="Secciones del cuartel" className="flex-1 overflow-y-auto px-3 py-5">
        {grupos.map((grupo) => (
          <section key={grupo.titulo} className="mb-6">
            <h2 className="mb-2 px-3 text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">
              {grupo.titulo}
            </h2>
            <div className="space-y-1">
              {grupo.items.map((item) => {
                const Icono = item.icon;
                const activo = esActivoRuta(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={activo ? "page" : undefined}
                    className={`tap flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                      activo ? "bg-red-tint text-red" : "text-label hover:bg-surface-2"
                    }`}
                  >
                    <Icono size={22} strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined ? <BadgeNumero valor={item.badge} /> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="shrink-0 border-t border-separator p-3">
        <UserMenu sesion={sesion} menuArriba />
      </div>
    </aside>
  );
}
