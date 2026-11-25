"use client";

export const EVENTO_COLA = "sigov:sincronizacion:cambio";
export const EVENTO_DATOS = "sigov:datos:actualizados";

export type TipoOperacion = "incidente" | "chequeo" | "tarea";

export type AccionOperacion =
  | "guardar_incidente"
  | "guardar_resultado"
  | "finalizar_chequeo"
  | "crear_tarea"
  | "editar_tarea"
  | "borrar_tarea"
  | "marcar_tarea"
  | "desmarcar_tarea";

export type OperacionPendiente = {
  id: string;
  tipo: TipoOperacion;
  accion: AccionOperacion;
  clave: string;
  creado_en: number;
  intentos: number;
  proximo_intento: number;
  ultimo_error: string | null;
  payload: Record<string, unknown>;
};

export type NuevaOperacion = {
  tipo: TipoOperacion;
  accion: AccionOperacion;
  clave: string;
  payload: Record<string, unknown>;
};

const NOMBRE_BD = "sigov-sincronizacion";
const VERSION_BD = 1;
const TIENDA = "operaciones";

function abrirBase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(NOMBRE_BD, VERSION_BD);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(TIENDA)) {
        const tienda = bd.createObjectStore(TIENDA, { keyPath: "id" });
        tienda.createIndex("por_clave", "clave", { unique: false });
        tienda.createIndex("por_tipo", "tipo", { unique: false });
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function conTienda<T>(
  modo: IDBTransactionMode,
  operacion: (tienda: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const bd = await abrirBase();
  return new Promise<T>((resolve, reject) => {
    const transaccion = bd.transaction(TIENDA, modo);
    const solicitud = operacion(transaccion.objectStore(TIENDA));
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
    transaccion.oncomplete = () => bd.close();
    transaccion.onerror = () => {
      bd.close();
      reject(transaccion.error);
    };
  });
}

export async function listarOperaciones(): Promise<OperacionPendiente[]> {
  const resultado = await conTienda<OperacionPendiente[]>("readonly", (tienda) =>
    tienda.getAll() as IDBRequest<OperacionPendiente[]>
  );
  return resultado.sort((a, b) => a.creado_en - b.creado_en);
}

export async function contarOperaciones(): Promise<number> {
  return conTienda<number>("readonly", (tienda) => tienda.count());
}

export async function eliminarOperacion(id: string): Promise<void> {
  await conTienda<undefined>("readwrite", (tienda) => tienda.delete(id));
  notificarCambio();
  notificarDatos();
}

export function notificarDatos(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_DATOS));
}

export async function registrarIntento(
  id: string,
  intentos: number,
  error: string
): Promise<void> {
  const espera = Math.min(15 * 60 * 1000, 30 * 1000 * 2 ** intentos);
  const bd = await abrirBase();
  return new Promise<void>((resolve, reject) => {
    const transaccion = bd.transaction(TIENDA, "readwrite");
    const tienda = transaccion.objectStore(TIENDA);
    const solicitud = tienda.get(id) as IDBRequest<OperacionPendiente | undefined>;
    solicitud.onsuccess = () => {
      const actual = solicitud.result;
      if (!actual) return;
      tienda.put({
        ...actual,
        intentos,
        proximo_intento: Date.now() + espera,
        ultimo_error: error,
      });
    };
    transaccion.oncomplete = () => {
      bd.close();
      notificarCambio();
      resolve();
    };
    transaccion.onerror = () => {
      bd.close();
      reject(transaccion.error);
    };
  });
}

export function notificarCambio(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_COLA));
}

export async function encolarOperacion(
  nueva: NuevaOperacion
): Promise<{ id: string; encolada: boolean }> {
  const ahora = Date.now();
  const operacion: OperacionPendiente = {
    id: crypto.randomUUID(),
    tipo: nueva.tipo,
    accion: nueva.accion,
    clave: nueva.clave,
    creado_en: ahora,
    intentos: 0,
    proximo_intento: ahora,
    ultimo_error: null,
    payload: nueva.payload,
  };

  if (nueva.tipo === "tarea") {
    const existentes = await conTienda<OperacionPendiente[]>("readonly", (tienda) =>
      (tienda.index("por_clave").getAll(nueva.clave) as IDBRequest<OperacionPendiente[]>)
    );
    if (existentes.length > 0) {
      return { id: existentes[0].id, encolada: false };
    }
    await conTienda<IDBValidKey>("readwrite", (tienda) => tienda.put(operacion));
    notificarCambio();
    return { id: operacion.id, encolada: true };
  }

  const existentes = await conTienda<OperacionPendiente[]>("readonly", (tienda) =>
    tienda.index("por_clave").getAll(nueva.clave) as IDBRequest<OperacionPendiente[]>
  );
  const bd = await abrirBase();
  return new Promise<{ id: string; encolada: boolean }>((resolve, reject) => {
    const transaccion = bd.transaction(TIENDA, "readwrite");
    const tienda = transaccion.objectStore(TIENDA);
    for (const anterior of existentes) void tienda.delete(anterior.id);
    tienda.put(operacion);
    transaccion.oncomplete = () => {
      bd.close();
      notificarCambio();
      resolve({ id: operacion.id, encolada: true });
    };
    transaccion.onerror = () => {
      bd.close();
      reject(transaccion.error);
    };
  });
}

export function suscribirACola(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO_COLA, callback);
  return () => window.removeEventListener(EVENTO_COLA, callback);
}
