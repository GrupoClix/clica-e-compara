// Service worker do Clica e Compara.
// Guarda os arquivos do app no aparelho para abrir sem internet.
// IMPORTANTE: sempre que alterar index.html, style.css ou app.js,
// aumente o número da versão abaixo (v1 -> v2 -> v3...) para as pessoas receberem a atualização.
const VERSION = "clica-e-compara-v1";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Fontes e outros domínios seguem direto para a rede.
  if (url.origin !== self.location.origin) return;

  // Abre do cache na hora e atualiza em segundo plano.
  event.respondWith(
    caches.match(req).then((emCache) => {
      const daRede = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copia));
          }
          return resp;
        })
        .catch(() => emCache || caches.match("./index.html"));
      return emCache || daRede;
    })
  );
});
