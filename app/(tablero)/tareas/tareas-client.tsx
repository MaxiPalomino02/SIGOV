"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Aviso } from "@/components/ui/aviso";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { EVENTO_DATOS, encolarOperacion } from "@/lib/cola-sincronizacion";
import { textoHechaPor } from "@/lib/tareas-reglas";
import { borrarTarea, crearTarea, desmarcarTarea, editarTarea, marcarTarea } from "./actions";

export type TareaVista = {
  id: string;
  titulo: string;
  descripcion: string | null;
  asignada_a: string | null;
  asignada_nombre: string | null;
  creada_por: string;
  estado: "pendiente" | "hecha";
  completada_por: string | null;
  completada_nombre: string | null;
  completada_en: string | null;
  creada_en: string;
};

export type BomberoOpcion = { id: string; nombre_completo: string };
type TabKey = "pendientes" | "mias" | "hechas";

function datosFormulario(formData: FormData): Record<string, unknown> {
  return {
    titulo: String(formData.get("titulo") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
    asignada_a: String(formData.get("asignada_a") ?? ""),
  };
}

function hayConexion(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

async function encolarTarea(
  accion: "crear_tarea" | "editar_tarea" | "borrar_tarea" | "marcar_tarea" | "desmarcar_tarea",
  clave: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  if (hayConexion()) return false;
  await encolarOperacion({ tipo: "tarea", accion, clave, payload });
  return true;
}

export function TareasClient({
  inicial,
  cargaError,
  bomberos,
  sessionId,
  esOficial,
}: {
  inicial: TareaVista[];
  cargaError: string | null;
  bomberos: BomberoOpcion[];
  sessionId: string;
  esOficial: boolean;
}) {
  const [tareas, setTareas] = useState<TareaVista[]>(inicial);
  const [tab, setTab] = useState<TabKey>("pendientes");
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [editando, setEditando] = useState<TareaVista | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refrescar = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from("tareas")
        .select(
          "id, titulo, descripcion, asignada_a, creada_por, estado, completada_por, completada_en, creada_en, asignada:bomberos!tareas_asignada_a_fkey(nombre_completo), completador:bomberos!tareas_completada_por_fkey(nombre_completo)"
        )
        .order("creada_en", { ascending: false });
      if (data) {
        setTareas(
          (data as any[]).map((t) => ({
            id: t.id, titulo: t.titulo, descripcion: t.descripcion, asignada_a: t.asignada_a,
            asignada_nombre: t.asignada?.nombre_completo ?? null, creada_por: t.creada_por, estado: t.estado,
            completada_por: t.completada_por, completada_nombre: t.completador?.nombre_completo ?? null,
            completada_en: t.completada_en, creada_en: t.creada_en,
          }))
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null = null;
    try {
      const supabase = createBrowserSupabaseClient();
      channel = supabase.channel("tareas-cambios").on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, () => { void refrescar(); }).subscribe();
    } catch {}
    return () => { try { if (channel) createBrowserSupabaseClient().removeChannel(channel); } catch {} };
  }, [refrescar]);

  useEffect(() => {
    window.addEventListener(EVENTO_DATOS, refrescar);
    return () => window.removeEventListener(EVENTO_DATOS, refrescar);
  }, [refrescar]);

  const pendientes = useMemo(() => tareas.filter((t) => t.estado === "pendiente"), [tareas]);
  const hechas = useMemo(() => tareas.filter((t) => t.estado === "hecha"), [tareas]);
  const mias = useMemo(() => tareas.filter((t) => t.asignada_a === sessionId), [tareas, sessionId]);
  const visibles = tab === "pendientes" ? pendientes : tab === "mias" ? mias : hechas;

  const abrirCrear = () => { setEditando(null); setMensaje(null); setHojaAbierta(true); };
  const abrirEditar = (t: TareaVista) => { setEditando(t); setMensaje(null); setHojaAbierta(true); };

  const onSubmit = async (formData: FormData) => {
    setMensaje(null);
    const tareaEditada = editando;
    const datos = datosFormulario(formData);
    const accion = tareaEditada ? "editar_tarea" : "crear_tarea";
    const clave = tareaEditada ? `tarea:${tareaEditada.id}` : `tarea:nueva:${crypto.randomUUID()}`;
    const pendiente = async () => {
      setHojaAbierta(false); setEditando(null);
      setMensaje({ tipo: "ok", texto: "Tarea guardada en el dispositivo. Se sincronizará cuando vuelva la conexión." });
    };
    startTransition(async () => {
      try {
        const res = tareaEditada ? await editarTarea(tareaEditada.id, formData) : await crearTarea(formData);
        if (res.ok) {
          setHojaAbierta(false); setEditando(null);
          setMensaje({ tipo: "ok", texto: tareaEditada ? "Tarea actualizada." : "Tarea creada." });
          await refrescar();
        } else if (await encolarTarea(accion, clave, { ...datos, tareaId: tareaEditada?.id ?? null })) {
          await pendiente();
        } else setMensaje({ tipo: "error", texto: res.error });
      } catch {
        if (await encolarTarea(accion, clave, { ...datos, tareaId: tareaEditada?.id ?? null })) await pendiente();
        else setMensaje({ tipo: "error", texto: "No se pudo guardar la tarea. Intentá de nuevo." });
      }
    });
  };

  const toggleHecha = async (t: TareaVista) => {
    setMensaje(null); setCargandoId(t.id);
    const accion = t.estado === "pendiente" ? "marcar_tarea" : "desmarcar_tarea";
    const nuevoEstado = t.estado === "pendiente" ? "hecha" : "pendiente";
    const aplicarLocal = () => {
      setTareas((prev) => prev.map((x) => x.id === t.id ? { ...x, estado: nuevoEstado, completada_por: nuevoEstado === "hecha" ? sessionId : null, completada_nombre: null } : x));
      setMensaje({ tipo: "ok", texto: "Tarea guardada en el dispositivo. Se sincronizará cuando vuelva la conexión." });
    };
    try {
      const res = accion === "marcar_tarea" ? await marcarTarea(t.id) : await desmarcarTarea(t.id);
      setCargandoId(null);
      if (res.ok) await refrescar();
      else if (await encolarTarea(accion, `tarea:${t.id}`, { tareaId: t.id })) aplicarLocal();
      else setMensaje({ tipo: "error", texto: res.error });
    } catch {
      setCargandoId(null);
      if (await encolarTarea(accion, `tarea:${t.id}`, { tareaId: t.id })) aplicarLocal();
      else setMensaje({ tipo: "error", texto: "No se pudo actualizar la tarea. Intentá de nuevo." });
    }
  };

  const onBorrar = async (t: TareaVista) => {
    if (!confirm("¿Borrar esta tarea? Esta acción no se puede deshacer.")) return;
    setMensaje(null); setCargandoId(t.id);
    const aplicarLocal = () => {
      setTareas((prev) => prev.filter((x) => x.id !== t.id));
      setMensaje({ tipo: "ok", texto: "Borrado guardado en el dispositivo. Se sincronizará cuando vuelva la conexión." });
    };
    try {
      const res = await borrarTarea(t.id);
      setCargandoId(null);
      if (res.ok) { setMensaje({ tipo: "ok", texto: "Tarea borrada." }); await refrescar(); }
      else if (await encolarTarea("borrar_tarea", `tarea:${t.id}`, { tareaId: t.id })) aplicarLocal();
      else setMensaje({ tipo: "error", texto: res.error });
    } catch {
      setCargandoId(null);
      if (await encolarTarea("borrar_tarea", `tarea:${t.id}`, { tareaId: t.id })) aplicarLocal();
      else setMensaje({ tipo: "error", texto: "No se pudo borrar la tarea. Intentá de nuevo." });
    }
  };

  const tabBtn = (key: TabKey, label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`min-h-11 rounded-[10px] px-3 text-[13px] font-medium transition-colors ${tab === key ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-hover"}`}
    >
      {label} <span className="dato-mono text-[13px]">{count}</span>
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <SectionHeading
        titulo="Tareas"
        descripcion="Tareas del cuartel y asignaciones."
        accion={esOficial ? (
          <button type="button" onClick={abrirCrear} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-fire px-4 text-[16px] font-medium text-ink hover:bg-fire-dark">
            <Plus className="h-4 w-4" aria-hidden /> Nueva tarea
          </button>
        ) : undefined}
      />

      {mensaje ? <Aviso variante={mensaje.tipo === "ok" ? "ok" : "error"}>{mensaje.texto}</Aviso> : null}
      {cargaError ? <Aviso variante="error">{cargaError}</Aviso> : null}

      <div role="tablist" aria-label="Filtro de tareas" className="flex flex-wrap gap-2">
        {tabBtn("pendientes", "Pendientes", pendientes.length)}
        {tabBtn("mias", "Mías", mias.length)}
        {tabBtn("hechas", "Hechas", hechas.length)}
      </div>

      <DashboardCard
        titulo={tab === "pendientes" ? "Tareas pendientes" : tab === "mias" ? "Mis tareas" : "Tareas hechas"}
        descripcion={tab === "hechas" ? "Historial de tareas completadas." : "Marcá una tarea cuando esté lista."}
      >
        {visibles.length === 0 ? (
          <EstadoVacio
            icono="ClipboardList"
            titulo={tab === "hechas" ? "No hay tareas hechas" : "No hay tareas pendientes"}
            texto={tab === "hechas" ? "Las tareas completadas van a aparecer acá." : "Cuando haya tareas, las vas a ver acá."}
          />
        ) : (
          <ul className="space-y-3">
            {visibles.map((t) => {
              const hecha = t.estado === "hecha";
              const puedeEditar = esOficial;
              const puedeBorrar = esOficial;
              return (
                <li key={t.id} className="rounded-[12px] bg-bg-subtle p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => void toggleHecha(t)}
                      disabled={cargandoId === t.id}
                      aria-label={hecha ? `Marcar "${t.titulo}" como pendiente` : `Marcar "${t.titulo}" como hecha`}
                      className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors disabled:opacity-50 ${hecha ? "border-ok bg-ok-light text-ok" : "border-line bg-surface text-ink-muted hover:border-ok hover:text-ok"}`}
                    >
                      {hecha ? <Check className="h-5 w-5" aria-hidden /> : <span className="h-4 w-4 rounded border border-current" aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[16px] font-medium ${hecha ? "text-ink-muted line-through" : "text-ink"}`}>{t.titulo}</p>
                      {t.descripcion ? <p className="mt-1 text-[14px] text-ink-muted">{t.descripcion}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                        <span>{t.asignada_nombre ? `Asignada a ${t.asignada_nombre}` : "Tarea general"}</span>
                        {hecha && t.completada_nombre && t.completada_en ? <span className="text-ok">{textoHechaPor(t.completada_nombre, t.completada_en)}</span> : null}
                      </div>
                    </div>
                    {(puedeEditar || puedeBorrar) ? (
                      <div className="flex shrink-0 items-center gap-1">
                        {puedeEditar ? (
                          <button type="button" onClick={() => abrirEditar(t)} aria-label={`Editar "${t.titulo}"`} className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-muted hover:bg-surface-hover hover:text-ink">
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                        ) : null}
                        {puedeBorrar ? (
                          <button type="button" onClick={() => void onBorrar(t)} disabled={cargandoId === t.id} aria-label={`Borrar "${t.titulo}"`} className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-muted hover:bg-fire-light hover:text-fire disabled:opacity-50">
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>

      <Hoja open={hojaAbierta} onClose={() => { if (!isPending) { setHojaAbierta(false); setEditando(null); } }} title={editando ? "Editar tarea" : "Nueva tarea"}>
        <form action={onSubmit} className="space-y-4">
          <Input id="titulo" name="titulo" label="Título" required defaultValue={editando?.titulo ?? ""} maxLength={120} />
          <Textarea id="descripcion" name="descripcion" label="Descripción (opcional)" defaultValue={editando?.descripcion ?? ""} rows={3} maxLength={500} />
          <Select id="asignada_a" name="asignada_a" label="Asignar a (opcional)" defaultValue={editando?.asignada_a ?? ""}>
            <option value="">Tarea general (sin asignar)</option>
            {bomberos.map((b) => <option key={b.id} value={b.id}>{b.nombre_completo}</option>)}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setHojaAbierta(false); setEditando(null); }} className="min-h-11 rounded-[10px] px-4 text-[16px] font-medium text-ink-muted hover:bg-surface-hover">Cancelar</button>
            <button type="submit" disabled={isPending} className="min-h-11 rounded-[10px] bg-fire px-4 text-[16px] font-medium text-ink hover:bg-fire-dark disabled:opacity-50">
              {isPending ? "Guardando..." : editando ? "Guardar cambios" : "Crear tarea"}
            </button>
          </div>
        </form>
      </Hoja>
    </div>
  );
}
