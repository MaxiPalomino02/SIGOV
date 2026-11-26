self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let datos = {};

  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = {
      title: event.data ? event.data.text() : "",
      body: "",
    };
  }

  const mensaje = datos && typeof datos === "object" ? datos : {};
  const titulo = typeof mensaje.title === "string" && mensaje.title.trim()
    ? mensaje.title
    : typeof mensaje.titulo === "string" && mensaje.titulo.trim()
      ? mensaje.titulo
      : "SIGOV";
  const cuerpo = typeof mensaje.body === "string"
    ? mensaje.body
    : typeof mensaje.cuerpo === "string"
      ? mensaje.cuerpo
      : "";
  const url =
    typeof mensaje.url === "string" && mensaje.url.startsWith("/") && !mensaje.url.startsWith("//")
      ? mensaje.url
      : "/";

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
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
      : "/";

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
