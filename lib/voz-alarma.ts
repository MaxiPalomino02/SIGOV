export type EstadoVozAlarma = "hablando" | "cargando" | "sin-soporte";

let esperandoVoces: EventListener | null = null;

export function elegirVozSpaniola(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voces = window.speechSynthesis
    .getVoices()
    .filter((voz) => /^es([-_]|$)/i.test(voz.lang));
  const porIdioma = (prefijo: string) =>
    voces.find((voz) => voz.lang.toLowerCase().startsWith(prefijo));

  return (
    porIdioma("es-ar") ??
    porIdioma("es-419") ??
    porIdioma("es-mx") ??
    porIdioma("es-es") ??
    voces[0] ??
    null
  );
}

export function cancelarVozPendiente(): void {
  if (typeof window === "undefined" || !esperandoVoces) return;
  try {
    window.speechSynthesis?.removeEventListener("voiceschanged", esperandoVoces);
  } catch {}
  esperandoVoces = null;
}

export function hablarTextoAlarma(texto: string): EstadoVozAlarma {
  if (typeof window === "undefined") return "sin-soporte";

  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return "sin-soporte";

  const reproducir = () => {
    const voz = elegirVozSpaniola();
    if (!voz) return;

    synth.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.voice = voz;
    utter.lang = voz.lang;
    utter.rate = 0.95;
    utter.volume = 1;
    synth.speak(utter);
  };

  if (elegirVozSpaniola()) {
    reproducir();
    return "hablando";
  }

  cancelarVozPendiente();
  const alCambiar: EventListener = () => {
    cancelarVozPendiente();
    reproducir();
  };
  esperandoVoces = alCambiar;
  synth.addEventListener("voiceschanged", alCambiar, { once: true });
  return "cargando";
}
