function numeroEnv(nombre: string, valorPorDefecto: number): number {
  const valor = process.env[nombre];
  if (!valor) return valorPorDefecto;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : valorPorDefecto;
}

export const CUARTEL = {
  nombre: "Bomberos Voluntarios La Trinidad",
  nombreCorto: "La Trinidad",
  localidad: "La Trinidad",
  provincia: "Tucumán",
  numero: 1,
  escudo: "/brand/cuartel-escudo.png",
  lat: numeroEnv("CUARTEL_LAT", -26.7906),
  lng: numeroEnv("CUARTEL_LNG", -65.2156),
  zonaHoraria: "America/Argentina/Tucuman",
} as const;

export function ubicacionCuartel(cuartel: Pick<typeof CUARTEL, "localidad" | "provincia"> = CUARTEL): string {
  return `${cuartel.localidad} · ${cuartel.provincia}`;
}
