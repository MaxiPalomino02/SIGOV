"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { fraseAlarma, etiquetaAlarma } from "@/lib/alarma";
import { responderAlarma } from "@/app/(tablero)/alarma/actions";
import {
  activarSonidoPorGesto,
  getAudioContext,
  getSonidoHabilitado,
} from "@/components/alarma-sonido";

type AlarmaActiva = {
  id: string;
  tipo: string;
  detalle: string | null;
  es_simulacro: boolean;
  activada_en: string;
  activa: boolean;
};

const AUTO_CIERRE_MS = 6 * 60 * 60 * 1000;

function claveAlarmaGuardada(sessionId: string): string {
  return `sigov:alarma:ultima:${sessionId}`;
}

function leerAlarmaGuardada(sessionId: string): AlarmaActiva | null {
  if (typeof window === "undefined" || !sessionId) return null;
  try {
    const raw = window.localStorage.getItem(claveAlarmaGuardada(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AlarmaActiva>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.tipo !== "string" ||
      typeof parsed.activada_en !== "string"
    ) return null;
    if (Date.now() - new Date(parsed.activada_en).getTime() > AUTO_CIERRE_MS) return null;
    return {
      id: parsed.id,
      tipo: parsed.tipo,
      detalle: typeof parsed.detalle === "string" ? parsed.detalle : null,
      es_simulacro: Boolean(parsed.es_simulacro),
      activada_en: parsed.activada_en,
      activa: true,
    };
  } catch {
    return null;
  }
}

function guardarAlarma(sessionId: string, alarma: AlarmaActiva): void {
  if (!sessionId) return;
  try {
    window.localStorage.setItem(claveAlarmaGuardada(sessionId), JSON.stringify(alarma));
  } catch {
    void 0;
  }
}

function limpiarAlarmaGuardada(sessionId: string): void {
  if (!sessionId) return;
  try {
    window.localStorage.removeItem(claveAlarmaGuardada(sessionId));
  } catch {
    void 0;
  }
}

function formatearHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function AlarmaGlobal({ sessionId }: { sessionId: string }) {
  const [alarma, setAlarma] = useState<AlarmaActiva | null>(() =>
    leerAlarmaGuardada(sessionId)
  );
  const [miRespuesta, setMiRespuesta] = useState<"recibido" | "voy" | "no_puedo" | null>(null);
  const [respondida, setRespondida] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [busy, setBusy] = useState(false);

  const sirenRef = useRef<{ stop: () => void } | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const ultimaAlarmaId = useRef<string | null>(null);

  const detenerAlertas = useCallback(() => {
    sirenRef.current?.stop();
    sirenRef.current = null;
    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    try { navigator.vibrate?.(0); } catch {}
    try { wakeLockRef.current?.release?.(); } catch {}
    wakeLockRef.current = null;
  }, []);

  const hablar = useCallback((texto: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(texto);
      const voces = synth.getVoices();
      const es = voces.filter((v) => /^es([-_]|$)/i.test(v.lang));
      const voz =
        es.find((v) => /es[-_]AR/i.test(v.lang)) ??
        es.find((v) => /es[-_]419/i.test(v.lang)) ??
        es.find((v) => /es[-_]MX/i.test(v.lang)) ??
        es.find((v) => /es[-_]ES/i.test(v.lang)) ??
        es[0];
      if (voz) {
        utter.voice = voz;
        utter.lang = voz.lang;
      } else {
        utter.lang = "es-ES";
      }
      utter.rate = 0.95;
      utter.volume = 1;
      synth.speak(utter);
    } catch {}
  }, []);

  const iniciarSirena = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return { stop: () => {} };
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      gain.gain.value = 0.18;
      osc.connect(gain).connect(ctx.destination);
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(600, now);
      const sweep = () => {
        const t = ctx.currentTime;
        try {
          osc.frequency.cancelScheduledValues(t);
          osc.frequency.setValueAtTime(600, t);
          osc.frequency.linearRampToValueAtTime(1100, t + 0.6);
          osc.frequency.linearRampToValueAtTime(600, t + 1.2);
        } catch {}
      };
      sweep();
      const id = window.setInterval(sweep, 1200);
      osc.start();
      return {
        stop: () => {
          window.clearInterval(id);
          try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch {}
        },
      };
    } catch {
      return { stop: () => {} };
    }
  }, []);

  const iniciarAlertas = useCallback(async (a: AlarmaActiva) => {
    detenerAlertas();
    const habilitado = getSonidoHabilitado();
    const ctx = getAudioContext();
    const ctxSuspendido = !!ctx && ctx.state === "suspended";
    if (!habilitado || ctxSuspendido) {
      setBloqueado(true);
    } else {
      setBloqueado(false);
    }

    if (habilitado) {
      sirenRef.current = iniciarSirena();
      const frase = fraseAlarma(a.tipo);
      hablar(frase);
      voiceTimerRef.current = window.setInterval(() => hablar(frase), 8000);
    }
    try { navigator.vibrate?.([400, 200, 400, 200, 800]); } catch {}
    try {
      if ("wakeLock" in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }, [detenerAlertas, hablar, iniciarSirena]);

  const consultarAlarma = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      // cerrar expiradas es best-effort vía RPC no expuesta a anon; filtramos por tiempo en cliente
      const { data } = await supabase
        .from("alarmas")
        .select("id, tipo, detalle, es_simulacro, activada_en, activa")
        .eq("activa", true)
        .order("activada_en", { ascending: false })
        .limit(1);
      const row = (data ?? [])[0] as any;
      if (!row) {
        limpiarAlarmaGuardada(sessionId);
        setAlarma(null);
        setMiRespuesta(null);
        setRespondida(false);
        return;
      }
      const expirada = Date.now() - new Date(row.activada_en).getTime() > AUTO_CIERRE_MS;
      if (expirada) {
        limpiarAlarmaGuardada(sessionId);
        setAlarma(null);
        setMiRespuesta(null);
        setRespondida(false);
        return;
      }
      const a: AlarmaActiva = {
        id: row.id, tipo: row.tipo, detalle: row.detalle,
        es_simulacro: !!row.es_simulacro, activada_en: row.activada_en, activa: !!row.activa,
      };
      guardarAlarma(sessionId, a);
      setAlarma(a);
      // mi respuesta
      const { data: resp } = await supabase
        .from("alarma_respuestas")
        .select("respuesta")
        .eq("alarma_id", a.id)
        .eq("bombero_id", sessionId)
        .maybeSingle();
      if (resp?.respuesta) {
        setMiRespuesta(resp.respuesta as any);
        setRespondida(true);
      } else {
        setRespondida(false);
      }
    } catch {
      // mantener estado actual
    }
  }, [sessionId]);

  useEffect(() => {
    void consultarAlarma();
    const id = window.setInterval(() => void consultarAlarma(), 15000);
    const onVis = () => { if (document.visibilityState === "visible") void consultarAlarma(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [consultarAlarma]);

  useEffect(() => {
    let chA: any = null;
    try {
      const supabase = createBrowserSupabaseClient();
      chA = supabase
        .channel("alarmas-global")
        .on("postgres_changes", { event: "*", schema: "public", table: "alarmas" }, () => void consultarAlarma())
        .on("postgres_changes", { event: "*", schema: "public", table: "alarma_respuestas" }, () => void consultarAlarma())
        .subscribe();
    } catch {}
    return () => {
      try { if (chA) createBrowserSupabaseClient().removeChannel(chA); } catch {}
    };
  }, [consultarAlarma]);

  useEffect(() => {
    if (!alarma) {
      ultimaAlarmaId.current = null;
      detenerAlertas();
      return;
    }
    if (ultimaAlarmaId.current !== alarma.id) {
      ultimaAlarmaId.current = alarma.id;
      setRespondida(false);
      setMiRespuesta(null);
    }
    if (!respondida) {
      void iniciarAlertas(alarma);
    } else {
      detenerAlertas();
    }
    return () => {
      // no detener en cada render; se controla por respondida/alarma
    };
  }, [alarma, respondida, iniciarAlertas, detenerAlertas]);

  useEffect(() => () => detenerAlertas(), [detenerAlertas]);

  const onResponder = async (r: "recibido" | "voy" | "no_puedo") => {
    if (!alarma) return;
    setBusy(true);
    const res = await responderAlarma(alarma.id, r);
    setBusy(false);
    if (res.ok) {
      limpiarAlarmaGuardada(sessionId);
      setMiRespuesta(r);
      setRespondida(true);
      detenerAlertas();
    }
  };

  const onActivarSonido = async () => {
    await activarSonidoPorGesto();
    if (alarma && !respondida) {
      setBloqueado(false);
      await iniciarAlertas(alarma);
    }
  };

  if (!alarma) return null;

  const mostrarOverlay = !respondida;
  const etiqueta = etiquetaAlarma(alarma.tipo);

  return (
    <div
      className={`${mostrarOverlay ? "fixed inset-0 z-[100] flex flex-col" : "fixed inset-x-0 bottom-20 z-[60] mx-3 mb-2 lg:bottom-4"} `}
      role={mostrarOverlay ? "alertdialog" : "status"}
      aria-label="Alarma activa"
    >
      {mostrarOverlay ? (
        <div className="flex h-full flex-col bg-bg text-ink">
          <div className="alarma-stripe h-3 w-full bg-fire" aria-hidden />
          {alarma.es_simulacro ? (
            <div className="mx-4 mt-4 rounded-lg border border-brass bg-brass-light px-4 py-2 text-center font-mono text-sm font-bold uppercase tracking-widest text-brass">
              Simulacro
            </div>
          ) : null}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">Alarma activa · {formatearHora(alarma.activada_en)}</p>
            <h1 className="heading-display text-4xl leading-tight sm:text-5xl">{etiqueta}</h1>
            {alarma.detalle ? (
              <p className="max-w-xl text-lg text-ink-muted">{alarma.detalle}</p>
            ) : null}
            {alarma.es_simulacro ? (
              <p className="font-mono text-xs uppercase tracking-widest text-brass">Esto es un simulacro</p>
            ) : null}

            {bloqueado ? (
              <button
                type="button"
                onClick={onActivarSonido}
                className="mt-2 w-full max-w-md rounded-2xl border-2 border-fire bg-fire px-6 py-6 text-xl font-bold text-ink shadow-[0_0_30px_rgba(198,40,40,0.35)]"
              >
                Tocar para activar sonido
              </button>
            ) : null}

            <div className="mt-4 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
              <button type="button" disabled={busy} onClick={() => void onResponder("recibido")} className="min-h-[64px] rounded-xl border border-line bg-surface px-4 text-lg font-bold text-ink hover:bg-surface-hover disabled:opacity-50">Recibido</button>
              <button type="button" disabled={busy} onClick={() => void onResponder("voy")} className="min-h-[64px] rounded-xl border border-fire bg-fire/20 px-4 text-lg font-bold text-ink hover:bg-fire/30 disabled:opacity-50">Voy</button>
              <button type="button" disabled={busy} onClick={() => void onResponder("no_puedo")} className="min-h-[64px] rounded-xl border border-line bg-surface px-4 text-lg font-bold text-ink hover:bg-surface-hover disabled:opacity-50">No puedo</button>
            </div>

            <p className="mt-4 max-w-md text-center font-mono text-[13px] uppercase tracking-widest text-ink-secondary">
              Con la app cerrada o el celular bloqueado la alarma depende de las notificaciones del sistema; no suena en modo silencio. Complementa, no reemplaza, la sirena y la radio.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-fire/60 bg-surface p-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <p className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">Alarma activa</p>
          <p className="heading-display text-lg text-ink">{etiqueta}{alarma.es_simulacro ? " (Simulacro)" : ""}</p>
          <p className="mt-1 text-[13px] text-ok">Respuesta registrada: {miRespuesta === "voy" ? "Voy" : miRespuesta === "no_puedo" ? "No puedo" : "Recibido"}</p>
        </div>
      )}
      <style jsx global>{`
        @keyframes alarma-stripe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .alarma-stripe { animation: alarma-stripe 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .alarma-stripe { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
