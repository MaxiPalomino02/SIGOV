const CACHE = "sigov-offline-v1";

const RUTAS_PRECACHEADAS = [
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

const RUTAS_EXCLUIDAS = [
  "/api",
  "/_next",
  "/login",
  "/auth",
  "/signin",
  "/signout",
  "/callback",
  "/serwist",
];

function esRutaExcluida(pathname) {
  return RUTAS_EXCLUIDAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        RUTAS_PRECACHEADAS.map(async (ruta) => {
          try {
            const respuesta = await fetch(ruta, { cache: "reload" });
            if (!respuesta.ok || respuesta.redirected) return;
            await cache.put(ruta, respuesta.clone());
          } catch {
            return;
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE)
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const { pathname } = url;
  if (esRutaExcluida(pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request, { redirect: "follow" });
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          throw error;
        }
      })()
    );
    return;
  }

  if (RUTAS_PRECACHEADAS.includes(pathname)) {
    event.respondWith(
      (async () => {
        const cacheada = await caches.match(request);
        if (cacheada) return cacheada;
        const respuesta = await fetch(request);
        if (respuesta.ok && !respuesta.redirected) {
          const cache = await caches.open(CACHE);
          await cache.put(request, respuesta.clone());
        }
        return respuesta;
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  let datos = {};

  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = {
      titulo: event.data ? event.data.text() : "",
      cuerpo: "",
    };
  }

  const mensaje = datos && typeof datos === "object" ? datos : {};
  const titulo =
    typeof mensaje.titulo === "string" && mensaje.titulo.trim()
      ? mensaje.titulo
      : typeof mensaje.title === "string" && mensaje.title.trim()
        ? mensaje.title
        : "SIGOV";
  const cuerpo = typeof mensaje.cuerpo === "string"
    ? mensaje.cuerpo
    : typeof mensaje.body === "string"
      ? mensaje.body
      : "";
  const url =
    typeof mensaje.url === "string" && mensaje.url.startsWith("/") && !mensaje.url.startsWith("//")
      ? mensaje.url
      : "/avisos";

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const datos = event.notification.data;
  const url =
    datos && typeof datos.url === "string" && datos.url.startsWith("/") && !datos.url.startsWith("//")
      ? datos.url
      : "/avisos";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (ventanas) => {
        for (const ventana of ventanas) {
          const destino = new URL(ventana.url);
          if (destino.origin === self.location.origin && destino.pathname === url) {
            await ventana.focus();
            return;
          }
        }
        await self.clients.openWindow(url);
      })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
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
          endpointAnterior: event.oldSubscription?.endpoint ?? null,
        }),
      });
    })()
  );
});
