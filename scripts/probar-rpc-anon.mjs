import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte < 0) continue;
    const clave = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local."
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const uuid = "00000000-0000-0000-0000-000000000000";
const fecha = "2099-01-01";
const franja = "08:00-13:00";

const llamadas = [
  ["ocupar_celda", { p_fecha: fecha, p_franja: franja, p_bombero_id: uuid }],
  ["lock_celda", { p_fecha: fecha, p_franja: franja }],
  ["anotar_turno", { p_fecha: fecha, p_franja: franja, p_bombero_id: uuid }],
  [
    "cancelar_turno",
    { p_turno_id: uuid, p_bombero_id: uuid, p_nota: null },
  ],
  [
    "cambiar_turno",
    {
      p_turno_anterior_id: uuid,
      p_fecha: fecha,
      p_franja: franja,
      p_bombero_id: uuid,
    },
  ],
  ["generar_turnos_ventana", { p_fecha_inicio: fecha, p_dias: 0 }],
  [
    "crear_bombero",
    {
      p_numero_ingreso: -1,
      p_nombre_completo: "Prueba Anon",
      p_cargo: "Cargo Invalido",
    },
  ],
  ["dar_de_baja_bombero", { p_bombero_id: uuid }],
  ["contar_intentos_login", { p_clave: "prueba-anon", p_minutos: 10 }],
  ["registrar_intento_login", { p_clave: null }],
];

function esPermissionDenied(error) {
  if (!error) return false;
  const codigo = String(error.code ?? "");
  const mensaje = String(error.message ?? "").toLowerCase();
  return (
    codigo === "42501" ||
    mensaje.includes("permission denied") ||
    mensaje.includes("insufficient privilege")
  );
}

let fallas = 0;

for (const [nombre, args] of llamadas) {
  const { error } = await supabase.rpc(nombre, args);
  if (esPermissionDenied(error)) {
    console.log(`OK   ${nombre}: permission denied`);
  } else if (error) {
    console.log(`?    ${nombre}: error distinto (${error.code}): ${error.message}`);
    fallas += 1;
  } else {
    console.log(`FALLA ${nombre}: la anon key pudo ejecutar la función`);
    fallas += 1;
  }
}

if (fallas > 0) {
  console.error(`\n${fallas} función(es) no están cerradas para anon.`);
  process.exit(1);
}

console.log("\nTodas las RPC rechazan a la anon key con permission denied.");
