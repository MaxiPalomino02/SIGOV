"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  ClipboardCheck,
  Siren,
  FileText,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Contador } from "@/components/ui/contador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Pasos } from "@/components/ui/pasos";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ETIQUETAS_TIPO_ACTIVIDAD,
  MAX_FOTOS_PREVENCION,
  TIPOS_ACTIVIDAD_PREVENCION,
  esFotoActividad,
  formatearFechaActividad,
  type ActividadPrevencion,
  type TipoActividadPrevencion,
} from "@/lib/prevencion";
import type { BomberoOption } from "./actions";
import { registrarActividadAction } from "./actions";

type Props = {
  inicial: ActividadPrevencion[];
  cargaError: string | null;
  bomberos: BomberoOption[];
  bomberosError: string | null;
  sessionNombre: string;
  hoy: string;
};

const PASOS_ALTA = [
  { n: 1, label: "Actividad" },
  { n: 2, label: "Detalle y fotos" },
];

const ICONOS_TIPO: Record<TipoActividadPrevencion, typeof MessageCircle> = {
  charla: MessageCircle,
  inspeccion: ClipboardCheck,
  simulacro: Siren,
  otra: FileText,
};

function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

function etiquetaMesLarga(mes: string): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    month: "long",
    year: "numeric",
  }).format(new Date(`${mes}-01T12:00:00-03:00`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function moverMes(mes: string, delta: number): string {
  const [anio, mesNum] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mesNum - 1 + delta, 1, 12, 0, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fechaCorta(fecha: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${fecha}T12:00:00-03:00`));
}

export function PrevencionClient({
  inicial,
  cargaError,
  bomberos,
  bomberosError,
  sessionNombre,
  hoy,
}: Props) {
  const [actividades, setActividades] = useState(inicial);
  const [mesSeleccionado, setMesSeleccionado] = useState(mesDeFecha(hoy));
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [hojaNueva, setHojaNueva] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);

  const seleccionado = actividades.find((a) => a.id === seleccionadoId) ?? null;

  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>([mesDeFecha(hoy)]);
    for (const a of actividades) set.add(mesDeFecha(a.fecha));
    return Array.from(set).sort().reverse();
  }, [actividades, hoy]);

  const actividadesMes = useMemo(
    () => actividades.filter((a) => mesDeFecha(a.fecha) === mesSeleccionado),
    [actividades, mesSeleccionado],
  );

  const conteos = useMemo(() => {
    const r = { charla: 0, inspeccion: 0, simulacro: 0 };
    for (const a of actividadesMes) {
      if (a.tipo === "charla" || a.tipo === "inspeccion" || a.tipo === "simulacro") r[a.tipo] += 1;
    }
    return r;
  }, [actividadesMes]);

  const gruposPorMes = useMemo(() => {
    const grupos = new Map<string, ActividadPrevencion[]>();
    for (const a of actividades) {
      const mes = mesDeFecha(a.fecha);
      const lista = grupos.get(mes) ?? [];
      lista.push(a);
      grupos.set(mes, lista);
    }
    return Array.from(grupos.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [actividades]);

  const abrirNueva = () => {
    setMensaje(null);
    setHojaNueva(true);
  };

  const alGuardar = (actividad: ActividadPrevencion) => {
    setActividades((prev) => [actividad, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en)));
    setMesSeleccionado(mesDeFecha(actividad.fecha));
    setHojaNueva(false);
    setMensaje({ tipo: "ok", texto: "Actividad registrada." });
  };

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <PageHeader
        titulo="Prevención"
        subtitulo="Charlas, inspecciones y simulacros del cuartel."
        acciones={
          <Button onClick={abrirNueva} aria-label="Cargar actividad" className="h-11 w-11 p-0 sm:w-auto sm:px-4 sm:gap-2">
            <Plus size={22} strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5">
        {mensaje ? <Aviso variante={mensaje.tipo}>{mensaje.texto}</Aviso> : null}
        {cargaError ? <Aviso variante="error">{cargaError}</Aviso> : null}
        {bomberosError ? (
          <Aviso variante="alerta" titulo="No se pudo cargar el padrón">
            {bomberosError} Podés guardar la actividad sin responsable.
          </Aviso>
        ) : null}

        <section className="rounded-[16px] bg-surface p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] text-label-2">Conteo del mes</p>
              <p className="mt-1 text-[17px] font-semibold text-label">{etiquetaMesLarga(mesSeleccionado)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMesSeleccionado((m) => moverMes(m, -1))} aria-label="Mes anterior" className="tap flex h-11 w-11 items-center justify-center rounded-[14px] text-label-2 transition-colors duration-200 hover:bg-surface-2">
                <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
              </button>
              <button type="button" onClick={() => setMesSeleccionado((m) => moverMes(m, 1))} aria-label="Mes siguiente" className="tap flex h-11 w-11 items-center justify-center rounded-[14px] text-label-2 transition-colors duration-200 hover:bg-surface-2">
                <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Contador valor={conteos.charla} etiqueta="Charlas" icono="MessageCircle" tono="ink" />
            <Contador valor={conteos.inspeccion} etiqueta="Inspecciones" icono="ClipboardCheck" tono="fire" />
            <Contador valor={conteos.simulacro} etiqueta="Simulacros" icono="Siren" tono="brass" />
          </div>
          {mesesDisponibles.length > 1 ? (
            <label className="mt-4 block">
              <span className="sr-only">Elegir mes</span>
              <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)} className="h-11 w-full rounded-[14px] bg-surface-2 px-4 text-[15px] text-label outline-none ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red">
                {mesesDisponibles.map((m) => <option key={m} value={m}>{etiquetaMesLarga(m)}</option>)}
              </select>
            </label>
          ) : null}
        </section>

        {actividadesMes.length === 0 ? (
          <EstadoVacio
            icono="ClipboardCheck"
            titulo="Todavía no hay actividades este mes"
            texto={actividades.length === 0 ? "Cargá la primera charla, inspección o simulacro." : `Podés cargar una actividad para ${etiquetaMesLarga(mesSeleccionado).toLowerCase()}.`}
            accion={{ label: "Cargar una", onClick: abrirNueva }}
          />
        ) : null}

        {gruposPorMes.map(([mes, lista]) => (
          <Grupo key={mes} titulo={etiquetaMesLarga(mes)}>
            <ul>
              {lista.map((actividad) => {
                const Icono = ICONOS_TIPO[actividad.tipo];
                return (
                  <li key={actividad.id} className="fila relative">
                    <button type="button" onClick={() => setSeleccionadoId(actividad.id)} className="absolute inset-0" aria-label={`Ver ${ETIQUETAS_TIPO_ACTIVIDAD[actividad.tipo].toLowerCase()} en ${actividad.lugar}`} />
                    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-2 text-label-2 pointer-events-none">
                      <Icono size={22} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="relative z-10 min-w-0 flex-1 py-3 pointer-events-none">
                      <p className="truncate text-[17px] font-semibold text-label">{ETIQUETAS_TIPO_ACTIVIDAD[actividad.tipo]} · {actividad.lugar}</p>
                      <p className="mt-0.5 truncate text-[15px] text-label-2">{fechaCorta(actividad.fecha)} · {actividad.responsable_nombre ?? "Sin responsable"}</p>
                    </div>
                    <div className="relative z-10 flex shrink-0 items-center gap-2 pointer-events-none">
                      {actividad.fotos.length > 0 ? (
                        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-label-2">{actividad.fotos.length} {actividad.fotos.length === 1 ? "foto" : "fotos"}</span>
                      ) : null}
                      <ChevronRight size={20} strokeWidth={1.75} className="text-label-3" aria-hidden />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Grupo>
        ))}
      </main>

      {hojaNueva ? (
        <AltaActividadHoja
          bomberos={bomberos}
          hoy={hoy}
          onCerrar={() => setHojaNueva(false)}
          onGuardado={alGuardar}
          sessionNombre={sessionNombre}
        />
      ) : null}

      {seleccionado ? (
        <FichaActividadHoja
          actividad={seleccionado}
          sessionNombre={sessionNombre}
          onCerrar={() => setSeleccionadoId(null)}
          onVerFoto={setFotoGrande}
        />
      ) : null}

      <Hoja open={!!fotoGrande} onClose={() => setFotoGrande(null)} title="Foto">
        {fotoGrande ? (
          <div className="space-y-4">
            <div className="overflow-auto rounded-[16px] bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoGrande} alt="Foto de la actividad" className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setFotoGrande(null)}>Cerrar</Button>
            </div>
          </div>
        ) : null}
      </Hoja>
    </div>
  );
}

function AltaActividadHoja({
  bomberos,
  hoy,
  onCerrar,
  onGuardado,
  sessionNombre,
}: {
  bomberos: BomberoOption[];
  hoy: string;
  onCerrar: () => void;
  onGuardado: (actividad: ActividadPrevencion) => void;
  sessionNombre: string;
}) {
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoActividadPrevencion>("charla");
  const [fecha, setFecha] = useState(hoy);
  const [lugar, setLugar] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [participantes, setParticipantes] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotoTexto, setFotoTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => { if (!guardando) onCerrar(); };

  const agregarFoto = () => {
    const valor = fotoTexto.trim();
    if (!esFotoActividad(valor)) {
      setError("La foto debe ser un enlace http(s) o una ruta que empiece con /.");
      return;
    }
    if (fotos.length >= MAX_FOTOS_PREVENCION) {
      setError(`Podés cargar hasta ${MAX_FOTOS_PREVENCION} fotos.`);
      return;
    }
    setFotos((actuales) => [...actuales, valor]);
    setFotoTexto("");
    setError(null);
  };

  const onFotoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    agregarFoto();
  };

  const continuar = () => {
    if (!lugar.trim()) { setError("Ingresá el lugar de la actividad."); return; }
    if (lugar.trim().length > 200) { setError("El lugar es demasiado largo."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { setError("Ingresá una fecha válida."); return; }
    setError(null);
    setPaso(2);
  };

  const guardar = async () => {
    if (guardando) return;
    if (participantes.trim().length > 1000) { setError("Los participantes son demasiados."); return; }
    if (descripcion.trim().length > 2000) { setError("La descripción es demasiado larga."); return; }
    setGuardando(true);
    setError(null);
    try {
      const input = {
        tipo,
        fecha,
        lugar: lugar.trim(),
        responsable_id: responsableId || null,
        participantes: participantes.trim(),
        descripcion: descripcion.trim(),
        fotos,
      };
      const resultado = await registrarActividadAction(input);
      if (!resultado.ok) { setError(resultado.error); return; }
      const responsable = bomberos.find((b) => b.id === responsableId);
      onGuardado({
        id: resultado.data,
        tipo,
        fecha,
        lugar: lugar.trim(),
        responsable_id: responsableId || null,
        participantes: participantes.trim(),
        descripcion: descripcion.trim(),
        fotos,
        creado_por: "",
        creado_en: new Date().toISOString(),
        responsable_nombre: responsable?.nombre,
        creador_nombre: sessionNombre,
      });
    } catch (err) {
      console.error("Error inesperado al guardar actividad:", err);
      setError("No se pudo guardar la actividad. Revisá tu conexión.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Hoja
      open
      onClose={cerrar}
      title="Nueva actividad"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>Cancelar</Button>
          {paso === 2 ? <Button variant="secondary" onClick={() => setPaso(1)} disabled={guardando}>Atrás</Button> : null}
          {paso === 1 ? (
            <Button onClick={continuar} className="gap-2">Continuar <ChevronRight size={18} strokeWidth={1.75} aria-hidden /></Button>
          ) : (
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <Pasos pasos={PASOS_ALTA} paso={paso} onIr={(d) => (d < paso ? setPaso(d) : undefined)} ariaLabel="Pasos de nueva actividad" />

        {paso === 1 ? (
          <>
            <fieldset>
              <legend className="mb-2 text-[13px] text-label-2">Tipo</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIPOS_ACTIVIDAD_PREVENCION.map((item) => {
                  const Icono = ICONOS_TIPO[item.value];
                  const activo = tipo === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setTipo(item.value)}
                      className={`tap flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[16px] border p-3 text-center transition-colors duration-200 ${activo ? "border-red bg-red-tint text-label" : "border-separator bg-surface-2 text-label-2"}`}
                    >
                      <Icono size={22} strokeWidth={1.75} className={activo ? "text-red" : "text-label-2"} aria-hidden />
                      <span className="text-[13px] font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
            <Input label="Lugar" placeholder="Ej.: Escuela N° 123" value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={200} disabled={guardando} />
          </>
        ) : (
          <>
            <Select label="Responsable" hint="Opcional." value={responsableId} onChange={(e) => setResponsableId(e.target.value)} disabled={guardando}>
              <option value="">Sin responsable asignado</option>
              {bomberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </Select>
            <Textarea label="Participantes" placeholder="Nombres o grupos que participaron..." value={participantes} onChange={(e) => setParticipantes(e.target.value)} maxLength={1000} hint="Opcional. Hasta 1000 caracteres." disabled={guardando} />
            <Textarea label="Descripción" placeholder="¿De qué se trató la actividad?" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} hint="Opcional. Hasta 2000 caracteres." disabled={guardando} />

            <div className="space-y-3">
              <div>
                <p className="text-[13px] text-label-2">Fotos</p>
                <p className="mt-1 text-[13px] text-label-2">Opcional. Hasta {MAX_FOTOS_PREVENCION} fotos. Pegá un enlace http(s) o una ruta que empiece con /.</p>
              </div>
              <div className="flex gap-2">
                <Input aria-label="Enlace o ruta de la foto" placeholder="https://... o /ruta/..." value={fotoTexto} onChange={(e) => setFotoTexto(e.target.value)} onKeyDown={onFotoKeyDown} disabled={guardando} containerClassName="flex-1" />
                <Button variant="secondary" onClick={agregarFoto} disabled={guardando || fotos.length >= MAX_FOTOS_PREVENCION} className="gap-2">
                  <Camera size={18} strokeWidth={1.75} aria-hidden /> Agregar
                </Button>
              </div>
              {fotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {fotos.map((foto, index) => (
                    <div key={`${foto}-${index}`} className="group relative h-[72px] overflow-hidden rounded-[16px] bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFotos((actuales) => actuales.filter((_, i) => i !== index))}
                        aria-label={`Quitar foto ${index + 1}`}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-label shadow-[0_1px_2px_rgba(0,0,0,.04)]"
                      >
                        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <div className="flex h-[72px] items-center justify-center rounded-[16px] bg-surface-2 text-label-3">
                    <ImageIcon size={22} strokeWidth={1.75} aria-hidden />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {error ? <Aviso variante="error">{error}</Aviso> : null}
      </div>
    </Hoja>
  );
}

function FichaActividadHoja({
  actividad,
  sessionNombre,
  onCerrar,
  onVerFoto,
}: {
  actividad: ActividadPrevencion;
  sessionNombre: string;
  onCerrar: () => void;
  onVerFoto: (foto: string) => void;
}) {
  return (
    <Hoja
      open
      onClose={onCerrar}
      title={`${ETIQUETAS_TIPO_ACTIVIDAD[actividad.tipo]} · ${actividad.lugar}`}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onCerrar}>Cerrar</Button></div>}
    >
      <div className="space-y-5">
        <Grupo titulo="Datos">
          <dl>
            <div className="fila"><dt className="w-36 shrink-0 text-[15px] text-label-2">Tipo</dt><dd className="min-w-0 flex-1 py-3 text-[15px] text-label">{ETIQUETAS_TIPO_ACTIVIDAD[actividad.tipo]}</dd></div>
            <div className="fila"><dt className="w-36 shrink-0 text-[15px] text-label-2">Fecha</dt><dd className="min-w-0 flex-1 py-3 text-[15px] text-label">{formatearFechaActividad(actividad.fecha)}</dd></div>
            <div className="fila"><dt className="w-36 shrink-0 text-[15px] text-label-2">Lugar</dt><dd className="min-w-0 flex-1 py-3 text-[15px] text-label">{actividad.lugar}</dd></div>
            <div className="fila"><dt className="w-36 shrink-0 text-[15px] text-label-2">Responsable</dt><dd className="min-w-0 flex-1 py-3 text-[15px] text-label">{actividad.responsable_nombre ?? "Sin responsable asignado"}</dd></div>
            <div className="fila"><dt className="w-36 shrink-0 text-[15px] text-label-2">Registrada por</dt><dd className="min-w-0 flex-1 py-3 text-[15px] text-label">{actividad.creador_nombre ?? sessionNombre}</dd></div>
          </dl>
        </Grupo>

        <Grupo titulo="Participantes">
          <div className="px-4 py-3 text-[15px] text-label whitespace-pre-wrap">{actividad.participantes || "Sin participantes registrados."}</div>
        </Grupo>

        <Grupo titulo="Descripción">
          <div className="px-4 py-3 text-[15px] text-label whitespace-pre-wrap">{actividad.descripcion || "Sin descripción."}</div>
        </Grupo>

        <Grupo titulo="Fotos">
          {actividad.fotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 p-3">
              {actividad.fotos.map((foto, index) => (
                <button key={`${foto}-${index}`} type="button" onClick={() => onVerFoto(foto)} className="aspect-square overflow-hidden rounded-[16px] bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red" aria-label={`Abrir foto ${index + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt={`Foto ${index + 1} de la actividad`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-[15px] text-label-2">Esta actividad no tiene fotos cargadas.</div>
          )}
        </Grupo>
      </div>
    </Hoja>
  );
}
