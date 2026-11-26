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
  axes: ["opsz"],
});

const esProduccion = process.env.NODE_ENV === "production";

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
  const contenido = (
    <>
      <Sincronizador />
      {children}
      <BotonInstalarApp />
    </>
  );

  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <head>
        {!esProduccion ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function (registraciones) {
                    if (registraciones.length === 0) return;
                    Promise.all(
                      registraciones.map(function (registracion) {
                        return registracion.unregister();
                      })
                    ).then(function () {
                      location.reload();
                    });
                  });
                }
              `,
            }}
          />
        ) : null}
      </head>
      <body className="min-h-full flex flex-col bg-bg text-label">
        {esProduccion ? (
          <SerwistProvider swUrl="/serwist/sw.js">{contenido}</SerwistProvider>
        ) : (
          contenido
        )}
      </body>
    </html>
  );
}
