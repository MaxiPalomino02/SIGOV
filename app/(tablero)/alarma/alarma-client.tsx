"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Siren, XOctagon } from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusPill } from "@/components/ui/status-pill";
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
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="relative inline-flex min-h-14 w-full select-none items-center justify-center overflow-hidden rounded-xl border border-fire/60 bg-fire px-6 text-[16px] font-bold uppercase tracking-wider text-ink shadow-[0_0_24px_rgba(198,40,40,0.3)] disabled:opacity-50"
      aria-label={`${label} (mantené apretado 2 segundos)`}
    >
      <span
        className="absolute inset-y-0 left-0 bg-fire-dark/60"
        style={{ width: `${Math.round(progress * 100)}%` }}
        aria-hidden
      />
      <span className="relative flex items-center gap-2">
        <Siren className="h-5 w-5" aria-hidden />
        {label}
      </span>
    </button>
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
    if (!confirm("¿Cerrar la alarma activa?")) return;
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
    <div className="pagina-alarma mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <SectionHeading
        titulo="Alarma"
        descripcion="Activación y seguimiento de la alarma del cuartel. Complementa, no reemplaza, la sirena y la radio."
      />

      {mensaje ? <Aviso variante={mensaje.tipo === "ok" ? "ok" : "error"}>{mensaje.texto}</Aviso> : null}

      <DashboardCard titulo="Sonido de alarma" descripcion="Activá el sonido en este dispositivo para recibir la alerta sonora.">
        <IndicadorSonidoAlarma />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          Con la app cerrada o el celular bloqueado la alarma depende de las notificaciones del sistema; no suena en modo silencio. Es una herramienta complementaria a la sirena y la radio.
        </p>
      </DashboardCard>

      {activa ? (
        <DashboardCard
          titulo="Alarma activa"
          descripcion={`${etiquetaAlarma(activa.tipo)} · ${fmtHora(activa.activada_en)}`}
          encabezadoAccion={<StatusPill estado="vencido" />}
        >
          {activa.es_simulacro ? (
            <div className="mb-3 rounded-lg border border-brass bg-brass-light px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-brass">
              Simulacro
            </div>
          ) : null}
          {activa.detalle ? <p className="mb-3 text-[15px] text-ink">{activa.detalle}</p> : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">Recibido</p><p className="font-mono text-lg font-bold text-ok">{recibido.length}</p></div>
            <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">Voy</p><p className="font-mono text-lg font-bold text-alarm">{voy.length}</p></div>
            <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">No puedo</p><p className="font-mono text-lg font-bold text-ink">{noPuedo.length}</p></div>
            <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">Sin respuesta</p><p className="font-mono text-lg font-bold text-ink-muted">{sinRespuesta.length}</p></div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Lista titulo="Recibido" nombres={recibido.map((b) => b.nombre_completo)} />
            <Lista titulo="Voy" nombres={voy.map((b) => b.nombre_completo)} />
            <Lista titulo="No puedo" nombres={noPuedo.map((b) => b.nombre_completo)} />
            <Lista titulo="Sin respuesta" nombres={sinRespuesta.map((b) => b.nombre_completo)} />
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={onCerrar}
              disabled={isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-50"
            >
              <XOctagon className="h-4 w-4" aria-hidden /> Cerrar alarma
            </button>
            <p className="mt-2 font-mono text-[13px] uppercase tracking-widest text-ink-secondary">Cierre automático a las 6 horas.</p>
          </div>
        </DashboardCard>
      ) : (
        <DashboardCard titulo="Activar alarma" descripcion="Elegí el tipo y mantené presionado el botón para activar. Una sola alarma activa a la vez.">
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-mono text-[13px] font-semibold uppercase tracking-widest text-ink-muted">Tipo de alarma</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TIPOS_ALARMA_LISTA.map((t) => {
                  const sel = tipo === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTipo(t.value); if (t.value === "simulacro") setSimulacro(true); }}
                      className={`min-h-14 rounded-xl border px-4 text-left text-[15px] font-semibold transition-colors ${
                        sel ? "border-fire bg-fire/15 text-ink" : "border-line bg-bg-subtle text-ink-muted hover:bg-surface-hover hover:text-ink"
                      }`}
                      aria-pressed={sel}
                    >
                      {t.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Detalle (opcional)"
              placeholder="Dirección o punto de reunión"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={300}
            />

            <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={simulacro}
                onChange={(e) => setSimulacro(e.target.checked)}
                className="h-5 w-5 rounded border-line bg-surface accent-brass"
              />
              Es un simulacro
            </label>

            <div className="rounded-lg border border-line-subtle bg-bg-subtle p-3 text-[13px] text-ink-muted">
              <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-alarm" aria-hidden />Mantené apretado 2 segundos para activar. Se pedirá confirmación antes de enviar.</p>
            </div>

            <HoldButton label="Mantener para activar alarma" disabled={isPending} onConfirm={() => setConfirmar(true)} />
          </div>
        </DashboardCard>
      )}

      <DashboardCard titulo="Últimas alarmas" descripcion="Registro reciente de activaciones (visible para oficiales). Tocá una alarma para ver el detalle y las respuestas.">
        {ultimas.length === 0 ? (
          <EstadoVacio icono="Siren" titulo="Sin alarmas registradas" texto="Las activaciones aparecerán acá." />
        ) : (
          <ul className="space-y-2">
            {ultimas.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => void abrirDetalle(a)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-line-subtle bg-bg-subtle px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">
                      {etiquetaAlarma(a.tipo)}{a.es_simulacro ? " (Simulacro)" : ""}
                    </p>
                    <p className="font-mono text-[13px] uppercase tracking-widest text-ink-secondary">
                      {fmtHora(a.activada_en)}{a.detalle ? ` · ${a.detalle}` : ""}
                    </p>
                  </div>
                  <StatusPill estado={a.activa ? "vencido" : "operativo"} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Confirmar activación de alarma"
        confirmLabel="Activar alarma"
        cancelLabel="Cancelar"
        onConfirm={onActivar}
        pending={isPending}
      >
        <p>Vas a activar: <strong>{etiquetaAlarma(tipo)}</strong>{simulacro ? " (Simulacro)" : ""}.</p>
        {detalle ? <p className="mt-1 text-ink-muted">Detalle: {detalle}</p> : null}
        <p className="mt-2 text-ink-muted">Se notificará a los bomberos conectados. Complementa, no reemplaza, la sirena y la radio.</p>
      </Modal>

      <Modal
        open={detalleSel !== null}
        onClose={() => setDetalleSel(null)}
        title={detalleSel ? `${etiquetaAlarma(detalleSel.tipo)}${detalleSel.es_simulacro ? " (Simulacro)" : ""}` : "Detalle de alarma"}
        cancelLabel="Cerrar"
      >
        {detalleSel ? (
          <div className="space-y-3">
            <p className="font-mono text-[13px] uppercase tracking-widest text-ink-secondary">
              {fmtHora(detalleSel.activada_en)}
              {detalleSel.cerrada_en ? ` · Cerrada ${fmtHora(detalleSel.cerrada_en)}` : detalleSel.activa ? " · Activa" : ""}
            </p>
            {detalleSel.detalle ? <p className="text-[15px] text-ink">{detalleSel.detalle}</p> : <p className="text-[15px] text-ink-muted">Sin detalle.</p>}
            {cargandoDetalle ? (
              <p className="text-[15px] text-ink-muted">Cargando respuestas…</p>
            ) : (() => {
              const porIdSel = new Map(respuestasSel.map((r) => [r.bombero_id, r]));
              const rec = activos.filter((b) => porIdSel.get(b.id)?.respuesta === "recibido");
              const voyL = activos.filter((b) => porIdSel.get(b.id)?.respuesta === "voy");
              const noP = activos.filter((b) => porIdSel.get(b.id)?.respuesta === "no_puedo");
              const sin = activos.filter((b) => !porIdSel.has(b.id));
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">Recibido</p><p className="font-mono text-lg font-bold text-ok">{rec.length}</p></div>
                    <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">Voy</p><p className="font-mono text-lg font-bold text-alarm">{voyL.length}</p></div>
                    <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">No puedo</p><p className="font-mono text-lg font-bold text-ink">{noP.length}</p></div>
                    <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2"><p className="font-mono text-[13px] text-ink-muted">Sin respuesta</p><p className="font-mono text-lg font-bold text-ink-muted">{sin.length}</p></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Lista titulo="Recibido" nombres={rec.map((b) => b.nombre_completo)} />
                    <Lista titulo="Voy" nombres={voyL.map((b) => b.nombre_completo)} />
                    <Lista titulo="No puedo" nombres={noP.map((b) => b.nombre_completo)} />
                    <Lista titulo="Sin respuesta" nombres={sin.map((b) => b.nombre_completo)} />
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Lista({ titulo, nombres }: { titulo: string; nombres: string[] }) {
  return (
    <div className="rounded-lg border border-line-subtle bg-bg-subtle p-2">
      <p className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">{titulo} ({nombres.length})</p>
      {nombres.length === 0 ? <p className="mt-1 text-[15px] text-ink-secondary">Nadie</p> : (
        <ul className="mt-1 space-y-0.5">{nombres.map((n) => <li key={n} className="text-[13px] text-ink">{n}</li>)}</ul>
      )}
    </div>
  );
}
