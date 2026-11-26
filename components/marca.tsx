"use client";

import Image from "next/image";
import { useState } from "react";
import { CUARTEL } from "@/lib/cuartel.config";
import { LOGOS, PRODUCTO } from "@/lib/marca";

type LogoSigovProps = {
  variante?: "principal" | "isotipo";
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  alt?: string;
};

/**
 * Logo oficial de SIGOV. Usa las proporciones originales (sin deformar ni recolorear).
 * Si el archivo no está disponible, muestra el texto SIGOV como respaldo.
 */
export function LogoSigov({
  variante = "principal",
  width = variante === "isotipo" ? 40 : 240,
  height = variante === "isotipo" ? 40 : 80,
  priority = false,
  className = "",
  alt,
}: LogoSigovProps) {
  const [error, setError] = useState(false);
  const src = variante === "isotipo" ? LOGOS.isotipo : LOGOS.principal;
  const textoAlt =
    alt ?? (variante === "isotipo" ? "Isotipo de SIGOV" : "Logo de SIGOV");

  if (error) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[22px] font-bold leading-none tracking-[0.18em] text-label ${className}`}
        style={variante === "isotipo" ? { width, height } : undefined}
        aria-label={textoAlt}
      >
        {PRODUCTO.nombre}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={textoAlt}
      width={width}
      height={height}
      priority={priority}
      onError={() => setError(true)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: "auto", height: "auto", maxWidth: width, maxHeight: height }}
    />
  );
}

export function IsotipoSigov({
  size = 40,
  priority = false,
  className = "",
  alt = "Isotipo de SIGOV",
}: {
  size?: number;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  return (
    <LogoSigov
      variante="isotipo"
      width={size}
      height={size}
      priority={priority}
      className={className}
      alt={alt}
    />
  );
}

/**
 * Escudo del cuartel, complementario a la marca SIGOV.
 * Se muestra completo, sin recortes, usando la ruta de configuración.
 */
export function EscudoCuartel({
  nombre = CUARTEL.nombre,
  size = 32,
  className = "",
}: {
  nombre?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={CUARTEL.escudo}
      alt={`Escudo de ${nombre}`}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function WordmarkSigov({
  className = "",
  mostrarDenominacion = false,
}: {
  className?: string;
  mostrarDenominacion?: boolean;
}) {
  return (
    <span className={`inline-flex min-w-0 flex-col ${className}`}>
      <span className="text-[22px] font-bold leading-none tracking-[0.18em] text-label">
        {PRODUCTO.nombre}
      </span>
      {mostrarDenominacion ? (
        <span className="mt-1 text-[13px] leading-relaxed text-label-2">
          {PRODUCTO.nombreCompleto}
        </span>
      ) : null}
    </span>
  );
}

export function MarcaSigov({
  size = 40,
  mostrarDenominacion = false,
  priority = false,
  className = "",
}: {
  size?: number;
  mostrarDenominacion?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <IsotipoSigov size={size} priority={priority} alt="" />
      <WordmarkSigov mostrarDenominacion={mostrarDenominacion} />
    </span>
  );
}
