import type { Metadata } from "next";
import Image from "next/image";
import { EscudoCuartel } from "@/components/marca";
import { CUARTEL } from "@/lib/cuartel.config";
import { LOGOS, PRODUCTO } from "@/lib/marca";
import { HelpSheet } from "./help-sheet";
import { LoginBackground } from "./login-background";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: `Acceso | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

const TITULO_MARCA_ESCRITORIO = "Todo el cuartel,\nen un solo lugar.";

export default function LoginPage() {
  return (
    <main
      data-login
      className={`${styles.pantalla} relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-6 text-label`}
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
      }}
    >
      <LoginBackground className="lg:hidden" />

      <LoginForm>
        <span
          aria-hidden
          className={`${styles.panelIzquierdo} pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 lg:block`}
        />
        <span
          aria-hidden
          className={`${styles.panelDerecho} pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block`}
        />

        <HelpSheet />

        <div className={`${styles.marca} flex flex-col items-center text-center`}>
          <span
            className={`${styles.logoEntrada} ${styles.logoRecuadro} ${styles.logoEscritorio} relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28%] bg-surface`}
          >
            <Image
              src={LOGOS.principal}
              alt="Logo de SIGOV"
              width={96}
              height={96}
              priority
              className={`${styles.logoImagen} h-full w-full object-cover`}
            />
          </span>

          <h2 className={`hidden ${styles.tituloMarca} lg:block`}>
            {TITULO_MARCA_ESCRITORIO}
          </h2>

          <p
            className={`${styles.subtituloMarca} mt-3 max-w-[270px] text-[12.5px] leading-snug text-label-2`}
          >
            {PRODUCTO.nombreCompleto}
          </p>

          <div
            className={`${styles.chipMarca} mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-separator/60 glass px-3`}
          >
            <EscudoCuartel nombre={CUARTEL.nombre} size={20} />
            <span className={`${styles.chipTexto} text-[13px] font-semibold text-label`}>
              {CUARTEL.nombre}
            </span>
          </div>
        </div>

        <div className={`${styles.etiquetas} mt-8 w-full text-center`}>
          <h1 className="text-[20px] font-bold leading-tight text-label">Número de legajo</h1>
          <p className="mt-1 text-[15px] text-label-2">Son los tres números que usás para entrar</p>
        </div>
      </LoginForm>
    </main>
  );
}
