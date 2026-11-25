"use client";

import { useState } from "react";
import { Bell, ClipboardList, ShieldCheck } from "lucide-react";
import { AnilloProgreso } from "@/components/ui/anillo-progreso";
import { Badge } from "@/components/ui/badge";
import { Buscador } from "@/components/ui/buscador";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Contador } from "@/components/ui/contador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Fila } from "@/components/ui/fila";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmentado } from "@/components/ui/segmentado";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function PaginaUI() {
  const [segmento, setSegmento] = useState("Hoy");
  const [notificaciones, setNotificaciones] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [hojaAbierta, setHojaAbierta] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <main className="no-print min-h-screen bg-bg px-5 py-8 text-label">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[34px] font-bold tracking-[-0.4px]">Base del sistema iOS</h1>
        <p className="mt-1 text-[15px] text-label-2">Galería temporal de componentes.</p>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Botones</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Texto</Button>
            <Button variant="danger">Destructivo</Button>
            <Button variant="outline">Contorno</Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Tarjetas</h2>
          <Card className="p-5">
            <p className="text-[17px] font-semibold">Tarjeta de superficie</p>
            <p className="mt-1 text-[15px] text-label-2">Radio de 16 píxeles y sombra mínima.</p>
          </Card>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Distintivos</h2>
          <div className="flex flex-wrap gap-2">
            <Badge cargo="Oficial Principal" />
            <Badge cargo="Cabo" />
            <Badge cargo="Bombero" />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Modal</h2>
          <Button variant="secondary" onClick={() => setModalAbierto(true)}>
            Abrir modal
          </Button>
          <Modal
            open={modalAbierto}
            onClose={() => setModalAbierto(false)}
            title="Confirmar acción"
            confirmLabel="Confirmar"
            onConfirm={() => setModalAbierto(false)}
          >
            Este modal usa la presentación de la hoja.
          </Modal>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Filas</h2>
          <Grupo titulo="Accesos">
            <Fila icono={Bell} titulo="Avisos" subtitulo="Novedades del cuartel" valor="3" onClick={() => undefined} />
            <Fila icono={ClipboardList} titulo="Tareas" subtitulo="Pendientes" valor="5" onClick={() => undefined} />
            <Fila icono={ShieldCheck} titulo="Guardias" valor="Activa" onClick={() => undefined} />
          </Grupo>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Grupos</h2>
          <Grupo titulo="Estado general">
            <Fila titulo="Personal" valor="24" />
            <Fila titulo="Disponibilidad" valor="Operativo" />
          </Grupo>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Segmentado</h2>
          <Segmentado
            etiqueta="Período"
            opciones={[
              { valor: "Hoy", etiqueta: "Hoy" },
              { valor: "Semana", etiqueta: "Semana" },
              { valor: "Mes", etiqueta: "Mes" },
            ]}
            valor={segmento}
            onChange={setSegmento}
          />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Interruptor</h2>
          <Grupo>
            <Switch
              checked={notificaciones}
              onChange={setNotificaciones}
              etiqueta="Notificaciones"
              descripcion="Recibir avisos del cuartel"
            />
          </Grupo>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Chips</h2>
          <div className="flex flex-wrap gap-2">
            <Chip tono="rojo">Alarma</Chip>
            <Chip tono="amarillo">Tu turno</Chip>
            <Chip tono="verde">Operativo</Chip>
            <Chip tono="gris">Sin novedades</Chip>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Hoja</h2>
          <Button variant="secondary" onClick={() => setHojaAbierta(true)}>
            Abrir hoja
          </Button>
          <Hoja
            open={hojaAbierta}
            onClose={() => setHojaAbierta(false)}
            title="Detalle"
            footer={<Button onClick={() => setHojaAbierta(false)}>Entendido</Button>}
          >
            La hoja sube desde abajo en el celular y se centra en escritorio.
          </Hoja>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Input label="Legajo" placeholder="Número de legajo" hint="Solo números." />
          <Textarea label="Observación" placeholder="Escribí una nota breve." />
        </section>

        <section className="mt-6">
          <Select label="Cargo" defaultValue="Bombero">
            <option value="Bombero">Bombero</option>
            <option value="Cabo">Cabo</option>
            <option value="Oficial Ayudante">Oficial Ayudante</option>
          </Select>
        </section>

        <section className="mt-6">
          <Buscador
            etiqueta="Buscar en la galería"
            placeholder="Buscar componente"
            value={busqueda}
            onChange={setBusqueda}
          />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Carga</h2>
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-14 w-full" />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Estado vacío</h2>
          <EstadoVacio
            icono="Inbox"
            titulo="Sin tareas"
            texto="No hay tareas pendientes por ahora."
            accion={{ label: "Actualizar", onClick: () => undefined }}
          />
        </section>

        <section className="mt-8 flex flex-wrap items-center gap-6">
          <Contador valor="12" etiqueta="Guardias" tono="fire" icono="ShieldCheck" />
          <Contador valor="4" etiqueta="Avisos" tono="brass" icono="Bell" />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[22px] font-bold">Progreso</h2>
          <AnilloProgreso valor={72} etiqueta="Cupos completados" />
        </section>
      </div>
    </main>
  );
}
