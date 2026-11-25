"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { AlertCard, type NivelAlerta, type TipoAlerta } from "@/components/ui/alert-card";
import { Aviso } from "@/components/ui/aviso";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { actualizarAlertasAhora, crearAlertaManual, cerrarAlerta, cancelarAlerta } from "./actions";

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

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "meteorologicas", label: "Meteorológicas" },
  { id: "hidrologicas", label: "Hidrológicas" },
  { id: "institucionales", label: "Institucionales" },
  { id: "vigentes", label: "Vigentes" },
  { id: "historial", label: "Historial" },
];

function fmt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

function vigencia(a: AlertaVista) {
  const d = fmt(a.desde);
  const h = fmt(a.hasta);
  if (d && h) return `${d} a ${h}`;
  if (h) return `Hasta ${h}`;
  if (d) return `Desde ${d}`;
  return null;
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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtradas = useMemo(() => {
    return alertasIniciales.filter((a) => {
      if (filtro === "vigentes") return a.estado_calculado === "vigente";
      if (filtro === "historial") return a.estado_calculado !== "vigente";
      if (filtro === "meteorologicas") return a.tipo_fuente === "meteorologica";
      if (filtro === "hidrologicas") return a.tipo_fuente === "hidrologica";
      if (filtro === "institucionales") return a.tipo_fuente === "institucional";
      return true;
    });
  }, [alertasIniciales, filtro]);

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

  const onCerrar = (id: string) => {
    startTransition(async () => {
      const r = await cerrarAlerta(id);
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Alerta marcada como vencida." });
        router.refresh();
      } else {
        setMsg({ tipo: "error", texto: r.error });
      }
    });
  };
  const onCancelar = (id: string) => {
    startTransition(async () => {
      const r = await cancelarAlerta(id);
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Alerta cancelada." });
        router.refresh();
      } else {
        setMsg({ tipo: "error", texto: r.error });
      }
    });
  };

  const onCrear = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const r = await crearAlertaManual(formData);
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Alerta creada." });
        router.refresh();
      } else {
        setMsg({ tipo: "error", texto: r.error });
      }
    });
  };

  const smnOk = !!fuenteSmn.ultimo_ok && !fuenteSmn.ultimo_error;
  const smnFallo = !!fuenteSmn.ultimo_error;
  const smnUltima = fmt(fuenteSmn.ultima_verificacion) || fmt(fuenteSmn.ultimo_ok);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <SectionHeading
        titulo="Alertas"
        descripcion="Alertas meteorológicas, hidrológicas e institucionales para la zona del cuartel. SIGOV informa y coordina; no reemplaza al SMN, Defensa Civil, la radio ni la sirena."
      />

      {msg ? <Aviso variante={msg.tipo === "ok" ? "ok" : "error"}>{msg.texto}</Aviso> : null}
      {errorCarga ? <Aviso variante="error">{errorCarga}</Aviso> : null}

      <DashboardCard titulo="Estado de fuentes" descripcion="Última consulta de la fuente meteorológica (SMN).">
        <div className="space-y-2 text-[15px] text-ink-muted">
          {smnFallo ? (
            <p className="text-error-text">No se pudo consultar la fuente (SMN). Se conserva la última información válida disponible.</p>
          ) : smnOk ? (
            <p>Fuente SMN consultada correctamente.</p>
          ) : (
            <p>La fuente SMN aún no fue consultada.</p>
          )}
          <p className="font-mono text-[15px] uppercase tracking-widest text-ink-secondary">
            Última actualización: {smnUltima ?? "sin datos"}
          </p>
          <p className="text-[15px]">Hidrología: sin fuente oficial automatizable verificada para la zona; las alertas hidrológicas se cargan de forma manual.</p>
        </div>
        {oficial ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onActualizar}
              disabled={isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden />
              Actualizar ahora
            </button>
          </div>
        ) : null}
      </DashboardCard>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`min-h-11 rounded-full border px-4 text-[15px] font-semibold transition-colors ${
              filtro === f.id ? "border-fire bg-fire/15 text-ink" : "border-line bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink"
            }`}
            aria-pressed={filtro === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {filtradas.length === 0 ? (
          <EstadoVacio
            icono="ShieldCheck"
            titulo={smnFallo ? "No se pudo consultar la fuente" : "No hay alertas vigentes"}
            texto={smnFallo
              ? "No fue posible obtener información actualizada de la fuente. Se muestra el estado conocido."
              : "No hay alertas para mostrar con este filtro."}
          />
        ) : (
          filtradas.map((a) => (
            <div key={a.id} className="space-y-2">
              <AlertCard
                tipo={a.tipo_fuente}
                nivel={a.nivel}
                titulo={a.titulo || a.fenomeno || "Alerta"}
                descripcion={a.descripcion || undefined}
                area={a.area || undefined}
                fuente={a.fuente_nombre}
                vigencia={vigencia(a) ?? undefined}
                ultimaActualizacion={fmt(a.ultima_verificacion) ?? undefined}
              />
              {oficial && a.estado_calculado === "vigente" && a.origen === "manual" ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => onCerrar(a.id)} disabled={isPending} className="min-h-11 rounded-[10px] border border-line bg-surface px-3 text-[15px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-50">Marcar vencida</button>
                  <button type="button" onClick={() => onCancelar(a.id)} disabled={isPending} className="min-h-11 rounded-[10px] border border-line bg-surface px-3 text-[15px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-50">Cancelar</button>
                </div>
              ) : null}
              {oficial && a.estado_calculado !== "vigente" ? (
                <p className="font-mono text-[15px] uppercase tracking-widest text-ink-secondary">
                  {a.estado_calculado === "cancelada" ? "Cancelada / reemplazada" : "Vencida"} · {a.origen === "automatico" ? "Automática" : "Manual"}
                </p>
              ) : null}
            </div>
          ))
        )}
      </section>

      {oficial ? (
        <DashboardCard titulo="Carga manual de alerta" descripcion="Para alertas hidrológicas o avisos de Defensa Civil u otra autoridad. Queda registrado quién la cargó.">
          <form action={onCrear} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink">Tipo
                <select name="tipo_fuente" required className="min-h-11 rounded-lg border border-line bg-bg-subtle px-3 text-[15px] text-ink">
                  <option value="institucional">Institucional</option>
                  <option value="hidrologica">Hidrológica</option>
                  <option value="meteorologica">Meteorológica</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink">Nivel
                <select name="nivel" required className="min-h-11 rounded-lg border border-line bg-bg-subtle px-3 text-[15px] text-ink">
                  <option value="informativa">Informativa</option>
                  <option value="amarilla">Amarilla</option>
                  <option value="naranja">Naranja</option>
                  <option value="roja">Roja</option>
                </select>
              </label>
            </div>
            <Input name="fenomeno" label="Fenómeno (opcional)" placeholder="Ej. Crecida, lluvia intensa" />
            <Input name="titulo" label="Título" required maxLength={200} />
            <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink">Descripción
              <textarea name="descripcion" rows={3} maxLength={2000} className="rounded-lg border border-line bg-bg-subtle px-3 py-2 text-[15px] text-ink" />
            </label>
            <Input name="area" label="Área / zona" placeholder="Ej. Zona norte, Tucumán" />
            <Input name="fuente_nombre" label="Fuente" required placeholder="Ej. Defensa Civil Tucumán" />
            <Input name="fuente_url" label="URL de la fuente (opcional)" placeholder="https://..." />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink">Inicio (opcional)
                <input type="datetime-local" name="desde" className="min-h-11 rounded-lg border border-line bg-bg-subtle px-3 text-[15px] text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-[15px] font-semibold text-ink">Vencimiento (opcional)
                <input type="datetime-local" name="hasta" className="min-h-11 rounded-lg border border-line bg-bg-subtle px-3 text-[15px] text-ink" />
              </label>
            </div>
            <button type="submit" disabled={isPending} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-fire/60 bg-fire px-4 text-[15px] font-semibold text-ink hover:bg-fire-dark disabled:opacity-50">
              <ShieldAlert className="h-4 w-4" aria-hidden /> Publicar alerta
            </button>
          </form>
        </DashboardCard>
      ) : null}
    </div>
  );
}
