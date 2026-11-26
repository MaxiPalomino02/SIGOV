/// <reference lib="esnext" />
/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { PRODUCTO } from "../lib/marca";
import type { PayloadPush } from "../lib/push-tipos";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const RUTAS_CACHEADAS = ["/inicio", "/guardias", "/tareas", "/avisos"];

function esRutaCacheada(pathname: string): boolean {
  return RUTAS_CACHEADAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

const expiracion24h = () =>
  new ExpirationPlugin({
    maxEntries: 24,
    maxAgeSeconds: 24 * 60 * 60,
    maxAgeFrom: "last-used",
  });

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: "sigov-fuentes-web",
        plugins: [expiracion24h()],
      }),
    },
    {
      matcher: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: "sigov-fuentes-estilos",
        plugins: [expiracion24h()],
      }),
    },
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "sigov-estaticos",
        plugins: [expiracion24h()],
      }),
    },
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        (pathname.startsWith("/icons/") || pathname.startsWith("/brand/")),
      handler: new CacheFirst({
        cacheName: "sigov-imagenes",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 48,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("RSC") === "1" &&
        sameOrigin &&
        esRutaCacheada(pathname),
      handler: new NetworkFirst({
        cacheName: "sigov-datos",
        plugins: [expiracion24h()],
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.destination === "document" &&
        sameOrigin &&
        esRutaCacheada(pathname),
      handler: new NetworkFirst({
        cacheName: "sigov-paginas",
        plugins: [expiracion24h()],
      }),
    },
    {
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkFirst({
        cacheName: "sigov-externos",
        plugins: [expiracion24h()],
        networkTimeoutSeconds: 10,
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let datos: PayloadPush;
  try {
    datos = event.data.json() as PayloadPush;
  } catch {
    return;
  }

  const opciones: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: datos.cuerpo,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: datos.tag,
    lang: "es",
    data: {
      url:
        datos.url === "/alarma" || datos.url === "/notificaciones"
          ? datos.url
          : "/avisos",
    },
    requireInteraction: Boolean(datos.requiereInteraccion),
    vibrate: datos.vibracion,
    renotify: datos.tipo === "alarma",
  };

  event.waitUntil(
    self.registration.showNotification(datos.titulo || PRODUCTO.nombre, opciones)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const datos = event.notification.data as { url?: unknown } | null;
  const destino =
    datos?.url === "/alarma" || datos?.url === "/notificaciones"
      ? datos.url
      : "/avisos";

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const ventana of ventanas) {
        const url = new URL(ventana.url);
        if (url.origin === self.location.origin && url.pathname === destino) {
          await ventana.focus();
          return;
        }
      }
      await self.clients.openWindow(destino);
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  const cambio = event as PushSubscriptionChangeEvent;

  event.waitUntil(
    (async () => {
      const suscripcion = await self.registration.pushManager.getSubscription();
      if (!suscripcion) return;

      const datos = suscripcion.toJSON();
      if (!datos.endpoint || !datos.keys?.p256dh || !datos.keys?.auth) return;

      await fetch("/api/push/renovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          endpoint: datos.endpoint,
          p256dh: datos.keys.p256dh,
          auth: datos.keys.auth,
          endpointAnterior: cambio.oldSubscription?.endpoint ?? null,
        }),
      });
    })()
  );
});

serwist.addEventListeners();
