export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const resultado = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let indice = 0; indice < rawData.length; indice += 1) {
    resultado[indice] = rawData.charCodeAt(indice);
  }
  return resultado;
}

export function soportePush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let registroPush: Promise<ServiceWorkerRegistration> | null = null;

export function registrarServiceWorkerPush(): Promise<ServiceWorkerRegistration> {
  if (!soportePush()) {
    return Promise.reject(new Error("Este navegador no admite notificaciones push."));
  }

  if (!registroPush) {
    registroPush = (async () => {
      const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (registro.active) return registro;

      const trabajador = registro.installing ?? registro.waiting;
      if (!trabajador) throw new Error("No pudimos iniciar el service worker push.");

      await new Promise<void>((resolve, reject) => {
        trabajador.addEventListener("statechange", () => {
          if (trabajador.state === "activated") resolve();
          if (trabajador.state === "redundant") {
            reject(new Error("No pudimos iniciar el service worker push."));
          }
        });
      });

      return registro;
    })().catch((error: unknown) => {
      registroPush = null;
      throw error;
    });
  }

  return registroPush;
}
