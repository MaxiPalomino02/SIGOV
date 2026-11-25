"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bug,
  Car,
  Check,
  ClipboardList,
  Clock3,
  FileDown,
  Flame,
  HandHeart,
  LifeBuoy,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Trees,
  User,
  Users,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/ui/section-heading";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Aviso } from "@/components/ui/aviso";
import { Tabs } from "@/components/ui/tabs";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Pasos } from "@/components/ui/pasos";
import {
  ETIQUETAS_TIPO_INCIDENTE,
  TIPOS_INCIDENTE,
  ahoraParaInput,
  formatearFechaHoraIncidente,
  type Incidente,
  type PersonalIncidente,
  type TipoIncidente,
} from "@/lib/incidentes";
import {
  borradorDesdeIncidente,
  crearBorradorVacio,
  incidenteGuardado,
  type IncidenteBorrador,
} from "@/lib/incidentes-guardado";
import { obtenerIncidentes, obtenerPersonalGuardia } from "./actions";

type CuartelInfo = {
  nombre: string;
  localidad: string;
  provincia: string;
  escudo: string;
};

type Props = {
  inicial: Incidente[];
  cargaError: string | null;
  personalGuardia: PersonalIncidente[];
  personalError: string | null;
  sessionId: string;
  sessionNombre: string;
  esOficial: boolean;
  ahoraInicial: string;
  cuartel: CuartelInfo;
};

type Vista = "lista" | "nuevo" | "ficha";
type EstadoGuardado = "inactivo" | "local" | "guardando" | "servidor" | "error";

const PASOS_INCIDENTE = [
  { n: 1, label: "Tipo" },
  { n: 2, label: "Dónde y cuándo" },
  { n: 3, label: "Personal y unidades" },
  { n: 4, label: "Detalle" },
];

const ICONOS_TIPO: Record<TipoIncidente, typeof Flame> = {
  incendio_estructural: Flame,
  forestal: Trees,
  vehicular: Car,
  rescate: LifeBuoy,
  abeja_enjambre: Bug,
  inundacion: Waves,
  apoyo: HandHeart,
  otro: MoreHorizontal,
};

function hayContenido(b: IncidenteBorrador): boolean {
  return Boolean(
    b.tipo || b.direccion.trim() || b.descripcion.trim() || b.unidades.length || b.personal.length
  );
}

function aISO(valor: string): string | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor);
  if (!partes) {
    const directa = new Date(valor);
    return Number.isNaN(directa.getTime()) ? null : directa.toISOString();
  }
  const [, anio, mes, dia, hora, minuto, segundo] = partes;
  const d = new Date(`${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo ?? "00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatearBorradorFecha(valor: string): string {
  const iso = aISO(valor);
  return iso ? formatearFechaHoraIncidente(iso) : "Sin fecha";
}

function escapeHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function estadoPill(estado: Incidente["estado"]) {
  return estado === "cargado" ? "cargado" : "borrador";
}

type SpeechResultado = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type ReconocimientoVoz = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultado) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type VentanaConVoz = Window & {
  SpeechRecognition?: new () => ReconocimientoVoz;
  webkitSpeechRecognition?: new () => ReconocimientoVoz;
};

function construirPlanillaHTML(incidente: Incidente, cuartel: CuartelInfo): string {
  const personal = incidente.personal.length
    ? incidente.personal
        .map(
          (p, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(p.nombre)}</td><td>${escapeHtml(
              p.cargo ?? ""
            )}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="vacio">Sin personal registrado.</td></tr>`;

  const unidades = incidente.unidades.length
    ? incidente.unidades.map((u) => escapeHtml(u)).join(", ")
    : "Sin unidades registradas.";

  const escudoUrl = `${window.location.origin}${cuartel.escudo}`;
  const generado = formatearFechaHoraIncidente(new Date().toISOString());

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Incidente - ${escapeHtml(cuartel.nombre)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 12pt; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  header img { width: 56px; height: 56px; object-fit: contain; filter: grayscale(1); }
  header h1 { font-size: 15pt; margin: 0; letter-spacing: .04em; }
  header p { margin: 2px 0 0; font-size: 10pt; color: #333; }
  h2 { font-size: 13pt; margin: 18px 0 8px; border-bottom: 1px solid #999; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #444; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { width: 32%; background: #eee; font-weight: 700; }
  .personal th:first-child, .personal td:first-child { width: 8%; text-align: center; }
  .personal th:nth-child(2), .personal td:nth-child(2) { width: 52%; }
  .descripcion { white-space: pre-wrap; min-height: 60px; }
  .vacio { color: #555; font-style: italic; }
  footer { margin-top: 22px; border-top: 1px solid #999; padding-top: 8px; font-size: 9pt; color: #444; display: flex; justify-content: space-between; gap: 12px; }
</style>
</head>
<body>
  <header>
    <img src="${escapeHtml(escudoUrl)}" alt="Escudo del cuartel" />
    <div>
      <h1>${escapeHtml(cuartel.nombre)}</h1>
      <p>${escapeHtml(cuartel.localidad)} - ${escapeHtml(cuartel.provincia)}</p>
      <p>Registro de incidente - Planilla para RUBA</p>
    </div>
  </header>

  <table>
    <tr><th>Fecha y hora</th><td>${escapeHtml(formatearFechaHoraIncidente(incidente.fecha_hora))}</td></tr>
    <tr><th>Tipo de incidente</th><td>${escapeHtml(ETIQUETAS_TIPO_INCIDENTE[incidente.tipo])}</td></tr>
    <tr><th>Dirección</th><td>${escapeHtml(incidente.direccion || "Sin datos")}</td></tr>
    <tr><th>Unidades</th><td>${unidades}</td></tr>
    <tr><th>Estado</th><td>${incidente.estado === "cargado" ? "Cargado" : "Borrador"}</td></tr>
    <tr><th>Registrado por</th><td>${escapeHtml(incidente.creador_nombre ?? "Sin datos")}</td></tr>
  </table>

  <h2>Personal interviniente</h2>
  <table class="personal">
    <thead><tr><th>N°</th><th>Nombre</th><th>Cargo</th></tr></thead>
    <tbody>${personal}</tbody>
  </table>

  <h2>Detalle de la intervención</h2>
  <table>
    <tr><td class="descripcion">${escapeHtml(incidente.descripcion || "Sin detalle registrado.")}</td></tr>
  </table>

  <footer>
    <span>Generado el ${escapeHtml(generado)} - SIGOV</span>
    <span>Completar los datos restantes en RUBA.</span>
  </footer>
</body>
</html>`;
}

export function IncidentesClient({
  inicial,
  cargaError,
  personalGuardia: personalInicial,
  personalError,
  sessionId,
  sessionNombre,
  esOficial,
  ahoraInicial,
  cuartel,
}: Props) {
  const [incidentes, setIncidentes] = useState<Incidente[]>(inicial);
  const [personalGuardia, setPersonalGuardia] = useState<PersonalIncidente[]>(personalInicial);
  const [personalErrorActual, setPersonalErrorActual] = useState<string | null>(personalError);
  const [cargandoPersonal, setCargandoPersonal] = useState(false);
  const [vista, setVista] = useState<Vista>("lista");
  const [filtro, setFiltro] = useState<"cargados" | "borradores">("cargados");
  const [seleccionado, setSeleccionado] = useState<Incidente | null>(null);
  const [paso, setPaso] = useState(1);
  const [borrador, setBorrador] = useState<IncidenteBorrador>(() => crearBorradorVacio(ahoraInicial));
  const [borradorPendiente, setBorradorPendiente] = useState<IncidenteBorrador | null>(null);
  const [unidadInput, setUnidadInput] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error" | "info"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("inactivo");
  const [ultimoGuardadoLocal, setUltimoGuardadoLocal] = useState<string | null>(null);
  const [escuchando, setEscuchando] = useState(false);
  const [soportaVoz, setSoportaVoz] = useState(false);
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const [cargandoLista, setCargandoLista] = useState(false);

  const borradorRef = useRef(borrador);
  const guardandoRef = useRef(false);
  const autoguardadoActivoRef = useRef(false);
  const reconocimientoRef = useRef<ReconocimientoVoz | null>(null);

  useEffect(() => {
    borradorRef.current = borrador;
  }, [borrador]);

  useEffect(() => {
    autoguardadoActivoRef.current = vista === "nuevo";
  }, [vista]);

  useEffect(() => {
    const local = incidenteGuardado.leerBorradorLocal(sessionId);
    if (!local || !hayContenido(local)) return;
    const id = window.setTimeout(() => setBorradorPendiente(local), 0);
    return () => window.clearTimeout(id);
  }, [sessionId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const w = window as VentanaConVoz;
      setSoportaVoz(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!autoguardadoActivoRef.current || !hayContenido(borrador)) return;
    const timer = window.setTimeout(() => {
      incidenteGuardado.guardarBorradorLocal(sessionId, borradorRef.current);
      setUltimoGuardadoLocal(
        new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Tucuman",
        })
      );
      setEstadoGuardado((prev) => (prev === "guardando" ? prev : "local"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [borrador, sessionId]);

  useEffect(() => {
    const guardarLocal = () => {
      const b = borradorRef.current;
      if (autoguardadoActivoRef.current && hayContenido(b)) {
        incidenteGuardado.guardarBorradorLocal(sessionId, b);
      }
    };
    window.addEventListener("beforeunload", guardarLocal);
    return () => {
      window.removeEventListener("beforeunload", guardarLocal);
      guardarLocal();
    };
  }, [sessionId]);

  const guardarBorradorServidor = useCallback(async () => {
    const b = borradorRef.current;
    if (!autoguardadoActivoRef.current || !b.tipo || guardandoRef.current) return;
    const fechaISO = aISO(b.fecha_hora);
    if (!fechaISO) return;
    guardandoRef.current = true;
    setEstadoGuardado("guardando");
    const res = await incidenteGuardado.guardar({
      incidenteId: b.id,
      localId: b.local_id,
      fecha_hora: fechaISO,
      tipo: b.tipo,
      direccion: b.direccion,
      descripcion: b.descripcion,
      unidades: b.unidades,
      personal: b.personal,
      estado: "borrador",
    });
    guardandoRef.current = false;
    if (res.ok) {
      const actual = borradorRef.current;
      if (actual.local_id === b.local_id) {
        const actualizado = { ...actual, id: res.data };
        incidenteGuardado.guardarBorradorLocal(sessionId, actualizado);
        setBorrador(actualizado);
        setBorradorPendiente((prev) =>
          prev && prev.local_id === b.local_id ? { ...prev, id: res.data } : prev
        );
      }
      setEstadoGuardado("servidor");
    } else {
      setEstadoGuardado("local");
    }
  }, [sessionId]);

  useEffect(() => {
    if (vista !== "nuevo") return;
    const id = window.setInterval(() => {
      void guardarBorradorServidor();
    }, 8000);
    return () => window.clearInterval(id);
  }, [vista, guardarBorradorServidor]);

  useEffect(() => {
    return () => {
      reconocimientoRef.current?.stop();
    };
  }, []);

  const cargados = useMemo(() => incidentes.filter((i) => i.estado === "cargado"), [incidentes]);
  const borradores = useMemo(() => incidentes.filter((i) => i.estado === "borrador"), [incidentes]);
  const visibles = filtro === "borradores" ? borradores : cargados;

  const refrescarLista = useCallback(async () => {
    setCargandoLista(true);
    const res = await obtenerIncidentes();
    setCargandoLista(false);
    if (res.ok) setIncidentes(res.data);
    else setMensaje({ tipo: "error", texto: res.error });
  }, []);

  const refrescarPersonal = useCallback(async () => {
    setCargandoPersonal(true);
    const res = await obtenerPersonalGuardia();
    setCargandoPersonal(false);
    if (res.ok) {
      setPersonalGuardia(res.data);
      setPersonalErrorActual(null);
    } else {
      setPersonalErrorActual(res.error);
    }
  }, []);

  const nuevoIncidente = () => {
    autoguardadoActivoRef.current = true;
    setBorrador(crearBorradorVacio(ahoraInicial));
    setPaso(1);
    setUnidadInput("");
    setMensaje(null);
    setSeleccionado(null);
    setVista("nuevo");
    setEstadoGuardado("inactivo");
  };

  const continuarBorrador = (incidente: Incidente) => {
    autoguardadoActivoRef.current = true;
    setBorrador(borradorDesdeIncidente(incidente));
    setPaso(incidente.tipo ? 2 : 1);
    setUnidadInput("");
    setMensaje(null);
    setSeleccionado(null);
    setVista("nuevo");
  };

  const restaurarBorrador = () => {
    if (!borradorPendiente) return;
    autoguardadoActivoRef.current = true;
    setBorrador(borradorPendiente);
    setPaso(borradorPendiente.tipo ? 2 : 1);
    setBorradorPendiente(null);
    setVista("nuevo");
    setMensaje({ tipo: "info", texto: "Recuperamos el borrador guardado en este dispositivo." });
  };

  const descartarBorrador = () => {
    incidenteGuardado.limpiarBorradorLocal(sessionId);
    const vacio = crearBorradorVacio(ahoraInicial);
    borradorRef.current = vacio;
    setBorrador(vacio);
    setPaso(1);
    setUnidadInput("");
    setBorradorPendiente(null);
    setEstadoGuardado("inactivo");
    setUltimoGuardadoLocal(null);
    setMensaje({ tipo: "info", texto: "Copia local descartada." });
  };

  const cambiarTipo = (tipo: TipoIncidente) => {
    setBorrador((prev) => ({ ...prev, tipo }));
  };

  const usarHoraActual = () => {
    setBorrador((prev) => ({ ...prev, fecha_hora: ahoraParaInput() }));
  };

  const togglePersonal = (persona: PersonalIncidente) => {
    setBorrador((prev) => {
      const existe = prev.personal.some((p) => p.bombero_id === persona.bombero_id);
      return {
        ...prev,
        personal: existe
          ? prev.personal.filter((p) => p.bombero_id !== persona.bombero_id)
          : [...prev.personal, persona],
      };
    });
  };

  const agregarUnidad = () => {
    const valor = unidadInput.trim();
    if (!valor) return;
    setBorrador((prev) =>
      prev.unidades.includes(valor)
        ? prev
        : { ...prev, unidades: [...prev.unidades, valor].slice(0, 20) }
    );
    setUnidadInput("");
  };

  const quitarUnidad = (unidad: string) => {
    setBorrador((prev) => ({ ...prev, unidades: prev.unidades.filter((u) => u !== unidad) }));
  };

  const dictar = () => {
    if (escuchando) {
      reconocimientoRef.current?.stop();
      setEscuchando(false);
      return;
    }
    setErrorVoz(null);
    const w = window as VentanaConVoz;
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) {
      setSoportaVoz(false);
      return;
    }
    const reconocimiento = new Constructor();
    reconocimiento.lang = "es-AR";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = false;
    reconocimiento.onresult = (event) => {
      let texto = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const resultado = event.results[i];
        if (resultado?.isFinal) texto += `${resultado[0]?.transcript ?? ""} `;
      }
      const limpio = texto.trim();
      if (limpio) {
        setBorrador((prev) => ({
          ...prev,
          descripcion: `${prev.descripcion}${prev.descripcion ? " " : ""}${limpio}`.slice(0, 2000),
        }));
      }
    };
    reconocimiento.onerror = () => {
      setEscuchando(false);
      setErrorVoz("No pudimos usar el micrófono. Revisá los permisos o escribí el detalle.");
    };
    reconocimiento.onend = () => setEscuchando(false);
    try {
      reconocimiento.start();
      reconocimientoRef.current = reconocimiento;
      setEscuchando(true);
    } catch {
      setErrorVoz("No pudimos iniciar el dictado por voz. Escribí el detalle.");
    }
  };

  const puedeContinuar = paso !== 1 || Boolean(borrador.tipo);

  const avanzar = () => {
    if (paso === 1 && !borrador.tipo) {
      setMensaje({ tipo: "error", texto: "Elegí el tipo de incidente para continuar." });
      return;
    }
    if (paso === 2 && !borrador.direccion.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresá la dirección para continuar." });
      return;
    }
    if (paso === 2 && !aISO(borrador.fecha_hora)) {
      setMensaje({ tipo: "error", texto: "Revisá la fecha y hora del incidente." });
      return;
    }
    setMensaje(null);
    setPaso((p) => Math.min(4, p + 1));
  };

  const retroceder = () => {
    setMensaje(null);
    setPaso((p) => Math.max(1, p - 1));
  };

  const guardar = async () => {
    if (guardandoRef.current) {
      await new Promise<void>((resolve) => {
        const id = window.setInterval(() => {
          if (!guardandoRef.current) {
            window.clearInterval(id);
            resolve();
          }
        }, 100);
      });
    }

    const b = borradorRef.current;
    if (!b.tipo) {
      setMensaje({ tipo: "error", texto: "Elegí el tipo de incidente." });
      setPaso(1);
      return;
    }
    if (!b.direccion.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresá la dirección del incidente." });
      setPaso(2);
      return;
    }
    const fechaISO = aISO(b.fecha_hora);
    if (!fechaISO) {
      setMensaje({ tipo: "error", texto: "Revisá la fecha y hora del incidente." });
      setPaso(2);
      return;
    }

    setGuardando(true);
    guardandoRef.current = true;
    setMensaje(null);
    const res = await incidenteGuardado.guardar({
      incidenteId: borradorRef.current.id,
      localId: borradorRef.current.local_id,
      fecha_hora: fechaISO,
      tipo: b.tipo,
      direccion: b.direccion,
      descripcion: b.descripcion,
      unidades: b.unidades,
      personal: b.personal,
      estado: "cargado",
    });
    guardandoRef.current = false;
    setGuardando(false);
    if (!res.ok) {
      setMensaje({
        tipo: "error",
        texto: res.pendiente
          ? "Guardado en el dispositivo. Se sincronizará cuando vuelva la conexión."
          : res.error,
      });
      return;
    }
    autoguardadoActivoRef.current = false;
    incidenteGuardado.limpiarBorradorLocal(sessionId);
    setBorradorPendiente(null);
    setBorrador(crearBorradorVacio(ahoraInicial));
    setPaso(1);
    setEstadoGuardado("inactivo");
    setUltimoGuardadoLocal(null);
    setVista("lista");
    setFiltro("cargados");
    setMensaje({ tipo: "ok", texto: "Incidente guardado. Ya está en la lista." });
    await refrescarLista();
  };

  const imprimir = (incidente: Incidente) => {
    const ventana = window.open("", "_blank", "width=900,height=1000");
    if (!ventana) {
      setMensaje({
        tipo: "error",
        texto: "Permití las ventanas emergentes para descargar la planilla.",
      });
      return;
    }
    ventana.document.open();
    ventana.document.write(construirPlanillaHTML(incidente, cuartel));
    ventana.document.close();
    ventana.focus();
    window.setTimeout(() => {
      ventana.print();
    }, 350);
  };

  const abrirFicha = (incidente: Incidente) => {
    setSeleccionado(incidente);
    setVista("ficha");
    setMensaje(null);
  };

  const volverLista = () => {
    if (vista === "nuevo" && hayContenido(borradorRef.current)) {
      incidenteGuardado.guardarBorradorLocal(sessionId, borradorRef.current);
      setBorradorPendiente(borradorRef.current);
    }
    autoguardadoActivoRef.current = false;
    setSeleccionado(null);
    setVista("lista");
  };

  const etiquetaGuardado =
    estadoGuardado === "guardando"
      ? "Guardando borrador..."
      : estadoGuardado === "servidor"
        ? "Borrador guardado en el servidor."
        : estadoGuardado === "local" && ultimoGuardadoLocal
          ? `Borrador guardado en este dispositivo a las ${ultimoGuardadoLocal}.`
          : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeading
        titulo="Incidentes"
        descripcion="Registrá las intervenciones del cuartel. La planilla se puede imprimir para completar RUBA."
        accion={
          vista === "lista" ? (
            <Button onClick={nuevoIncidente} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo incidente
            </Button>
          ) : (
            <Button variant="secondary" onClick={volverLista} className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Volver a la lista
            </Button>
          )
        }
      />

      {mensaje ? (
        <div className="mt-4">
          <Aviso variante={mensaje.tipo}>{mensaje.texto}</Aviso>
        </div>
      ) : null}

      {cargaError ? (
        <div className="mt-4">
          <Aviso variante="error">{cargaError}</Aviso>
        </div>
      ) : null}

      {vista === "lista" ? (
        <div className="mt-5 space-y-4">
          {borradorPendiente ? (
            <Aviso variante="alerta" titulo="Hay un borrador sin terminar">
              <p className="text-[15px]">
                Encontramos un borrador guardado en este dispositivo. ¿Querés continuarlo?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={restaurarBorrador}>
                  Continuar borrador
                </Button>
                <Button size="sm" variant="secondary" onClick={descartarBorrador}>
                  Descartar copia local
                </Button>
              </div>
            </Aviso>
          ) : null}

          <Tabs
            items={[
              { value: "cargados", label: "Cargados", badge: cargados.length },
              { value: "borradores", label: "Borradores", badge: borradores.length },
            ]}
            value={filtro}
            onChange={(v) => setFiltro(v as "cargados" | "borradores")}
            ariaLabel="Estado de incidentes"
          />

          <DashboardCard
            titulo={filtro === "cargados" ? "Incidentes cargados" : "Borradores"}
            descripcion={
              filtro === "cargados"
                ? esOficial
                  ? "Todos los incidentes registrados."
                  : "Tus incidentes registrados."
                : "Borradores que todavía no se guardaron como incidente."
            }
            loading={cargandoLista}
          >
            {visibles.length === 0 ? (
              <EstadoVacio
                icono={filtro === "cargados" ? "ClipboardList" : "FileText"}
                titulo={
                  filtro === "cargados" ? "Todavía no hay incidentes" : "No hay borradores"
                }
                texto={
                  filtro === "cargados"
                    ? "Cuando registres un incidente, va a aparecer en esta lista."
                    : "Los borradores se guardan solos mientras completás el registro."
                }
                accion={
                  filtro === "cargados"
                    ? { label: "Registrar incidente", onClick: nuevoIncidente }
                    : undefined
                }
              />
            ) : (
              <ul className="space-y-3">
                {visibles.map((incidente) => {
                  const Icono = ICONOS_TIPO[incidente.tipo];
                  return (
                    <li key={incidente.id}>
                      <button
                        type="button"
                        onClick={() => abrirFicha(incidente)}
                        className="flex w-full min-h-12 items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-ink-muted/40 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
                      >
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fire/10 text-fire-soft ring-1 ring-fire/25">
                          <Icono className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">
                              {ETIQUETAS_TIPO_INCIDENTE[incidente.tipo]}
                            </span>
                            <StatusPill estado={estadoPill(incidente.estado)} />
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-muted">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" aria-hidden />
                              {formatearFechaHoraIncidente(incidente.fecha_hora)}
                            </span>
                            {incidente.direccion ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" aria-hidden />
                                {incidente.direccion}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-3 text-[15px] text-ink-secondary">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" aria-hidden />
                              {incidente.personal.length} personal
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                              {incidente.unidades.length} unidades
                            </span>
                            {esOficial && incidente.creador_nombre ? (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3.5 w-3.5" aria-hidden />
                                {incidente.creador_nombre}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardCard>
        </div>
      ) : null}

      {vista === "ficha" && seleccionado ? (
        <FichaIncidente
          incidente={seleccionado}
          esOficial={esOficial}
          esCreador={seleccionado.creado_por === sessionId}
          onVolver={volverLista}
          onImprimir={() => imprimir(seleccionado)}
          onContinuar={() => continuarBorrador(seleccionado)}
        />
      ) : null}

      {vista === "nuevo" ? (
        <div className="mt-5 space-y-4">
          <Pasos
            pasos={PASOS_INCIDENTE}
            paso={paso}
            onIr={(p) => (p < paso ? setPaso(p) : undefined)}
          />

          {etiquetaGuardado ? (
            <p className="flex items-center gap-2 text-[14px] text-ink-muted" aria-live="polite">
              {estadoGuardado === "guardando" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5 text-ok" aria-hidden />
              )}
              {etiquetaGuardado}
            </p>
          ) : null}

          {paso === 1 ? (
            <DashboardCard
              titulo="1. Tipo de incidente"
              descripcion="Elegí la opción que mejor describa la intervención."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TIPOS_INCIDENTE.map((tipo) => {
                  const Icono = ICONOS_TIPO[tipo.value];
                  const activo = borrador.tipo === tipo.value;
                  return (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => cambiarTipo(tipo.value)}
                      aria-pressed={activo}
                      className={`flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft ${
                        activo
                          ? "border-fire bg-fire/15 text-ink"
                          : "border-line bg-surface text-ink hover:border-ink-muted/40 hover:bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                          activo ? "bg-fire text-ink" : "bg-bg-subtle text-ink-muted"
                        }`}
                      >
                        <Icono className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-[16px] font-semibold">{tipo.label}</span>
                      {activo ? <Check className="ml-auto h-5 w-5 text-fire-soft" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </DashboardCard>
          ) : null}

          {paso === 2 ? (
            <DashboardCard
              titulo="2. Dónde y cuándo"
              descripcion="La hora actual ya está cargada. Ajustala si hace falta."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Fecha y hora"
                  type="datetime-local"
                  value={borrador.fecha_hora}
                  onChange={(e) => setBorrador((prev) => ({ ...prev, fecha_hora: e.target.value }))}
                />
                <div className="flex items-end">
                  <Button variant="secondary" onClick={usarHoraActual} className="gap-2">
                    <Clock3 className="h-4 w-4" aria-hidden />
                    Usar hora actual
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <Input
                  label="Dirección"
                  placeholder="Calle, número y localidad"
                  value={borrador.direccion}
                  maxLength={200}
                  onChange={(e) => setBorrador((prev) => ({ ...prev, direccion: e.target.value }))}
                  hint="Obligatoria para guardar el incidente."
                />
              </div>
            </DashboardCard>
          ) : null}

          {paso === 3 ? (
            <div className="space-y-4">
              <DashboardCard
                titulo="3. Personal de guardia"
                descripcion="Marcá quiénes participaron. Podés actualizar la guardia si cambió."
                encabezadoAccion={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={refrescarPersonal}
                    disabled={cargandoPersonal}
                    className="gap-2"
                  >
                    {cargandoPersonal ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Users className="h-4 w-4" aria-hidden />
                    )}
                    Actualizar
                  </Button>
                }
              >
                {personalErrorActual ? (
                  <Aviso variante="error">{personalErrorActual}</Aviso>
                ) : personalGuardia.length === 0 ? (
                  <EstadoVacio
                    icono="Users"
                    titulo="No hay personal de guardia ahora"
                    texto="Podés guardar el incidente igual y completar el personal en RUBA."
                  />
                ) : (
                  <ul className="space-y-2">
                    {personalGuardia.map((persona) => {
                      const activo = borrador.personal.some(
                        (p) => p.bombero_id === persona.bombero_id
                      );
                      return (
                        <li key={persona.bombero_id}>
                          <button
                            type="button"
                            onClick={() => togglePersonal(persona)}
                            aria-pressed={activo}
                            className={`flex w-full min-h-12 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft ${
                              activo
                                ? "border-brass bg-brass/10"
                                : "border-line bg-surface hover:bg-surface-hover"
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                                activo
                                  ? "border-brass bg-brass text-bg"
                                  : "border-line bg-bg-subtle text-transparent"
                              }`}
                            >
                              <Check className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-ink">{persona.nombre}</span>
                              {persona.cargo ? (
                                <span className="text-[14px] text-ink-muted">{persona.cargo}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </DashboardCard>

              <DashboardCard
                titulo="Unidades"
                descripcion="Agregá los móviles o unidades que intervinieron."
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    label="Unidad"
                    placeholder="Ej: Móvil 1"
                    value={unidadInput}
                    maxLength={40}
                    onChange={(e) => setUnidadInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarUnidad();
                      }
                    }}
                    containerClassName="flex-1"
                  />
                  <div className="flex items-end">
                    <Button variant="secondary" onClick={agregarUnidad} className="gap-2">
                      <Plus className="h-4 w-4" aria-hidden />
                      Agregar
                    </Button>
                  </div>
                </div>
                {borrador.unidades.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {borrador.unidades.map((unidad) => (
                      <li key={unidad}>
                        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-bg-subtle pl-3 text-[14px] text-ink">
                          {unidad}
                          <button
                            type="button"
                            onClick={() => quitarUnidad(unidad)}
                            aria-label={`Quitar ${unidad}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[14px] text-ink-muted">Todavía no agregaste unidades.</p>
                )}
              </DashboardCard>
            </div>
          ) : null}

          {paso === 4 ? (
            <DashboardCard
              titulo="4. Detalle y confirmación"
              descripcion="Escribí un resumen breve de lo que pasó. Después revisá y guardá."
            >
              <Textarea
                label="Detalle de la intervención"
                placeholder="Qué pasó, cómo se trabajó y observaciones importantes."
                rows={5}
                maxLength={2000}
                value={borrador.descripcion}
                onChange={(e) =>
                  setBorrador((prev) => ({ ...prev, descripcion: e.target.value }))
                }
                hint={`${borrador.descripcion.length}/2000 caracteres`}
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {soportaVoz ? (
                  <Button variant="secondary" onClick={dictar} className="gap-2">
                    {escuchando ? (
                      <MicOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Mic className="h-4 w-4" aria-hidden />
                    )}
                    {escuchando ? "Detener dictado" : "Dictar por voz"}
                  </Button>
                ) : (
                  <p className="text-[14px] text-ink-muted">
                    Tu navegador no soporta dictado por voz. Escribí el detalle.
                  </p>
                )}
                {escuchando ? (
                  <span className="text-[14px] text-alarm" aria-live="polite">
                    Escuchando...
                  </span>
                ) : null}
              </div>
              {errorVoz ? (
                <p className="mt-2 flex items-center gap-2 text-[14px] text-fire-text" role="alert">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  {errorVoz}
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border border-line bg-bg-subtle p-4">
                <h4 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  Resumen
                </h4>
                <dl className="mt-2 grid gap-2 text-[15px] sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Tipo</dt>
                    <dd className="font-semibold text-ink">
                      {borrador.tipo ? ETIQUETAS_TIPO_INCIDENTE[borrador.tipo] : "Sin elegir"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Fecha y hora</dt>
                    <dd className="font-semibold text-ink">
                      {formatearBorradorFecha(borrador.fecha_hora)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-ink-muted">Dirección</dt>
                    <dd className="font-semibold text-ink">
                      {borrador.direccion.trim() || "Sin completar"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Personal</dt>
                    <dd className="font-semibold text-ink">
                      {borrador.personal.length
                        ? `${borrador.personal.length} seleccionados`
                        : "Sin seleccionar"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Unidades</dt>
                    <dd className="font-semibold text-ink">
                      {borrador.unidades.length ? borrador.unidades.join(", ") : "Sin unidades"}
                    </dd>
                  </div>
                </dl>
                {borrador.personal.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {borrador.personal.map((p) => (
                      <span
                        key={p.bombero_id}
                        className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-[14px] text-ink"
                      >
                        {p.nombre}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={retroceder} className="gap-2">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Volver
                </Button>
                <Button onClick={guardar} disabled={guardando} className="gap-2">
                  {guardando ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  {guardando ? "Guardando..." : "Guardar incidente"}
                </Button>
              </div>
            </DashboardCard>
          ) : null}

          {paso < 4 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="secondary"
                onClick={retroceder}
                disabled={paso === 1}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Atrás
              </Button>
              <Button onClick={avanzar} disabled={!puedeContinuar} className="gap-2">
                Continuar
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-8 border-t border-line-subtle pt-3 text-[15px] text-ink-secondary">
        Registro a cargo de {sessionNombre}. Los incidentes son datos internos del cuartel.
      </p>
    </div>
  );
}

function FichaIncidente({
  incidente,
  esOficial,
  esCreador,
  onVolver,
  onImprimir,
  onContinuar,
}: {
  incidente: Incidente;
  esOficial: boolean;
  esCreador: boolean;
  onVolver: () => void;
  onImprimir: () => void;
  onContinuar: () => void;
}) {
  const Icono = ICONOS_TIPO[incidente.tipo];
  const editable = incidente.estado === "borrador" && esCreador;

  return (
    <div className="mt-5 space-y-4">
      <DashboardCard
        titulo={ETIQUETAS_TIPO_INCIDENTE[incidente.tipo]}
        descripcion={formatearFechaHoraIncidente(incidente.fecha_hora)}
        encabezadoAccion={<StatusPill estado={estadoPill(incidente.estado)} />}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fire/10 text-fire-soft ring-1 ring-fire/25">
            <Icono className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                  Dirección
                </p>
                <p className="text-[16px] text-ink">
                  {incidente.direccion || "Sin dirección registrada"}
                </p>
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                Unidades
              </p>
              {incidente.unidades.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {incidente.unidades.map((u) => (
                    <span
                      key={u}
                      className="inline-flex items-center rounded-full border border-line bg-bg-subtle px-2.5 py-1 text-[14px] text-ink"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-ink-muted">Sin unidades registradas.</p>
              )}
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                Detalle
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[16px] leading-relaxed text-ink">
                {incidente.descripcion || "Sin detalle registrado."}
              </p>
            </div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        titulo="Personal interviniente"
        descripcion={
          incidente.personal.length
            ? `${incidente.personal.length} personas registradas.`
            : "Sin personal registrado."
        }
      >
        {incidente.personal.length ? (
          <ul className="divide-y divide-line-subtle">
            {incidente.personal.map((p) => (
              <li key={p.bombero_id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-ink-muted">
                  <User className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{p.nombre}</span>
                  {p.cargo ? (
                    <span className="text-[14px] text-ink-muted">{p.cargo}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-muted">
            El personal se puede completar después en RUBA.
          </p>
        )}
      </DashboardCard>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onVolver} className="gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Button>
        <Button onClick={onImprimir} className="gap-2">
          <FileDown className="h-4 w-4" aria-hidden />
          Imprimir / PDF
        </Button>
        {editable ? (
          <Button variant="secondary" onClick={onContinuar} className="gap-2">
            <Pencil className="h-4 w-4" aria-hidden />
            Continuar borrador
          </Button>
        ) : null}
        {esOficial && incidente.creador_nombre ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[14px] text-ink-muted">
            <User className="h-3.5 w-3.5" aria-hidden />
            Registrado por {incidente.creador_nombre}
          </span>
        ) : null}
      </div>
    </div>
  );
}
