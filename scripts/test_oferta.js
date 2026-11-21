// Teste automático da variante Ofertas. Uso: node scripts/test_oferta.js [arquivo.html]
const { chromium } = require("playwright");
const path = require("path");
const alvo = path.resolve(process.argv[2] || "variantes/oferta/index.html");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ["clipboard-read", "clipboard-write"] });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|net::/.test(m.text())) erros.push(m.text()); });
  await p.goto("file://" + alvo);
  const txt = () => p.locator("#resultado").innerText();
  const set = async (i, campos) => {
    const c = p.locator(".pkg").nth(i);
    for (const [k, v] of Object.entries(campos)) {
      if (k === "unidade") await c.locator(`input[value="${v}"]`).check({ force: true });
      else { if (["leve","pague","desc"].includes(k)) await c.locator(".promo").evaluate((d) => { d.open = true; }); await c.locator("." + ({ preco: "price", qtd: "qty" }[k] || k)).fill(v); }
    }
    await p.locator("#produto").focus();
  };

  ok((await txt()).includes("pelo menos duas ofertas"), "estado vazio");
  ok(!(await p.locator("#copiar").isVisible()), "sem botão de copiar quando vazio");
  await p.click("#exemplo");
  let t = await txt();
  ok(t.includes("Melhor compra") && t.includes("Becker, 5 L"), "exemplo: melhor = Becker 5 L");
  ok(/R\$ 5,98/.test(t) && /R\$ 6,63/.test(t), "5,98 e 6,63 por litro");
  ok(t.includes("R$ 0,653 a menos por litro que a mais cara"), "economia 0,653 (3 casas abaixo de R$ 1)");
  ok(t.includes("11% mais caro"), "OMO 11% mais caro");
  ok(t.includes("Pão de Açúcar") && t.includes("Mercado do bairro"), "lojas aparecem");
  ok(!t.includes("Flagra"), "sem flagra quando a maior é a melhor");

  // promoção leve 3, pague 2 na OMO: 19,90*2/3 = 13,27 -> 4,42/L (OMO vira a melhor) e dá flagra
  await set(0, { leve: "3", pague: "2" });
  t = await txt();
  ok(t.includes("OMO, 3 L") && /R\$ 4,42/.test(t), "leve 3 pague 2 -> R$ 4,42/L");
  ok(t.includes("Leve 3, pague 2: cada uma sai R$ 13,27."), "texto da promoção");
  ok(t.includes("Flagra: a embalagem maior sai mais cara por litro."), "flagra com promoção");
  ok(t.indexOf("Melhor compra") < t.indexOf("OMO, 3 L") && t.indexOf("OMO, 3 L") < t.indexOf("Becker"), "OMO é a melhor");
  // promoção inválida
  await set(0, { leve: "2", pague: "3" });
  ok((await p.locator(".promo-msg").first().innerText()).includes("leve precisa ser maior que pague"), "aviso de promoção inválida");
  t = await txt(); ok(/R\$ 6,63/.test(t), "promoção inválida é ignorada");
  await set(0, { leve: "", pague: "" });
  // desconto extra 10% no Becker: 29,90*0,9 = 26,91 -> 5,382 -> R$ 5,38/L
  await set(1, { desc: "10" });
  t = await txt(); ok(/R\$ 5,38/.test(t) && t.includes("10% de desconto"), "desconto extra 10% -> R$ 5,38/L");
  await set(1, { desc: "" });

  // copia pro grupo
  await p.click("#exemplo");
  await p.click("#copia");
  await p.waitForTimeout(150);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  const texto = clip || await p.inputValue("#copiaTexto");
  ok(texto.startsWith("Clica e Compara: Sabão líquido"), "texto copiado começa com produto");
  ok(texto.includes("Melhor compra: Becker, 5 L (Mercado do bairro), a R$ 5,98/L"), "texto traz melhor compra com loja");
  ok(texto.includes("OMO, 3 L (Pão de Açúcar): R$ 6,63/L, 11% mais caro"), "texto traz a outra oferta");
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(texto), "sem emoji no texto");
  ok((await p.locator("#aviso").innerText()).startsWith("Copiou") || await p.locator("#copiaTexto").isVisible(), "aviso ou plano B");

  // sem marca: usa Oferta A
  await p.click("#limpa");
  await set(0, { preco: "10", qtd: "1", unidade: "kg" }); await set(1, { preco: "6", qtd: "500", unidade: "g" });
  t = await txt(); ok(t.includes("Oferta A, 1 kg") && t.includes("Oferta B, 500 g"), "sem marca usa Oferta A/B");

  // 8 ofertas e remover
  for (let i = 0; i < 8; i++) if (await p.locator("#add").isVisible()) await p.click("#add");
  ok((await p.locator(".pkg").count()) === 8, "máximo de 8");
  while ((await p.locator(".del").count()) > 0) await p.locator(".del").last().click();
  ok((await p.locator(".pkg").count()) === 2, "remove até 2");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sem rolagem horizontal em 360px");

  await p.click("#exemplo");
  await p.locator(".pkg").first().locator(".promo summary").click();
  await p.locator(".pkg").first().locator(".leve").fill("3");
  await p.locator(".pkg").first().locator(".pague").fill("2");
  await p.screenshot({ path: "/tmp/oferta-shot.png", fullPage: true });
  ok(erros.length === 0, "sem erros no console " + erros.join(" | "));
  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
  process.exit(falhas ? 1 : 0);
})();
