"use client";

import { useState } from "react";
import { Download, Home, MoreVertical, Share2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Segmentado } from "@/components/ui/segmentado";

type Plataforma = "android" | "iphone";

type Paso = {
  numero: number;
  texto: string;
  icono: LucideIcon;
};

const PASOS: Record<Plataforma, Paso[]> = {
  android: [
    { numero: 1, texto: "Abrí el menú del navegador.", icono: MoreVertical },
    { numero: 2, texto: "Tocá «Instalar app».", icono: Download },
  ],
  iphone: [
    { numero: 1, texto: "Tocá el botón Compartir.", icono: Share2 },
    { numero: 2, texto: "Elegí «Agregar a inicio».", icono: Home },
  ],
};

export function HojaInstalar({
  open,
  onClose,
  plataformaInicial = "android",
  instalable = false,
  onInstalar,
}: {
  open: boolean;
  onClose: () => void;
  plataformaInicial?: Plataforma;
  instalable?: boolean;
  onInstalar?: () => void | Promise<void>;
}) {
  const [plataforma, setPlataforma] = useState<Plataforma>(plataformaInicial);

  return (
    <Hoja
      open={open}
      onClose={onClose}
      title="Cómo instalar SIGOV"
      footer={
        <div className="flex flex-col-reverse gap-2">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Entendido
          </Button>
          {instalable ? (
            <Button className="w-full" onClick={() => void onInstalar?.()}>
              Instalar ahora
            </Button>
          ) : null}
        </div>
      }
    >
      <Segmentado
        opciones={[
          { valor: "android", etiqueta: "Android" },
          { valor: "iphone", etiqueta: "iPhone" },
        ]}
        valor={plataforma}
        onChange={(valor) => setPlataforma(valor as Plataforma)}
        etiqueta="Elegí tu dispositivo"
      />

      <Grupo className="mt-4">
        {PASOS[plataforma].map((paso) => {
          const Icono = paso.icono;
          return (
            <div key={paso.numero} className="fila flex items-center gap-3 px-4 py-3">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red text-[13px] font-semibold text-surface">
                {paso.numero}
              </span>
              <span className="min-w-0 flex-1 text-[17px] text-label">{paso.texto}</span>
              <Icono size={22} strokeWidth={1.75} className="shrink-0 text-label-2" aria-hidden />
            </div>
          );
        })}
      </Grupo>
    </Hoja>
  );
}
