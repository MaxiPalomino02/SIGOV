"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bug,
  Car,
  Check,
  ChevronRight,
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
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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



function etiquetaEstadoIncidente(estado: Incidente["estado"]) {
  return estado === "cargado" ? "Cargado" : "Borrador";
}
function claseChipEstado(estado: Incidente["estado"]) {
  return estado === "cargado" ? "bg-green-tint text-green-ink" : "bg-yellow-tint text-yellow-ink";
}
function claveMes(fechaISO: string) {
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return "sin-fecha";
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Tucuman", year: "numeric", month: "2-digit" }).formatToParts(d);
  const anio = partes.find((p) => p.type === "year")?.value ?? "0000";
  const mes = partes.find((p) => p.type === "month")?.value ?? "00";
  return `${anio}-${mes}`;
}
function etiquetaMes(clave: string) {
  if (clave === "sin-fecha") return "Sin fecha";
  const [anio, mes] = clave.split("-");
  const d = new Date(Date.UTC(Number(anio), Number(mes) - 1, 1, 12, 0, 0));
  const nombre = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
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
        ? "Borrador guardado"
        : estadoGuardado === "local" && ultimoGuardadoLocal
          ? `Borrador guardado a las ${ultimoGuardadoLocal}`
          : estadoGuardado === "error"
            ? "No se pudo guardar el borrador"
            : null;

  const gruposMes = useMemo(() => {
    const mapa = new Map<string, Incidente[]>();
    for (const incidente of visibles) {
      const clave = claveMes(incidente.fecha_hora);
      const actual = mapa.get(clave) ?? [];
      actual.push(incidente);
      mapa.set(clave, actual);
    }
    return Array.from(mapa.entries()).map(([clave, items]) => ({ clave, titulo: etiquetaMes(clave), items }));
  }, [visibles]);

  const mesActual = claveMes(ahoraInicial);
  const cargadosEsteMes = cargados.filter((i) => claveMes(i.fecha_hora) === mesActual).length;
  const esNuevo = vista === "nuevo";
  const esFicha = vista === "ficha";
  const tituloIsla = esNuevo ? "Nuevo incidente" : esFicha ? "Incidente" : "Incidentes";
  const subtituloIsla = esNuevo
    ? [PASOS_INCIDENTE[paso - 1]?.label, etiquetaGuardado].filter(Boolean).join(" · ")
    : esFicha
      ? undefined
      : "Registrá y consultá las intervenciones del cuartel.";
  const estadoIsla = esNuevo
    ? ({ tono: "neutro", texto: `Paso ${paso} de 4` } as const)
    : ({ tono: "neutro", texto: `${cargadosEsteMes} cargados este mes` } as const);
  const accionesIsla = esNuevo
    ? [{ icono: X, etiqueta: "Cerrar", onClick: volverLista, principal: true }]
    : esFicha
      ? [{ icono: ArrowLeft, etiqueta: "Volver a la lista", onClick: volverLista }]
      : [{ icono: Plus, etiqueta: "Nuevo incidente", onClick: nuevoIncidente, principal: true }];
  const progresoIsla = esNuevo ? { actual: paso, total: 4 } : undefined;

  return (
    <div className="min-h-dvh bg-bg pb-28">
      <EncabezadoIsla
        titulo={tituloIsla}
        subtitulo={subtituloIsla}
        icono={ClipboardList}
        estado={estadoIsla}
        acciones={accionesIsla}
        progreso={progresoIsla}
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        {mensaje ? (
          <div role={mensaje.tipo === "error" ? "alert" : "status"} className={`mb-4 rounded-[16px] px-4 py-3 text-[15px] ${mensaje.tipo === "ok" ? "bg-green-tint text-green-ink" : mensaje.tipo === "error" ? "bg-red-tint text-red" : "bg-yellow-tint text-yellow-ink"}`}>
            {mensaje.texto}
          </div>
        ) : null}
        {cargaError ? <div role="alert" className="mb-4 rounded-[16px] bg-red-tint px-4 py-3 text-[15px] text-red">{cargaError}</div> : null}

        {vista === "lista" ? (
          <div className="space-y-4">
            {borradorPendiente ? (
              <div className="rounded-[16px] bg-yellow-tint p-4">
                <p className="text-[17px] font-semibold text-label">Hay un borrador sin terminar</p>
                <p className="mt-1 text-[15px] text-label-2">Encontramos un borrador guardado en este dispositivo. ¿Querés continuarlo?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={restaurarBorrador}>Continuar borrador</Button>
                  <Button size="sm" variant="secondary" onClick={descartarBorrador}>Descartar copia local</Button>
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 rounded-[14px] bg-surface-2 p-1" role="tablist" aria-label="Estado de incidentes">
              {([{ value: "cargados" as const, label: "Cargados", count: cargados.length }, { value: "borradores" as const, label: "Borradores", count: borradores.length }]).map((tab) => {
                const activo = filtro === tab.value;
                return (
                  <button key={tab.value} type="button" role="tab" aria-selected={activo} onClick={() => setFiltro(tab.value)} className={`tap min-h-[44px] flex-1 rounded-[14px] px-3 text-[15px] font-semibold transition-colors ${activo ? "bg-surface text-label shadow-[0_1px_2px_rgba(0,0,0,.04)]" : "text-label-2"}`}>
                    {tab.label} <span className="num text-label-2">{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {cargandoLista ? (
              <div className="rounded-[16px] bg-surface p-4 text-[15px] text-label-2">Cargando incidentes...</div>
            ) : visibles.length === 0 ? (
              <div className="rounded-[16px] bg-surface px-6 py-10 text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-surface-2 text-label-2"><ClipboardList size={22} strokeWidth={1.75} aria-hidden /></span>
                <p className="text-[17px] font-semibold text-label">{filtro === "cargados" ? "Todavía no hay incidentes" : "No hay borradores"}</p>
                <p className="mt-1 text-[15px] text-label-2">{filtro === "cargados" ? "Cuando registres un incidente, va a aparecer en esta lista." : "Los borradores se guardan solos mientras completás el registro."}</p>
                {filtro === "cargados" ? <Button className="mt-5" onClick={nuevoIncidente}>Registrar incidente</Button> : null}
              </div>
            ) : (
              <div className="space-y-6">
                {gruposMes.map((grupo) => (
                  <section key={grupo.clave}>
                    <h2 className="mb-2 px-1 text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">{grupo.titulo}</h2>
                    <div className="overflow-hidden rounded-[16px] bg-surface">
                      {grupo.items.map((incidente) => {
                        const Icono = ICONOS_TIPO[incidente.tipo];
                        return (
                          <button key={incidente.id} type="button" onClick={() => abrirFicha(incidente)} className="tap fila flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-tint text-red"><Icono size={22} strokeWidth={1.75} aria-hidden /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[17px] font-semibold text-label">{ETIQUETAS_TIPO_INCIDENTE[incidente.tipo]}</span>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-medium ${claseChipEstado(incidente.estado)}`}>{etiquetaEstadoIncidente(incidente.estado)}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-[15px] text-label-2"><span className="num">{formatearFechaHoraIncidente(incidente.fecha_hora)}</span>{incidente.direccion ? ` · ${incidente.direccion}` : ""}</span>
                              <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-label-2"><span>{incidente.personal.length} personal</span><span>{incidente.unidades.length} unidades</span>{esOficial && incidente.creador_nombre ? <span>{incidente.creador_nombre}</span> : null}</span>
                            </span>
                            <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 text-label-3" aria-hidden />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {vista === "ficha" && seleccionado ? (
          <FichaIncidente incidente={seleccionado} esOficial={esOficial} esCreador={seleccionado.creado_por === sessionId} onVolver={volverLista} onImprimir={() => imprimir(seleccionado)} onContinuar={() => continuarBorrador(seleccionado)} />
        ) : null}

        {vista === "nuevo" ? (
          <div className="space-y-4">
            {paso === 1 ? (
              <section className="rounded-[16px] bg-surface p-4">
                <h2 className="text-[22px] font-bold text-label">¿Qué tipo de incidente fue?</h2>
                <p className="mt-1 text-[15px] text-label-2">Elegí la opción que mejor describa la intervención.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TIPOS_INCIDENTE.map((tipo) => {
                    const Icono = ICONOS_TIPO[tipo.value];
                    const activo = borrador.tipo === tipo.value;
                    return (
                      <button key={tipo.value} type="button" onClick={() => cambiarTipo(tipo.value)} aria-pressed={activo} className={`tap flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[16px] border px-3 py-4 text-center transition-colors ${activo ? "border-red bg-red-tint text-label" : "border-separator bg-surface-2 text-label hover:bg-surface"}`}>
                        <span className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${activo ? "bg-red text-surface" : "bg-surface text-label-2"}`}><Icono size={22} strokeWidth={1.75} aria-hidden /></span>
                        <span className="text-[15px] font-semibold leading-snug">{tipo.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {paso === 2 ? (
              <section className="rounded-[16px] bg-surface p-4">
                <h2 className="text-[22px] font-bold text-label">¿Dónde y cuándo?</h2>
                <p className="mt-1 text-[15px] text-label-2">La hora actual ya está cargada. Ajustala si hace falta.</p>
                <div className="mt-4 space-y-4">
                  <Input label="Fecha y hora" type="datetime-local" value={borrador.fecha_hora} onChange={(e) => setBorrador((prev) => ({ ...prev, fecha_hora: e.target.value }))} />
                  <Button variant="secondary" onClick={usarHoraActual} className="gap-2"><Clock3 size={22} strokeWidth={1.75} aria-hidden />Usar hora actual</Button>
                  <Input label="Dirección" placeholder="Calle, número y localidad" value={borrador.direccion} maxLength={200} onChange={(e) => setBorrador((prev) => ({ ...prev, direccion: e.target.value }))} hint="Obligatoria para guardar el incidente." />
                </div>
              </section>
            ) : null}

            {paso === 3 ? (
              <div className="space-y-4">
                <section className="rounded-[16px] bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[22px] font-bold text-label">¿Quiénes participaron?</h2>
                      <p className="mt-1 text-[15px] text-label-2">Marcá el personal de guardia que intervino.</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={refrescarPersonal} disabled={cargandoPersonal} className="shrink-0 gap-2">
                      {cargandoPersonal ? <Loader2 size={22} strokeWidth={1.75} className="animate-spin" aria-hidden /> : <Users size={22} strokeWidth={1.75} aria-hidden />}
                      Actualizar
                    </Button>
                  </div>
                  {personalErrorActual ? <p role="alert" className="mt-4 rounded-[14px] bg-red-tint px-4 py-3 text-[15px] text-red">{personalErrorActual}</p> : personalGuardia.length === 0 ? (
                    <p className="mt-4 rounded-[14px] bg-surface-2 px-4 py-3 text-[15px] text-label-2">No hay personal de guardia ahora. Podés guardar el incidente igual y completar el personal en RUBA.</p>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-[16px] border border-separator">
                      {personalGuardia.map((persona) => {
                        const activo = borrador.personal.some((p) => p.bombero_id === persona.bombero_id);
                        return (
                          <button key={persona.bombero_id} type="button" onClick={() => togglePersonal(persona)} aria-pressed={activo} className="tap fila flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${activo ? "border-red bg-red text-surface" : "border-separator bg-surface text-transparent"}`}><Check size={14} strokeWidth={2} aria-hidden /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[17px] font-medium text-label">{persona.nombre}</span>{persona.cargo ? <span className="block text-[15px] text-label-2">{persona.cargo}</span> : null}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-[16px] bg-surface p-4">
                  <h2 className="text-[22px] font-bold text-label">Unidades</h2>
                  <p className="mt-1 text-[15px] text-label-2">Agregá los móviles o unidades que intervinieron.</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Input label="Unidad" placeholder="Ej: Móvil 1" value={unidadInput} maxLength={40} onChange={(e) => setUnidadInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarUnidad(); } }} containerClassName="flex-1" />
                    <div className="flex items-end"><Button variant="secondary" onClick={agregarUnidad} className="gap-2"><Plus size={22} strokeWidth={1.75} aria-hidden />Agregar</Button></div>
                  </div>
                  {borrador.unidades.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {borrador.unidades.map((unidad) => (
                        <span key={unidad} className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-surface-2 pl-4 text-[15px] text-label">
                          {unidad}
                          <button type="button" onClick={() => quitarUnidad(unidad)} aria-label={`Quitar ${unidad}`} className="tap flex h-11 w-11 items-center justify-center rounded-full text-label-2 hover:bg-surface"><X size={18} strokeWidth={1.75} aria-hidden /></button>
                        </span>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-[15px] text-label-2">Todavía no agregaste unidades.</p>}
                </section>
              </div>
            ) : null}

            {paso === 4 ? (
              <section className="rounded-[16px] bg-surface p-4">
                <h2 className="text-[22px] font-bold text-label">Detalle y confirmación</h2>
                <p className="mt-1 text-[15px] text-label-2">Escribí un resumen breve de lo que pasó. Después revisá y guardá.</p>
                <div className="mt-4 space-y-3">
                  <Textarea label="Detalle de la intervención" placeholder="Qué pasó, cómo se trabajó y observaciones importantes." rows={5} maxLength={2000} value={borrador.descripcion} onChange={(e) => setBorrador((prev) => ({ ...prev, descripcion: e.target.value }))} hint={`${borrador.descripcion.length}/2000 caracteres`} />
                  <div className="flex flex-wrap items-center gap-2">
                    {soportaVoz ? (
                      <Button variant="secondary" onClick={dictar} className="gap-2">
                        {escuchando ? <MicOff size={22} strokeWidth={1.75} aria-hidden /> : <Mic size={22} strokeWidth={1.75} aria-hidden />}
                        {escuchando ? "Detener dictado" : "Dictar por voz"}
                      </Button>
                    ) : <p className="text-[15px] text-label-2">Tu navegador no soporta dictado por voz. Escribí el detalle.</p>}
                    {escuchando ? <span className="text-[15px] font-medium text-red" aria-live="polite">Escuchando...</span> : null}
                  </div>
                  {errorVoz ? <p role="alert" className="flex items-center gap-2 rounded-[14px] bg-red-tint px-4 py-3 text-[15px] text-red"><AlertCircle size={22} strokeWidth={1.75} aria-hidden />{errorVoz}</p> : null}
                  <div className="rounded-[16px] bg-surface-2 p-4">
                    <p className="text-[13px] text-label-2">Resumen</p>
                    <dl className="mt-3 grid gap-3 text-[15px] sm:grid-cols-2">
                      <div><dt className="text-label-2">Tipo</dt><dd className="font-semibold text-label">{borrador.tipo ? ETIQUETAS_TIPO_INCIDENTE[borrador.tipo] : "Sin elegir"}</dd></div>
                      <div><dt className="text-label-2">Fecha y hora</dt><dd className="num font-semibold text-label">{formatearBorradorFecha(borrador.fecha_hora)}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-label-2">Dirección</dt><dd className="font-semibold text-label">{borrador.direccion.trim() || "Sin completar"}</dd></div>
                      <div><dt className="text-label-2">Personal</dt><dd className="font-semibold text-label">{borrador.personal.length ? `${borrador.personal.length} seleccionados` : "Sin seleccionar"}</dd></div>
                      <div><dt className="text-label-2">Unidades</dt><dd className="font-semibold text-label">{borrador.unidades.length ? borrador.unidades.join(", ") : "Sin unidades"}</dd></div>
                    </dl>
                    {borrador.personal.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{borrador.personal.map((p) => <span key={p.bombero_id} className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-[13px] text-label">{p.nombre}</span>)}</div> : null}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

      {vista === "nuevo" ? (
        <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-separator">
          <div className="mx-auto flex w-full max-w-3xl gap-3 px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
            <Button variant="secondary" onClick={retroceder} disabled={paso === 1 || guardando} className="flex-1 gap-2"><ArrowLeft size={22} strokeWidth={1.75} aria-hidden />Atrás</Button>
            {paso < 4 ? (
              <Button onClick={avanzar} disabled={!puedeContinuar} className="flex-1 gap-2">Continuar<ArrowRight size={22} strokeWidth={1.75} aria-hidden /></Button>
            ) : (
              <Button onClick={guardar} disabled={guardando} className="flex-1 gap-2">
                {guardando ? <Loader2 size={22} strokeWidth={1.75} className="animate-spin" aria-hidden /> : <Check size={22} strokeWidth={1.75} aria-hidden />}
                {guardando ? "Guardando..." : "Guardar incidente"}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FichaIncidente({
  incidente, esOficial, esCreador, onVolver, onImprimir, onContinuar,
}: {
  incidente: Incidente; esOficial: boolean; esCreador: boolean; onVolver: () => void; onImprimir: () => void; onContinuar: () => void;
}) {
  const Icono = ICONOS_TIPO[incidente.tipo];
  const editable = incidente.estado === "borrador" && esCreador;
  return (
    <div className="space-y-4">
      <section className="rounded-[16px] bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-red-tint text-red"><Icono size={22} strokeWidth={1.75} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-bold text-label">{ETIQUETAS_TIPO_INCIDENTE[incidente.tipo]}</h2>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-medium ${claseChipEstado(incidente.estado)}`}>{etiquetaEstadoIncidente(incidente.estado)}</span>
            </div>
            <p className="num mt-1 text-[15px] text-label-2">{formatearFechaHoraIncidente(incidente.fecha_hora)}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-4 text-[15px]">
          <div><dt className="text-label-2">Dirección</dt><dd className="text-[17px] font-medium text-label">{incidente.direccion || "Sin dirección registrada"}</dd></div>
          <div><dt className="text-label-2">Unidades</dt><dd className="mt-1">{incidente.unidades.length ? <div className="flex flex-wrap gap-2">{incidente.unidades.map((u) => <span key={u} className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-[13px] text-label">{u}</span>)}</div> : <span className="text-label-2">Sin unidades registradas.</span>}</dd></div>
          <div><dt className="text-label-2">Detalle</dt><dd className="mt-1 whitespace-pre-wrap text-[17px] leading-relaxed text-label">{incidente.descripcion || "Sin detalle registrado."}</dd></div>
        </dl>
      </section>
      <section className="rounded-[16px] bg-surface p-4">
        <p className="text-[13px] font-normal tracking-[.3px] text-label-2 uppercase">Personal interviniente</p>
        <p className="mt-1 text-[15px] text-label-2">{incidente.personal.length ? `${incidente.personal.length} personas registradas.` : "Sin personal registrado."}</p>
        {incidente.personal.length ? (
          <div className="mt-3 overflow-hidden rounded-[16px] border border-separator">
            {incidente.personal.map((p) => (
              <div key={p.bombero_id} className="fila flex min-h-[44px] items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-label-2"><User size={18} strokeWidth={1.75} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block text-[17px] font-medium text-label">{p.nombre}</span>{p.cargo ? <span className="block text-[15px] text-label-2">{p.cargo}</span> : null}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-[15px] text-label-2">El personal se puede completar después en RUBA.</p>}
      </section>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onVolver} className="gap-2"><ArrowLeft size={22} strokeWidth={1.75} aria-hidden />Volver</Button>
        <Button onClick={onImprimir} className="gap-2"><FileDown size={22} strokeWidth={1.75} aria-hidden />Exportar PDF</Button>
        {editable ? <Button variant="secondary" onClick={onContinuar} className="gap-2"><Pencil size={22} strokeWidth={1.75} aria-hidden />Continuar borrador</Button> : null}
      </div>
      {esOficial && incidente.creador_nombre ? <p className="px-1 text-[15px] text-label-2">Registrado por {incidente.creador_nombre}</p> : null}
    </div>
  );
}
