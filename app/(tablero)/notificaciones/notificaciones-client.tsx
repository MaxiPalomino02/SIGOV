"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, Smartphone, VolumeX } from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { urlBase64ToUint8Array } from "@/lib/push-client";
import {
  activarSuscripcionPush,
  desactivarSuscripcionPush,
} from "./actions";

type EstadoPermiso = NotificationPermission | "no-soportado" | null;
type Mensaje = { variante: "ok" | "error"; texto: string };

type Props = {
  activaInicial: boolean;
  claveDisponible: boolean;
  errorInicial: string | null;
};

function suscribirPermiso(): () => void {
  return () => {};
}

function obtenerPermiso(): EstadoPermiso {
  return typeof Notification === "undefined"
    ? "no-soportado"
    : Notification.permission;
}

function permisoServidor(): EstadoPermiso {
  return null;
}

export function NotificacionesClient({
  activaInicial,
  claveDisponible,
  errorInicial,
}: Props) {
  const [activa, setActiva] = useState(activaInicial);
  const [pendiente, setPendiente] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(
    errorInicial ? { variante: "error", texto: errorInicial } : null
  );
  const permiso = useSyncExternalStore(
    suscribirPermiso,
    obtenerPermiso,
    permisoServidor
  );

  async function activar() {
    setMensaje(null);
    setPendiente(true);
    try {
      if (typeof Notification === "undefined") {
        throw new Error("Este navegador no admite notificaciones.");
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Este navegador no admite notificaciones push.");
      }

      const respuesta = await Notification.requestPermission();
      if (respuesta !== "granted") {
        setMensaje({
          variante: "error",
          texto:
            "No dimos permiso para notificaciones. Si cambias de idea, habilitalas desde los permisos del sitio.",
        });
        return;
      }
      if (!claveDisponible) {
        setMensaje({
          variante: "error",
          texto: "Falta la configuración push del servidor. Avisá al administrador.",
        });
        return;
      }

      const respuestaClave = await fetch("/api/push/vapid", { cache: "no-store" });
      if (!respuestaClave.ok) {
        throw new Error("No pudimos obtener la clave pública push.");
      }
      const { clave } = (await respuestaClave.json()) as { clave: string | null };
      if (!clave) {
        throw new Error("No pudimos obtener la clave pública push.");
      }

      const registro = await navigator.serviceWorker.ready;
      const existente = await registro.pushManager.getSubscription();
      if (existente) await existente.unsubscribe();

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clave),
      });
      const datos = suscripcion.toJSON();
      if (!datos.endpoint || !datos.keys?.p256dh || !datos.keys?.auth) {
        throw new Error("La suscripción push quedó incompleta.");
      }

      const resultado = await activarSuscripcionPush({
        endpoint: datos.endpoint,
        p256dh: datos.keys.p256dh,
        auth: datos.keys.auth,
      });
      if (!resultado.ok) {
        setMensaje({ variante: "error", texto: resultado.error });
        return;
      }

      setActiva(true);
      setMensaje({
        variante: "ok",
        texto: "Listo. Las notificaciones push están activadas en este dispositivo.",
      });
    } catch (error) {
      setMensaje({
        variante: "error",
        texto:
          error instanceof Error
            ? error.message
            : "No pudimos activar las notificaciones. Intentá de nuevo.",
      });
    } finally {
      setPendiente(false);
    }
  }

  async function desactivar() {
    setMensaje(null);
    setPendiente(true);
    try {
      if ("serviceWorker" in navigator) {
        const registro = await navigator.serviceWorker.ready;
        const suscripcion = await registro.pushManager.getSubscription();
        if (suscripcion) await suscripcion.unsubscribe();
      }

      const resultado = await desactivarSuscripcionPush();
      if (!resultado.ok) {
        setMensaje({ variante: "error", texto: resultado.error });
        return;
      }

      setActiva(false);
      setMensaje({
        variante: "ok",
        texto: "Las notificaciones push quedaron desactivadas.",
      });
    } catch {
      setMensaje({
        variante: "error",
        texto: "No pudimos desactivar las notificaciones. Intentá de nuevo.",
      });
    } finally {
      setPendiente(false);
    }
  }

  const descripcionEstado = activa
    ? "Este dispositivo puede recibir avisos, convocatorias, alarmas y alertas."
    : "Todavía no activaste las notificaciones en este dispositivo.";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <SectionHeading
        titulo="Notificaciones"
        descripcion="Avisos breves cuando hay novedades en el cuartel, incluso con la app cerrada."
      />

      <div className="mt-6 space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-bg-subtle">
              <BellRing className="size-5 text-fire-text" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="heading-display text-lg text-ink">Estado</h2>
              <p className="mt-1 text-[16px] leading-relaxed text-ink-muted">
                {descripcionEstado}
              </p>
              {permiso === "denied" ? (
                <p className="mt-2 text-[14px] leading-relaxed text-fire-text">
                  El navegador tiene bloqueados los permisos. Habilitalos desde los
                  ajustes del sitio para poder activarlas.
                </p>
              ) : null}
              {permiso === "no-soportado" ? (
                <p className="mt-2 text-[14px] leading-relaxed text-fire-text">
                  Este navegador no admite notificaciones.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={activar}
              disabled={pendiente || !claveDisponible || permiso === "no-soportado"}
            >
              {pendiente ? "Procesando…" : activa ? "Volver a activar" : "Activar"}
            </Button>
            {activa ? (
              <Button
                variant="secondary"
                onClick={desactivar}
                disabled={pendiente}
              >
                Desactivar
              </Button>
            ) : null}
          </div>

          {mensaje ? (
            <div className="mt-4">
              <Aviso variante={mensaje.variante}>{mensaje.texto}</Aviso>
            </div>
          ) : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="space-y-4 text-[16px] leading-relaxed text-ink-muted">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
              <p>
                En iPhone, las notificaciones push solo funcionan si agregaste SIGOV
                a la pantalla de inicio y la abrís como app instalada.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <VolumeX className="mt-0.5 size-5 shrink-0 text-alarm" aria-hidden />
              <p>
                Una notificación push no suena en bucle ni pasa el modo silencio como
                una alarma nativa. Si más adelante hace falta una alarma crítica, el
                camino es envolver SIGOV con Capacitor.
              </p>
            </div>
            <p>
              Estas notificaciones complementan, y no reemplazan, la sirena y la
              radio del cuartel.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
