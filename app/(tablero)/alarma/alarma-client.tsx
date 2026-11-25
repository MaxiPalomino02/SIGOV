"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Bug, ChevronRight, Flame, LifeBuoy, Megaphone, Siren, Waves, XOctagon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { TIPOS_ALARMA_LISTA, etiquetaAlarma, type TipoAlarma } from "@/lib/alarma";
import { IndicadorSonidoAlarma } from "@/components/alarma-sonido";
import { activarAlarma, cerrarAlarma } from "./actions";

export type AlarmaActivaVista = {
  id: string;
  tipo: string;
  detalle: string | null;
  es_simulacro: boolean;
  activada_en: string;
  activa: boolean;
} | null;

export type RespuestaVista = {
  bombero_id: string;
  nombre: string;
  respuesta: "recibido" | "voy" | "no_puedo";
  respondido_en: string;
};

export type AlarmaHistorial = {
  id: string;
  tipo: string;
  detalle: string | null;
  es_simulacro: boolean;
  activada_en: string;
  activa: boolean;
  cerrada_en: string | null;
};

export type BomberoActivo = { id: string; nombre_completo: string };

function fmtHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function HoldButton({
  onConfirm,
  disabled,
  label,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label: string;
}) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const done = useRef(false);

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    startRef.current = null;
    if (!done.current) setProgress(0);
  };

  const start = () => {
    if (disabled) return;
    done.current = false;
    startRef.current = Date.now();
    timer.current = window.setInterval(() => {
      if (!startRef.current) return;
      const p = Math.min(1, (Date.now() - startRef.current) / 2000);
      setProgress(p);
      if (p >= 1) {
        done.current = true;
        stop();
        onConfirm();
        setTimeout(() => setProgress(0), 300);
      }
    }, 30);
  };

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] -rotate-90 text-red"
        aria-hidden
      >
        <rect x="1" y="1" width="98" height="98" rx="20" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <rect x="1" y="1" width="98" height="98" rx="20" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} strokeLinecap="round" />
      </svg>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        className="tap relative flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-red px-6 text-[17px] font-bold text-surface disabled:opacity-50"
        aria-label={`${label} (mantené apretado 2 segundos)`}
      >
        <Siren size={22} strokeWidth={1.75} aria-hidden />
        {label}
      </button>
    </div>
  );
}

export function AlarmaClient({
  activaInicial,
  respuestasInicial,
  ultimasInicial,
  activos,
}: {
  activaInicial: AlarmaActivaVista;
  respuestasInicial: RespuestaVista[];
  ultimasInicial: AlarmaHistorial[];
  activos: BomberoActivo[];
}) {
  const [activa, setActiva] = useState<AlarmaActivaVista>(activaInicial);
  const [respuestas, setRespuestas] = useState<RespuestaVista[]>(respuestasInicial);
  const [ultimas, setUltimas] = useState<AlarmaHistorial[]>(ultimasInicial);
  const [tipo, setTipo] = useState<TipoAlarma>("incendio_estructural");
  const [detalle, setDetalle] = useState("");
  const [simulacro, setSimulacro] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [detalleSel, setDetalleSel] = useState<AlarmaHistorial | null>(null);
  const [respuestasSel, setRespuestasSel] = useState<RespuestaVista[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const abrirDetalle = async (a: AlarmaHistorial) => {
    setDetalleSel(a);
    setRespuestasSel([]);
    setCargandoDetalle(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: resp } = await supabase
        .from("alarma_respuestas")
        .select("alarma_id, bombero_id, respuesta, respondido_en, bombero:bomberos(nombre_completo)")
        .eq("alarma_id", a.id);
      setRespuestasSel(
        (resp ?? []).map((r: any) => ({
          bombero_id: r.bombero_id,
          nombre: r.bombero?.nombre_completo ?? "Bombero",
          respuesta: r.respuesta,
          respondido_en: r.respondido_en,
        }))
      );
    } catch {
      setRespuestasSel([]);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const refrescar = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: act } = await supabase
        .from("alarmas")
        .select("id, tipo, detalle, es_simulacro, activada_en, activa")
        .eq("activa", true)
        .order("activada_en", { ascending: false })
        .limit(1);
      const row = (act ?? [])[0] as any;
      let activaId: string | null = null;
      if (row) {
        const expirada = Date.now() - new Date(row.activada_en).getTime() > 6 * 60 * 60 * 1000;
        if (!expirada) {
          setActiva({ id: row.id, tipo: row.tipo, detalle: row.detalle, es_simulacro: !!row.es_simulacro, activada_en: row.activada_en, activa: true });
          activaId = row.id;
        } else {
          setActiva(null);
        }
      } else {
        setActiva(null);
      }

      if (activaId) {
        const { data: resp } = await supabase
          .from("alarma_respuestas")
          .select("alarma_id, bombero_id, respuesta, respondido_en, bombero:bomberos(nombre_completo)")
          .eq("alarma_id", activaId);
        setRespuestas(
          (resp ?? []).map((r: any) => ({
            bombero_id: r.bombero_id,
            nombre: r.bombero?.nombre_completo ?? "Bombero",
            respuesta: r.respuesta,
            respondido_en: r.respondido_en,
          }))
        );
      } else {
        setRespuestas([]);
      }

      const { data: hist } = await supabase
        .from("alarmas")
        .select("id, tipo, detalle, es_simulacro, activada_en, activa, cerrada_en")
        .order("activada_en", { ascending: false })
        .limit(10);
      if (hist) setUltimas(hist as any);
    } catch {}
  }, []);

  useEffect(() => {
    let chA: any = null;
    let chR: any = null;
    try {
      const supabase = createBrowserSupabaseClient();
      chA = supabase.channel("alarma-oficial-a").on("postgres_changes", { event: "*", schema: "public", table: "alarmas" }, () => void refrescar()).subscribe();
      chR = supabase.channel("alarma-oficial-r").on("postgres_changes", { event: "*", schema: "public", table: "alarma_respuestas" }, () => void refrescar()).subscribe();
    } catch {}
    const id = window.setInterval(() => void refrescar(), 15000);
    return () => {
      window.clearInterval(id);
      try { const s = createBrowserSupabaseClient(); if (chA) s.removeChannel(chA); if (chR) s.removeChannel(chR); } catch {}
    };
  }, [refrescar]);

  const onActivar = () => {
    setMensaje(null);
    startTransition(async () => {
      const res = await activarAlarma(tipo, detalle || null, simulacro);
      if (res.ok) {
        setConfirmar(false);
        setDetalle("");
        setSimulacro(false);
        setMensaje({ tipo: "ok", texto: "Alarma activada." });
        await refrescar();
      } else {
        setMensaje({ tipo: "error", texto: res.error });
      }
    });
  };

  const onCerrar = () => {
    if (!activa) return;
    setMensaje(null);
    startTransition(async () => {
      const res = await cerrarAlarma(activa.id);
      if (res.ok) {
        setMensaje({ tipo: "ok", texto: "Alarma cerrada." });
        await refrescar();
      } else {
        setMensaje({ tipo: "error", texto: res.error });
      }
    });
  };

  const porId = useMemo(() => new Map(respuestas.map((r) => [r.bombero_id, r])), [respuestas]);
  const recibido = activos.filter((b) => porId.get(b.id)?.respuesta === "recibido");
  const voy = activos.filter((b) => porId.get(b.id)?.respuesta === "voy");
  const noPuedo = activos.filter((b) => porId.get(b.id)?.respuesta === "no_puedo");
  const sinRespuesta = activos.filter((b) => !porId.has(b.id));

  return (
    <>
      <PageHeader titulo="Alarma" />

      <div className="no-print mx-auto w-full max-w-[1100px] space-y-6 px-4 pb-8 pt-4">
        {mensaje ? <AvisoLocal texto={mensaje.texto} tipo={mensaje.tipo} /> : null}

        <Grupo titulo="Sonido de alarma">
          <div className="px-4 py-3">
            <IndicadorSonidoAlarma />
          </div>
          <div className="border-t border-separator px-4 py-3">
            <p className="text-[15px] text-label-2">
              Con la app cerrada o el celular bloqueado la alarma depende de las notificaciones del sistema. Es una herramienta complementaria a la sirena y la radio.
            </p>
          </div>
        </Grupo>

        {activa ? (
          <Grupo titulo="Alarma activa">
            <div className="flex items-start justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[22px] font-bold text-label">{etiquetaAlarma(activa.tipo)}</span>
                  <ChipSimulacro es={activa.es_simulacro} />
                </div>
                <p className="num mt-1 text-[13px] text-label-2">{fmtHora(activa.activada_en)}</p>
                {activa.detalle ? <p className="mt-2 text-[15px] text-label">{activa.detalle}</p> : null}
              </div>
              <span className="shrink-0 rounded-full bg-red-tint px-3 py-1 text-[13px] font-semibold text-red">Activa</span>
            </div>

            <div className="border-t border-separator px-4 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Contador titulo="Recibido" nombres={recibido.map((b) => b.nombre_completo)} />
                <Contador titulo="Voy" nombres={voy.map((b) => b.nombre_completo)} destacado />
                <Contador titulo="No puedo" nombres={noPuedo.map((b) => b.nombre_completo)} />
                <Contador titulo="Sin respuesta" nombres={sinRespuesta.map((b) => b.nombre_completo)} />
              </div>
            </div>

            <div className="border-t border-separator px-4 py-4">
              <Button variant="danger" onClick={() => setConfirmarCierre(true)} disabled={isPending}>
                <XOctagon size={22} strokeWidth={1.75} aria-hidden /> Cerrar alarma
              </Button>
              <p className="num mt-2 text-[13px] text-label-2">Cierre automático a las 6 horas.</p>
            </div>
          </Grupo>
        ) : (
          <Grupo titulo="Activar alarma">
            <div className="px-4 py-4">
              <p className="mb-3 text-[13px] font-medium tracking-[.3px] text-label-2 uppercase">Tipo de alarma</p>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_ALARMA_LISTA.map((t) => {
                  const Icono = TIPO_ICONOS[t.value];
                  const sel = tipo === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => { setTipo(t.value); if (t.value === "simulacro") setSimulacro(true); }}
                      className={`tap flex min-h-[72px] items-center gap-3 rounded-[16px] px-4 text-left text-[15px] font-semibold transition-colors ${
                        sel ? "bg-red text-surface" : "bg-surface-2 text-label hover:bg-red-tint"
                      }`}
                    >
                      <Icono size={22} strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 leading-tight">{t.etiqueta}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-separator px-4 py-4">
              <Input
                label="Detalle (opcional)"
                placeholder="Dirección o punto de reunión"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                maxLength={300}
              />
              <Switch checked={simulacro} onChange={setSimulacro} etiqueta="Es un simulacro" />
              {simulacro ? (
                <p className="mt-2 rounded-[14px] bg-yellow-tint px-4 py-3 text-[15px] font-medium text-yellow-ink">
                  La alarma se va a enviar como simulacro.
                </p>
              ) : null}
            </div>

            <div className="border-t border-separator px-4 py-4">
              <HoldButton label="Activar alarma" disabled={isPending} onConfirm={() => setConfirmar(true)} />
            </div>
          </Grupo>
        )}

        <Grupo titulo="Últimas alarmas">
          {ultimas.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Siren size={28} strokeWidth={1.75} className="mx-auto text-label-3" aria-hidden />
              <p className="mt-2 text-[17px] text-label-2">Sin alarmas registradas</p>
              <p className="mt-1 text-[15px] text-label-2">Las activaciones aparecen acá.</p>
            </div>
          ) : (
            <ul>
              {ultimas.map((a) => {
                const Icono = TIPO_ICONOS[a.tipo as TipoAlarma] ?? Siren;
                return (
                  <li key={a.id} className="border-t border-separator first:border-t-0">
                    <button
                      type="button"
                      onClick={() => void abrirDetalle(a)}
                      className="tap flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-opacity"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-2 text-label-2">
                        <Icono size={22} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-medium text-label">{etiquetaAlarma(a.tipo)}</span>
                        <span className="num mt-0.5 block text-[13px] text-label-2">{fmtHora(a.activada_en)}</span>
                      </span>
                      <ChipSimulacro es={a.es_simulacro} />
                      <span className="num shrink-0 text-[13px] text-label-2">Respuestas: —</span>
                      <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 text-label-3" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Grupo>
      </div>

      <Hoja
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Confirmar activación de alarma"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button type="button" onClick={onActivar} disabled={isPending} className="w-full">
              Confirmar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmar(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="text-[17px] text-label">
          Vas a activar <strong>{etiquetaAlarma(tipo)} - {simulacro ? "Simulacro" : "Real"}</strong>.
        </p>
        {detalle ? <p className="mt-2 text-[15px] text-label-2">Detalle: {detalle}</p> : null}
        <p className="mt-2 text-[15px] text-label-2">Se notificará a los bomberos conectados.</p>
      </Hoja>

      <Hoja
        open={confirmarCierre}
        onClose={() => setConfirmarCierre(false)}
        title="Cerrar alarma"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmarCierre(false)} className="w-full">
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isPending}
              onClick={() => { setConfirmarCierre(false); onCerrar(); }}
              className="w-full"
            >
              Cerrar alarma
            </Button>
          </div>
        }
      >
        <p className="text-[17px] text-label">¿Cerrar la alarma activa? Va a pasar al historial.</p>
      </Hoja>

      <Hoja
        open={detalleSel !== null}
        onClose={() => setDetalleSel(null)}
        title={detalleSel ? `${etiquetaAlarma(detalleSel.tipo)} - ${detalleSel.es_simulacro ? "Simulacro" : "Real"}` : "Detalle de alarma"}
        footer={
          <Button type="button" variant="secondary" onClick={() => setDetalleSel(null)} className="w-full">
            Cerrar
          </Button>
        }
      >
        {detalleSel ? (
          <div className="space-y-4">
            <p className="num text-[13px] text-label-2">
              {fmtHora(detalleSel.activada_en)}
              {detalleSel.cerrada_en ? ` · Cerrada ${fmtHora(detalleSel.cerrada_en)}` : detalleSel.activa ? " · Activa" : ""}
            </p>
            <p className="text-[15px] text-label">{detalleSel.detalle || "Sin detalle."}</p>
            {cargandoDetalle ? (
              <p className="text-[15px] text-label-2">Cargando respuestas…</p>
            ) : (() => {
              const porIdSel = new Map(respuestasSel.map((r) => [r.bombero_id, r]));
              const rec = activos.filter((b) => porIdSel.get(b.id)?.respuesta === "recibido");
              const voyL = activos.filter((b) => porIdSel.get(b.id)?.respuesta === "voy");
              const noP = activos.filter((b) => porIdSel.get(b.id)?.respuesta === "no_puedo");
              const sin = activos.filter((b) => !porIdSel.has(b.id));
              return (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Contador titulo="Recibido" nombres={rec.map((b) => b.nombre_completo)} />
                  <Contador titulo="Voy" nombres={voyL.map((b) => b.nombre_completo)} destacado />
                  <Contador titulo="No puedo" nombres={noP.map((b) => b.nombre_completo)} />
                  <Contador titulo="Sin respuesta" nombres={sin.map((b) => b.nombre_completo)} />
                </div>
              );
            })()}
          </div>
        ) : null}
      </Hoja>
    </>
  );
}

const TIPO_ICONOS: Record<TipoAlarma, LucideIcon> = {
  incendio_estructural: Flame,
  incendio_forestal: Flame,
  rescate_vehicular: LifeBuoy,
  rescate: LifeBuoy,
  enjambre_abejas: Bug,
  inundacion: Waves,
  convocatoria_general: Megaphone,
  simulacro: Siren,
};

function AvisoLocal({ texto, tipo }: { texto: string; tipo: "ok" | "error" }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-[14px] px-4 py-3 text-[15px] ${tipo === "error" ? "bg-red-tint text-red" : "bg-green-tint text-green-ink"}`}
    >
      {texto}
    </p>
  );
}

function ChipSimulacro({ es }: { es: boolean }) {
  return es ? (
    <span className="shrink-0 rounded-full bg-yellow px-3 py-1 text-[13px] font-extrabold text-label">Simulacro</span>
  ) : (
    <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-label-2">Real</span>
  );
}

function Contador({
  titulo,
  nombres,
  destacado = false,
}: {
  titulo: string;
  nombres: string[];
  destacado?: boolean;
}) {
  return (
    <details className="group rounded-[14px] bg-surface-2">
      <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[13px] text-label-2">{titulo}</span>
          <span className={`num block text-[22px] font-bold ${destacado ? "text-red" : "text-label"}`}>{nombres.length}</span>
        </span>
        <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 text-label-3 transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="border-t border-separator px-3 py-2">
        {nombres.length === 0 ? (
          <p className="text-[13px] text-label-2">Nadie</p>
        ) : (
          <ul className="space-y-1">
            {nombres.map((n) => <li key={n} className="text-[13px] text-label">{n}</li>)}
          </ul>
        )}
      </div>
    </details>
  );
}
