"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { login, type LoginState } from "./actions";
import { LegajoInput } from "./legajo-input";
import { WelcomeTransition, type FaseLogin } from "./welcome-transition";
import styles from "./login.module.css";

const MENSAJE_BLOQUEO = "Demasiados intentos. Probá en unos minutos.";
const DURACION_SALUDO = 1800;
const DURACION_SALUDO_REDUCIDO = 1200;

function vibrar() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }
}

function mensajeVisible(error: string): string {
  if (error === MENSAJE_BLOQUEO) return error;
  if (error.startsWith("El servidor") || error.startsWith("Ocurrió un error")) return error;
  return "Revisá los tres números";
}

function prefiereMovimientoReducido(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LoginForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  const [legajo, setLegajo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sacudir, setSacudir] = useState(false);
  const [fase, setFase] = useState<FaseLogin>("idle");
  const [nombre, setNombre] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const navegado = useRef(false);
  const faseRef = useRef(fase);
  const pendingRef = useRef(pending);
  const errorId = useId();
  const router = useRouter();

  const secuenciaActiva = fase !== "idle" && fase !== "loading";
  const loginOculto = fase === "dot" || fase === "greeting" || fase === "leaving";

  const irAlInicio = useCallback(() => {
    if (navegado.current) return;
    navegado.current = true;
    router.push("/inicio");
  }, [router]);

  useEffect(() => {
    faseRef.current = fase;
  }, [fase]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const enfocarSiEscritorio = useCallback(() => {
    if (faseRef.current !== "idle" || pendingRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  function alEnfocarInput() {
    if (typeof window === "undefined" || secuenciaActiva) return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;
    window.setTimeout(() => {
      const comportamiento: ScrollBehavior = prefiereMovimientoReducido() ? "auto" : "smooth";
      botonRef.current?.scrollIntoView({ behavior: comportamiento, block: "end" });
    }, 250);
  }

  useEffect(() => {
    enfocarSiEscritorio();
  }, [enfocarSiEscritorio]);

  useEffect(() => {
    if (pending) queueMicrotask(() => setFase("loading"));
  }, [pending]);

  useEffect(() => {
    const nombreServidor = state.nombre;
    if (nombreServidor) {
      router.prefetch("/inicio");
      queueMicrotask(() => {
        setNombre(nombreServidor.trim().split(/\s+/)[0] || "");
        setFase("collapsing");
      });
      return;
    }
    if (!state.error) return;
    const mensaje = mensajeVisible(state.error);
    queueMicrotask(() => {
      setError(mensaje);
      setSacudir(true);
      setFase("idle");
    });
    vibrar();
    const temporizador = window.setTimeout(() => {
      setLegajo("");
      setSacudir(false);
      enfocarSiEscritorio();
    }, 420);
    return () => window.clearTimeout(temporizador);
  }, [state, router, enfocarSiEscritorio]);

  useEffect(() => {
    if (fase !== "greeting") return;
    const espera = prefiereMovimientoReducido()
      ? DURACION_SALUDO_REDUCIDO
      : DURACION_SALUDO;
    const temporizador = window.setTimeout(() => setFase("leaving"), espera);
    return () => window.clearTimeout(temporizador);
  }, [fase]);

  useEffect(() => {
    if (fase !== "leaving") return;
    const temporizador = window.setTimeout(irAlInicio, prefiereMovimientoReducido() ? 300 : 450);
    return () => window.clearTimeout(temporizador);
  }, [fase, irAlInicio]);

  function alTerminarColapso(evento: AnimationEvent<HTMLDivElement>) {
    if (fase !== "collapsing" || evento.target !== evento.currentTarget) return;
    setFase(prefiereMovimientoReducido() ? "greeting" : "dot");
  }

  function alTerminarPunto() {
    setFase("greeting");
  }

  function cambiar(valor: string) {
    if (secuenciaActiva || pending) return;
    setError(null);
    setLegajo(valor);
    if (valor.length === 3) vibrar();
  }

  return (
    <>
      <div
        onAnimationEnd={alTerminarColapso}
        className={`${styles.contenido} ${fase === "collapsing" ? styles.colapsando : ""} ${
          loginOculto ? styles.contenidoOculto : ""
        }`}
      >
        {children}

        <form
          action={action}
          onSubmit={(evento) => {
            if (legajo.length !== 3 || pending || fase !== "idle") evento.preventDefault();
          }}
          className={`${styles.formulario} mt-7 w-full`}
        >
          <LegajoInput
            valor={legajo}
            error={error}
            sacudir={sacudir}
            errorId={errorId}
            inputRef={inputRef}
            onChange={cambiar}
            onEnfocar={alEnfocarInput}
            deshabilitado={pending || secuenciaActiva}
          />

          <button
            ref={botonRef}
            type="submit"
            disabled={legajo.length !== 3 || pending || fase !== "idle"}
            onClick={vibrar}
            aria-label="Ingresar"
            aria-busy={pending || fase === "loading"}
            className={`${styles.boton} tap mt-5 flex h-[50px] w-full scroll-mb-8 items-center justify-center rounded-[14px] bg-red px-6 text-[17px] font-semibold text-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:pointer-events-none disabled:bg-surface-2 disabled:text-label-2 disabled:shadow-none`}
          >
            {pending || fase === "loading" ? (
              <LoaderCircle size={22} strokeWidth={1.75} className="animate-spin" aria-hidden />
            ) : (
              "Ingresar"
            )}
          </button>
        </form>
      </div>

      <WelcomeTransition
        nombre={nombre}
        fase={fase}
        onSaltar={irAlInicio}
        onFinPunto={alTerminarPunto}
      />
    </>
  );
}
