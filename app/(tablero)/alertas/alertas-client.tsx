"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Info, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { AlertCard, NIVELES_ALERTA, type NivelAlerta, type TipoAlerta } from "@/components/ui/alert-card";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Segmentado } from "@/components/ui/segmentado";
import { Textarea } from "@/components/ui/textarea";
import { actualizarAlertasAhora, crearAlertaManual, cerrarAlerta } from "./actions";

export type AlertaVista = {
  id: string;
  tipo_fuente: TipoAlerta;
  id_externo: string | null;
  nivel: NivelAlerta;
  fenomeno: string;
  titulo: string;
  descripcion: string;
  area: string;
  desde: string | null;
  hasta: string | null;
  fuente_nombre: string;
  fuente_url: string | null;
  origen: "automatico" | "manual";
  estado: string;
  estado_calculado: "vigente" | "vencida" | "cancelada";
  creada_en: string;
  actualizada_en: string;
  ultima_verificacion: string;
};

export type FuenteEstado = {
  fuente: string;
  ultima_verificacion: string | null;
  ultimo_ok: string | null;
  ultimo_error: string | null;
};

type Filtro = "todas" | "meteorologicas" | "hidrologicas" | "institucionales" | "vigentes" | "historial";
type TipoCrear = "meteorologica" | "hidrologica" | "defensa_civil";
type NivelCrear = "amarilla" | "naranja" | "roja";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "meteorologicas", label: "Meteorológicas" },
  { id: "hidrologicas", label: "Hidrológicas" },
  { id: "institucionales", label: "Institucionales" },
  { id: "vigentes", label: "Vigentes" },
  { id: "historial", label: "Historial" },
];

const NIVELES_CREAR = [
  { valor: "amarilla", etiqueta: "Amarilla" },
  { valor: "naranja", etiqueta: "Naranja" },
  { valor: "roja", etiqueta: "Roja" },
] as const;

function hora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function fmtCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function vigenciaCorta(a: AlertaVista): string | null {
  const desde = fmtCorta(a.desde);
  const hasta = fmtCorta(a.hasta);
  if (desde && hasta) return `${desde} a ${hasta}`;
  if (hasta) return `Hasta ${hasta}`;
  if (desde) return `Desde ${desde}`;
  return null;
}

function esCortoPlazo(a: AlertaVista): boolean {
  return /^aviso\b/i.test((a.titulo || a.fenomeno || "").trim());
}

function AvisoLocal({ texto, tipo }: { texto: string; tipo: "ok" | "error" }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-[14px] px-4 py-3 text-[15px] ${tipo === "error" ? "bg-red-tint text-red" : "bg-green-tint text-green-ink"}`}
    >
      {texto}
    </p>
  );
}

function FilaEstado({ titulo, detalle, ok = false }: { titulo: string; detalle?: string | null; ok?: boolean }) {
  const Icono = ok ? CircleCheckBig : Info;
  return (
    <Grupo>
      <div className="fila flex items-center gap-3 px-4 py-3">
        <Icono size={22} strokeWidth={1.75} className={`shrink-0 ${ok ? "text-green-ink" : "text-label-2"}`} aria-hidden />
        <div className="min-w-0">
          <p className="text-[17px] font-medium text-label">{titulo}</p>
          {detalle ? <p className="num text-[13px] text-label-2">{detalle}</p> : null}
        </div>
      </div>
    </Grupo>
  );
}

export function AlertasClient({
  alertasIniciales,
  fuenteSmn,
  oficial,
  errorCarga,
}: {
  alertasIniciales: AlertaVista[];
  fuenteSmn: FuenteEstado;
  oficial: boolean;
  errorCarga: string | null;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [hojaCrear, setHojaCrear] = useState(false);
  const [tipoCrear, setTipoCrear] = useState<TipoCrear>("meteorologica");
  const [nivelCrear, setNivelCrear] = useState<NivelCrear>("amarilla");
  const [descripcionAbierta, setDescripcionAbierta] = useState<AlertaVista | null>(null);
  const [cerrando, setCerrando] = useState<AlertaVista | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const vigentes = useMemo(() => alertasIniciales.filter((a) => a.estado_calculado === "vigente"), [alertasIniciales]);

  const ordenNiveles: NivelAlerta[] = ["informativa", "amarilla", "naranja", "roja"];
  const nivelVigente = vigentes.reduce<NivelAlerta | null>(
    (max, a) => (!max || ordenNiveles.indexOf(a.nivel) > ordenNiveles.indexOf(max) ? a.nivel : max),
    null
  );
  const estadoIsla = vigentes.length === 0
    ? ({ tono: "ok", texto: "Sin alertas vigentes" } as const)
    : ({ tono: "alerta", texto: `Alerta ${NIVELES_ALERTA[nivelVigente ?? "amarilla"].label.toLowerCase()} vigente` } as const);

  const filtradas = useMemo(() => {
    if (filtro === "historial") return alertasIniciales.filter((a) => a.estado_calculado !== "vigente");
    if (filtro === "meteorologicas") return vigentes.filter((a) => a.tipo_fuente === "meteorologica");
    if (filtro === "hidrologicas") return vigentes.filter((a) => a.tipo_fuente === "hidrologica");
    if (filtro === "institucionales") return vigentes.filter((a) => a.tipo_fuente === "institucional");
    return vigentes;
  }, [alertasIniciales, filtro, vigentes]);

  const onActualizar = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await actualizarAlertasAhora();
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Alertas actualizadas." });
        router.refresh();
      } else {
        setMsg({ tipo: "error", texto: r.error });
      }
    });
  };

  const cerrar = (a: AlertaVista) => {
    setMsg(null);
    startTransition(async () => {
      const r = await cerrarAlerta(a.id);
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Alerta cerrada." });
        router.refresh();
      } else {
        setMsg({ tipo: "error", texto: r.error });
      }
    });
  };

  const confirmarCierre = () => {
    const a = cerrando;
    if (!a) return;
    setCerrando(null);
    cerrar(a);
  };

  const onCrear = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const r = await crearAlertaManual(formData);
      if (r.ok) {
        setHojaCrear(false);
        setMsg({ tipo: "ok", texto: "Alerta publicada." });
        router.refresh();
      } else {
        setMsg({ tipo: "error", texto: r.error });
      }
    });
  };

  const smnFallo = !!fuenteSmn.ultimo_error;
  const actualizadoFeed = hora(fuenteSmn.ultimo_ok ?? fuenteSmn.ultima_verificacion ?? vigentes[0]?.actualizada_en);
  const ultimaSinVigentes = hora(fuenteSmn.ultima_verificacion ?? fuenteSmn.ultimo_ok);
  const tipoDb = tipoCrear === "defensa_civil" ? "institucional" : tipoCrear;
  const fuenteCrear = tipoCrear === "meteorologica" ? "Servicio Meteorológico Nacional" : "Defensa Civil";

  return (
    <>
      <EncabezadoIsla
        titulo="Alertas"
        icono={TriangleAlert}
        estado={estadoIsla}
        acciones={
          oficial
            ? [
                { icono: RefreshCw, etiqueta: "Actualizar ahora", onClick: onActualizar },
                {
                  icono: Plus,
                  etiqueta: "Cargar alerta",
                  onClick: () => { setMsg(null); setHojaCrear(true); },
                  principal: true,
                },
              ]
            : []
        }
      />

      <div className="no-print mx-auto w-full max-w-[1100px] space-y-6 px-4 pb-8 pt-4">
        {msg ? <AvisoLocal texto={msg.texto} tipo={msg.tipo} /> : null}
        {errorCarga ? <AvisoLocal texto={errorCarga} tipo="error" /> : null}
        {smnFallo ? (
          <AvisoLocal
            texto={`No se pudo actualizar el feed. Se muestra la última información conocida.${actualizadoFeed ? ` Actualizado a las ${actualizadoFeed}.` : ""}`}
            tipo="error"
          />
        ) : null}

        <Grupo>
          <div className="flex gap-2 overflow-x-auto p-2" role="group" aria-label="Filtro de alertas">
            {FILTROS.map((f) => {
              const activo = filtro === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  aria-pressed={activo}
                  className={`tap min-h-11 shrink-0 rounded-full px-4 text-[15px] font-medium transition-colors ${
                    activo ? "bg-red-tint text-red" : "bg-surface-2 text-label-2 hover:bg-bg"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Grupo>

        {filtradas.length === 0 ? (
          vigentes.length === 0 && filtro !== "historial" ? (
            <FilaEstado titulo="Sin alertas vigentes" detalle={`Última actualización ${ultimaSinVigentes ?? "sin datos"}`} ok />
          ) : (
            <FilaEstado titulo={filtro === "historial" ? "No hay alertas en el historial" : "No hay alertas con este filtro"} />
          )
        ) : (
          <div className="space-y-4">
            {filtradas.map((a) => (
              <AlertCard
                key={a.id}
                tipo={a.tipo_fuente}
                nivel={a.nivel}
                titulo={a.titulo || a.fenomeno || "Alerta"}
                descripcion={a.descripcion || undefined}
                area={a.area || undefined}
                fuente={a.fuente_nombre}
                vigencia={vigenciaCorta(a) ?? undefined}
                ultimaActualizacion={fmtCorta(a.ultima_verificacion) ?? fmtCorta(a.actualizada_en) ?? undefined}
                finalizada={a.estado_calculado !== "vigente"}
                cortoPlazo={esCortoPlazo(a)}
                onVerMas={a.descripcion ? () => setDescripcionAbierta(a) : undefined}
                onCerrar={oficial && a.estado_calculado === "vigente" && a.origen === "manual" ? () => setCerrando(a) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <Hoja
        open={descripcionAbierta !== null}
        onClose={() => setDescripcionAbierta(null)}
        title={descripcionAbierta?.titulo ?? "Alerta"}
      >
        <p className="whitespace-pre-wrap text-[17px] leading-[1.45] text-label">{descripcionAbierta?.descripcion}</p>
      </Hoja>

      <Hoja
        open={hojaCrear}
        onClose={() => { if (!isPending) setHojaCrear(false); }}
        title="Cargar alerta"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button type="submit" form="form-cargar-alerta" className="w-full" disabled={isPending}>
              {isPending ? "Publicando…" : "Publicar"}
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setHojaCrear(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <form id="form-cargar-alerta" action={onCrear} className="space-y-4">
          <input type="hidden" name="tipo_fuente" value={tipoDb} />
          <input type="hidden" name="nivel" value={nivelCrear} />
          <input type="hidden" name="fuente_nombre" value={fuenteCrear} />

          <Segmentado
            etiqueta="Tipo de alerta"
            opciones={[
              { valor: "meteorologica", etiqueta: "Meteorológica" },
              { valor: "hidrologica", etiqueta: "Hidrológica" },
              { valor: "defensa_civil", etiqueta: "Defensa Civil" },
            ]}
            valor={tipoCrear}
            onChange={(valor) => setTipoCrear(valor as TipoCrear)}
          />

          <div role="group" aria-label="Nivel" className="flex min-h-[50px] items-center gap-1 rounded-[14px] bg-surface-2 p-1">
            {NIVELES_CREAR.map((n) => {
              const activo = nivelCrear === n.valor;
              return (
                <button
                  key={n.valor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setNivelCrear(n.valor)}
                  className={`tap min-h-11 flex-1 rounded-[14px] px-2 text-[15px] font-medium transition-colors duration-200 ${
                    activo ? NIVELES_ALERTA[n.valor].chip : "text-label-2"
                  }`}
                >
                  {n.etiqueta}
                </button>
              );
            })}
          </div>

          <Input id="titulo" name="titulo" label="Título" required maxLength={200} />
          <Textarea id="descripcion" name="descripcion" label="Descripción" rows={4} maxLength={2000} />
          <Input id="area" name="area" label="Área / zona" maxLength={200} />
          <Input id="desde" name="desde" type="datetime-local" label="Desde" />
          <Input id="hasta" name="hasta" type="datetime-local" label="Hasta" />
          <p className="num text-[13px] text-label-2">Fuente: {fuenteCrear}</p>
        </form>
      </Hoja>

      <Hoja
        open={cerrando !== null}
        onClose={() => setCerrando(null)}
        title="Cerrar alerta"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button type="button" variant="secondary" className="w-full" onClick={() => setCerrando(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" className="w-full" onClick={confirmarCierre}>
              Cerrar alerta
            </Button>
          </div>
        }
      >
        <p>¿Cerrar «{cerrando?.titulo}»? La alerta va a pasar al historial.</p>
      </Hoja>
    </>
  );
}
