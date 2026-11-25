"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";
import { UserMenu, type SesionUI } from "@/components/user-menu";
import { esActivoRuta, gruposNav, itemsPrincipales } from "@/components/sidebar";

function BadgeNumero({ valor }: { valor: number }) {
  if (valor <= 0) return null;
  return (
    <span
      className="num absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold text-surface"
      aria-label={`${valor} no leídos`}
    >
      {valor}
    </span>
  );
}

export function BottomNav({
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
  const [masAbierto, setMasAbierto] = useState(false);
  const tabs = itemsPrincipales(avisosNoLeidos, tareasPendientes);
  const grupos = gruposNav(oficial, avisosNoLeidos, tareasPendientes);
  const masActivo = grupos
    .flatMap((grupo) => grupo.items)
    .some((item) => esActivoRuta(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="no-print glass fixed inset-x-0 bottom-0 z-40 border-t border-separator lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
          {tabs.map((item) => {
            const Icono = item.icon;
            const activo = esActivoRuta(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={`tap flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                  activo ? "text-red" : "text-label-2"
                }`}
              >
                <span className="relative">
                  <Icono size={24} strokeWidth={1.75} aria-hidden />
                  {item.badge !== undefined ? <BadgeNumero valor={item.badge} /> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={masAbierto}
            onClick={() => setMasAbierto(true)}
            className={`tap flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
              masActivo ? "text-red" : "text-label-2"
            }`}
          >
            <Menu size={24} strokeWidth={1.75} aria-hidden />
            <span>Más</span>
          </button>
        </div>
      </nav>

      <Hoja open={masAbierto} onClose={() => setMasAbierto(false)} title="Más">
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <section key={grupo.titulo}>
              <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[.3px] text-label-2">
                {grupo.titulo}
              </h2>
              <div className="grupo">
                {grupo.items.map((item) => {
                  const Icono = item.icon;
                  const activo = esActivoRuta(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={activo ? "page" : undefined}
                      onClick={() => setMasAbierto(false)}
                      className={`fila tap flex items-center gap-3 px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red ${
                        activo ? "bg-red-tint text-red" : "text-label"
                      }`}
                    >
                      <Icono size={22} strokeWidth={1.75} className="shrink-0 text-label-2" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 ? (
                        <span className="num rounded-full bg-red px-1.5 py-0.5 text-[12px] font-semibold text-surface">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="border-t border-separator pt-4">
            <UserMenu sesion={sesion} />
          </section>
        </div>
      </Hoja>
    </>
  );
}
