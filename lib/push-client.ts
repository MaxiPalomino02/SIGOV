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
