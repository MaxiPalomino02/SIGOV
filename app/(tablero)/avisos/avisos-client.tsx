"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Bell, Megaphone, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Aviso as AvisoUI } from "@/components/ui/aviso";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { borrarAviso, fijarAviso, marcarLeido, publicarAviso, responderConvocatoria } from "./actions";

export type RespuestaConv = {
  bombero_id: string;
  nombre: string;
  respuesta: "voy" | "no_puedo" | "en_camino";
  respondido_en: string;
};

export type AvisoVista = {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: "informativo" | "importante" | "convocatoria";
  creado_por: string;
  creador_nombre: string;
  fijado: boolean;
  creado_en: string;
  leido: boolean;
  convocatoria: { motivo: string; fecha_hora: string; lugar: string } | null;
  respuestas: RespuestaConv[];
};

export type BomberoActivo = { id: string; nombre_completo: string };

function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Tucuman", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Tucuman", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function AvisosClient({ inicial, cargaError, activos, sessionId, esOficial }: { inicial: AvisoVista[]; cargaError: string | null; activos: BomberoActivo[]; sessionId: string; esOficial: boolean; }) {
  const [avisos, setAvisos] = useState<AvisoVista[]>(inicial);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [hojaCrear, setHojaCrear] = useState(false);
  const [tipoCrear, setTipoCrear] = useState<"informativo" | "importante" | "convocatoria">("informativo");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refrescar = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: avisosData } = await supabase.from("avisos").select("id, titulo, cuerpo, tipo, creado_por, fijado, creado_en, creador:bomberos!avisos_creado_por_fkey(nombre_completo), convocatorias(motivo, fecha_hora, lugar)").order("fijado", { ascending: false }).order("creado_en", { ascending: false });
      if (!avisosData) return;
      const ids = avisosData.map((a: any) => a.id);
      const { data: lecturasData } = ids.length ? await supabase.from("avisos_lecturas").select("aviso_id").eq("bombero_id", sessionId).in("aviso_id", ids) : { data: [] as any[] };
      const convIds = avisosData.filter((a: any) => a.tipo === "convocatoria").map((a: any) => a.id);
      const { data: respuestasData } = convIds.length ? await supabase.from("convocatoria_respuestas").select("aviso_id, bombero_id, respuesta, respondido_en, bombero:bomberos(nombre_completo)").in("aviso_id", convIds) : { data: [] as any[] };
      const leidos = new Set((lecturasData ?? []).map((l: any) => l.aviso_id));
      setAvisos((avisosData as any[]).map((a) => {
        const conv = Array.isArray(a.convocatorias) ? a.convocatorias[0] : a.convocatorias;
        const respuestas = (respuestasData ?? []).filter((r: any) => r.aviso_id === a.id).map((r: any) => ({ bombero_id: r.bombero_id, nombre: r.bombero?.nombre_completo ?? "Bombero", respuesta: r.respuesta as "voy" | "no_puedo" | "en_camino", respondido_en: r.respondido_en }));
        return { id: a.id, titulo: a.titulo, cuerpo: a.cuerpo, tipo: a.tipo, creado_por: a.creado_por, creador_nombre: a.creador?.nombre_completo ?? "Oficial", fijado: !!a.fijado, creado_en: a.creado_en, leido: leidos.has(a.id), convocatoria: conv ? { motivo: conv.motivo, fecha_hora: conv.fecha_hora, lugar: conv.lugar } : null, respuestas };
      }));
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    let chAvisos: any = null; let chResp: any = null;
    try {
      const supabase = createBrowserSupabaseClient();
      chAvisos = supabase.channel("avisos-cambios").on("postgres_changes", { event: "*", schema: "public", table: "avisos" }, () => void refrescar()).subscribe();
      chResp = supabase.channel("conv-resp-cambios").on("postgres_changes", { event: "*", schema: "public", table: "convocatoria_respuestas" }, () => void refrescar()).subscribe();
    } catch {}
    return () => { try { const s = createBrowserSupabaseClient(); if (chAvisos) s.removeChannel(chAvisos); if (chResp) s.removeChannel(chResp); } catch {} };
  }, [refrescar]);

  const abrirAviso = async (id: string) => {
    setAbiertoId((prev) => (prev === id ? null : id));
    const aviso = avisos.find((a) => a.id === id);
    if (aviso && !aviso.leido) { setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, leido: true } : a))); await marcarLeido(id); }
  };

  const onPublicar = async (formData: FormData) => {
    setMensaje(null);
    startTransition(async () => {
      const res = await publicarAviso(formData);
      if (res.ok) { setHojaCrear(false); setTipoCrear("informativo"); setMensaje({ tipo: "ok", texto: "Aviso publicado." }); await refrescar(); }
      else setMensaje({ tipo: "error", texto: res.error });
    });
  };
  const onFijar = async (a: AvisoVista) => { setBusyId(a.id); const res = await fijarAviso(a.id, !a.fijado); setBusyId(null); if (!res.ok) setMensaje({ tipo: "error", texto: res.error }); else await refrescar(); };
  const onBorrar = async (a: AvisoVista) => { if (!confirm("¿Borrar este aviso? Esta acción no se puede deshacer.")) return; setBusyId(a.id); const res = await borrarAviso(a.id); setBusyId(null); if (!res.ok) setMensaje({ tipo: "error", texto: res.error }); else { setMensaje({ tipo: "ok", texto: "Aviso borrado." }); await refrescar(); } };
  const onResponder = async (avisoId: string, respuesta: "voy" | "no_puedo" | "en_camino") => { setBusyId(avisoId); const res = await responderConvocatoria(avisoId, respuesta); setBusyId(null); if (!res.ok) setMensaje({ tipo: "error", texto: res.error }); else await refrescar(); };

  const noLeidos = useMemo(() => avisos.filter((a) => !a.leido).length, [avisos]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <SectionHeading
        titulo="Avisos"
        descripcion="Comunicaciones y convocatorias del cuartel."
        accion={esOficial ? (
          <button type="button" onClick={() => { setMensaje(null); setHojaCrear(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-fire px-4 text-[16px] font-medium text-ink hover:bg-fire-dark">
            <Plus className="h-4 w-4" aria-hidden /> Publicar aviso
          </button>
        ) : undefined}
      />

      {mensaje ? <AvisoUI variante={mensaje.tipo === "ok" ? "ok" : "error"}>{mensaje.texto}</AvisoUI> : null}
      {cargaError ? <AvisoUI variante="error">{cargaError}</AvisoUI> : null}

      <DashboardCard titulo="Avisos del cuartel" descripcion={noLeidos > 0 ? `${noLeidos} sin leer.` : "Estás al día."}>
        {avisos.length === 0 ? (
          <EstadoVacio icono="Bell" titulo="No hay avisos" texto="Los avisos publicados van a aparecer acá." />
        ) : (
          <ul className="space-y-3">
            {avisos.map((a) => {
              const abierto = abiertoId === a.id;
              const miRespuesta = a.respuestas.find((r) => r.bombero_id === sessionId)?.respuesta ?? null;
              return (
                <li key={a.id}>
                  <article className={`rounded-[12px] bg-bg-subtle ${!a.leido ? "ring-1 ring-fire/25" : ""}`}>
                    <button type="button" onClick={() => void abrirAviso(a.id)} className="flex w-full items-start gap-3 p-3 text-left sm:p-4 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft" aria-expanded={abierto}>
                      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
                        {a.tipo === "convocatoria" ? <Megaphone className="h-5 w-5 text-alarm" aria-hidden /> : <Bell className={`h-5 w-5 ${!a.leido ? "text-fire" : ""}`} aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!a.leido ? <span className="h-2 w-2 rounded-full bg-fire" aria-hidden /> : null}
                          {a.fijado ? <Pin className="h-3.5 w-3.5 text-brass" aria-hidden /> : null}
                          <p className="text-[16px] font-medium text-ink">{a.titulo}</p>
                        </div>
                        <p className="texto-aux mt-0.5">
                          {a.tipo === "convocatoria" ? "Convocatoria" : a.tipo === "importante" ? "Importante" : "Informativo"} · {formatearFecha(a.creado_en)}
                        </p>
                      </div>
                    </button>

                    {abierto ? (
                      <div className="border-t border-line-subtle px-3 pb-4 pt-3 sm:px-4 sm:pl-[4.5rem]">
                        <p className="whitespace-pre-wrap text-[16px] text-ink">{a.cuerpo}</p>
                        <p className="texto-aux mt-2">Publicado por {a.creador_nombre}</p>

                        {a.tipo === "convocatoria" && a.convocatoria ? (
                          <div className="mt-4 space-y-3">
                            <div className="rounded-[10px] bg-surface p-3 text-[16px]">
                              <p><span className="texto-aux block">Motivo</span>{a.convocatoria.motivo}</p>
                              <p className="mt-2"><span className="texto-aux block">Fecha y hora</span><span className="dato-mono text-[13px]">{formatearFechaHora(a.convocatoria.fecha_hora)}</span></p>
                              <p className="mt-2"><span className="texto-aux block">Lugar</span>{a.convocatoria.lugar}</p>
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-ink-muted">Tu respuesta</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {([
                                  { k: "voy", label: "Voy" },
                                  { k: "no_puedo", label: "No puedo" },
                                  { k: "en_camino", label: "En camino" },
                                ] as const).map((op) => {
                                  const activo = miRespuesta === op.k;
                                  return (
                                    <button key={op.k} type="button" disabled={busyId === a.id} onClick={() => void onResponder(a.id, op.k)} className={`min-h-11 rounded-[10px] px-4 text-[16px] font-medium transition-colors disabled:opacity-50 ${activo ? "bg-fire text-ink" : "bg-surface text-ink hover:bg-surface-hover"}`}>
                                      {op.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {esOficial ? <ResumenConvocatoria respuestas={a.respuestas} activos={activos} /> : null}
                          </div>
                        ) : null}

                        {esOficial ? (
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                            <button type="button" onClick={() => void onFijar(a)} disabled={busyId === a.id} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-surface px-3 text-[15px] font-medium text-ink hover:bg-surface-hover disabled:opacity-50">
                              {a.fijado ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />} {a.fijado ? "Desfijar" : "Fijar"}
                            </button>
                            <button type="button" onClick={() => void onBorrar(a)} disabled={busyId === a.id} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-fire-light px-3 text-[15px] font-medium text-fire-text hover:opacity-90 disabled:opacity-50">
                              <Trash2 className="h-4 w-4" aria-hidden /> Borrar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>

      <Hoja open={hojaCrear} onClose={() => { if (!isPending) setHojaCrear(false); }} title="Publicar aviso">
        <form action={onPublicar} className="space-y-4">
          <Select id="tipo" name="tipo" label="Tipo" value={tipoCrear} onChange={(e) => setTipoCrear(e.target.value as any)}>
            <option value="informativo">Informativo</option>
            <option value="importante">Importante</option>
            <option value="convocatoria">Convocatoria</option>
          </Select>
          <Input id="titulo" name="titulo" label="Título" required maxLength={120} />
          <Textarea id="cuerpo" name="cuerpo" label="Mensaje" required rows={4} maxLength={2000} />
          {tipoCrear === "convocatoria" ? (
            <div className="space-y-4 rounded-[12px] bg-bg-subtle p-3">
              <p className="text-[13px] font-medium text-ink-muted">Datos de convocatoria</p>
              <Input id="motivo" name="motivo" label="Motivo" maxLength={200} />
              <Input id="fecha_hora" name="fecha_hora" type="datetime-local" label="Fecha y hora" />
              <Input id="lugar" name="lugar" label="Lugar" maxLength={200} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setHojaCrear(false)} className="min-h-11 rounded-[10px] px-4 text-[16px] font-medium text-ink-muted hover:bg-surface-hover">Cancelar</button>
            <button type="submit" disabled={isPending} className="min-h-11 rounded-[10px] bg-fire px-4 text-[16px] font-medium text-ink hover:bg-fire-dark disabled:opacity-50">
              {isPending ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </form>
      </Hoja>
    </div>
  );
}

function ResumenConvocatoria({ respuestas, activos }: { respuestas: RespuestaConv[]; activos: BomberoActivo[] }) {
  const voy = respuestas.filter((r) => r.respuesta === "voy");
  const noPuedo = respuestas.filter((r) => r.respuesta === "no_puedo");
  const enCamino = respuestas.filter((r) => r.respuesta === "en_camino");
  const respondieron = new Set(respuestas.map((r) => r.bombero_id));
  const sinRespuesta = activos.filter((b) => !respondieron.has(b.id));
  return (
    <div className="rounded-[10px] bg-surface p-3">
      <p className="text-[13px] font-medium text-ink-muted">Respuestas</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <GrupoResp titulo={`Voy (${voy.length})`} nombres={voy.map((r) => r.nombre)} />
        <GrupoResp titulo={`No puedo (${noPuedo.length})`} nombres={noPuedo.map((r) => r.nombre)} />
        <GrupoResp titulo={`En camino (${enCamino.length})`} nombres={enCamino.map((r) => r.nombre)} />
        <GrupoResp titulo={`Sin respuesta (${sinRespuesta.length})`} nombres={sinRespuesta.map((b) => b.nombre_completo)} />
      </div>
    </div>
  );
}

function GrupoResp({ titulo, nombres }: { titulo: string; nombres: string[] }) {
  return (
    <div>
      <p className="text-[13px] text-ink-muted">{titulo}</p>
      {nombres.length ? <p className="mt-0.5 text-[14px] text-ink">{nombres.join(", ")}</p> : <p className="mt-0.5 text-[14px] text-ink-muted">—</p>}
    </div>
  );
}
