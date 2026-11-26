"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Radio,
  Shield,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Buscador } from "@/components/ui/buscador";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Segmentado } from "@/components/ui/segmentado";
import { FotoInput } from "@/components/ui/foto-input";
import {
  type Equipo,
  type EquipoMovimiento,
  type EstadoEquipo,
  ESTADOS_EQUIPO,
  ETIQUETAS_ESTADO_EQUIPO,
  etiquetaAccionMovimiento,
} from "@/lib/equipos";
import {
  obtenerEquipos,
  obtenerMovimientosEquipo,
  crearEquipo,
  editarEquipo,
  cambiarEstadoEquipo,
} from "./actions";

const ESTADO_CHIPS: Array<{ valor: EstadoEquipo; etiqueta: string }> = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "en_reparacion", etiqueta: "En reparación" },
  { valor: "baja", etiqueta: "Baja" },
];

function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function iconoCategoria(categoria: string): LucideIcon {
  const c = categoria.toLowerCase();
  if (c.includes("radio") || c.includes("comunic")) return Radio;
  if (c.includes("epp") || c.includes("protecc") || c.includes("seguridad")) return Shield;
  if (c.includes("herram") || c.includes("repar")) return Wrench;
  return Package;
}

function ChipEstado({ estado }: { estado: EstadoEquipo }) {
  const clases =
    estado === "operativo"
      ? "bg-green-tint text-green-ink"
      : estado === "en_reparacion"
        ? "bg-yellow-tint text-yellow-ink"
        : "bg-surface-2 text-label-2";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] font-medium ${clases}`}>
      {ETIQUETAS_ESTADO_EQUIPO[estado]}
    </span>
  );
}

function esDesdeChequeo(m: EquipoMovimiento) {
  const texto = `${m.accion} ${m.nota}`.toLowerCase();
  return texto.includes("chequeo");
}

type Props = { oficial: boolean };

export function EquiposClient({ oficial }: Props) {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoEquipo>("todos");

  const [hojaForm, setHojaForm] = useState<"crear" | "editar" | null>(null);
  const [equipoEditando, setEquipoEditando] = useState<Equipo | null>(null);
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    categoria: "",
    ubicacion: "",
    estado: "operativo" as EstadoEquipo,
    notas: "",
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [ficha, setFicha] = useState<Equipo | null>(null);
  const [movimientos, setMovimientos] = useState<EquipoMovimiento[]>([]);
  const [cargandoMov, setCargandoMov] = useState(false);
  const [errorMov, setErrorMov] = useState<string | null>(null);

  const [hojaEstado, setHojaEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoEquipo>("en_reparacion");
  const [notaEstado, setNotaEstado] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const res = await obtenerEquipos();
    if (res.ok) setEquipos(res.data);
    else setError(res.error);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const categorias = useMemo(() => {
    const set = new Set(equipos.map((e) => e.categoria));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [equipos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return equipos.filter((e) => {
      if (filtroCategoria !== "todas" && e.categoria !== filtroCategoria) return false;
      if (filtroEstado !== "todos" && e.estado !== filtroEstado) return false;
      if (!q) return true;
      return e.codigo.toLowerCase().includes(q) || e.nombre.toLowerCase().includes(q);
    });
  }, [equipos, busqueda, filtroCategoria, filtroEstado]);

  const abrirCrear = () => {
    setEquipoEditando(null);
    setForm({ codigo: "", nombre: "", categoria: "", ubicacion: "", estado: "operativo", notas: "" });
    setFoto(null);
    setErrorForm(null);
    setHojaForm("crear");
  };

  const abrirEditar = (e: Equipo) => {
    setEquipoEditando(e);
    setForm({
      codigo: e.codigo,
      nombre: e.nombre,
      categoria: e.categoria,
      ubicacion: e.ubicacion,
      estado: e.estado,
      notas: e.notas,
    });
    setFoto(null);
    setErrorForm(null);
    setHojaForm("editar");
  };

  const guardarForm = async () => {
    setGuardando(true);
    setErrorForm(null);
    const res =
      hojaForm === "crear"
        ? await crearEquipo(form)
        : equipoEditando
          ? await editarEquipo({ equipoId: equipoEditando.id, ...form })
          : null;
    if (!res) {
      setGuardando(false);
      return;
    }
    if (!res.ok) setErrorForm(res.error);
    else {
      setHojaForm(null);
      setEquipoEditando(null);
      await cargar();
      if (ficha && equipoEditando && ficha.id === equipoEditando.id) {
        const resEquipos = await obtenerEquipos();
        if (resEquipos.ok) {
          setEquipos(resEquipos.data);
          const actualizado = resEquipos.data.find((x) => x.id === equipoEditando.id) ?? null;
          if (actualizado) setFicha(actualizado);
        }
        const mov = await obtenerMovimientosEquipo(equipoEditando.id);
        if (mov.ok) setMovimientos(mov.data);
      }
    }
    setGuardando(false);
  };

  const abrirFicha = async (e: Equipo) => {
    setFicha(e);
    setMovimientos([]);
    setErrorMov(null);
    setCargandoMov(true);
    const res = await obtenerMovimientosEquipo(e.id);
    if (res.ok) setMovimientos(res.data);
    else setErrorMov(res.error);
    setCargandoMov(false);
  };

  const cerrarFicha = () => {
    setFicha(null);
    setMovimientos([]);
    setErrorMov(null);
  };

  const abrirCambioEstado = () => {
    if (!ficha) return;
    setNuevoEstado(ficha.estado === "operativo" ? "en_reparacion" : "operativo");
    setNotaEstado("");
    setErrorEstado(null);
    setHojaEstado(true);
  };

  const guardarCambioEstado = async () => {
    if (!ficha) return;
    setGuardandoEstado(true);
    setErrorEstado(null);
    const res = await cambiarEstadoEquipo({ equipoId: ficha.id, estado: nuevoEstado, nota: notaEstado });
    if (!res.ok) setErrorEstado(res.error);
    else {
      setHojaEstado(false);
      const resEquipos = await obtenerEquipos();
      if (resEquipos.ok) setEquipos(resEquipos.data);
      const actualizado = resEquipos.ok ? resEquipos.data.find((x) => x.id === ficha.id) ?? null : null;
      if (actualizado) setFicha(actualizado);
      const mov = await obtenerMovimientosEquipo(ficha.id);
      if (mov.ok) setMovimientos(mov.data);
    }
    setGuardandoEstado(false);
  };

  const fichaActual = ficha ? equipos.find((e) => e.id === ficha.id) ?? ficha : null;
  const IconoFicha = fichaActual ? iconoCategoria(fichaActual.categoria) : Package;

  return (
    <>
      <PageHeader
        titulo="Equipamiento"
        acciones={
          oficial ? (
            <button
              type="button"
              onClick={abrirCrear}
              aria-label="Nuevo equipo"
              className="tap flex h-11 w-11 items-center justify-center rounded-[14px] bg-red text-surface transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              <Plus size={22} strokeWidth={1.75} aria-hidden />
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 pb-8 pt-4 lg:px-8">
        <Buscador
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre o código"
          etiqueta="Buscar equipo"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFiltroCategoria("todas")}
            className={`tap shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
              filtroCategoria === "todas" ? "bg-red text-surface" : "bg-surface text-label-2"
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFiltroCategoria(c)}
              className={`tap shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                filtroCategoria === c ? "bg-red text-surface" : "bg-surface text-label-2"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFiltroEstado("todos")}
            className={`tap shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
              filtroEstado === "todos" ? "bg-red text-surface" : "bg-surface text-label-2"
            }`}
          >
            Todos
          </button>
          {ESTADO_CHIPS.map((e) => (
            <button
              key={e.valor}
              type="button"
              onClick={() => setFiltroEstado(e.valor)}
              className={`tap shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                filtroEstado === e.valor ? "bg-red text-surface" : "bg-surface text-label-2"
              }`}
            >
              {e.etiqueta}
            </button>
          ))}
        </div>

        {error ? (
          <Grupo>
            <div className="px-4 py-5">
              <p className="text-[17px] font-semibold text-label">No se pudo cargar el equipamiento</p>
              <p className="mt-1 text-[15px] text-label-2">{error}</p>
            </div>
          </Grupo>
        ) : cargando ? (
          <Grupo>
            <div className="px-4 py-8 text-center text-[15px] text-label-2">Cargando equipamiento…</div>
          </Grupo>
        ) : filtrados.length === 0 ? (
          <Grupo>
            <div className="px-4 py-8 text-center">
              <Wrench size={22} strokeWidth={1.75} className="mx-auto text-label-3" aria-hidden />
              <p className="mt-2 text-[15px] text-label-2">No se encontraron equipos</p>
            </div>
          </Grupo>
        ) : (
          <Grupo>
            <ul>
              {filtrados.map((e, idx) => {
                const Icono = iconoCategoria(e.categoria);
                const subtitulo = [e.codigo, e.ubicacion].filter(Boolean).join(" · ");
                return (
                  <li key={e.id} className={idx > 0 ? "border-t border-separator" : ""}>
                    <button
                      type="button"
                      onClick={() => void abrirFicha(e)}
                      className="tap flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-label-2">
                        <Icono size={22} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold text-label">{e.nombre}</span>
                        <span className="block truncate text-[15px] text-label-2">{subtitulo}</span>
                      </span>
                      <ChipEstado estado={e.estado} />
                      <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 text-label-3" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Grupo>
        )}
      </div>

      <Hoja
        open={!!fichaActual && !hojaEstado}
        onClose={cerrarFicha}
        title="Ficha del equipo"
        className="sm:max-w-xl"
        footer={
          fichaActual ? (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={abrirCambioEstado}>Cambiar estado</Button>
              {oficial ? (
                <Button variant="secondary" className="flex-1" onClick={() => { const eq = fichaActual; cerrarFicha(); abrirEditar(eq); }}>
                  <Pencil size={22} strokeWidth={1.75} aria-hidden />
                  Editar
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {fichaActual ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[16px] bg-surface-2">
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-2 text-label-3">
                <IconoFicha size={44} strokeWidth={1.75} aria-hidden />
              </div>
            </div>

            <div>
              <h3 className="text-[22px] font-bold text-label">{fichaActual.nombre}</h3>
              <div className="mt-2"><ChipEstado estado={fichaActual.estado} /></div>
            </div>

            <Grupo titulo="Datos">
              {[
                ["Código", fichaActual.codigo],
                ["Categoría", fichaActual.categoria],
                ["Ubicación", fichaActual.ubicacion || "Sin ubicación"],
                ["Notas", fichaActual.notas || "Sin notas"],
              ].map(([k, v], i, arr) => (
                <div key={k} className={`px-4 py-3 ${i < arr.length - 1 ? "border-b border-separator" : ""}`}>
                  <p className="text-[13px] text-label-2">{k}</p>
                  <p className="mt-1 text-[17px] text-label">{v}</p>
                </div>
              ))}
            </Grupo>

            <Grupo titulo="Historial">
              {cargandoMov ? (
                <div className="px-4 py-6 text-center text-[15px] text-label-2">Cargando historial…</div>
              ) : errorMov ? (
                <div className="px-4 py-4 text-[15px] text-red">{errorMov}</div>
              ) : movimientos.length === 0 ? (
                <div className="px-4 py-6 text-center text-[15px] text-label-2">Sin movimientos registrados</div>
              ) : (
                <div className="px-4 py-4">
                  <ol className="space-y-0">
                    {movimientos.map((m, i) => (
                      <li key={m.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < movimientos.length - 1 ? (
                          <span className="absolute left-[4px] top-[14px] h-[calc(100%-10px)] w-px bg-separator" aria-hidden />
                        ) : null}
                        <span className="mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full bg-label-3" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[17px] font-medium text-label">{etiquetaAccionMovimiento(m.accion)}</p>
                            {esDesdeChequeo(m) ? (
                              <span className="rounded-full bg-yellow-tint px-2.5 py-1 text-[13px] font-medium text-yellow-ink">Desde chequeo</span>
                            ) : null}
                          </div>
                          {m.nota ? <p className="mt-0.5 text-[15px] text-label-2">{m.nota}</p> : null}
                          <p className="num mt-1 text-[13px] text-label-2">
                            {m.bombero_nombre ?? "Bombero"} · {formatearFecha(m.fecha)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Grupo>
          </div>
        ) : null}
      </Hoja>

      <Hoja
        open={hojaEstado}
        onClose={() => setHojaEstado(false)}
        title="Cambiar estado"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setHojaEstado(false)} disabled={guardandoEstado}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void guardarCambioEstado()} disabled={guardandoEstado || !notaEstado.trim()}>
              {guardandoEstado ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {errorEstado ? <p role="alert" className="text-[15px] font-semibold text-red">{errorEstado}</p> : null}
          <Segmentado
            etiqueta="Nuevo estado"
            valor={nuevoEstado}
            onChange={(v) => setNuevoEstado(v as EstadoEquipo)}
            opciones={ESTADO_CHIPS.map((e) => ({ valor: e.valor, etiqueta: e.etiqueta }))}
          />
          <Textarea
            label="Nota"
            value={notaEstado}
            onChange={(e) => setNotaEstado(e.target.value)}
            rows={4}
            maxLength={500}
            required
            placeholder="Describí el motivo del cambio"
          />
        </div>
      </Hoja>

      <Hoja
        open={!!hojaForm}
        onClose={() => { setHojaForm(null); setEquipoEditando(null); }}
        title={hojaForm === "crear" ? "Nuevo equipo" : "Editar equipo"}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setHojaForm(null); setEquipoEditando(null); }} disabled={guardando}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void guardarForm()} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {errorForm ? <p role="alert" className="text-[15px] font-semibold text-red">{errorForm}</p> : null}
          <Input label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} maxLength={40} required />
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={120} required />
          <Input label="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} maxLength={80} required />
          <Input label="Ubicación" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} maxLength={120} />
          <Select label="Estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoEquipo })}>
            {ESTADOS_EQUIPO.map((est) => (
              <option key={est} value={est}>{ETIQUETAS_ESTADO_EQUIPO[est]}</option>
            ))}
          </Select>
          <Textarea label="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={4} maxLength={1000} />
          <FotoInput value={foto} onChange={setFoto} label="Foto" />
        </div>
      </Hoja>
    </>
  );
}
