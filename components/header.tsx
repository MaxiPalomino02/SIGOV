import Link from "next/link";
import { Siren } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { EstadoConexion } from "@/components/estado-conexion";
import { MenuUsuario } from "@/components/menu-usuario";
import { getSession } from "@/lib/session";
import { isCargo, isOficial } from "@/lib/cargos";
import { IsotipoSigov } from "@/components/marca";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";

export async function Header({ avisosNoLeidos = 0 }: { avisosNoLeidos?: number }) {
  const session = await getSession();
  const cargo = session && isCargo(session.cargo) ? session.cargo : null;

  return (
    <header className="glass-header no-print sticky top-0 z-30">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/inicio"
            aria-label={`Ir al inicio de ${PRODUCTO.nombre}`}
            className="group flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface p-1 transition-colors group-hover:border-fire/40 sm:h-11 sm:w-11">
              <IsotipoSigov size={30} priority alt="" />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-fire">
                {PRODUCTO.nombre}
              </span>
              <span className="heading-display block truncate text-[17px] leading-tight text-ink sm:text-lg">
                {CUARTEL.nombre}
              </span>
              <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted md:block">
                {CUARTEL.localidad} · {CUARTEL.provincia}
              </span>
            </span>
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full bg-ok-light px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-ok ring-1 ring-ok/20 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" aria-hidden />
            Operativo
          </span>
        </div>

        {session ? (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <EstadoConexion />

            {isOficial(session.cargo) ? (
              <Link
                href="/alarma"
                aria-label="Alarma del cuartel"
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-fire px-3 font-mono text-[12px] font-semibold uppercase tracking-wider text-surface shadow-[0_1px_3px_rgba(200,16,46,0.25)] transition-colors hover:bg-fire-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft active:scale-[0.98]"
              >
                <Siren className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Alarma</span>
              </Link>
            ) : null}

            <MenuUsuario
              nombre={session.nombre_completo}
              cargo={cargo}
              legajo={session.numero_ingreso}
            />
          </div>
        ) : null}
      </div>

      {session ? (
        <div className="hidden border-t border-line bg-surface/80 lg:block">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
            <AppNav oficial={isOficial(session.cargo)} avisosNoLeidos={avisosNoLeidos} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
