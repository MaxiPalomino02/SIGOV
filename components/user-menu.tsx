"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, Download, LogOut, WifiOff } from "lucide-react";
import {
  activarSonidoPorGesto,
  getSonidoHabilitado,
  setSonidoHabilitado,
} from "@/components/alarma-sonido";
import { Switch } from "@/components/ui/switch";
import { logout } from "@/app/login/actions";
import { contarOperaciones, suscribirACola } from "@/lib/cola-sincronizacion";

export type SesionUI = {
  nombre: string;
  cargo: string | null;
  legajo: number;
};

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function enModoIndependiente(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function esIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const ipadModerno = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iphone || ipadModerno;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}



function suscribirConexion(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function conexionCliente() {
  return navigator.onLine;
}

function conexionServidor() {
  return true;
}

export function UserMenu({
  sesion,
  menuArriba = false,
  className = "",
}: {
  sesion: SesionUI;
  menuArriba?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [instrucciones, setInstrucciones] = useState(false);
  const [ocultoInstalar, setOcultoInstalar] = useState(true);
  const [iphone, setIphone] = useState(false);
  const [sonido, setSonido] = useState(false);
  const enLinea = useSyncExternalStore(suscribirConexion, conexionCliente, conexionServidor);
  const promptRef = useRef<EventoInstalacion | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activo = true;
    const actualizar = () => {
      void contarOperaciones()
        .then((cantidad) => {
          if (activo) setPendientes(cantidad);
        })
        .catch(() => void 0);
    };
    actualizar();
    const desuscribir = suscribirACola(actualizar);
    return () => {
      activo = false;
      desuscribir();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOcultoInstalar(enModoIndependiente());
      setIphone(esIphone());
    });
    const alPedirInstalacion = (evento: Event) => {
      evento.preventDefault();
      promptRef.current = evento as EventoInstalacion;
      setOcultoInstalar(false);
    };
    const alInstalar = () => {
      promptRef.current = null;
      setOcultoInstalar(true);
      setInstrucciones(false);
    };
    window.addEventListener("beforeinstallprompt", alPedirInstalacion);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", alPedirInstalacion);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alPresionarAfuera = (evento: PointerEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", alPresionarAfuera);
    document.addEventListener("keydown", alPresionarTecla);
    return () => {
      document.removeEventListener("pointerdown", alPresionarAfuera);
      document.removeEventListener("keydown", alPresionarTecla);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const selector = '[data-menuitem], [role="switch"]';
    menuRef.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [abierto]);

  useEffect(() => {
    const sincronizar = () => setSonido(getSonidoHabilitado());
    sincronizar();
    window.addEventListener("storage", sincronizar);
    window.addEventListener("sigov-sonido-change", sincronizar);
    return () => {
      window.removeEventListener("storage", sincronizar);
      window.removeEventListener("sigov-sonido-change", sincronizar);
    };
  }, []);

  const alternarSonido = async () => {
    if (sonido) {
      setSonidoHabilitado(false);
      return;
    }
    await activarSonidoPorGesto();
  };

  const instalar = async () => {
    if (promptRef.current) {
      await promptRef.current.prompt();
      const eleccion = await promptRef.current.userChoice;
      promptRef.current = null;
      if (eleccion.outcome === "accepted") {
        setOcultoInstalar(true);
        setInstrucciones(false);
      }
      return;
    }
    setInstrucciones((valor) => !valor);
  };

  const navegarMenu = (evento: ReactKeyboardEvent<HTMLDivElement>) => {
    const teclas = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!teclas.includes(evento.key)) return;
    evento.preventDefault();
    const nodos = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[data-menuitem], [role="switch"]') ?? [],
    );
    if (nodos.length === 0) return;
    const actual = nodos.indexOf(document.activeElement as HTMLElement);
    let siguiente = actual;
    if (evento.key === "ArrowDown") siguiente = (actual + 1) % nodos.length;
    if (evento.key === "ArrowUp") siguiente = (actual - 1 + nodos.length) % nodos.length;
    if (evento.key === "Home") siguiente = 0;
    if (evento.key === "End") siguiente = nodos.length - 1;
    nodos[siguiente]?.focus();
  };

  const legajo = String(sesion.legajo).padStart(3, "0");

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Opciones de usuario"
        onClick={() => setAbierto((valor) => !valor)}
        className="tap flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-tint text-[15px] font-semibold text-yellow-ink">
          {iniciales(sesion.nombre)}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${enLinea ? "bg-green" : "bg-yellow"}`}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-label">{sesion.nombre}</span>
            {!enLinea ? (
              <span className="shrink-0 rounded-full bg-yellow-tint px-2 py-0.5 text-[13px] text-yellow-ink">
                Sin conexión
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[13px] text-label-2">
            {sesion.cargo ?? "Bombero"} · <span className="num">{legajo}</span>
          </span>
        </span>
        <ChevronDown
          size={22}
          strokeWidth={1.75}
          className={`shrink-0 text-label-2 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {enLinea ? "En línea" : "Sin conexión"}
        {pendientes > 0 ? ` · ${pendientes} pendientes de sincronizar` : ""}
      </span>

      {!enLinea ? (
        <span className="pointer-events-none absolute right-3 top-3 text-label-2" aria-hidden>
          <WifiOff size={16} strokeWidth={1.75} />
        </span>
      ) : null}

      {abierto ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Opciones de usuario"
          onKeyDown={navegarMenu}
          className={`absolute left-0 z-50 w-[min(280px,calc(100vw-32px))] rounded-[16px] border border-separator bg-surface p-2 shadow-sm animate-fade-in ${
            menuArriba ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
          }`}
        >
          <div role="none">
            <Switch
              checked={sonido}
              onChange={() => void alternarSonido()}
              etiqueta="Sonido de alarma"
              className="rounded-[10px]"
            />
          </div>

          <Link
            href="/notificaciones"
            role="menuitem"
            data-menuitem
            onClick={() => setAbierto(false)}
            className="tap flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] text-label transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
          >
            <span className="flex-1">Notificaciones</span>
          </Link>

          {!ocultoInstalar ? (
            <>
              <button
                type="button"
                role="menuitem"
                data-menuitem
                onClick={() => void instalar()}
                className="tap flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] text-label transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
              >
                <Download size={22} strokeWidth={1.75} className="text-label-2" aria-hidden />
                <span className="flex-1">Cómo instalar SIGOV</span>
              </button>
              {instrucciones ? (
                <div className="mx-2 mb-2 rounded-[10px] bg-surface-2 p-3 text-[13px] text-label-2">
                  {iphone
                    ? "Tocá Compartir y después Agregar a pantalla de inicio."
                    : "Abrí el menú del navegador y elegí Instalar app o Agregar a pantalla de inicio."}
                </div>
              ) : null}
            </>
          ) : null}

          <div className="my-1 border-t border-separator" aria-hidden />

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              data-menuitem
              className="tap flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] text-label transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              <LogOut size={22} strokeWidth={1.75} className="text-label-2" aria-hidden />
              <span>Salir</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
