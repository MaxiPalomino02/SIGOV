import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Oswald, Source_Sans_3 } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { BotonInstalarApp } from "@/components/boton-instalar-app";
import { Sincronizador } from "@/components/sincronizador";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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

export const viewport: Viewport = {
  themeColor: "#f2f5f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${oswald.variable} ${sourceSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <SerwistProvider swUrl="/serwist/sw.js">
          <Sincronizador />
          {children}
          <BotonInstalarApp />
        </SerwistProvider>
      </body>
    </html>
  );
}
