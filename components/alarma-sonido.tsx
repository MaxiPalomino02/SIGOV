"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export const SONIDO_PREF_KEY = "sigov_sonido_alarma";

export function getSonidoHabilitado(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SONIDO_PREF_KEY) === "1";
}

export function setSonidoHabilitado(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SONIDO_PREF_KEY, v ? "1" : "0");
  window.dispatchEvent(new Event("sigov-sonido-change"));
}

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

export async function activarSonidoPorGesto(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") await ctx.resume();
    // prueba corta
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setSonidoHabilitado(true);
    return true;
  } catch {
    return false;
  }
}

export function IndicadorSonidoAlarma({ compact = false }: { compact?: boolean }) {
  const [habilitado, setHabilitado] = useState(false);

  useEffect(() => {
    const sync = () => setHabilitado(getSonidoHabilitado());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SONIDO_PREF_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("sigov-sonido-change", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sigov-sonido-change", sync);
    };
  }, []);

  const activar = async () => {
    await activarSonidoPorGesto();
    setHabilitado(getSonidoHabilitado());
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={activar}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold uppercase tracking-wider ${
          habilitado
            ? "border-ok/40 bg-ok-light text-ok"
            : "border-alarm-border bg-alarm-light text-alarm"
        }`}
        aria-label={habilitado ? "Sonido de alarma activado" : "Sonido de alarma desactivado. Tocar para activar"}
      >
        {habilitado ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">{habilitado ? "Sonido activado" : "Activar sonido"}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
          habilitado
            ? "border-ok/40 bg-ok-light text-ok"
            : "border-alarm-border bg-alarm-light text-alarm"
        }`}
      >
        {habilitado ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
        Sonido de alarma: {habilitado ? "activado" : "desactivado"}
      </span>
      <button
        type="button"
        onClick={activar}
        className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-surface-hover"
      >
        {habilitado ? "Probar sonido" : "Activar sonido"}
      </button>
    </div>
  );
}
