import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { BotonInstalarApp } from "@/components/boton-instalar-app";
import { Sincronizador } from "@/components/sincronizador";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: PRODUCTO.nombre,
  title: `${PRODUCTO.nombre} | ${CUARTEL.nombre}`,
  description: `${PRODUCTO.nombre} es la plataforma de gestión operativa para cuarteles de bomberos voluntarios. Instalación: ${CUARTEL.nombre}, ${CUARTEL.localidad}, ${CUARTEL.provincia}.`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: PRODUCTO.nombre,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-label">
        <SerwistProvider swUrl="/serwist/sw.js">
          <Sincronizador />
          {children}
          <BotonInstalarApp />
        </SerwistProvider>
      </body>
    </html>
  );
}
