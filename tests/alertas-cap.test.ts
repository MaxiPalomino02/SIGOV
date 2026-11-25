import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  afectaCuartel,
  identifiersReferenciados,
  nivelDesdeCap,
  parseCap,
  puntoEnPoligono,
  parsePolygon,
} from "../lib/alertas-cap.ts";

const CUARTEL_LAT = -26.7906;
const CUARTEL_LNG = -65.2156;

test("punto-en-polígono: sintético contiene el cuartel (orden lat,lng no invertido)", () => {
  // cuadrado alrededor de La Trinidad en orden CAP: lat,lon
  const poly: [number, number][] = [
    [-26.70, -65.30],
    [-26.70, -65.10],
    [-26.88, -65.10],
    [-26.88, -65.30],
  ];
  assert.equal(puntoEnPoligono(CUARTEL_LAT, CUARTEL_LNG, poly), true);
  assert.equal(puntoEnPoligono(-26.50, -65.20, poly), false);
});

test("punto-en-polígono: punto claramente afuera", () => {
  const poly: [number, number][] = [[-27.0,-64.0],[-27.0,-63.8],[-27.2,-63.8],[-27.2,-64.0]];
  assert.equal(puntoEnPoligono(CUARTEL_LAT, CUARTEL_LNG, poly), false);
});

function readFixture(name: string) {
  return fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "smn", name), "utf8");
}

test("parseo CAP real: aviso a corto plazo (ACP)", () => {
  const cap = parseCap(readFixture("acp.xml"));
  assert.equal(cap.identifier, "urn:oid:2.49.0.1.32.0.2026.11.16.12.44.00");
  assert.equal(cap.msgType, "Alert");
  assert.equal(cap.sent, "2026-11-16T12:44:00-03:00");
  assert.equal(cap.references, "");
  assert.ok(cap.info);
  assert.equal(cap.info!.severity, "Severe");
  assert.equal(cap.info!.headline, "AVISO NARANJA POR TORMENTAS FUERTES CON LLUVIAS INTENSAS Y OCASIONAL CAIDA DE GRANIZO");
  assert.equal(cap.info!.onset, null);
  assert.equal(cap.info!.expires, "2026-11-16T14:44:00-03:00");
  assert.equal(cap.info!.polygons.length, 1);
  assert.ok(cap.info!.areaDesc.includes("CORDOBA"));
  // headline trae NARANJA
  assert.equal(nivelDesdeCap(cap.info!.headline, cap.info!.severity), "naranja");
  // ACP real queda afuera del cuartel
  assert.equal(afectaCuartel(cap.info!.polygons, CUARTEL_LAT, CUARTEL_LNG), false);
  assert.deepEqual(identifiersReferenciados(cap.references), []);
});

test("parseo CAP real: alerta diaria Severe Update con references", () => {
  const cap = parseCap(readFixture("diaria.xml"));
  assert.equal(cap.identifier, "urn:oid:2.49.0.1.32.0.2026.11.16.12.49.52.17");
  assert.equal(cap.msgType, "Update");
  assert.equal(cap.references, "smn@smn.gob.ar,urn:oid:2.49.0.1.32.0.2026.11.16.11.08.55,2026-11-16T11:08:55-03:00");
  assert.ok(cap.info);
  assert.equal(cap.info!.severity, "Severe");
  assert.equal(cap.info!.onset, "2026-11-17T03:00:00-03:00");
  assert.equal(cap.info!.expires, "2026-11-17T08:59:59-03:00");
  assert.equal(cap.info!.areaDesc, "");
  assert.equal(cap.info!.polygons.length, 1);
  // headline sin color -> por severity Severe => naranja (regla aprobada)
  assert.equal(nivelDesdeCap(cap.info!.headline, cap.info!.severity), "naranja");
  assert.equal(afectaCuartel(cap.info!.polygons, CUARTEL_LAT, CUARTEL_LNG), false);
  assert.deepEqual(identifiersReferenciados(cap.references), [
    "urn:oid:2.49.0.1.32.0.2026.11.16.11.08.55",
  ]);
});

test("parseo CAP real: alerta diaria Moderate", () => {
  const cap = parseCap(readFixture("diaria_moderada.xml"));
  assert.ok(cap.info);
  assert.equal(cap.info!.severity, "Moderate");
  assert.equal(nivelDesdeCap(cap.info!.headline, cap.info!.severity), "amarilla");
  assert.equal(afectaCuartel(cap.info!.polygons, CUARTEL_LAT, CUARTEL_LNG), false);
});

test("mapeo de nivel: headline con color tiene prioridad; severity desconocida -> informativa", () => {
  assert.equal(nivelDesdeCap("ALERTA ROJA POR CALOR", "Moderate"), "roja");
  assert.equal(nivelDesdeCap("AVISO AMARILLO POR LLUVIAS", "Severe"), "amarilla");
  assert.equal(nivelDesdeCap("Evento", "Extreme"), "roja");
  assert.equal(nivelDesdeCap("Evento", "Minor"), "informativa");
  assert.equal(nivelDesdeCap("Evento", "Rara"), "informativa");
});

test("parsePolygon mantiene orden lat,lng", () => {
  const pts = parsePolygon("-26.7,-65.3 -26.7,-65.1 -26.88,-65.1");
  assert.deepEqual(pts[0], [-26.7, -65.3]); // [lat, lon]
});

test("msgType Cancel: fixture sintético rotulado como tal se parsea", () => {
  const xml = `<?xml version="1.0"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>urn:oid:test.cancel.1</identifier>
  <sender>smn@smn.gob.ar</sender>
  <sent>2026-11-16T12:00:00-03:00</sent>
  <status>Actual</status>
  <msgType>Cancel</msgType>
  <scope>Public</scope>
  <references>smn@smn.gob.ar,urn:oid:2.49.0.1.32.0.2026.11.16.12.44.00,2026-11-16T12:44:00-03:00</references>
</alert>`;
  const cap = parseCap(xml);
  assert.equal(cap.msgType, "Cancel");
  assert.equal(cap.identifier, "urn:oid:test.cancel.1");
  assert.deepEqual(identifiersReferenciados(cap.references), [
    "urn:oid:2.49.0.1.32.0.2026.11.16.12.44.00",
  ]);
  assert.equal(cap.info, null);
});
