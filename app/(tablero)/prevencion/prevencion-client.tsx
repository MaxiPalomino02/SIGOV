"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Siren,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Pasos } from "@/components/ui/pasos";
import { QuickAction } from "@/components/ui/quick-action";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
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
import { obtenerActividades, registrarActividadAction } from "./actions";

type Props = {
  inicial: ActividadPrevencion[];
  cargaError: string | null;
  bomberos: BomberoOption[];
  bomberosError: string | null;
  sessionNombre: string;
  hoy: string;
};

type Mensaje = { tipo: "ok" | "error"; texto: string };

const PASOS_ALTA = [
  { n: 1, label: "Datos de la actividad" },
  { n: 2, label: "Detalle y fotos" },
];

const ICONOS_TIPO: Record<TipoActividadPrevencion, LucideIcon> = {
  charla: MessageCircle,
  inspeccion: ClipboardCheck,
  simulacro: Siren,
  otra: FileText,
};

export function PrevencionClient({
  inicial,
  cargaError,
  bomberos,
  bomberosError,
  sessionNombre,
  hoy,
}: Props) {
  const [actividades, setActividades] = useState(inicial);
  const [errorLista, setErrorLista] = useState<string | null>(cargaError);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | TipoActividadPrevencion>(
    "todas"
  );
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [hojaNueva, setHojaNueva] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  const seleccionado =
    actividades.find((actividad) => actividad.id === seleccionadoId) ?? null;

  const conteos = useMemo(() => {
    const resultado: Record<TipoActividadPrevencion, number> = {
      charla: 0,
      inspeccion: 0,
      simulacro: 0,
      otra: 0,
    };
    for (const actividad of actividades) resultado[actividad.tipo] += 1;
    return resultado;
  }, [actividades]);

  const visibles = useMemo(
    () =>
      filtro === "todas"
        ? actividades
        : actividades.filter((actividad) => actividad.tipo === filtro),
    [actividades, filtro]
  );

  const tabs = useMemo(
    () => [
      { value: "todas", label: "Todas", badge: actividades.length },
      ...TIPOS_ACTIVIDAD_PREVENCION.map((tipo) => ({
        value: tipo.value as string,
        label: tipo.label,
        icon: ICONOS_TIPO[tipo.value],
        badge: conteos[tipo.value],
      })),
    ],
    [actividades.length, conteos]
  );

  const refrescar = useCallback(async () => {
    setCargandoLista(true);
    try {
      const resultado = await obtenerActividades();
      if (!resultado.ok) {
        setErrorLista(resultado.error);
        return;
      }
      setActividades(resultado.data);
      setErrorLista(null);
    } catch (err) {
      console.error("Error inesperado al actualizar prevención:", err);
      setErrorLista("No se pudieron cargar las actividades.");
    } finally {
      setCargandoLista(false);
    }
  }, []);

  const abrirNueva = () => {
    setMensaje(null);
    setHojaNueva(true);
  };

  const alGuardar = async () => {
    setHojaNueva(false);
    setMensaje({ tipo: "ok", texto: "Actividad registrada." });
    await refrescar();
  };

  const descripcionLista =
    actividades.length === 0
      ? "Todavía no hay actividades registradas."
      : filtro === "todas"
        ? `${actividades.length} ${actividades.length === 1 ? "actividad registrada" : "actividades registradas"}.`
        : `${visibles.length} de ${actividades.length} actividades.`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeading
        titulo="Prevención"
        descripcion="Registrá charlas, inspecciones y simulacros del cuartel."
        accion={
          <QuickAction
            icono={Plus}
            titulo="Nueva actividad"
            descripcion="Cargala en dos pasos."
            onClick={abrirNueva}
          />
        }
      />

      {mensaje ? (
        <div className="mt-4">
          <Aviso variante={mensaje.tipo}>{mensaje.texto}</Aviso>
        </div>
      ) : null}

      {bomberosError ? (
        <div className="mt-4">
          <Aviso variante="alerta" titulo="No se pudo cargar el padrón">
            {bomberosError} Podés guardar la actividad sin responsable.
          </Aviso>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={refrescar}
            disabled={cargandoLista}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${cargandoLista ? "animate-spin" : ""}`}
              aria-hidden
            />
            Actualizar
          </Button>
        </div>

        <Tabs
          items={tabs}
          value={filtro}
          onChange={(valor) =>
            setFiltro(valor as "todas" | TipoActividadPrevencion)
          }
          ariaLabel="Tipos de actividad"
        />

        <DashboardCard
          titulo="Actividades"
          descripcion={descripcionLista}
          loading={cargandoLista}
          error={errorLista}
        >
          {visibles.length === 0 ? (
            <EstadoVacio
              icono="ShieldCheck"
              titulo={
                filtro === "todas"
                  ? "Todavía no hay actividades"
                  : "No hay actividades de este tipo"
              }
              texto={
                filtro === "todas"
                  ? "Registrá la primera charla, inspección o simulacro."
                  : "Probá con otro tipo de actividad."
              }
              accion={
                filtro === "todas"
                  ? { label: "Nueva actividad", onClick: abrirNueva }
                  : { label: "Ver todas", onClick: () => setFiltro("todas") }
              }
            />
          ) : (
            <ul className="space-y-3">
              {visibles.map((actividad) => (
                <li key={actividad.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccionadoId(actividad.id)}
                    className="flex w-full min-h-12 items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-ink-muted/40 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-ink-muted ring-1 ring-line-subtle">
                      {(() => {
                        const Icono = ICONOS_TIPO[actividad.tipo];
                        return <Icono className="h-5 w-5" aria-hidden />;
                      })()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="break-words font-semibold text-ink">
                          {actividad.lugar}
                        </span>
                        <StatusPill estado={actividad.tipo} />
                      </span>
                      {actividad.descripcion ? (
                        <span className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink-muted">
                          {actividad.descripcion}
                        </span>
                      ) : null}
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-secondary">
                        <span>{formatearFechaActividad(actividad.fecha)}</span>
                        <span>
                          {actividad.responsable_nombre ?? "Sin responsable"}
                        </span>
                        <span>
                          {actividad.participantes || "Sin participantes"}
                        </span>
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-2 h-4 w-4 shrink-0 text-ink-muted"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      {hojaNueva ? (
        <AltaActividadHoja
          bomberos={bomberos}
          hoy={hoy}
          onCerrar={() => setHojaNueva(false)}
          onGuardado={alGuardar}
        />
      ) : null}

      {seleccionado ? (
        <FichaActividadHoja
          actividad={seleccionado}
          sessionNombre={sessionNombre}
          onCerrar={() => setSeleccionadoId(null)}
        />
      ) : null}
    </div>
  );
}

function AltaActividadHoja({
  bomberos,
  hoy,
  onCerrar,
  onGuardado,
}: {
  bomberos: BomberoOption[];
  hoy: string;
  onCerrar: () => void;
  onGuardado: () => void;
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

  const cerrar = () => {
    if (!guardando) onCerrar();
  };

  const agregarFoto = () => {
    const valor = fotoTexto.trim();
    if (!esFotoActividad(valor)) {
      setError("La foto debe ser un enlace http(s) o una ruta que empiece con /.");
      return;
    }
    if (fotos.length >= MAX_FOTOS_PREVENCION) {
      setError(`Se pueden cargar hasta ${MAX_FOTOS_PREVENCION} fotos.`);
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

  const validarPasoUno = (): string | null => {
    if (!lugar.trim()) return "Ingresá el lugar de la actividad.";
    if (lugar.trim().length > 200) return "El lugar es demasiado largo.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "Ingresá una fecha válida.";
    return null;
  };

  const continuar = () => {
    const problema = validarPasoUno();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setPaso(2);
  };

  const guardar = async () => {
    if (guardando) return;
    if (participantes.trim().length > 1000) {
      setError("Los participantes son demasiados.");
      return;
    }
    if (descripcion.trim().length > 2000) {
      setError("La descripción es demasiado larga.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const resultado = await registrarActividadAction({
        tipo,
        fecha,
        lugar: lugar.trim(),
        responsable_id: responsableId || null,
        participantes: participantes.trim(),
        descripcion: descripcion.trim(),
        fotos,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onGuardado();
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
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          {paso === 2 ? (
            <Button variant="secondary" onClick={() => setPaso(1)} disabled={guardando}>
              Atrás
            </Button>
          ) : null}
          {paso === 1 ? (
            <Button onClick={continuar} className="gap-2">
              Continuar
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {guardando ? "Guardando..." : "Guardar actividad"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <Pasos
          pasos={PASOS_ALTA}
          paso={paso}
          onIr={(destino) => (destino < paso ? setPaso(destino) : undefined)}
          ariaLabel="Pasos de la nueva actividad"
        />

        {paso === 1 ? (
          <>
            <fieldset>
              <legend className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                Tipo de actividad
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TIPOS_ACTIVIDAD_PREVENCION.map((item) => {
                  const Icono = ICONOS_TIPO[item.value];
                  const activo = tipo === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setTipo(item.value)}
                      className={`flex min-h-16 flex-col items-start justify-center gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft ${
                        activo
                          ? "border-fire bg-fire-light text-ink"
                          : "border-line bg-surface text-ink-muted hover:bg-surface-hover"
                      }`}
                    >
                      <Icono className="h-5 w-5 text-fire-text" aria-hidden />
                      <span className="text-[14px] font-semibold">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Input
              label="Fecha"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              disabled={guardando}
            />
            <Input
              label="Lugar"
              placeholder="Ej.: Sala de conferencias"
              value={lugar}
              onChange={(event) => setLugar(event.target.value)}
              maxLength={200}
              disabled={guardando}
            />
          </>
        ) : (
          <>
            <Select
              label="Responsable"
              hint="Opcional."
              value={responsableId}
              onChange={(event) => setResponsableId(event.target.value)}
              disabled={guardando}
            >
              <option value="">Sin responsable asignado</option>
              {bomberos.map((bombero) => (
                <option key={bombero.id} value={bombero.id}>
                  {bombero.nombre}
                </option>
              ))}
            </Select>
            <Textarea
              label="Participantes"
              placeholder="Nombres o grupos que participaron..."
              value={participantes}
              onChange={(event) => setParticipantes(event.target.value)}
              maxLength={1000}
              hint="Opcional. Hasta 1000 caracteres."
              disabled={guardando}
            />
            <Textarea
              label="Descripción"
              placeholder="De qué se trató la actividad..."
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              maxLength={2000}
              hint="Opcional. Hasta 2000 caracteres."
              disabled={guardando}
            />

            <div className="space-y-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                Fotos
              </span>
              <div className="flex gap-2">
                <Input
                  aria-label="Enlace o ruta de la foto"
                  placeholder="https://... o /brand/..."
                  value={fotoTexto}
                  onChange={(event) => setFotoTexto(event.target.value)}
                  onKeyDown={onFotoKeyDown}
                  disabled={guardando}
                  containerClassName="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={agregarFoto}
                  disabled={guardando}
                  className="gap-2"
                >
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Agregar
                </Button>
              </div>
              {fotos.length > 0 ? (
                <ul className="space-y-2">
                  {fotos.map((foto, index) => (
                    <li
                      key={`${foto}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-3 py-2 text-[13px] text-ink"
                    >
                      <span className="min-w-0 flex-1 break-all">{foto}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFotos((actuales) =>
                            actuales.filter((_, i) => i !== index)
                          )
                        }
                        aria-label={`Quitar foto ${index + 1}`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-fire-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">
                  Opcional. Hasta {MAX_FOTOS_PREVENCION} enlaces o rutas.
                </p>
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
}: {
  actividad: ActividadPrevencion;
  sessionNombre: string;
  onCerrar: () => void;
}) {
  return (
    <Hoja
      open
      onClose={onCerrar}
      title={actividad.lugar}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill estado={actividad.tipo} />
          <span className="font-mono text-[13px] text-ink-muted">
            {formatearFechaActividad(actividad.fecha)}
          </span>
        </div>

        <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink">
          {actividad.descripcion || "Sin descripción."}
        </p>

        <dl className="grid gap-3 rounded-xl border border-line-subtle bg-bg-subtle p-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Lugar
            </dt>
            <dd className="mt-0.5 text-ink">{actividad.lugar}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Responsable
            </dt>
            <dd className="mt-0.5 text-ink">
              {actividad.responsable_nombre ?? "Sin responsable asignado"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Participantes
            </dt>
            <dd className="mt-0.5 text-ink">
              {actividad.participantes || "Sin participantes registrados"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Registrada por
            </dt>
            <dd className="mt-0.5 text-ink">
              {actividad.creador_nombre ?? sessionNombre}
            </dd>
          </div>
        </dl>

        {actividad.fotos.length > 0 ? (
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Fotos
            </p>
            <ul className="space-y-2">
              {actividad.fotos.map((foto, index) => (
                <li key={`${foto}-${index}`}>
                  <a
                    href={foto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 break-all text-[14px] text-fire-text underline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
                  >
                    <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
                    Ver foto {index + 1}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Aviso variante="info">Esta actividad no tiene fotos cargadas.</Aviso>
        )}

        <p className="text-[13px] text-ink-muted">
          Tipo: {ETIQUETAS_TIPO_ACTIVIDAD[actividad.tipo]} · Registro interno del
          cuartel.
        </p>
      </div>
    </Hoja>
  );
}
