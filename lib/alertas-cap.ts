export type NivelAlerta = "informativa" | "amarilla" | "naranja" | "roja";

// Mapeo de nivel inferido de muestras SMN (CAP reales nov 2026: <severity> Moderate/Severe,
// <headline> "AVISO NARANJA..." en ACP; sin <parameter> de color). Criterio SAT/colores:
// https://www.smn.gob.ar/sites/default/files/PreguntasFrecuentes.pdf (amarillo=informate,
// naranja=preparate, rojo=seguí instrucciones oficiales). Regla: primero headline si trae
// AVISO/ALERTA + color; si no, por severity.
export function nivelDesdeCap(headline: string | null | undefined, severity: string | null | undefined): NivelAlerta {
  const h = (headline ?? "").toUpperCase();
  if (/\b(AVISO|ALERTA)\b/.test(h)) {
    if (/ROJ/.test(h)) return "roja";
    if (/NARANJA/.test(h)) return "naranja";
    if (/AMARILL/.test(h)) return "amarilla";
  }
  const s = (severity ?? "").trim().toLowerCase();
  switch (s) {
    case "moderate":
      return "amarilla";
    case "severe":
      return "naranja";
    case "extreme":
      return "roja";
    case "minor":
      return "informativa";
    default:
      if (s) console.warn("[alertas] severity CAP desconocida, se usa informativa:", severity);
      return "informativa";
  }
}

export function puntoEnPoligono(lat: number, lon: number, polygon: [number, number][]): boolean {
  // polygon: pares [lat, lon] en orden CAP (lat,lon). Ray casting sobre plano lon(x), lat(y).
  let dentro = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1];
    const yj = polygon[j][0], xj = polygon[j][1];
    const intersecta = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}

export function parsePolygon(text: string | null | undefined): [number, number][] {
  if (!text) return [];
  return text
    .trim()
    .split(/\s+/)
    .map((par) => {
      const [a, b] = par.split(",").map((n) => Number(n.trim()));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return [a, b] as [number, number];
    })
    .filter((p): p is [number, number] => p !== null);
}

export type CapParsed = {
  identifier: string;
  msgType: string;
  sent: string | null;
  references: string;
  info: {
    event: string;
    headline: string;
    description: string;
    instruction: string;
    onset: string | null;
    expires: string | null;
    severity: string;
    areaDesc: string;
    polygons: string[];
  } | null;
};

function tag(xml: string, name: string): string {
  const re = new RegExp(`<(?:(?:cap|\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:cap|\\w+):)?${name}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function tags(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:(?:cap|\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:cap|\\w+):)?${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export function parseCap(xml: string): CapParsed {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new Error("CAP_INVALIDO");
  }
  const identifier = decodeEntities(tag(xml, "identifier"));
  const msgType = decodeEntities(tag(xml, "msgType"));
  const sent = tag(xml, "sent") || null;
  const references = decodeEntities(tag(xml, "references"));
  // tomar primer <info>
  const infoMatch = xml.match(/<(?:(?:cap|\w+):)?info\b[^>]*>([\s\S]*?)<\/(?:(?:cap|\w+):)?info>/i);
  let info: CapParsed["info"] = null;
  if (infoMatch) {
    const ix = infoMatch[1];
    const polygons = tags(ix, "polygon");
    info = {
      event: decodeEntities(tag(ix, "event")),
      headline: decodeEntities(tag(ix, "headline")),
      description: decodeEntities(tag(ix, "description")),
      instruction: decodeEntities(tag(ix, "instruction")),
      onset: tag(ix, "onset") || null,
      expires: tag(ix, "expires") || null,
      severity: decodeEntities(tag(ix, "severity")),
      areaDesc: decodeEntities(tag(ix, "areaDesc")),
      polygons,
    };
  }
  return { identifier, msgType, sent, references, info };
}

export function polygonToGeoJson(polygons: string[]): unknown | null {
  const rings = polygons.map(parsePolygon).filter((r) => r.length >= 3);
  if (rings.length === 0) return null;
  // GeoJSON: [lon, lat]
  const coords = rings.map((ring) => ring.map(([lat, lon]) => [lon, lat]));
  if (coords.length === 1) return { type: "Polygon", coordinates: coords };
  return { type: "MultiPolygon", coordinates: coords.map((c) => [c]) };
}

export function afectaCuartel(polygons: string[], lat: number, lon: number): boolean {
  for (const p of polygons) {
    const pts = parsePolygon(p);
    if (pts.length >= 3 && puntoEnPoligono(lat, lon, pts)) return true;
  }
  return false;
}

export function identifiersReferenciados(references: string): string[] {
  // formato: sender,identifier,sent sender,identifier,sent ...
  if (!references) return [];
  const tokens = references.trim().split(/\s+/);
  const ids: string[] = [];
  for (const t of tokens) {
    const parts = t.split(",");
    if (parts.length >= 2 && parts[1]) ids.push(parts[1]);
  }
  return ids;
}
