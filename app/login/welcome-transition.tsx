"use client";

import type { AnimationEvent, CSSProperties, KeyboardEvent } from "react";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import { LoginBackground } from "./login-background";
import styles from "./login.module.css";

export type FaseLogin = "idle" | "loading" | "collapsing" | "dot" | "greeting" | "leaving";

const TEXTO_BIENVENIDA = "Te damos la bienvenida";

type Props = {
  nombre: string | null;
  fase: FaseLogin;
  onSaltar: () => void;
  onFinPunto: () => void;
};

export function WelcomeTransition({ nombre, fase, onSaltar, onFinPunto }: Props) {
  if (fase === "idle" || fase === "loading") return null;

  const primerNombre = nombre?.trim() ? nombre.trim().split(/\s+/)[0] : "";
  const saludo = primerNombre ? `${TEXTO_BIENVENIDA}, ${primerNombre}` : TEXTO_BIENVENIDA;
  const pie = `${PRODUCTO.nombre} · ${CUARTEL.nombre}`;
  const saludoCompleto = `${saludo}. ${pie}`;
  const lineas = primerNombre ? [`${TEXTO_BIENVENIDA},`, primerNombre] : [TEXTO_BIENVENIDA];
  let contador = 0;

  const lineasConLetras = lineas.map((linea, fila) =>
    Array.from(linea).map((caracter, posicion) => {
      const ancho = fila === 0 ? 30 : 26;
      const desplazamientoX = -(posicion - (linea.length - 1) / 2) * ancho;
      const desplazamientoY = fila === 0 ? -30 : 30;
      const estilo = {
        "--i": contador,
        "--dx": `${desplazamientoX}px`,
        "--dy": `${desplazamientoY}px`,
      } as CSSProperties;
      contador += 1;
      return { caracter, estilo };
    })
  );

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onSaltar();
    }
  }

  function alTerminarPunto(evento: AnimationEvent<HTMLSpanElement>) {
    if (fase !== "dot" || evento.target !== evento.currentTarget) return;
    onFinPunto();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Saltar al inicio"
      onClick={onSaltar}
      onKeyDown={alTeclear}
      className="fixed inset-0 z-[60] flex items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
    >
      <LoginBackground />

      {fase === "collapsing" || fase === "dot" ? (
        <span
          aria-hidden
          onAnimationEnd={alTerminarPunto}
          className={`${styles.punto} h-[14px] w-[14px] rounded-full bg-label ${
            fase === "dot" ? styles.puntoLatido : ""
          }`}
        />
      ) : null}

      {fase === "greeting" || fase === "leaving" ? (
        <div
          role="status"
          aria-label={saludoCompleto}
          className={`${styles.saludo} flex flex-col items-center text-center ${
            fase === "leaving" ? styles.saludoSaliendo : ""
          }`}
        >
          <div aria-hidden className="flex flex-col items-center">
            {lineasConLetras.map((letras, fila) => (
              <div
                key={fila}
                className={fila === 0 ? styles.saludoHola : styles.saludoNombre}
              >
                {letras.map((letra, indice) => (
                  <span key={indice} className={styles.letra} style={letra.estilo}>
                    {letra.caracter === " " ? "\u00A0" : letra.caracter}
                  </span>
                ))}
              </div>
            ))}
            <p className={styles.saludoPie}>{pie}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
