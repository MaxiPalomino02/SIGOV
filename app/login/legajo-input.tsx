"use client";

import { useState, type RefObject } from "react";
import styles from "./login.module.css";

type Props = {
  valor: string;
  error: string | null;
  sacudir: boolean;
  errorId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (valor: string) => void;
  onEnfocar: () => void;
  deshabilitado: boolean;
};

export function LegajoInput({
  valor,
  error,
  sacudir,
  errorId,
  inputRef,
  onChange,
  onEnfocar,
  deshabilitado,
}: Props) {
  const [conFoco, setConFoco] = useState(false);
  const activo = Math.min(valor.length, 2);

  return (
    <div className="w-full">
      <div
        role="group"
        aria-label="Tres dígitos del número de legajo"
        className={`${styles.casillas} relative mt-4 flex items-center justify-center gap-3 ${
          error ? styles.casillasError : ""
        } ${sacudir ? styles.shake : ""}`}
      >
        <input
          id="numero_ingreso"
          name="numero_ingreso"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          autoComplete="off"
          autoFocus
          disabled={deshabilitado}
          value={valor}
          onChange={(evento) => onChange(evento.target.value.replace(/\D/g, "").slice(0, 3))}
          onFocus={() => {
            setConFoco(true);
            onEnfocar();
          }}
          onBlur={() => setConFoco(false)}
          aria-label="Número de legajo de tres dígitos"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          style={{ fontSize: 16 }}
        />

        {[0, 1, 2].map((indice) => {
          const digito = valor[indice] ?? "";
          const esActivo = conFoco && indice === activo;
          return (
            <span
              key={`${indice}-${digito}`}
              aria-hidden
              className={`${styles.casilla} ${styles.digitoPop} num flex h-[88px] w-[80px] items-center justify-center rounded-[22px] border-2 bg-surface text-[42px] font-bold leading-none text-label ${
                esActivo ? styles.casillaActiva : ""
              }`}
            >
              {esActivo && !digito ? (
                <span aria-hidden className={`${styles.cursor} h-10 w-[2px] rounded-full bg-red`} />
              ) : (
                digito
              )}
            </span>
          );
        })}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mx-auto mt-3 w-fit max-w-full rounded-[14px] bg-red-tint px-4 py-2 text-center text-[17px] font-semibold text-red animate-fade-in"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
