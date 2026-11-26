import type { Metadata } from "next";
import { createSupabaseClient } from "@/lib/supabase";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import { EscudoCuartel, IsotipoSigov } from "@/components/marca";
import { LoginForm } from "./login-form";
import type { RosterBombero } from "./roster-list";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: `Acceso | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let bomberos: RosterBombero[] = [];

  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("bomberos")
      .select("numero_ingreso, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo", { ascending: true });
    bomberos = (data ?? []).filter(
      (bombero): bombero is RosterBombero =>
        typeof bombero.numero_ingreso === "number" &&
        typeof bombero.nombre_completo === "string"
    );
  } catch (err) {
    console.error("No se pudo cargar el padrón:", err);
  }

  return (
    <main
      data-login=""
      className={`${styles.pantalla} flex min-h-dvh items-center justify-center bg-bg px-6 py-10`}
    >
      <div className="w-full max-w-[400px] text-center">
        <div className="flex flex-col items-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-[16px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            <IsotipoSigov size={72} priority />
          </span>
          <h1 className="mt-4 text-[34px] font-bold leading-none tracking-[-0.4px] text-label">
            {PRODUCTO.nombre}
          </h1>
          <p className="mt-2 text-[15px] leading-snug text-label-2">
            {PRODUCTO.nombreCompleto}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2">
            <EscudoCuartel nombre={CUARTEL.nombre} size={22} />
            <span className="text-[13px] font-medium text-label">{CUARTEL.nombre}</span>
          </div>
        </div>

        <div className="mt-9 text-left">
          <h2 className="text-[22px] font-bold leading-tight text-label">Ingreso de personal</h2>
          <p className="mt-1 text-[15px] text-label-2">Ingresá tu número de legajo</p>
          <LoginForm bomberos={bomberos} />
        </div>
      </div>
    </main>
  );
}
