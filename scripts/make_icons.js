// Gera os ícones do app (azul cobalto com o símbolo branco). Uso: node scripts/make_icons.js
const { chromium } = require("playwright");
const path = require("path");
const sym = (pct) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="190 190 680 550" style="width:${pct}%;color:#fff"><g fill="none" stroke="currentColor" stroke-width="70" stroke-linecap="round"><path d="M230 560 L400 700"/><path d="M400 700 Q650 560 830 230"/></g></svg>`;
const page = (size, pct) => `<body style="margin:0;width:${size}px;height:${size}px;background:#143A8C;display:grid;place-items:center">${sym(pct)}</body>`;
(async () => {
  const b = await chromium.launch();
  const jobs = [["icon-192.png",192,58],["icon-512.png",512,58],["icon-maskable-512.png",512,42],["apple-touch-icon.png",180,58]];
  for (const [nome, size, pct] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(page(size, pct));
    await p.screenshot({ path: path.join(__dirname, "..", "icons", nome) });
    await p.close();
  }
  await b.close();
})();
