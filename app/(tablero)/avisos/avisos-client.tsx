"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Megaphone,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contador } from "@/components/ui/contador";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Segmentado } from "@/components/ui/segmentado";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { hoyArgentina, sumarDias } from "@/lib/tablero";
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

type TipoAviso = AvisoVista["tipo"];
type FiltroAviso = "todos" | "sin_leer" | "convocatorias";
type Respuesta = "voy" | "no_puedo" | "en_camino";

const OPCIONES_RESPUESTA = [
  { k: "voy", etiqueta: "Voy", activo: "bg-green-tint text-green-ink" },
  { k: "no_puedo", etiqueta: "No puedo", activo: "bg-red-tint text-red" },
  { k: "en_camino", etiqueta: "En camino", activo: "bg-yellow-tint text-yellow-ink" },
] as const;

function dateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function horaArgentina(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function fechaRelativa(iso: string): string {
  const clave = dateKey(iso);
  if (!clave) return "";
  const hoy = hoyArgentina();
  if (clave === hoy) return `Hoy ${horaArgentina(iso)}`;
  if (clave === sumarDias(hoy, -1)) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso)).replace(".", "");
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Tucuman", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function formatearSoloFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Tucuman", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function infoTipo(tipo: TipoAviso): { etiqueta: string; clases: string } {
  if (tipo === "convocatoria") return { etiqueta: "Convocatoria", clases: "bg-red-tint text-red" };
  if (tipo === "importante") return { etiqueta: "Importante", clases: "bg-yellow-tint text-yellow-ink" };
  return { etiqueta: "Informativo", clases: "bg-surface-2 text-label-2" };
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

export function AvisosClient({ inicial, cargaError, activos, sessionId, esOficial }: { inicial: AvisoVista[]; cargaError: string | null; activos: BomberoActivo[]; sessionId: string; esOficial: boolean; }) {
  const router = useRouter();
  const [avisos, setAvisos] = useState<AvisoVista[]>(inicial);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [hojaCrear, setHojaCrear] = useState(false);
  const [tipoCrear, setTipoCrear] = useState<TipoAviso>("informativo");
  const [fijarCrear, setFijarCrear] = useState(false);
  const [filtro, setFiltro] = useState<FiltroAviso>("todos");
  const [borrando, setBorrando] = useState<AvisoVista | null>(null);
  const [menuRespuestas, setMenuRespuestas] = useState<string | null>(null);
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
    const aviso = avisos.find((a) => a.id === id);
    setAbiertoId(id);
    setMenuRespuestas(null);
    if (aviso && !aviso.leido) {
      setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, leido: true } : a)));
      const res = await marcarLeido(id);
      if (!res.ok) setMensaje({ tipo: "error", texto: res.error });
      else router.refresh();
    }
  };

  const onPublicar = async (formData: FormData) => {
    setMensaje(null);
    startTransition(async () => {
      const res = await publicarAviso(formData);
      if (res.ok) { setHojaCrear(false); setTipoCrear("informativo"); setFijarCrear(false); setMensaje({ tipo: "ok", texto: "Aviso publicado." }); await refrescar(); router.refresh(); }
      else setMensaje({ tipo: "error", texto: res.error });
    });
  };
  const onFijar = async (a: AvisoVista) => { setBusyId(a.id); const res = await fijarAviso(a.id, !a.fijado); setBusyId(null); if (!res.ok) setMensaje({ tipo: "error", texto: res.error }); else await refrescar(); };
  const onBorrar = async (a: AvisoVista) => { setBusyId(a.id); const res = await borrarAviso(a.id); setBusyId(null); if (!res.ok) setMensaje({ tipo: "error", texto: res.error }); else { setMensaje({ tipo: "ok", texto: "Aviso borrado." }); await refrescar(); } };
  const onResponder = async (avisoId: string, respuesta: Respuesta) => { setBusyId(avisoId); const res = await responderConvocatoria(avisoId, respuesta); setBusyId(null); if (!res.ok) setMensaje({ tipo: "error", texto: res.error }); else await refrescar(); };

  const confirmarBorrar = async () => {
    const aviso = borrando;
    if (!aviso) return;
    setBorrando(null);
    await onBorrar(aviso);
  };

  const noLeidos = useMemo(() => avisos.filter((a) => !a.leido).length, [avisos]);

  const visibles = useMemo(() => {
    const base = filtro === "sin_leer"
      ? avisos.filter((a) => !a.leido)
      : filtro === "convocatorias"
      ? avisos.filter((a) => a.tipo === "convocatoria")
      : avisos;
    return [...base].sort((a, b) => Number(b.fijado) - Number(a.fijado) || new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
  }, [avisos, filtro]);

  const fijados = visibles.filter((a) => a.fijado);
  const resto = visibles.filter((a) => !a.fijado);
  const avisoAbierto = avisos.find((a) => a.id === abiertoId) ?? null;
  const miRespuesta = avisoAbierto?.respuestas.find((r) => r.bombero_id === sessionId)?.respuesta ?? null;

  const renderFila = (a: AvisoVista) => {
    const tipo = infoTipo(a.tipo);
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => void abrirAviso(a.id)}
        className="fila tap flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
      >
        {!a.leido ? (
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red" aria-hidden />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            {a.fijado ? <Pin size={14} strokeWidth={1.75} className="mt-1 shrink-0 text-yellow-ink" aria-label="Fijado" /> : null}
            <span className={`truncate text-[17px] ${a.leido ? "font-medium text-label-2" : "font-semibold text-label"}`}>{a.titulo}</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className={`inline-flex min-h-5 shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${tipo.clases}`}>{tipo.etiqueta}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] text-label-2">{a.cuerpo}</span>
          </span>
        </span>
        <span className="num mt-0.5 shrink-0 text-[13px] text-label-2">{fechaRelativa(a.creado_en)}</span>
        <ChevronRight size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-3" aria-hidden />
      </button>
    );
  };

  return (
    <>
      <EncabezadoIsla
        titulo="Avisos"
        icono={Bell}
        estado={{ tono: "neutro", texto: `${noLeidos} sin leer` }}
        acciones={
          esOficial
            ? [{ icono: Plus, etiqueta: "Publicar aviso", onClick: () => { setMensaje(null); setHojaCrear(true); }, principal: true }]
            : []
        }
      />

      <div className="no-print mx-auto w-full max-w-[1100px] space-y-5 px-4 pb-8 pt-4">
        {mensaje ? <AvisoLocal texto={mensaje.texto} tipo={mensaje.tipo} /> : null}
        {cargaError ? <AvisoLocal texto={cargaError} tipo="error" /> : null}

        <Segmentado
          etiqueta="Filtro de avisos"
          opciones={[
            { valor: "todos", etiqueta: "Todos" },
            { valor: "sin_leer", etiqueta: "Sin leer" },
            { valor: "convocatorias", etiqueta: "Convocatorias" },
          ]}
          valor={filtro}
          onChange={(valor) => setFiltro(valor as FiltroAviso)}
        />

        {visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[16px] bg-surface px-6 py-12 text-center animate-fade-in">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-label-2">
              <Bell size={28} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-[17px] text-label-2">No hay avisos</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fijados.length ? <Grupo titulo="Fijados">{fijados.map(renderFila)}</Grupo> : null}
            {resto.length ? <Grupo>{resto.map(renderFila)}</Grupo> : null}
          </div>
        )}
      </div>

      <Hoja
        open={avisoAbierto !== null}
        onClose={() => { setAbiertoId(null); setMenuRespuestas(null); }}
        title={avisoAbierto?.titulo ?? "Aviso"}
        className="max-h-[90dvh]! sm:max-h-[85dvh]!"
      >
        {avisoAbierto ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-[13px] font-medium ${infoTipo(avisoAbierto.tipo).clases}`}>
                  {infoTipo(avisoAbierto.tipo).etiqueta}
                </span>
                {avisoAbierto.fijado ? <Pin size={14} strokeWidth={1.75} className="text-yellow-ink" aria-label="Fijado" /> : null}
              </div>
              <p className="num text-[15px] text-label-2">{formatearFecha(avisoAbierto.creado_en)}</p>
              <p className="text-[15px] text-label-2">Publicado por {avisoAbierto.creador_nombre}</p>
            </div>

            <p className="whitespace-pre-wrap text-[17px] leading-[1.45] text-label">{avisoAbierto.cuerpo}</p>

            {avisoAbierto.tipo === "convocatoria" && avisoAbierto.convocatoria ? (
              <section className="space-y-3">
                <h3 className="text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">Convocatoria</h3>
                <Grupo>
                  <div className="fila flex items-start gap-3 px-4 py-3">
                    <Megaphone size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] text-label-2">Motivo</p>
                      <p className="text-[17px] text-label">{avisoAbierto.convocatoria.motivo}</p>
                    </div>
                  </div>
                  <div className="fila flex items-start gap-3 px-4 py-3">
                    <CalendarDays size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] text-label-2">Fecha</p>
                      <p className="num text-[17px] text-label">{formatearSoloFecha(avisoAbierto.convocatoria.fecha_hora)}</p>
                    </div>
                  </div>
                  <div className="fila flex items-start gap-3 px-4 py-3">
                    <Clock3 size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] text-label-2">Hora</p>
                      <p className="num text-[17px] text-label">{horaArgentina(avisoAbierto.convocatoria.fecha_hora)}</p>
                    </div>
                  </div>
                  <div className="fila flex items-start gap-3 px-4 py-3">
                    <MapPin size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] text-label-2">Lugar</p>
                      <p className="text-[17px] text-label">{avisoAbierto.convocatoria.lugar}</p>
                    </div>
                  </div>
                </Grupo>

                <div>
                  <p className="text-[13px] text-label-2">Tu respuesta</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {OPCIONES_RESPUESTA.map((op) => {
                      const activo = miRespuesta === op.k;
                      return (
                        <button
                          key={op.k}
                          type="button"
                          disabled={busyId === avisoAbierto.id}
                          aria-pressed={activo}
                          onClick={() => void onResponder(avisoAbierto.id, op.k)}
                          className={`tap min-h-14 rounded-[14px] px-2 text-[15px] font-semibold transition-colors disabled:text-label-2 disabled:bg-surface-2 ${
                            activo ? op.activo : "bg-surface-2 text-label-2"
                          }`}
                        >
                          {op.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {esOficial ? (
                  <ResumenConvocatoria
                    avisoId={avisoAbierto.id}
                    respuestas={avisoAbierto.respuestas}
                    activos={activos}
                    abierta={menuRespuestas}
                    onToggle={setMenuRespuestas}
                  />
                ) : null}
              </section>
            ) : null}

            {esOficial ? (
              <div className="flex gap-2 border-t border-separator pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busyId === avisoAbierto.id}
                  onClick={() => void onFijar(avisoAbierto)}
                >
                  <Pin size={22} strokeWidth={1.75} aria-hidden />
                  {avisoAbierto.fijado ? "Desfijar" : "Fijar"}
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={busyId === avisoAbierto.id}
                  onClick={() => setBorrando(avisoAbierto)}
                >
                  <Trash2 size={22} strokeWidth={1.75} aria-hidden />
                  Borrar
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Hoja>

      <Hoja
        open={hojaCrear}
        onClose={() => { if (!isPending) setHojaCrear(false); }}
        title="Publicar aviso"
      >
        <form action={onPublicar} className="space-y-4">
          <input type="hidden" name="tipo" value={tipoCrear} />
          <input type="hidden" name="fijado" value={fijarCrear ? "on" : ""} />

          <Segmentado
            etiqueta="Tipo de aviso"
            opciones={[
              { valor: "informativo", etiqueta: "Informativo" },
              { valor: "importante", etiqueta: "Importante" },
              { valor: "convocatoria", etiqueta: "Convocatoria" },
            ]}
            valor={tipoCrear}
            onChange={(valor) => setTipoCrear(valor as TipoAviso)}
          />
          <Input id="titulo" name="titulo" label="Título" required maxLength={120} />
          <Textarea id="cuerpo" name="cuerpo" label="Mensaje" required rows={4} maxLength={2000} />

          <div className="grupo">
            <Switch checked={fijarCrear} onChange={setFijarCrear} etiqueta="Fijar" descripcion="Mostrar arriba de la lista." />
          </div>

          {tipoCrear === "convocatoria" ? (
            <div className="space-y-4 rounded-[16px] bg-surface-2 p-4">
              <h3 className="text-[13px] text-label-2">Datos de la convocatoria</h3>
              <Input id="motivo" name="motivo" label="Motivo" required maxLength={200} />
              <Input id="fecha_hora" name="fecha_hora" type="datetime-local" label="Fecha y hora" required />
              <Input id="lugar" name="lugar" label="Lugar" required maxLength={200} />
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-1">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Publicando…" : "Publicar"}
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setHojaCrear(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Hoja>

      <Hoja
        open={borrando !== null}
        onClose={() => setBorrando(null)}
        title="Borrar aviso"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button variant="secondary" className="w-full" onClick={() => setBorrando(null)}>
              Cancelar
            </Button>
            <Button variant="danger" className="w-full" onClick={() => void confirmarBorrar()}>
              Borrar
            </Button>
          </div>
        }
      >
        <p>¿Borrar «{borrando?.titulo}»? Esta acción no se puede deshacer.</p>
      </Hoja>
    </>
  );
}

function ResumenConvocatoria({
  avisoId,
  respuestas,
  activos,
  abierta,
  onToggle,
}: {
  avisoId: string;
  respuestas: RespuestaConv[];
  activos: BomberoActivo[];
  abierta: string | null;
  onToggle: (clave: string | null) => void;
}) {
  const voy = respuestas.filter((r) => r.respuesta === "voy").map((r) => r.nombre);
  const enCamino = respuestas.filter((r) => r.respuesta === "en_camino").map((r) => r.nombre);
  const noPuedo = respuestas.filter((r) => r.respuesta === "no_puedo").map((r) => r.nombre);
  const respondieron = new Set(respuestas.map((r) => r.bombero_id));
  const sinResponder = activos.filter((b) => !respondieron.has(b.id)).map((b) => b.nombre_completo);

  const grupos = [
    { k: "voy", etiqueta: "Voy", tono: "ok" as const, icono: "CircleCheckBig", nombres: voy },
    { k: "en_camino", etiqueta: "En camino", tono: "alarm" as const, icono: "Clock3", nombres: enCamino },
    { k: "no_puedo", etiqueta: "No puedo", tono: "fire" as const, icono: "CircleX", nombres: noPuedo },
    { k: "sin_respuesta", etiqueta: "Sin responder", tono: "ink" as const, icono: "Users", nombres: sinResponder },
  ] as const;

  const activo = grupos.find((g) => abierta === `${avisoId}:${g.k}`);

  return (
    <section className="space-y-2">
      <h3 className="text-[13px] text-label-2">Respuestas</h3>
      <div className="grid grid-cols-2 gap-2">
        {grupos.map((g) => {
          const clave = `${avisoId}:${g.k}`;
          return (
            <button key={g.k} type="button" onClick={() => onToggle(abierta === clave ? null : clave)} className="tap text-left">
              <Contador valor={g.nombres.length} etiqueta={g.etiqueta} tono={g.tono} icono={g.icono} />
            </button>
          );
        })}
      </div>
      {activo ? (
        <Grupo titulo={activo.etiqueta}>
          {activo.nombres.length ? (
            activo.nombres.map((nombre, indice) => (
              <div key={`${nombre}-${indice}`} className="fila flex items-center px-4 py-2 text-[15px] text-label">
                {nombre}
              </div>
            ))
          ) : (
            <div className="fila flex items-center px-4 py-2 text-[15px] text-label-2">Sin respuestas</div>
          )}
        </Grupo>
      ) : null}
    </section>
  );
}
