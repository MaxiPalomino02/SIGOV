"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleX,
  CloudLightning,
  Info,
  Megaphone,
  Siren,
  Smartphone,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { Fila } from "@/components/ui/fila";
import { Grupo } from "@/components/ui/grupo";
import { Switch } from "@/components/ui/switch";
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

function esIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const ipadModerno = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iphone || ipadModerno;
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
  const [permisoLocal, setPermisoLocal] = useState<EstadoPermiso>(null);
  const [iphone, setIphone] = useState(false);
  const permisoStore = useSyncExternalStore(
    suscribirPermiso,
    obtenerPermiso,
    permisoServidor
  );
  const permiso = permisoLocal ?? permisoStore;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIphone(esIphone()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
      setPermisoLocal(respuesta);
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

  const cambiarNotificaciones = (checked: boolean) => {
    if (pendiente) return;
    if (checked) void activar();
    else void desactivar();
  };

  const permisoTexto =
    permiso === "granted"
      ? "Activadas"
      : permiso === "denied"
        ? "Bloqueadas"
        : permiso === "no-soportado"
          ? "No disponibles"
          : "Sin pedir";
  const permisoDetalle =
    permiso === "granted"
      ? "Este dispositivo puede recibir avisos del cuartel."
      : permiso === "denied"
        ? "Andá a Ajustes del sitio y habilitá las notificaciones."
        : permiso === "no-soportado"
          ? "Este navegador no admite notificaciones."
          : "Tocá el switch para pedir permiso.";
  const permisoIcono: LucideIcon =
    permiso === "granted"
      ? BellRing
      : permiso === "denied"
        ? CircleX
        : Info;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-8">
      <h1 className="text-[34px] font-bold leading-tight tracking-[-.4px] text-label">
        Notificaciones
      </h1>
      <p className="mt-1 text-[15px] leading-relaxed text-label-2">
        Avisos breves cuando hay novedades en el cuartel, incluso con la app cerrada.
      </p>

      <div className="mt-6 space-y-5">
        {iphone ? (
          <div
            role="note"
            className="flex items-start gap-3 rounded-[16px] bg-yellow-tint px-4 py-3 text-[15px] leading-relaxed text-yellow-ink animate-fade-in"
          >
            <Smartphone size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            <p>En iPhone funcionan solo con la app instalada.</p>
          </div>
        ) : null}

        <div
          role="note"
          className="flex items-start gap-3 rounded-[16px] bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-label-2"
        >
          <VolumeX size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Complementan, no reemplazan, la sirena y la radio. No suenan en bucle ni
            pasan el modo silencio.
          </p>
        </div>

        <section>
          <h2 className="mb-2 px-1 text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">
            Estado
          </h2>
          <Grupo>
            <Switch
              checked={activa}
              onChange={cambiarNotificaciones}
              etiqueta="Activar notificaciones"
              descripcion={pendiente ? "Procesando…" : undefined}
              disabled={pendiente || permiso === "no-soportado"}
            />

            <div className="fila flex items-center gap-3 px-4 py-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center text-label-2">
                {(() => {
                  const Icono = permisoIcono;
                  return <Icono size={22} strokeWidth={1.75} aria-hidden />;
                })()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-medium text-label">
                  Permiso del navegador
                </span>
                <span className="mt-0.5 block text-[15px] text-label-2">
                  {permisoDetalle}
                </span>
              </span>
              <span className="num shrink-0 text-[17px] text-label-2">{permisoTexto}</span>
            </div>

            {mensaje ? (
              <div
                role={mensaje.variante === "error" ? "alert" : "status"}
                className={`flex items-start gap-2 border-t border-separator px-4 py-3 text-[15px] leading-relaxed animate-fade-in ${
                  mensaje.variante === "error"
                    ? "bg-red-tint text-red"
                    : "bg-green-tint text-green-ink"
                }`}
              >
                {mensaje.variante === "error" ? (
                  <CircleX size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                )}
                <span>{mensaje.texto}</span>
              </div>
            ) : null}
          </Grupo>
        </section>

        <Grupo titulo="Qué recibís">
          <Fila
            titulo="Avisos"
            subtitulo="Novedades del cuartel"
            icono={Megaphone}
            chevron={false}
          />
          <Fila
            titulo="Convocatorias"
            subtitulo="Nuevos llamados y guardias"
            icono={CalendarDays}
            chevron={false}
          />
          <Fila
            titulo="Alarmas"
            subtitulo="Salidas y novedades operativas"
            icono={Siren}
            chevron={false}
          />
          <Fila
            titulo="Alertas del SMN"
            subtitulo="Avisos naranjas y rojas"
            icono={CloudLightning}
            chevron={false}
          />
        </Grupo>
      </div>
    </div>
  );
}
