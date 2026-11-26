"use client";

import { useState } from "react";
import {
  BellRing,
  CheckCircle2,
  CircleX,
  CloudLightning,
  Megaphone,
  Send,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ControlActivarNotificaciones } from "@/components/activar-notificaciones";
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Button } from "@/components/ui/button";
import { Fila } from "@/components/ui/fila";
import { Grupo } from "@/components/ui/grupo";
import { enviarNotificacionPrueba } from "./actions";

type MensajePrueba = { variante: "ok" | "error"; texto: string };

export type NoticiaNotificacion = {
  id: string;
  titulo: string;
  subtitulo: string;
  tipo: "aviso" | "alerta";
  href: string;
};

type Props = {
  activaInicial: boolean;
  claveDisponible: boolean;
  errorInicial: string | null;
  puedeProbar: boolean;
  noticias: NoticiaNotificacion[];
};

export function NotificacionesClient({
  activaInicial,
  claveDisponible,
  errorInicial,
  puedeProbar,
  noticias,
}: Props) {
  const [activa, setActiva] = useState(activaInicial);
  const [probando, setProbando] = useState(false);
  const [mensajePrueba, setMensajePrueba] = useState<MensajePrueba | null>(null);

  async function probar() {
    setMensajePrueba(null);
    setProbando(true);
    try {
      const resultado = await enviarNotificacionPrueba();
      setMensajePrueba(
        resultado.ok
          ? { variante: "ok", texto: "Prueba enviada. Revisá la notificación en este dispositivo." }
          : { variante: "error", texto: resultado.error }
      );
    } catch {
      setMensajePrueba({
        variante: "error",
        texto: "No pudimos enviar la prueba. Intentá de nuevo.",
      });
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <EncabezadoIsla
        titulo="Notificaciones"
        subtitulo="Avisos breves cuando hay novedades en el cuartel, incluso con la app cerrada."
        icono={BellRing}
        estado={{
          tono: activa ? "ok" : "neutro",
          texto: activa ? "Activadas" : "Desactivadas",
        }}
      />

      <div className="mx-auto w-full max-w-[520px] space-y-5 px-4 py-8">
        <div
          role="note"
          className="flex items-start gap-3 rounded-[16px] bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-label-2"
        >
          <VolumeX size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p>Complementan, no reemplazan, la sirena y la radio.</p>
        </div>

        <section>
          <h2 className="mb-2 px-1 text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">
            Estado
          </h2>
          <ControlActivarNotificaciones
            activaInicial={activa}
            claveDisponible={claveDisponible}
            errorInicial={errorInicial}
            onActivaChange={setActiva}
          />
        </section>

        {puedeProbar ? (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">
              Prueba
            </h2>
            <Grupo>
              <div className="px-4 py-3">
                <Button type="button" onClick={() => void probar()} disabled={probando}>
                  <Send size={22} strokeWidth={1.75} aria-hidden />
                  Probar notificación
                </Button>
                {mensajePrueba ? (
                  <p
                    role={mensajePrueba.variante === "error" ? "alert" : "status"}
                    className={`mt-3 flex items-start gap-2 rounded-[14px] px-3 py-2 text-[15px] ${
                      mensajePrueba.variante === "error"
                        ? "bg-red-tint text-red"
                        : "bg-green-tint text-green-ink"
                    }`}
                  >
                    {mensajePrueba.variante === "error" ? (
                      <CircleX size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                    ) : (
                      <CheckCircle2 size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                    )}
                    <span>{mensajePrueba.texto}</span>
                  </p>
                ) : null}
              </div>
            </Grupo>
          </section>
        ) : null}

        <Grupo titulo="Novedades">
          {noticias.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Megaphone size={28} strokeWidth={1.75} className="mx-auto text-label-3" aria-hidden />
              <p className="mt-2 text-[17px] text-label-2">Sin novedades recientes</p>
              <p className="mt-1 text-[15px] text-label-2">Los avisos y alertas aparecen acá.</p>
            </div>
          ) : (
            <ul>
              {noticias.map((noticia) => {
                const Icono: LucideIcon = noticia.tipo === "alerta" ? CloudLightning : Megaphone;
                return (
                  <li key={`${noticia.tipo}-${noticia.id}`} className="border-t border-separator first:border-t-0">
                    <Link
                      href={noticia.href}
                      className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
                    >
                      <Fila icono={Icono} titulo={noticia.titulo} subtitulo={noticia.subtitulo} chevron />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Grupo>
      </div>
    </div>
  );
}
