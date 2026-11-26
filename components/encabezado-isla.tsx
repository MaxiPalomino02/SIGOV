"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { House, LayoutGrid, MoreHorizontal, Siren, type LucideIcon } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";

export type TonoIsla = "ok" | "turno" | "alerta" | "alarma" | "neutro";

export type EstadoIsla = { tono: TonoIsla; texto: string };

export type AccionIsla = {
  icono: LucideIcon;
  etiqueta: string;
  onClick?: () => void;
  href?: string;
  principal?: boolean;
};

export type ProgresoIsla = { actual: number; total: number };

type EncabezadoIslaProps = {
  titulo: string;
  subtitulo?: string;
  estado?: EstadoIsla;
  acciones?: AccionIsla[];
  icono?: LucideIcon | "inicio";
  progreso?: ProgresoIsla;
  className?: string;
  children?: ReactNode;
};

const FONDOS: Record<TonoIsla, string> = {
  neutro:
    "radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-yellow) 14%, transparent), transparent 55%), linear-gradient(135deg, var(--color-surface) 0%, var(--color-red-tint) 100%)",
  turno:
    "radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-yellow) 14%, transparent), transparent 55%), linear-gradient(135deg, var(--color-surface) 0%, var(--color-yellow-tint) 100%)",
  ok: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-green-tint) 100%)",
  alerta: "linear-gradient(135deg, var(--color-surface) 0%, var(--color-yellow-tint) 100%)",
  alarma:
    "linear-gradient(135deg, var(--color-red) 0%, color-mix(in srgb, var(--color-red) 71%, black) 100%)",
};

const PUNTOS: Record<TonoIsla, string> = {
  neutro: "var(--color-label-3)",
  turno: "var(--color-yellow-ink)",
  ok: "var(--color-green-ink)",
  alerta: "var(--color-alerta-naranja)",
  alarma: "var(--color-yellow)",
};

function BotonAccion({ accion, compacta }: { accion: AccionIsla; compacta?: boolean }) {
  const Icono = accion.icono;
  const clases = `tap relative inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
    compacta
      ? "h-9 w-9 after:absolute after:-inset-1 after:content-['']"
      : "min-h-11 px-3 text-[15px] font-medium"
  } ${accion.principal ? "bg-red text-surface hover:bg-red-pressed" : "bg-surface-2 text-label-2 hover:bg-red-tint hover:text-red"}`;
  const contenido = (
    <>
      <Icono size={22} strokeWidth={1.75} aria-hidden />
      <span className={compacta ? "sr-only" : ""}>{accion.etiqueta}</span>
    </>
  );
  if (accion.href) {
    return (
      <Link href={accion.href} aria-label={accion.etiqueta} className={clases}>
        {contenido}
      </Link>
    );
  }
  return (
    <button type="button" onClick={accion.onClick} aria-label={accion.etiqueta} className={clases}>
      {contenido}
    </button>
  );
}

export function EncabezadoIsla({
  titulo,
  subtitulo,
  estado,
  acciones = [],
  icono: iconoProp = LayoutGrid,
  progreso,
  className = "",
  children,
}: EncabezadoIslaProps) {
  const sentinela = useRef<HTMLDivElement>(null);
  const isla = useRef<HTMLDivElement>(null);
  const [compacto, setCompacto] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [menu, setMenu] = useState(false);
  const [viva, setViva] = useState<EstadoIsla | null>(null);

  useEffect(() => {
    let oculto: HTMLElement | null = null;
    const detectar = () => {
      const alarma = document.querySelector<HTMLElement>('a[aria-label^="Alarma activa:"]');
      const alerta = document.querySelector<HTMLElement>('a[href="/alertas"][aria-label$="Ver alertas"]');
      const elegida = alarma ?? alerta;
      if (!elegida || elegida.hidden) return;
      const texto = (elegida.getAttribute("aria-label") ?? "").replace(/\. (?:Responder|Ver alertas)$/, "");
      const nuevo: EstadoIsla = { tono: alarma ? "alarma" : "alerta", texto };
      setViva((actual) => (actual?.texto === texto && actual.tono === nuevo.tono ? actual : nuevo));
      if (oculto && oculto !== elegida) oculto.hidden = false;
      elegida.hidden = true;
      oculto = elegida;
    };
    detectar();
    const observador = new MutationObserver(detectar);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      if (oculto) oculto.hidden = false;
    };
  }, []);

  useEffect(() => {
    const nodo = sentinela.current;
    if (!nodo) return;
    const expander = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setCompacto(false);
          setAbierta(false);
        }
      },
      { rootMargin: "12px 0px 0px 0px" }
    );
    const compactar = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) {
          setCompacto(true);
          setAbierta(false);
          setMenu(false);
        }
      },
      { rootMargin: "40px 0px 0px 0px" }
    );
    expander.observe(nodo);
    compactar.observe(nodo);
    return () => {
      expander.disconnect();
      compactar.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (evento: PointerEvent) => {
      if (!isla.current?.contains(evento.target as Node)) setAbierta(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierta(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierta]);

  const IconoSeccion = iconoProp === "inicio" ? House : iconoProp;
  const estadoEfectivo = viva ?? estado;
  const tono = estadoEfectivo?.tono ?? "neutro";
  const oscura = tono === "alarma";
  const principal = acciones.find((accion) => accion.principal) ?? acciones[0];
  const resto = acciones.filter((accion) => accion !== principal);
  const textoEstado = estadoEfectivo?.texto ?? "";
  const compactaVisible = compacto && !abierta;

  return (
    <>
      <div ref={sentinela} aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" />
      <header
        className={`no-print pointer-events-none sticky z-40 mx-auto w-full max-w-[1100px] px-4 lg:px-8 ${className}`}
        style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
      >
        <div
          ref={isla}
          className={`pointer-events-auto relative mx-auto overflow-hidden border-[0.5px] border-separator shadow-[0_6px_22px_rgba(0,0,0,.10)] backdrop-blur-[20px] backdrop-saturate-[160%] motion-reduce:transition-none ${
            compactaVisible ? "h-11 w-fit rounded-full px-2" : "w-full rounded-[28px] px-4 py-3 sm:px-5"
          } ${oscura ? "text-surface" : "text-label"}`}
          style={{
            backgroundImage: FONDOS[tono],
            backgroundColor: oscura ? "var(--color-red)" : "var(--color-surface)",
            transitionProperty: "width, height, border-radius, padding",
            transitionDuration: "420ms",
            transitionTimingFunction: "cubic-bezier(.34,1.3,.64,1)",
          }}
        >
          <div
            aria-hidden={compactaVisible}
            className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(.34,1.3,.64,1)] motion-reduce:transition-none ${
              compactaVisible ? "pointer-events-none" : ""
            }`}
            style={{ gridTemplateRows: compactaVisible ? "0fr" : "1fr", opacity: compactaVisible ? 0 : 1 }}
          >
            <div className="overflow-hidden">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[28px] font-bold leading-none">{titulo}</h1>
                  {subtitulo ? <p className="mt-1 truncate text-[13px] opacity-70">{subtitulo}</p> : null}
                </div>
                {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
                <div className="flex shrink-0 items-center gap-2">
                  {acciones.map((accion) => (
                    <BotonAccion key={accion.etiqueta} accion={accion} />
                  ))}
                </div>
              </div>
              <div
                className="grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(.34,1.3,.64,1)] motion-reduce:transition-none"
                style={{ gridTemplateRows: compactaVisible ? "0fr" : "1fr", opacity: compactaVisible ? 0 : 1 }}
              >
                <div className="overflow-hidden">
                  {textoEstado ? (
                    <div className="flex items-center gap-2 pt-2">
                      {tono === "alarma" ? (
                        <Siren size={16} strokeWidth={1.75} className="shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PUNTOS[tono] }} aria-hidden />
                      )}
                      <span className="truncate text-[15px]">{textoEstado}</span>
                    </div>
                  ) : null}
                  {progreso ? (
                    <div
                      className="mt-2 flex gap-1.5"
                      role="progressbar"
                      aria-label={`Paso ${progreso.actual} de ${progreso.total}`}
                      aria-valuemin={1}
                      aria-valuemax={progreso.total}
                      aria-valuenow={progreso.actual}
                    >
                      {Array.from({ length: progreso.total }, (_, i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full ${i < progreso.actual ? "bg-red" : "bg-separator"}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {compactaVisible ? (
            <div className="absolute inset-0 flex h-11 items-center gap-1.5">
              <button
                type="button"
                aria-expanded={abierta}
                aria-label={`${titulo}. ${textoEstado}. Mostrar detalles`}
                onClick={() => setAbierta(true)}
                className="tap flex h-11 min-w-0 items-center gap-2 rounded-full px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
              >
                <IconoSeccion size={22} strokeWidth={1.75} className="shrink-0" aria-hidden />
                <span className="max-w-[42vw] truncate text-[17px] font-semibold">{titulo}</span>
                {tono === "alarma" ? (
                  <Siren size={16} strokeWidth={1.75} className="shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PUNTOS[tono] }} aria-hidden />
                )}
              </button>
              {principal ? <BotonAccion accion={principal} compacta /> : null}
              {resto.length ? (
                <>
                  <button
                    type="button"
                    aria-label="Más acciones"
                    aria-expanded={menu}
                    onClick={() => setMenu(true)}
                    className="tap relative flex h-9 w-9 items-center justify-center rounded-full after:absolute after:-inset-1 after:content-['']"
                  >
                    <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden />
                  </button>
                  <Hoja open={menu} onClose={() => setMenu(false)} title={titulo}>
                    <div className="space-y-2">
                      {resto.map((accion) => (
                        <BotonAccion key={accion.etiqueta} accion={accion} />
                      ))}
                    </div>
                  </Hoja>
                </>
              ) : null}
              {children}
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}
