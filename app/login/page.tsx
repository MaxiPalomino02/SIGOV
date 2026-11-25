import type { Metadata } from "next";
import { createSupabaseClient } from "@/lib/supabase";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import { EscudoCuartel, IsotipoSigov, LogoSigov } from "@/components/marca";
import { PieInstitucional } from "@/components/pie-institucional";
import { LoginForm } from "./login-form";
import { RosterList, type RosterBombero } from "./roster-list";

export const metadata: Metadata = {
  title: `Acceso | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let bomberos: RosterBombero[] = [];

  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("bomberos")
      .select("numero_ingreso, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo", { ascending: true });
    bomberos = (data ?? []).filter(
      (bombero): bombero is RosterBombero =>
        typeof bombero.numero_ingreso === "number" &&
        typeof bombero.nombre_completo === "string"
    );
  } catch (err) {
    console.error("No se pudo cargar el padrÃ³n:", err);
  }

  return (
    <div className="fondo-marca relative flex min-h-screen flex-col overflow-x-hidden bg-bg text-ink">
      {/* â”€â”€ Zona superior: isotipo + SIGOV â”€â”€ */}
      <header className="relative z-10 border-b border-line/70 bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg/70 p-1.5">
              <IsotipoSigov size={34} priority />
            </span>
            <div>
              <p className="heading-display text-lg leading-none tracking-[0.18em] text-ink">
                SIGOV
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                {PRODUCTO.nombre}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-4 sm:flex">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Cuartel {CUARTEL.nombreCorto} | {CUARTEL.provincia}
              </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 sm:px-8 lg:py-12">
        <div className="grid w-full gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
          {/* â”€â”€ Marca institucional â”€â”€ */}
          <div className="animate-slide-up lg:col-span-6">
            <div className="flex items-center gap-4">
              <div className="flex min-h-16 min-w-16 items-center justify-center rounded-2xl border border-line bg-bg/60 p-2.5 shadow-[0_0_32px_rgba(198,40,40,0.18)] sm:min-h-20 sm:min-w-20">
                <LogoSigov variante="principal" width={220} height={80} priority className="max-h-16 sm:max-h-20" />
              </div>
              <div className="min-w-0">
                <p className="heading-display text-4xl leading-none tracking-[0.18em] text-ink sm:text-5xl">
                  {PRODUCTO.nombre}
                </p>
                <p className="mt-2 max-w-sm font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-ink-muted sm:text-[12px]">
                  {PRODUCTO.nombreCompleto}
                </p>
              </div>
            </div>

            <div className="mt-8 border-l-2 border-fire pl-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-fire-soft">
                InstalaciÃ³n institucional
              </p>
              <h1 className="heading-display mt-1 text-2xl leading-tight text-ink sm:text-3xl">
                {CUARTEL.nombre}
              </h1>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                {CUARTEL.localidad} Â· {CUARTEL.provincia}
              </p>
            </div>

            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink-muted">
              Plataforma de gestiÃ³n operativa para cuarteles de bomberos
              voluntarios. Las guardias, el personal y las novedades del cuartel
              en un solo lugar.
            </p>

            <div className="mt-6 grid gap-3 sm:max-w-lg sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface/70 p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  Servicio
                </p>
                <p className="heading-display mt-1 text-lg text-ink">24 / 7</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Cuatro franjas diarias.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface/70 p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  Acceso
                </p>
                <p className="heading-display mt-1 text-lg text-ink">Por legajo</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Sin contraseÃ±a. Control de cupos.
                </p>
              </div>
            </div>
          </div>

          {/* â”€â”€ Panel de acceso â”€â”€ */}
          <div className="flex animate-fade-in justify-center lg:col-span-6 lg:justify-end">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface/95 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
              <div
                aria-hidden
                className="h-[3px] w-full bg-gradient-to-r from-transparent via-fire to-transparent"
              />

              <div className="p-6 sm:p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <span
                      aria-hidden
                      className="absolute -inset-4 rounded-full bg-fire/20 blur-2xl"
                    />
                    <span className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-line bg-bg/80 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                      <LogoSigov variante="principal" width={180} height={80} priority />
                    </span>
                  </div>

                  <p className="heading-display mt-4 text-2xl leading-none tracking-[0.18em] text-ink">
                    {PRODUCTO.nombre}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-ink-muted">
                    {PRODUCTO.nombreCompleto}
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <EscudoCuartel nombre={CUARTEL.nombre} size={22} />
                    <span className="text-[13px] font-semibold text-ink">
                      {CUARTEL.nombre}
                    </span>
                  </div>

                  <div
                    aria-hidden
                    className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-fire/70 to-transparent"
                  />

                  <h2 className="heading-display mt-4 text-lg tracking-wider text-ink">
                    Acceso de personal
                  </h2>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                    IngresÃ¡ tu nÃºmero de legajo
                  </p>
                </div>

                <div className="mt-5">
                  <LoginForm />
                </div>

                <div className="mt-5">
                  <RosterList bomberos={bomberos} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* â”€â”€ Zona inferior: lÃ­nea roja + logos/leyenda institucional â”€â”€ */}
      <div className="relative z-10">
        <PieInstitucional className="bg-bg/85 backdrop-blur-md" />
      </div>
    </div>
  );
}

