import { CUARTEL } from "./cuartel.config";
import { createServiceRoleClient } from "./supabase";
import {
  afectaCuartel,
  identifiersReferenciados,
  nivelDesdeCap,
  parseCap,
  polygonToGeoJson,
  type CapParsed,
} from "./alertas-cap";
import { notificarAlerta } from "./notificaciones-alertas";

export const FUENTE_SMN = "SMN";
const FEED_URL = "https://ssl.smn.gob.ar/CAP/AR.php";
const UA = "SIGOV-Bomberos/1.0";
const TIMEOUT_MS = 10000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_CAP_BYTES = 1024 * 1024;
const CONCURRENCY = 5;

export type SyncResult = {
  ok: boolean;
  procesadas: number;
  aplicadas: number;
  error?: string;
  ultimaVerificacion?: string;
};

let syncEnCurso: Promise<SyncResult> | null = null;
let ultimaTentativa = 0;

async function fetchText(url: string, maxBytes: number): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== "ssl.smn.gob.ar") {
    throw new Error("HOST_NO_PERMITIDO");
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("RESPUESTA_DEMASIADO_GRANDE");
    return text;
  } finally {
    clearTimeout(t);
  }
}

function parseFeedItems(xml: string): { url: string; pubDate: string | null }[] {
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items: { url: string; pubDate: string | null }[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const link = block.match(/<link>(https?:\/\/ssl\.smn\.gob\.ar\/[^<]+\.xml)<\/link>/i)?.[1]?.trim();
    if (!link || seen.has(link)) continue;
    seen.add(link);
    const pubRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? "";
    items.push({ url: link, pubDate: pubRaw || null });
  }
  return items;
}

export function estadoVigenteCalculado(estado: string, hasta: string | null | undefined, ahora = new Date()): "vigente" | "vencida" | "cancelada" {
  if (estado === "cancelada") return "cancelada";
  if (hasta) {
    const h = new Date(hasta);
    if (!Number.isNaN(h.getTime()) && h <= ahora) return "vencida";
  }
  return estado === "vencida" ? "vencida" : "vigente";
}

async function procesarCap(url: string): Promise<{ cap: CapParsed; aplicada: boolean; notificarId?: string } | null> {
  const xml = await fetchText(url, MAX_CAP_BYTES);
  const cap = parseCap(xml);
  if (!cap.identifier) return null;
  const supabase = createServiceRoleClient();

  // Cancel/Update: marcar referenciadas como cancelada/reemplazada (historial conservado)
  const refs = identifiersReferenciados(cap.references);
  if ((cap.msgType === "Update" || cap.msgType === "Cancel") && refs.length > 0) {
    for (const refId of refs) {
      await supabase.rpc("cancelar_alerta_por_id_externo", {
        p_fuente_nombre: FUENTE_SMN,
        p_id_externo: refId,
      });
    }
  }
  if (cap.msgType === "Cancel") {
    await supabase.rpc("cancelar_alerta_por_id_externo", {
      p_fuente_nombre: FUENTE_SMN,
      p_id_externo: cap.identifier,
    });
    return { cap, aplicada: true };
  }

  const info = cap.info;
  if (!info) return { cap, aplicada: false };
  // si hay poligono utilizable, filtrar por punto del cuartel; si no hay poligono no se puede ubicar
  if (info.polygons.length === 0) return { cap, aplicada: false };
  if (!afectaCuartel(info.polygons, CUARTEL.lat, CUARTEL.lng)) return { cap, aplicada: false };

  const nivel = nivelDesdeCap(info.headline || info.event, info.severity);
  const desde = info.onset || cap.sent || null;
  const hasta = info.expires || null;
  const ahora = new Date();
  const estado = hasta && !Number.isNaN(new Date(hasta).getTime()) && new Date(hasta) <= ahora ? "vencida" : "vigente";
  const area = info.areaDesc && info.areaDesc.trim() ? info.areaDesc.trim() : "Zona definida por polígono del SMN";
  const geo = polygonToGeoJson(info.polygons);

  const { data, error } = await supabase.rpc("upsert_alerta", {
    p_tipo_fuente: "meteorologica",
    p_id_externo: cap.identifier,
    p_nivel: nivel,
    p_fenomeno: info.event || "",
    p_titulo: info.headline || info.event || "Alerta meteorológica",
    p_descripcion: info.description || "",
    p_area: area,
    p_area_geojson: geo,
    p_desde: desde,
    p_hasta: hasta,
    p_fuente_nombre: FUENTE_SMN,
    p_fuente_url: url,
    p_estado: estado,
  });
  if (error) throw error;
  const id = typeof data === "string" ? data : undefined;
  if (id && estado === "vigente" && (nivel === "naranja" || nivel === "roja")) {
    await notificarAlerta(id);
  }
  return { cap, aplicada: true, notificarId: id };
}

export async function sincronizarAlertasSmn(opts?: { forzar?: boolean }): Promise<SyncResult> {
  const ahoraMs = Date.now();
  if (syncEnCurso) return syncEnCurso;
  // throttling simple: evitar corridas simultáneas/pegadas salvo forzado
  if (!opts?.forzar && ahoraMs - ultimaTentativa < 15000) {
    return { ok: true, procesadas: 0, aplicadas: 0 };
  }
  ultimaTentativa = ahoraMs;

  const run = (async (): Promise<SyncResult> => {
    const supabase = createServiceRoleClient();
    const consultaEn = new Date().toISOString();
    try {
      await supabase.rpc("marcar_alertas_vencidas");

      // Identificadores ya conocidos para detectar CAP nuevos y loguear su sent (cadencia SMN).
      const { data: conocidosData } = await supabase
        .from("alertas")
        .select("id_externo")
        .eq("fuente_nombre", FUENTE_SMN)
        .not("id_externo", "is", null);
      const conocidos = new Set<string>(
        (conocidosData ?? [])
          .map((r: { id_externo: string | null }) => r.id_externo)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      );

      const feed = await fetchText(FEED_URL, MAX_FEED_BYTES);
      const items = parseFeedItems(feed);
      const pubDatePorUrl = new Map(items.map((it) => [it.url, it.pubDate]));
      let procesadas = 0;
      let aplicadas = 0;
      const nuevos: Array<{ identifier: string; sent: string | null; pubDate: string | null }> = [];
      // concurrencia limitada
      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const lote = items.slice(i, i + CONCURRENCY);
        const res = await Promise.allSettled(
          lote.map(async (it) => ({ ...(await procesarCap(it.url)), url: it.url } as { cap: CapParsed; aplicada: boolean; notificarId?: string; url: string } | null))
        );
        for (const r of res) {
          procesadas++;
          if (r.status === "fulfilled" && r.value) {
            if (r.value.aplicada) aplicadas++;
            const cap = r.value.cap;
            if (cap?.identifier && !conocidos.has(cap.identifier)) {
              nuevos.push({ identifier: cap.identifier, sent: cap.sent ?? null, pubDate: pubDatePorUrl.get(r.value.url) ?? null });
              conocidos.add(cap.identifier);
            }
          }
          if (r.status === "rejected") {
            console.warn("[alertas] error procesando CAP:", r.reason);
          }
        }
      }
      try {
        await supabase.rpc("registrar_ingesta_alertas", {
          p_fecha_consulta: consultaEn,
          p_items_feed: items.length,
          p_cap_nuevos: nuevos.length,
          p_detalle: nuevos.map((n) => ({ identifier: n.identifier, sent: n.sent, pubDate: n.pubDate })),
        });
      } catch (logErr) {
        console.error("[alertas] no se pudo registrar la ingesta SMN:", logErr);
      }
      await supabase.rpc("registrar_estado_fuente_alertas", {
        p_fuente: FUENTE_SMN,
        p_ok: true,
        p_error: null,
      });
      return { ok: true, procesadas, aplicadas, ultimaVerificacion: new Date().toISOString() };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ERROR_DESCONOCIDO";
      console.error("[alertas] fallo sync SMN:", e);
      try {
        await supabase.rpc("registrar_estado_fuente_alertas", {
          p_fuente: FUENTE_SMN,
          p_ok: false,
          p_error: msg.slice(0, 200),
        });
      } catch {}
      return { ok: false, procesadas: 0, aplicadas: 0, error: msg };
    }
  })();

  syncEnCurso = run.finally(() => { syncEnCurso = null; });
  return syncEnCurso;
}

export async function refrescarSmnSiCorresponde(): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("alertas_fuentes_estado")
      .select("ultima_verificacion")
      .eq("fuente", FUENTE_SMN)
      .maybeSingle();
    const ultima = data?.ultima_verificacion ? new Date(data.ultima_verificacion).getTime() : 0;
    if (!ultima || Date.now() - ultima > 15 * 60 * 1000) {
      void sincronizarAlertasSmn(); // segundo plano, throttling interno
    }
  } catch (e) {
    console.warn("[alertas] no se pudo evaluar refresco perezoso:", e);
  }
}
