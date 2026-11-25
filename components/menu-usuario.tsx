"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDown, Download, LogOut, Volume2, VolumeX, X } from "lucide-react";
import { activarSonidoPorGesto, getSonidoHabilitado, SONIDO_PREF_KEY } from "@/components/alarma-sonido";
import { logout } from "@/app/login/actions";

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
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

export function MenuUsuario({
  nombre,
  cargo,
  legajo,
}: {
  nombre: string;
  cargo: string | null;
  legajo: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [sonido, setSonido] = useState(false);
  const [instrucciones, setInstrucciones] = useState(false);
  const [instalable, setInstalable] = useState(false);
  const [ocultoInstalar, setOcultoInstalar] = useState(enModoIndependiente);
  const [iphone] = useState(esIphone);
  const promptRef = useRef<EventoInstalacion | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setSonido(getSonidoHabilitado());
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

  useEffect(() => {
    const alPedirInstalacion = (evento: Event) => {
      evento.preventDefault();
      promptRef.current = evento as EventoInstalacion;
      setInstalable(true);
    };
    const alInstalar = () => {
      promptRef.current = null;
      setInstalable(false);
      setOcultoInstalar(true);
      setInstrucciones(false);
    };
    window.addEventListener("beforeinstallprompt", alPedirInstalacion);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPedirInstalacion);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!contenedorRef.current?.contains(target)) {
        setAbierto(false);
        setInstrucciones(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAbierto(false);
        setInstrucciones(false);
        botonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto]);

  useEffect(() => {
    if (abierto) {
      menuRef.current?.querySelector<HTMLElement>("[data-menuitem]")?.focus();
    }
  }, [abierto]);

  const alternarSonido = async () => {
    if (sonido) {
      localStorage.setItem(SONIDO_PREF_KEY, "0");
      window.dispatchEvent(new Event("sigov-sonido-change"));
      setSonido(false);
      return;
    }
    await activarSonidoPorGesto();
    setSonido(getSonidoHabilitado());
  };

  const instalar = async () => {
    if (promptRef.current) {
      await promptRef.current.prompt();
      const eleccion = await promptRef.current.userChoice;
      promptRef.current = null;
      setInstalable(false);
      if (eleccion.outcome === "accepted") {
        setOcultoInstalar(true);
        setInstrucciones(false);
      }
      return;
    }
    setInstrucciones((v) => !v);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="truncate text-[14px] font-semibold leading-tight text-ink">{nombre}</p>
        <p className="texto-aux truncate leading-tight">
          {cargo ?? "Bombero"} · <span className="dato-mono">{String(legajo).padStart(3, "0")}</span>
        </p>
      </div>

      <div ref={contenedorRef} className="relative">
        <button
          ref={botonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-label="Opciones de usuario"
          onClick={() => setAbierto((v) => !v)}
          className="flex h-11 items-center gap-1 rounded-full border border-line bg-surface pl-1 pr-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
        >
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle">
            {iniciales(nombre)}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-ink-muted transition-transform ${abierto ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {abierto ? (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Opciones de usuario"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-[12px] border border-line bg-surface p-2 shadow-[0_8px_24px_rgba(20,26,24,0.12)]"
          >

          <button
            type="button"
            role="menuitem"
            data-menuitem
            onClick={() => void alternarSonido()}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[16px] font-normal text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
          >
            {sonido ? <Volume2 className="h-4 w-4 text-ok" aria-hidden /> : <VolumeX className="h-4 w-4 text-ink-muted" aria-hidden />}
            <span className="flex-1">Sonido de alarma</span>
            <span className="texto-aux">{sonido ? "Activado" : "Desactivado"}</span>
          </button>

          {!ocultoInstalar ? (
            <div>
              <button
                type="button"
                role="menuitem"
                onClick={() => void instalar()}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[16px] font-normal text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
              >
                <Download className="h-4 w-4 text-fire" aria-hidden />
                <span className="flex-1">Cómo instalar SIGOV</span>
              </button>
              {instrucciones ? (
                <div className="mx-2 mb-2 rounded-lg border border-line-subtle bg-bg-subtle p-3 text-[13px] text-ink-muted">
                  <div className="flex items-start justify-between gap-2">
                    <p>
                      {iphone
                        ? "Tocá Compartir y después Agregar a pantalla de inicio."
                        : "Abrí el menú del navegador y elegí Instalar app o Agregar a pantalla de inicio."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setInstrucciones(false)}
                      aria-label="Cerrar instrucciones"
                      className="rounded p-1 text-ink-muted hover:bg-surface-hover"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

            <div className="my-1 h-px bg-line-subtle" aria-hidden />
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[16px] font-normal text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft sm:hidden"
              >
                <LogOut className="h-4 w-4 text-ink-muted" aria-hidden />
                <span>Salir</span>
              </button>
            </form>
          </div>
        ) : null}
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="hidden h-11 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 font-mono text-[12px] font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:border-fire/30 hover:bg-fire-light hover:text-fire sm:inline-flex"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Salir
        </button>
      </form>
    </div>
  );
}
