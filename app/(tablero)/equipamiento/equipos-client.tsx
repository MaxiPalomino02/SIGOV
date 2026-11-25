"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, Search, Wrench } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { QuickAction } from "@/components/ui/quick-action";
import { StatusPill, type EstadoStatusPill } from "@/components/ui/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Aviso } from "@/components/ui/aviso";
import { Hoja } from "@/components/ui/hoja";
import { Badge } from "@/components/ui/badge";
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

function estadoPill(estado: EstadoEquipo): EstadoStatusPill {
  if (estado === "operativo") return "operativo";
  if (estado === "en_reparacion") return "pendiente";
  return "fuera-de-servicio";
}

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

type Props = { oficial: boolean };

export function EquiposClient({ oficial }: Props) {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState<EstadoEquipo | "todos">("todos");

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
      return (
        e.codigo.toLowerCase().includes(q) ||
        e.nombre.toLowerCase().includes(q) ||
        e.categoria.toLowerCase().includes(q) ||
        e.ubicacion.toLowerCase().includes(q)
      );
    });
  }, [equipos, busqueda, filtroCategoria, filtroEstado]);

  const abrirCrear = () => {
    setEquipoEditando(null);
    setForm({ codigo: "", nombre: "", categoria: "", ubicacion: "", estado: "operativo", notas: "" });
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
    setErrorForm(null);
    setHojaForm("editar");
  };

  const guardarForm = async () => {
    setGuardando(true);
    setErrorForm(null);
    let res;
    if (hojaForm === "crear") {
      res = await crearEquipo(form);
    } else if (equipoEditando) {
      res = await editarEquipo({ equipoId: equipoEditando.id, ...form });
    } else {
      setGuardando(false);
      return;
    }
    if (!res.ok) setErrorForm(res.error);
    else {
      setHojaForm(null);
      setEquipoEditando(null);
      await cargar();
      if (ficha && equipoEditando && ficha.id === equipoEditando.id) {
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

  const abrirCambioEstado = (e: Equipo) => {
    setFicha(e);
    setNuevoEstado(e.estado === "operativo" ? "en_reparacion" : "operativo");
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
      await cargar();
      const resEquipos = await obtenerEquipos();
      const actualizado = resEquipos.ok ? (resEquipos.data.find((x) => x.id === ficha.id) ?? null) : null;
      if (actualizado) setFicha(actualizado);
      const mov = await obtenerMovimientosEquipo(ficha.id);
      if (mov.ok) setMovimientos(mov.data);
    }
    setGuardandoEstado(false);
  };

  return (
    <div className="space-y-4">
      <SectionHeading
        titulo="Equipamiento"
        descripcion="Listado, fichas e historial de equipos del cuartel."
        accion={
          oficial ? <QuickAction icono={Plus} titulo="Nuevo equipo" onClick={abrirCrear} /> : null
        }
      />

      <DashboardCard
        titulo="Equipos"
        descripcion="Buscá por código, nombre, categoría o ubicación y filtrá por estado."
        encabezadoAccion={
          <Button variant="ghost" size="sm" onClick={() => void cargar()} aria-label="Actualizar listado">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar equipo..."
                className="pl-9"
                aria-label="Buscar equipo"
              />
            </div>
          </div>
          <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} aria-label="Filtrar por categoría">
            <option value="todas">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoEquipo | "todos")}
            aria-label="Filtrar por estado"
          >
            <option value="todos">Todos los estados</option>
            {ESTADOS_EQUIPO.map((est) => (
              <option key={est} value={est}>{ETIQUETAS_ESTADO_EQUIPO[est]}</option>
            ))}
          </Select>
        </div>

        {cargando ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <Aviso variante="error">{error}</Aviso>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-4 py-8 text-center text-ink-muted">
            <Wrench className="h-8 w-8" aria-hidden />
            <p className="text-[14px]">
              {equipos.length === 0 ? "No hay equipos registrados." : "No hay equipos que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-ink-muted">{e.codigo}</span>
                    <p className="font-semibold text-ink truncate">{e.nombre}</p>
                    <Badge cargo="Bombero" />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {e.categoria}{e.ubicacion ? ` · ${e.ubicacion}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <StatusPill estado={estadoPill(e.estado)} className="text-[11px]" />
                  <Button variant="ghost" size="sm" onClick={() => void abrirFicha(e)} aria-label={`Ver ficha de ${e.nombre}`}>
                    <Eye className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => abrirCambioEstado(e)}>
                    Cambiar estado
                  </Button>
                  {oficial ? (
                    <Button variant="ghost" size="sm" onClick={() => abrirEditar(e)} aria-label={`Editar ${e.nombre}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <Hoja
        open={!!hojaForm}
        onClose={() => { setHojaForm(null); setEquipoEditando(null); }}
        title={hojaForm === "crear" ? "Nuevo equipo" : "Editar equipo"}
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void guardarForm(); }}>
          {errorForm ? <Aviso variante="error">{errorForm}</Aviso> : null}
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Código *</span>
            <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} maxLength={40} required />
          </div>
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Nombre *</span>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={120} required />
          </div>
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Categoría *</span>
            <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} maxLength={80} required />
          </div>
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Ubicación</span>
            <Input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} maxLength={120} />
          </div>
          {hojaForm === "crear" ? (
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Estado inicial</span>
              <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoEquipo })}>
                {ESTADOS_EQUIPO.map((est) => (
                  <option key={est} value={est}>{ETIQUETAS_ESTADO_EQUIPO[est]}</option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Notas</span>
            <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} maxLength={1000} />
          </div>
          <div className="flex gap-3 pt-2 border-t border-line">
            <Button type="submit" className="flex-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setHojaForm(null); setEquipoEditando(null); }}>
              Cancelar
            </Button>
          </div>
        </form>
      </Hoja>

      <Hoja
        open={!!ficha && !hojaEstado}
        onClose={cerrarFicha}
        title={ficha ? `Ficha: ${ficha.nombre}` : "Ficha"}
        className="max-w-2xl"
      >
        {ficha ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-bg-subtle p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] font-bold text-ink-muted">{ficha.codigo}</span>
                <StatusPill estado={estadoPill(ficha.estado)} />
              </div>
              <p className="text-[14px] text-ink"><span className="font-semibold">Categoría:</span> {ficha.categoria}</p>
              <p className="text-[14px] text-ink"><span className="font-semibold">Ubicación:</span> {ficha.ubicacion || "Sin especificar"}</p>
              {ficha.notas ? <p className="text-[14px] text-ink-muted whitespace-pre-wrap">{ficha.notas}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => abrirCambioEstado(ficha)}>Cambiar estado</Button>
              {oficial ? <Button variant="secondary" size="sm" onClick={() => { cerrarFicha(); abrirEditar(ficha); }}>Editar</Button> : null}
            </div>
            <div className="space-y-2">
              <h4 className="heading-display text-base text-ink">Historial de movimientos</h4>
              {cargandoMov ? (
                <div className="space-y-2" aria-busy="true">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : errorMov ? (
                <Aviso variante="error">{errorMov}</Aviso>
              ) : movimientos.length === 0 ? (
                <div className="rounded-lg border border-line-subtle bg-bg-subtle px-4 py-6 text-center text-[14px] text-ink-muted">
                  Sin movimientos registrados.
                </div>
              ) : (
                <div className="space-y-2">
                  {movimientos.map((m) => (
                    <div key={m.id} className="rounded-lg border border-line bg-surface p-3">
                      <p className="text-[14px] font-semibold text-ink">{etiquetaAccionMovimiento(m.accion)}</p>
                      <p className="font-mono text-[11px] text-ink-muted mt-1">
                        {formatearFecha(m.fecha)} · {m.bombero_nombre ?? "Bombero"}
                      </p>
                      {m.nota ? <p className="mt-1 text-[13px] text-ink-muted">{m.nota}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Hoja>

      <Hoja
        open={hojaEstado}
        onClose={() => setHojaEstado(false)}
        title={ficha ? `Cambiar estado: ${ficha.nombre}` : "Cambiar estado"}
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void guardarCambioEstado(); }}>
          {errorEstado ? <Aviso variante="error">{errorEstado}</Aviso> : null}
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Nuevo estado</span>
            <Select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value as EstadoEquipo)}>
              {ESTADOS_EQUIPO.map((est) => (
                <option key={est} value={est}>{ETIQUETAS_ESTADO_EQUIPO[est]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-[14px] font-semibold text-ink">Nota *</span>
            <Textarea
              value={notaEstado}
              onChange={(e) => setNotaEstado(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Describí el motivo del cambio..."
              required
            />
          </div>
          <p className="text-[13px] text-ink-muted">
            El cambio de estado queda registrado en el historial del equipo.
          </p>
          <div className="flex gap-3 pt-2 border-t border-line">
            <Button type="submit" className="flex-1" disabled={guardandoEstado || !notaEstado.trim()}>
              {guardandoEstado ? "Guardando..." : "Guardar cambio"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setHojaEstado(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Hoja>
    </div>
  );
}
