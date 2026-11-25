"use client";

import { sincronizarOperacion } from "@/app/sincronizacion/actions";
import {
  EVENTO_COLA,
  eliminarOperacion,
  listarOperaciones,
  registrarIntento,
} from "@/lib/cola-sincronizacion";

let sincronizando = false;

export async function sincronizarPendientes(): Promise<void> {
  if (sincronizando || typeof navigator === "undefined" || !navigator.onLine) return;
  sincronizando = true;
  try {
    const operaciones = await listarOperaciones();
    const ahora = Date.now();
    for (const operacion of operaciones) {
      if (operacion.proximo_intento > ahora) continue;
      const resultado = await sincronizarOperacion(operacion);
      if (resultado.ok) {
        await eliminarOperacion(operacion.id);
      } else {
        await registrarIntento(
          operacion.id,
          operacion.intentos + 1,
          resultado.error
        );
      }
    }
  } catch {
    void 0;
  } finally {
    sincronizando = false;
  }
}

export function iniciarSincronizador(): () => void {
  const alCambiar = () => void sincronizarPendientes();
  window.addEventListener("online", alCambiar);
  window.addEventListener(EVENTO_COLA, alCambiar);
  const temporizador = window.setInterval(() => {
    void sincronizarPendientes();
  }, 60_000);
  void sincronizarPendientes();

  return () => {
    window.removeEventListener("online", alCambiar);
    window.removeEventListener(EVENTO_COLA, alCambiar);
    window.clearInterval(temporizador);
  };
}
