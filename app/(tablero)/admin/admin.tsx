"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Plus,
  UserX,
  Users,
} from "lucide-react";
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Badge, CARGOS, isCargo, type Cargo } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Buscador } from "@/components/ui/buscador";
import { Contador } from "@/components/ui/contador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Fila } from "@/components/ui/fila";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Segmentado } from "@/components/ui/segmentado";
import { Select } from "@/components/ui/select";
import { isOficial } from "@/lib/cargos";
import { VENTANA_DIAS } from "@/lib/tablero";
import { crearBombero, darDeBajaBombero } from "./actions";
import type { RosterBombero } from "./page";

type Seccion = "personal" | "turnos";
type ErrorUI = { texto: string; tono: "rojo" | "amarillo" };

function iniciales(nombre: string): string {
  const palabras = nombre.split(/[\s,]+/).filter(Boolean);
  const siglas = `${palabras[0]?.[0] ?? ""}${palabras[1]?.[0] ?? ""}`.toUpperCase();
  return siglas || "?";
}

export function Admin({ bomberos }: { bomberos: RosterBombero[] }) {
  const router = useRouter();

  const [seccion, setSeccion] = useState<Seccion>("personal");
  const [busqueda, setBusqueda] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<ErrorUI | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [legajo, setLegajo] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargoNuevo, setCargoNuevo] = useState<Cargo>("Bombero");

  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [cargoDetalle, setCargoDetalle] = useState<Cargo>("Bombero");
  const [bajaId, setBajaId] = useState<string | null>(null);
  const [bajasAbiertas, setBajasAbiertas] = useState(false);
  const [generarAbierto, setGenerarAbierto] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function limpiarAvisos() {
    setError(null);
    setToast(null);
  }

  const totalOficiales = useMemo(
    () => bomberos.filter((b) => isCargo(b.cargo) && isOficial(b.cargo)).length,
    [bomberos]
  );

  const bomberosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return bomberos;
    const q = busqueda.toLowerCase().trim();
    return bomberos.filter(
      (b) =>
        b.nombre_completo.toLowerCase().includes(q) ||
        String(b.numero_ingreso).includes(q) ||
        b.cargo.toLowerCase().includes(q)
    );
  }, [bomberos, busqueda]);

  const detalle = bomberos.find((b) => b.id === detalleId) ?? null;
  const baja = bomberos.find((b) => b.id === bajaId) ?? null;

  function abrirDetalle(bombero: RosterBombero) {
    limpiarAvisos();
    setCargoDetalle(isCargo(bombero.cargo) ? bombero.cargo : "Bombero");
    setDetalleId(bombero.id);
  }

  function cerrarBaja() {
    const id = bajaId;
    setBajaId(null);
    if (id) setDetalleId(id);
  }

  async function onAlta(evento: FormEvent) {
    evento.preventDefault();
    limpiarAvisos();
    if (!/^\d{3}$/.test(legajo)) {
      setError({ texto: "Ingresá un legajo de tres dígitos.", tono: "rojo" });
      return;
    }
    setPendiente(true);
    const resultado = await crearBombero(Number(legajo), nombre, cargoNuevo);
    setPendiente(false);
    if (resultado.ok) {
      setNuevoAbierto(false);
      setLegajo("");
      setNombre("");
      setCargoNuevo("Bombero");
      setToast("Bombero agregado al padrón.");
      router.refresh();
    } else {
      setError({ texto: resultado.error, tono: "rojo" });
    }
  }

  async function onBaja() {
    if (!bajaId) return;
    const objetivo = bomberos.find((b) => b.id === bajaId);
    limpiarAvisos();
    setPendiente(true);
    const resultado = await darDeBajaBombero(bajaId);
    setPendiente(false);
    setBajaId(null);
    if (resultado.ok) {
      setDetalleId(null);
      setToast("Bombero dado de baja del padrón activo.");
      router.refresh();
    } else {
      setError({
        texto: resultado.error,
        tono: resultado.error.includes("último oficial") ? "amarillo" : "rojo",
      });
      if (objetivo) setDetalleId(objetivo.id);
    }
  }

  function confirmarGenerar() {
    setGenerarAbierto(false);
    setToast(
      "Los turnos de la ventana los genera el cron diario; esta pantalla no crea turnos por su cuenta."
    );
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <EncabezadoIsla
        titulo="Administración"
        subtitulo="Personal y turnos del cuartel"
        icono={Users}
        estado={{ tono: "ok", texto: `${bomberos.length} bomberos activos` }}
        acciones={[
          {
            icono: Plus,
            etiqueta: "Agregar bombero",
            onClick: () => {
              limpiarAvisos();
              setNuevoAbierto(true);
            },
            principal: true,
          },
          {
            icono: CalendarClock,
            etiqueta: "Generar turnos",
            onClick: () => setGenerarAbierto(true),
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 lg:px-8">
        <Segmentado
          etiqueta="Sección de administración"
          opciones={[
            { valor: "personal", etiqueta: "Personal" },
            { valor: "turnos", etiqueta: "Turnos" },
          ]}
          valor={seccion}
          onChange={(valor) => setSeccion(valor === "turnos" ? "turnos" : "personal")}
        />

        {error ? (
          <div
            role={error.tono === "amarillo" ? "status" : "alert"}
            className={`mt-4 rounded-[14px] px-4 py-3 text-[15px] ${
              error.tono === "amarillo"
                ? "bg-yellow-tint text-yellow-ink"
                : "bg-red-tint text-red"
            }`}
          >
            {error.texto}
          </div>
        ) : null}

        {seccion === "personal" ? (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Contador valor={bomberos.length} etiqueta="Activos" tono="fire" icono="Users" />
              <Contador
                valor={totalOficiales}
                etiqueta="Oficiales"
                tono="brass"
                icono="ShieldCheck"
              />
              <Contador
                valor={VENTANA_DIAS}
                etiqueta="Días de ventana"
                tono="ok"
                icono="CalendarRange"
                className="col-span-2 sm:col-span-1"
              />
            </div>

            <Buscador
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar por nombre o legajo"
              etiqueta="Buscar bombero"
            />

            {bomberosFiltrados.length === 0 ? (
              <EstadoVacio
                icono="UserRoundSearch"
                titulo="Sin resultados"
                texto="No se encontraron bomberos que coincidan con la búsqueda."
              />
            ) : (
              <Grupo titulo={`Padrón activo (${bomberosFiltrados.length})`}>
                {bomberosFiltrados.map((bombero) => {
                  const oficial = isCargo(bombero.cargo) && isOficial(bombero.cargo);
                  return (
                    <button
                      key={bombero.id}
                      type="button"
                      onClick={() => abrirDetalle(bombero)}
                      className="fila tap flex w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
                    >
                      <span
                        aria-hidden
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
                          oficial
                            ? "bg-yellow-tint text-yellow-ink"
                            : "bg-surface-2 text-label-2"
                        }`}
                      >
                        {iniciales(bombero.nombre_completo)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold text-label">
                          {bombero.nombre_completo}
                        </span>
                        <span className="num mt-0.5 block text-[15px] text-label-2">
                          Legajo {String(bombero.numero_ingreso).padStart(3, "0")}
                        </span>
                      </span>
                      {isCargo(bombero.cargo) ? (
                        <Badge cargo={bombero.cargo} className="shrink-0" />
                      ) : null}
                      <ChevronRight
                        size={22}
                        strokeWidth={1.75}
                        className="shrink-0 text-label-3"
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </Grupo>
            )}

            <div>
              <button
                type="button"
                onClick={() => setBajasAbiertas((abiertas) => !abiertas)}
                aria-expanded={bajasAbiertas}
                className="tap flex min-h-11 w-full items-center justify-between rounded-[14px] bg-surface px-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
              >
                <span className="text-[15px] font-medium text-label-2">Dados de baja</span>
                <ChevronDown
                  size={22}
                  strokeWidth={1.75}
                  className={`shrink-0 text-label-3 transition-transform duration-200 ${
                    bajasAbiertas ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {bajasAbiertas ? (
                <Grupo className="mt-2">
                  <Fila
                    titulo="Sin detalle en esta vista"
                    subtitulo="El padrón cargado incluye solo el personal activo."
                  />
                </Grupo>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Contador valor="—" etiqueta="Días cubiertos" tono="ok" icono="CalendarCheck2" />
              <Contador valor="—" etiqueta="Cupos libres" tono="alarm" icono="Users" />
              <Contador valor="—" etiqueta="Celdas completas" tono="ink" icono="CheckCircle2" />
              <Contador
                valor={VENTANA_DIAS}
                etiqueta="Días consultados"
                tono="fire"
                icono="CalendarRange"
              />
            </div>
            <p className="rounded-[14px] bg-surface px-4 py-3 text-[15px] text-label-2">
              El detalle de cobertura de los próximos {VENTANA_DIAS} días está en Guardias.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setGenerarAbierto(true)}
            >
              <CalendarClock size={20} strokeWidth={1.75} aria-hidden />
              Generar turnos de la ventana
            </Button>
          </div>
        )}
      </div>

      <Hoja
        open={detalle !== null}
        onClose={() => setDetalleId(null)}
        title="Detalle del bombero"
        footer={
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (!detalle) return;
              setBajaId(detalle.id);
              setDetalleId(null);
            }}
          >
            <UserX size={20} strokeWidth={1.75} aria-hidden />
            Dar de baja
          </Button>
        }
      >
        {detalle ? (
          <div className="space-y-4">
            <Grupo titulo="Datos">
              <Fila
                titulo="Legajo"
                valor={
                  <span className="num text-[17px] text-label-2">
                    {String(detalle.numero_ingreso).padStart(3, "0")}
                  </span>
                }
                chevron={false}
              />
              <Fila
                titulo="Estado"
                valor={
                  <span className="rounded-full bg-green-tint px-3 py-1 text-[13px] font-semibold text-green-ink">
                    Activo
                  </span>
                }
                chevron={false}
              />
            </Grupo>
            <Select
              label="Cargo"
              value={cargoDetalle}
              disabled
              hint="Los cambios de cargo se revalidan desde la base en la próxima acción."
              onChange={(evento) => {
                if (isCargo(evento.target.value)) setCargoDetalle(evento.target.value);
              }}
            >
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </Hoja>

      <Hoja
        open={baja !== null}
        onClose={cerrarBaja}
        title="Dar de baja"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button variant="secondary" className="w-full" onClick={cerrarBaja}>
              Cancelar
            </Button>
            <Button className="w-full" onClick={() => void onBaja()} disabled={pendiente}>
              Dar de baja
            </Button>
          </div>
        }
      >
        <p className="text-[17px] leading-relaxed text-label">
          ¿Dar de baja a <span className="font-semibold">{baja?.nombre_completo}</span>? Va a perder
          el acceso en su próxima acción y se liberan sus guardias.
        </p>
      </Hoja>

      <Hoja
        open={nuevoAbierto}
        onClose={() => setNuevoAbierto(false)}
        title="Nuevo bombero"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setNuevoAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-nuevo-bombero"
              className="w-full"
              disabled={pendiente}
            >
              {pendiente ? "Agregando…" : "Agregar bombero"}
            </Button>
          </div>
        }
      >
        <form id="form-nuevo-bombero" onSubmit={onAlta} className="space-y-4">
          <Input
            label="Legajo"
            inputMode="numeric"
            autoComplete="off"
            placeholder="014"
            maxLength={3}
            value={legajo}
            onChange={(evento) =>
              setLegajo(evento.target.value.replace(/\D/g, "").slice(0, 3))
            }
            hint="Tres dígitos."
          />
          <Input
            label="Apellido y nombre"
            autoComplete="off"
            placeholder="Pérez, Juan"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
          />
          <Select
            label="Cargo"
            value={cargoNuevo}
            onChange={(evento) => {
              if (isCargo(evento.target.value)) setCargoNuevo(evento.target.value);
            }}
          >
            {CARGOS.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </Select>
        </form>
      </Hoja>

      <Hoja
        open={generarAbierto}
        onClose={() => setGenerarAbierto(false)}
        title="Generar turnos"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setGenerarAbierto(false)}
            >
              Cancelar
            </Button>
            <Button className="w-full" onClick={confirmarGenerar}>
              Entendido
            </Button>
          </div>
        }
      >
        <p className="text-[17px] leading-relaxed text-label">
          La ventana de {VENTANA_DIAS} días se genera automáticamente cada día. Esta pantalla no
          crea turnos por su cuenta.
        </p>
      </Hoja>

      {toast ? (
        <div
          role="status"
          className="no-print fixed inset-x-4 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-label px-5 py-3 text-center text-[15px] font-medium text-surface animate-fade-in lg:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
