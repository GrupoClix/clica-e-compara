// Registra o service worker (abre sem internet e permite instalar na tela inicial).
// Este arquivo NÃO entra na versão do artefato do Claude (service workers não rodam lá).
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  // Se já havia uma versão instalada e chegou uma nova, recarrega uma vez para usá-la.
  var haviaControle = !!navigator.serviceWorker.controller;
  var recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (haviaControle && !recarregou) { recarregou = true; window.location.reload(); }
  });
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  });
}
