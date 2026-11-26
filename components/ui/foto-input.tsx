"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Camera, Images, LoaderCircle, Trash2 } from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";

type FotoInputProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  maxLado?: number;
  calidad?: number;
  disabled?: boolean;
  className?: string;
};

export async function comprimirFoto(
  file: File,
  maxLado = 1200,
  calidad = 0.8,
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }

  const url = URL.createObjectURL(file);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = url;
    });

    const anchoOriginal = imagen.naturalWidth || imagen.width;
    const altoOriginal = imagen.naturalHeight || imagen.height;
    if (!anchoOriginal || !altoOriginal) {
      throw new Error("La imagen está vacía.");
    }

    const escala = Math.min(1, maxLado / Math.max(anchoOriginal, altoOriginal));
    const ancho = Math.max(1, Math.round(anchoOriginal * escala));
    const alto = Math.max(1, Math.round(altoOriginal * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("No se pudo preparar la imagen.");
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", calidad),
    );
    if (!blob) throw new Error("No se pudo comprimir la imagen.");

    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FotoInput({
  value,
  onChange,
  label = "Foto",
  hint,
  maxLado = 1200,
  calidad = 0.8,
  disabled = false,
  className = "",
}: FotoInputProps) {
  const grupoId = useId();
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const procesar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setError(null);
    setProcesando(true);
    try {
      const comprimido = await comprimirFoto(file, maxLado, calidad);
      onChange(comprimido);
    } catch {
      setError("No pudimos procesar la foto. Probá con otra imagen.");
    } finally {
      setProcesando(false);
    }
  };

  const deshabilitado = disabled || procesando;

  return (
    <div
      role="group"
      aria-labelledby={`${grupoId}-label`}
      className={`flex flex-col gap-2 ${className}`}
    >
      <span
        id={`${grupoId}-label`}
        className="text-[13px] text-label-2"
      >
        {label}
      </span>

      <div className="overflow-hidden rounded-[16px] border border-separator bg-surface">
        <div className="relative aspect-[4/3] w-full bg-surface-2">
          {preview ? (
            <div
              role="img"
              aria-label="Vista previa de la foto"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${preview})` }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-label-2">
              <Camera className="h-8 w-8" aria-hidden />
              <p className="text-[13px]">Sin foto</p>
            </div>
          )}
          {procesando ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-bg/80 text-label">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-[15px] font-semibold">Procesando…</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-separator p-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => camaraRef.current?.click()}
            disabled={deshabilitado}
          >
            <Camera className="h-4 w-4" aria-hidden />
            Tomar foto
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => galeriaRef.current?.click()}
            disabled={deshabilitado}
          >
            <Images className="h-4 w-4" aria-hidden />
            Elegir de galería
          </Button>
          {value ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              disabled={deshabilitado}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={procesar}
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={galeriaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={procesar}
        aria-hidden
        tabIndex={-1}
      />

      {hint ? <p className="text-[13px] text-label-2">{hint}</p> : null}
      {error ? <Aviso variante="error">{error}</Aviso> : null}
    </div>
  );
}
