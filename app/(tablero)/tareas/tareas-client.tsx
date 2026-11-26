"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Check, CheckCircle2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Segmentado } from "@/components/ui/segmentado";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { EVENTO_DATOS, encolarOperacion } from "@/lib/cola-sincronizacion";
import { REGLAS_TAREAS, textoHechaPor } from "@/lib/tareas-reglas";
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

function AvisoLocal({ texto, tipo }: { texto: string; tipo: "ok" | "error" }) {
  return (
    <p
      role="status"
      className={`rounded-[14px] px-4 py-3 text-[15px] ${
        tipo === "error" ? "bg-red-tint text-red" : "bg-green-tint text-green-ink"
      }`}
    >
      {texto}
    </p>
  );
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
  const [ahora, setAhora] = useState(0);
  const [motivosBloqueo, setMotivosBloqueo] = useState<Record<string, string>>({});
  const [hojaBloqueo, setHojaBloqueo] = useState<{
    id: string;
    motivo: string;
  } | null>(null);
  const [borrando, setBorrando] = useState<TareaVista | null>(null);
  const [toastEsperandoId, setToastEsperandoId] = useState<string | null>(null);

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

  useEffect(() => {
    const inicial = window.setTimeout(() => setAhora(Date.now()), 0);
    const intervalo = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    if (!toastEsperandoId) return;
    const id = window.setTimeout(() => setToastEsperandoId(null), 3_000);
    return () => window.clearTimeout(id);
  }, [toastEsperandoId]);

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
      else if (accion === "marcar_tarea") {
        if (res.error === "Esta tarea ya fue marcada como hecha.") {
          void refrescar();
          setToastEsperandoId(t.id);
        } else {
          setMotivosBloqueo((prev) => ({ ...prev, [t.id]: res.error }));
          setHojaBloqueo({ id: t.id, motivo: res.error });
        }
      } else setMensaje({ tipo: "error", texto: res.error });
    } catch {
      setCargandoId(null);
      if (await encolarTarea(accion, `tarea:${t.id}`, { tareaId: t.id })) aplicarLocal();
      else setMensaje({ tipo: "error", texto: "No se pudo actualizar la tarea. Intentá de nuevo." });
    }
  };

  const onBorrar = async (t: TareaVista) => {
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

  const textoVacio =
    tab === "pendientes"
      ? "No hay tareas pendientes."
      : tab === "mias"
      ? "No tenés tareas asignadas."
      : "Todavía no hay tareas hechas.";
  const tareaToast = toastEsperandoId
    ? tareas.find((t) => t.id === toastEsperandoId)
    : null;
  const toastTexto = tareaToast?.completada_nombre
    ? `Ya la marcó ${tareaToast.completada_nombre}`
    : null;
  const cerrarFormulario = () => {
    if (!isPending) {
      setHojaAbierta(false);
      setEditando(null);
    }
  };
  const confirmarBorrar = async () => {
    const tarea = borrando;
    if (!tarea) return;
    setBorrando(null);
    await onBorrar(tarea);
  };

  return (
    <>
      <PageHeader
        titulo="Tareas"
        acciones={
          <>
            <span className="num rounded-full bg-surface-2 px-3 py-1 text-[13px] text-label-2">
              {pendientes.length} pendientes
            </span>
            {esOficial ? (
              <button
                type="button"
                onClick={abrirCrear}
                aria-label="Nueva tarea"
                className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red text-surface transition-colors hover:bg-red-pressed"
              >
                <Plus size={22} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </>
        }
      />

      <div className="no-print mx-auto w-full max-w-[1100px] space-y-5 px-4 pb-8 pt-4">
        {mensaje ? <AvisoLocal texto={mensaje.texto} tipo={mensaje.tipo} /> : null}
        {cargaError ? <AvisoLocal texto={cargaError} tipo="error" /> : null}

        <Segmentado
          etiqueta="Filtro de tareas"
          opciones={[
            { valor: "pendientes", etiqueta: "Pendientes" },
            { valor: "mias", etiqueta: "Mis tareas" },
            { valor: "hechas", etiqueta: "Hechas" },
          ]}
          valor={tab}
          onChange={(valor) => setTab(valor as TabKey)}
        />

        {visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[16px] bg-surface px-6 py-12 text-center animate-fade-in">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-tint text-green-ink">
              <CheckCircle2 size={28} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-[17px] text-label-2">{textoVacio}</p>
          </div>
        ) : (
          <Grupo>
            {visibles.map((t) => {
              const hecha = t.estado === "hecha";
              const motivoBloqueo = motivosBloqueo[t.id];
              const bloqueada = !hecha && Boolean(motivoBloqueo);
              const tiempoDesdeHecha = t.completada_en
                ? ahora - new Date(t.completada_en).getTime()
                : Number.POSITIVE_INFINITY;
              const puedeDeshacer =
                esOficial ||
                (tiempoDesdeHecha >= 0 &&
                  tiempoDesdeHecha < REGLAS_TAREAS.desmarcarMinutos * 60_000);
              const hechaPor =
                hecha && t.completada_nombre && t.completada_en
                  ? textoHechaPor(t.completada_nombre, t.completada_en).replace(
                      " - ",
                      ", "
                    )
                  : null;

              return (
                <div
                  key={t.id}
                  className="fila flex items-start gap-3 px-4 py-3 animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (bloqueada && motivoBloqueo) {
                        setHojaBloqueo({ id: t.id, motivo: motivoBloqueo });
                      } else {
                        void toggleHecha(t);
                      }
                    }}
                    aria-disabled={bloqueada || cargandoId === t.id}
                    aria-label={
                      bloqueada
                        ? "La puede marcar quien está de guardia ahora"
                        : hecha
                        ? `Desmarcar "${t.titulo}"`
                        : `Marcar "${t.titulo}" como hecha`
                    }
                    className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
                        bloqueada
                          ? "border-separator bg-surface-2 text-label-3"
                          : hecha
                          ? "border-red bg-red text-surface"
                          : "border-separator bg-surface"
                      }`}
                    >
                      {bloqueada ? (
                        <Lock size={14} strokeWidth={1.75} aria-hidden />
                      ) : hecha ? (
                        <Check size={16} strokeWidth={2.25} aria-hidden />
                      ) : null}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[17px] font-medium ${
                        hecha ? "text-label-2 line-through" : "text-label"
                      }`}
                    >
                      {t.titulo}
                    </p>
                    {t.descripcion ? (
                      <p className="mt-1 line-clamp-2 text-[15px] text-label-2">
                        {t.descripcion}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] text-label-2">
                        {t.asignada_nombre ? `Para ${t.asignada_nombre}` : "General"}
                      </span>
                      {hechaPor ? (
                        <span className="text-[13px] text-label-2">{hechaPor}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {hecha && puedeDeshacer ? (
                      <button
                        type="button"
                        onClick={() => void toggleHecha(t)}
                        disabled={cargandoId === t.id}
                        className="tap min-h-11 rounded-[14px] px-2 text-[13px] font-semibold text-red transition-colors duration-200 disabled:text-label-2 disabled:bg-surface-2"
                      >
                        Deshacer
                      </button>
                    ) : null}
                    {esOficial ? (
                      <>
                        <button
                          type="button"
                          onClick={() => abrirEditar(t)}
                          aria-label={`Editar "${t.titulo}"`}
                          className="tap flex h-11 w-11 items-center justify-center rounded-[14px] text-label-2 transition-colors hover:bg-surface-2 hover:text-label"
                        >
                          <Pencil size={22} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBorrando(t)}
                          aria-label={`Borrar "${t.titulo}"`}
                          className="tap flex h-11 w-11 items-center justify-center rounded-[14px] text-label-2 transition-colors hover:bg-red-tint hover:text-red"
                        >
                          <Trash2 size={22} strokeWidth={1.75} aria-hidden />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Grupo>
        )}
      </div>

      <Hoja
        open={hojaAbierta}
        onClose={cerrarFormulario}
        title={editando ? "Editar tarea" : "Nueva tarea"}
      >
        <form action={onSubmit} className="space-y-4">
          <Input
            id="titulo"
            name="titulo"
            label="Título"
            required
            defaultValue={editando?.titulo ?? ""}
            maxLength={120}
          />
          <Textarea
            id="descripcion"
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={editando?.descripcion ?? ""}
            rows={3}
            maxLength={500}
          />
          <Select
            id="asignada_a"
            name="asignada_a"
            label="Asignar a (opcional)"
            defaultValue={editando?.asignada_a ?? ""}
          >
            <option value="">Tarea general (sin asignar)</option>
            {bomberos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre_completo}
              </option>
            ))}
          </Select>
          <div className="flex flex-col-reverse gap-2 pt-1">
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={cerrarFormulario}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Hoja>

      <Hoja
        open={hojaBloqueo !== null}
        onClose={() => setHojaBloqueo(null)}
        title="No podés marcar esta tarea"
        footer={
          <Button className="w-full" onClick={() => setHojaBloqueo(null)}>
            Entendido
          </Button>
        }
      >
        <div className="space-y-2">
          <p>La puede marcar quien está de guardia ahora.</p>
          <p className="text-[15px] text-label-2">{hojaBloqueo?.motivo}</p>
        </div>
      </Hoja>

      <Hoja
        open={borrando !== null}
        onClose={() => setBorrando(null)}
        title="Borrar tarea"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setBorrando(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => void confirmarBorrar()}
            >
              Borrar
            </Button>
          </div>
        }
      >
        <p>¿Borrar «{borrando?.titulo}»? Esta acción no se puede deshacer.</p>
      </Hoja>

      {toastTexto ? (
        <div
          role="status"
          className="no-print fixed inset-x-4 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-label px-5 py-3 text-[15px] font-medium text-surface animate-fade-in"
        >
          {toastTexto}
        </div>
      ) : null}
    </>
  );
}
