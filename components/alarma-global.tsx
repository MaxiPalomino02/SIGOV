"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { fraseAlarma, etiquetaAlarma } from "@/lib/alarma";
import { cancelarVozPendiente, hablarTextoAlarma } from "@/lib/voz-alarma";
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
  const [alarma, setAlarma] = useState<AlarmaActiva | null>(null);
  const [miRespuesta, setMiRespuesta] = useState<"recibido" | "voy" | "no_puedo" | null>(null);
  const [respondida, setRespondida] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sirenRef = useRef<{ stop: () => void } | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const ultimaAlarmaId = useRef<string | null>(null);
  const requestSeqRef = useRef(0);
  const respondidaParaRef = useRef<string | null>(null);

  const detenerAlertas = useCallback(() => {
    sirenRef.current?.stop();
    sirenRef.current = null;
    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    cancelarVozPendiente();
    try { window.speechSynthesis?.cancel(); } catch {}
    try { navigator.vibrate?.(0); } catch {}
    try { wakeLockRef.current?.release?.(); } catch {}
    wakeLockRef.current = null;
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
      hablarTextoAlarma(frase);
      voiceTimerRef.current = window.setInterval(() => hablarTextoAlarma(frase), 8000);
    }
    try { navigator.vibrate?.([400, 200, 400, 200, 800]); } catch {}
    try {
      if ("wakeLock" in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }, [detenerAlertas, iniciarSirena]);

  const consultarAlarma = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const vigente = () => seq === requestSeqRef.current;
    try {
      const supabase = createBrowserSupabaseClient();
      // cerrar expiradas es best-effort vía RPC no expuesta a anon; filtramos por tiempo en cliente
      const { data } = await supabase
        .from("alarmas")
        .select("id, tipo, detalle, es_simulacro, activada_en, activa")
        .eq("activa", true)
        .order("activada_en", { ascending: false })
        .limit(1);
      if (!vigente()) return;
      const row = (data ?? [])[0] as any;
      if (!row) {
        limpiarAlarmaGuardada(sessionId);
        respondidaParaRef.current = null;
        setAlarma(null);
        setMiRespuesta(null);
        setRespondida(false);
        setErrorMsg(null);
        return;
      }
      const expirada = Date.now() - new Date(row.activada_en).getTime() > AUTO_CIERRE_MS;
      if (expirada) {
        limpiarAlarmaGuardada(sessionId);
        respondidaParaRef.current = null;
        setAlarma(null);
        setMiRespuesta(null);
        setRespondida(false);
        setErrorMsg(null);
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
      if (!vigente()) return;
      if (resp?.respuesta) {
        respondidaParaRef.current = a.id;
        setMiRespuesta(resp.respuesta as any);
        setRespondida(true);
        setErrorMsg(null);
      } else if (respondidaParaRef.current === a.id) {
        // respuesta local optimista reciente; no pisar con lectura vacía vieja
        setRespondida(true);
      } else {
        setMiRespuesta(null);
        setRespondida(false);
      }
    } catch {
      // mantener estado actual
    }
  }, [sessionId]);

  useEffect(() => {
    const guardada = leerAlarmaGuardada(sessionId);
    if (guardada) queueMicrotask(() => setAlarma((actual) => actual ?? guardada));
    void consultarAlarma();
    const id = window.setInterval(() => void consultarAlarma(), 15000);
    const onVis = () => { if (document.visibilityState === "visible") void consultarAlarma(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [consultarAlarma, sessionId]);

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
      respondidaParaRef.current = null;
      detenerAlertas();
      return;
    }
    if (ultimaAlarmaId.current !== alarma.id) {
      ultimaAlarmaId.current = alarma.id;
      if (respondidaParaRef.current !== alarma.id) {
        respondidaParaRef.current = null;
        setRespondida(false);
        setMiRespuesta(null);
        setErrorMsg(null);
      }
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
    setErrorMsg(null);
    const res = await responderAlarma(alarma.id, r);
    setBusy(false);
    if (res.ok) {
      respondidaParaRef.current = alarma.id;
      limpiarAlarmaGuardada(sessionId);
      setMiRespuesta(r);
      setRespondida(true);
      detenerAlertas();
      void consultarAlarma();
      return;
    }
    setErrorMsg(res.error);
    if (res.error === "La alarma ya no está activa.") {
      limpiarAlarmaGuardada(sessionId);
      respondidaParaRef.current = null;
      void consultarAlarma();
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

  const etiqueta = etiquetaAlarma(alarma.tipo);
  const textoRespuesta =
    miRespuesta === "voy" ? "Voy" : miRespuesta === "no_puedo" ? "No puedo" : "Recibido";

  if (respondida) {
    return (
      <div
        className="no-print fixed inset-x-0 bottom-20 z-[60] mx-3 mb-2 lg:bottom-4"
        role="status"
        aria-label="Respuesta de alarma registrada"
      >
        <div className="rounded-[16px] bg-alarma-superficie p-4 text-surface">
          <p className="text-[13px] text-alarma-secundario">Alarma activa</p>
          <p className="mt-1 text-[17px] font-bold">
            {etiqueta}
            {alarma.es_simulacro ? " · Simulacro" : ""}
          </p>
          <p className="mt-1 text-[15px] text-separator">Respuesta registrada: {textoRespuesta}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-alarma-bg text-surface"
      role="alertdialog"
      aria-label="Alarma activa"
    >
      <div className="alarma-franja h-3 w-full shrink-0 bg-red" aria-hidden />
      {alarma.es_simulacro ? (
        <div className="mx-5 mt-5 self-start rounded-full bg-yellow px-4 py-2 text-[17px] font-extrabold text-label">
          SIMULACRO
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-6 text-center">
        <p className="num text-[17px] text-alarma-secundario">
          Alarma activa · {formatearHora(alarma.activada_en)}
        </p>
        <h1 className="line-clamp-2 max-w-[22ch] text-[44px] font-extrabold leading-[1.05] tracking-[-.4px] text-surface">
          {etiqueta}
        </h1>
        {alarma.detalle ? (
          <p className="max-w-xl text-[22px] font-medium leading-snug text-separator">{alarma.detalle}</p>
        ) : null}

        {bloqueado ? (
          <button
            type="button"
            onClick={onActivarSonido}
            className="tap mt-2 flex min-h-[64px] w-full max-w-xl items-center justify-center rounded-[18px] bg-yellow px-6 text-[17px] font-extrabold text-label"
          >
            Tocar para activar sonido
          </button>
        ) : null}

        <div className="mt-2 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            ["recibido", "Recibido", "bg-surface text-label"],
            ["voy", "Voy", "bg-red text-surface"],
            ["no_puedo", "No puedo", "bg-alarma-superficie text-surface"],
          ] as const).map(([valor, texto, colores]) => {
            const elegido = miRespuesta === valor;
            return (
              <button
                key={valor}
                type="button"
                disabled={busy}
                aria-pressed={elegido}
                onClick={() => void onResponder(valor)}
                className={`tap flex min-h-16 items-center justify-center gap-2 rounded-[18px] px-4 text-[17px] font-bold transition-all ${colores} ${
                  elegido ? "" : miRespuesta ? "opacity-40" : ""
                }`}
              >
                {elegido ? <Check size={22} strokeWidth={2.25} aria-hidden /> : null}
                {texto}
              </button>
            );
          })}
        </div>
        {errorMsg ? (
          <p role="status" className="w-full max-w-xl rounded-[14px] bg-red-tint px-4 py-3 text-center text-[15px] font-medium text-red">
            {errorMsg}
          </p>
        ) : null}
      </div>

      <p className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] text-center text-[13px] text-alarma-secundario">
        Complementa la sirena y la radio. Con la app cerrada depende de las notificaciones del sistema.
      </p>

      <style jsx global>{`
        @keyframes alarma-franja {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .alarma-franja { animation: alarma-franja 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .alarma-franja { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
