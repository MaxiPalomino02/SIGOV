"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, CheckCircle2, CircleX, Info, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";
import { Switch } from "@/components/ui/switch";
import {
  registrarServiceWorkerPush,
  soportePush,
  urlBase64ToUint8Array,
} from "@/lib/push-client";
import {
  activarSuscripcionPush,
  desactivarSuscripcionPush,
} from "@/app/(tablero)/notificaciones/actions";

type EstadoPermiso = NotificationPermission | "no-soportado" | null;
type Mensaje = { variante: "ok" | "error"; texto: string };

export type OpcionesNotificaciones = {
  activaInicial: boolean;
  claveDisponible: boolean;
  errorInicial?: string | null;
  onActivaChange?: (activa: boolean) => void;
};

function suscribirPermiso(): () => void {
  return () => {};
}

function obtenerPermiso(): EstadoPermiso {
  return typeof Notification === "undefined" ? "no-soportado" : Notification.permission;
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

function useNotificaciones({
  activaInicial,
  claveDisponible,
  errorInicial,
  onActivaChange,
}: OpcionesNotificaciones) {
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
  const soporte = useSyncExternalStore(suscribirPermiso, soportePush, () => true);
  const permiso = permisoLocal ?? permisoStore;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIphone(esIphone()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && soportePush()) {
      void registrarServiceWorkerPush().catch(() => {});
    }
  }, []);

  const cambiarActiva = useCallback(
    (valor: boolean) => {
      setActiva(valor);
      onActivaChange?.(valor);
    },
    [onActivaChange]
  );

  const activar = useCallback(async () => {
    setMensaje(null);
    setPendiente(true);
    try {
      if (typeof Notification === "undefined" || !soportePush()) {
        throw new Error("Este navegador no admite notificaciones push.");
      }
      if (process.env.NODE_ENV !== "production") {
        throw new Error("En local probá las notificaciones con npm run build y npm start.");
      }
      if (!claveDisponible) {
        throw new Error("Falta la configuración push del servidor. Avisá al administrador.");
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

      let clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!clave) {
        const respuestaClave = await fetch("/api/push/vapid", { cache: "no-store" });
        if (!respuestaClave.ok) throw new Error("No pudimos obtener la clave pública push.");
        const datosClave = (await respuestaClave.json()) as { clave: string | null };
        clave = datosClave.clave ?? undefined;
      }
      if (!clave) throw new Error("No pudimos obtener la clave pública push.");

      const registro = await registrarServiceWorkerPush();
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

      cambiarActiva(true);
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
  }, [claveDisponible, cambiarActiva]);

  const desactivar = useCallback(async () => {
    setMensaje(null);
    setPendiente(true);
    try {
      if ("serviceWorker" in navigator) {
        const registro = await navigator.serviceWorker.getRegistration("/");
        const suscripcion = await registro?.pushManager.getSubscription();
        if (suscripcion) await suscripcion.unsubscribe();
      }

      const resultado = await desactivarSuscripcionPush();
      if (!resultado.ok) {
        setMensaje({ variante: "error", texto: resultado.error });
        return;
      }

      cambiarActiva(false);
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
  }, [cambiarActiva]);

  const cambiar = (marcado: boolean) => {
    if (pendiente) return;
    if (marcado) void activar();
    else void desactivar();
  };

  return {
    activa,
    pendiente,
    mensaje,
    permiso,
    soporte,
    iphone,
    cambiar,
    activar,
    setMensaje,
  };
}

function Aviso({ mensaje }: { mensaje: Mensaje | null }) {
  if (!mensaje) return null;
  return (
    <div
      role={mensaje.variante === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 border-t border-separator px-4 py-3 text-[15px] leading-relaxed ${
        mensaje.variante === "error" ? "bg-red-tint text-red" : "bg-green-tint text-green-ink"
      }`}
    >
      {mensaje.variante === "error" ? (
        <CircleX size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      )}
      <span>{mensaje.texto}</span>
    </div>
  );
}

export function ControlActivarNotificaciones({
  activaInicial,
  claveDisponible,
  errorInicial,
  onActivaChange,
}: OpcionesNotificaciones) {
  const { activa, pendiente, mensaje, permiso, soporte, iphone, cambiar } = useNotificaciones({
    activaInicial,
    claveDisponible,
    errorInicial,
    onActivaChange,
  });

  const sinSoporte = !soporte;
  const permisoDenegado = permiso === "denied";
  const estadoTexto = sinSoporte
    ? "No soportado"
    : permisoDenegado
      ? "Permiso denegado"
      : activa
        ? "Activadas"
        : "Pendiente de activar";
  const estadoDetalle = sinSoporte
    ? "Este navegador no admite notificaciones push."
    : permisoDenegado
      ? "Habilitá las notificaciones desde Ajustes para este sitio."
      : activa
        ? "Este dispositivo recibe los avisos del cuartel."
        : !claveDisponible
          ? "Falta la configuración push del servidor. Avisá al administrador."
          : "Tocá el switch para activarlas.";
  const IconoEstado = sinSoporte || permisoDenegado ? CircleX : activa ? BellRing : Info;

  const permisoTexto =
    permiso === "granted"
      ? "Concedido"
      : permiso === "denied"
        ? "No concedido"
        : permiso === "no-soportado"
          ? "No disponible"
          : "Sin pedir";
  const permisoDetalle =
    permiso === "granted"
      ? "Este dispositivo puede recibir avisos del cuartel."
      : permiso === "denied"
        ? "Andá a Ajustes del sitio y habilitá las notificaciones."
        : permiso === "no-soportado"
          ? "Este navegador no admite notificaciones."
          : "Tocá el switch para pedir permiso.";
  const IconoPermiso =
    permiso === "granted" ? BellRing : permiso === "denied" ? CircleX : Info;

  return (
    <Grupo>
      {iphone ? (
        <div className="flex items-start gap-3 border-b border-separator px-4 py-3 text-[15px] leading-relaxed text-yellow-ink">
          <Smartphone size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p>En iPhone funcionan solo con la app instalada.</p>
        </div>
      ) : null}
      <Switch
        checked={activa}
        onChange={cambiar}
        etiqueta="Activar notificaciones"
        descripcion={pendiente ? "Procesando…" : undefined}
        disabled={sinSoporte || permisoDenegado}
      />
      <div className="fila flex items-center gap-3 border-t border-separator px-4 py-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-label-2">
          <IconoEstado size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-medium text-label">Estado</span>
          <span className="mt-0.5 block text-[15px] text-label-2">{estadoDetalle}</span>
        </span>
        <span className="num shrink-0 text-[15px] text-label-2">{estadoTexto}</span>
      </div>
      <div className="fila flex items-center gap-3 border-t border-separator px-4 py-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-label-2">
          <IconoPermiso size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-medium text-label">Permiso del navegador</span>
          <span className="mt-0.5 block text-[15px] text-label-2">{permisoDetalle}</span>
        </span>
        <span className="num shrink-0 text-[15px] text-label-2">{permisoTexto}</span>
      </div>
      <Aviso mensaje={mensaje} />
    </Grupo>
  );
}

export function TarjetaActivarNotificaciones({
  activaInicial,
  claveDisponible,
}: OpcionesNotificaciones) {
  const { activa, pendiente, mensaje, activar, soporte, permiso } = useNotificaciones({
    activaInicial,
    claveDisponible,
  });

  const estadoTexto = !soporte
    ? "No soportado en este navegador."
    : permiso === "denied"
      ? "Permiso denegado. Habilitalo desde Ajustes."
      : pendiente
        ? "Procesando…"
        : "Pendiente de activar.";

  if (activa || !claveDisponible) return null;

  return (
    <div className="rounded-[16px] bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-red-tint text-red">
          <BellRing size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-label">Activá las notificaciones</p>
          <p className="mt-1 text-[15px] leading-relaxed text-label-2">
            Recibí avisos del cuartel incluso con la app cerrada.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={pendiente || !soporte || permiso === "denied"}
            onClick={() => void activar()}
          >
            Activar notificaciones
          </Button>
          <p className="mt-2 text-[13px] text-label-2">{estadoTexto}</p>
        </div>
      </div>
      {mensaje ? (
        <div className="mt-3 rounded-[14px] bg-surface-2 px-3 py-2 text-[13px] text-label-2">
          {mensaje.texto}
        </div>
      ) : null}
    </div>
  );
}
