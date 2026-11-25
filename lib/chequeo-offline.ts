import type {
  ChequeoGuardado,
  GuardarResultadoInput,
} from "@/lib/chequeo-guardado";
import { encolarOperacion } from "@/lib/cola-sincronizacion";

type ResultadoLocal = { ok: true } | { ok: false; error: string; pendiente?: boolean };

export const chequeoOffline: Pick<
  ChequeoGuardado,
  "guardarResultado" | "finalizarChequeo"
> = {
  async guardarResultado(input: GuardarResultadoInput): Promise<ResultadoLocal> {
    await encolarOperacion({
      tipo: "chequeo",
      accion: "guardar_resultado",
      clave: `chequeo:${input.chequeoId}:${input.itemId}`,
      payload: {
        chequeoId: input.chequeoId,
        itemId: input.itemId,
        estado: input.estado,
        nota: input.nota ?? "",
        fotoPath: input.fotoPath ?? "",
      },
    });
    return {
      ok: false,
      error: "Guardado en el dispositivo. Se sincronizará cuando vuelva la conexión.",
      pendiente: true,
    };
  },

  async finalizarChequeo(
    chequeoId: string,
    observaciones?: string
  ): Promise<ResultadoLocal> {
    await encolarOperacion({
      tipo: "chequeo",
      accion: "finalizar_chequeo",
      clave: `chequeo:${chequeoId}:finalizacion`,
      payload: { chequeoId, observaciones: observaciones ?? "" },
    });
    return {
      ok: false,
      error: "Finalización guardada en el dispositivo. Se sincronizará cuando vuelva la conexión.",
      pendiente: true,
    };
  },
};
