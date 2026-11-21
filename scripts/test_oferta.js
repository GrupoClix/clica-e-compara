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
  const classe = { preco: "price", qtd: "qty", seg: "seg2" };
  // Preenche campos de uma oferta. Abre os blocos e escolhe o tipo de promoção quando precisa.
  const set = async (i, campos) => {
    const c = p.locator(".pkg").nth(i);
    for (const [k, v] of Object.entries(campos)) {
      if (k === "unidade") { await c.locator(`input[value="${v}"]`).check({ force: true }); continue; }
      if (["leve", "pague", "seg", "desc", "cash"].includes(k)) {
        await c.locator(".promo").evaluate((d) => { d.open = true; });
        if (k === "leve" || k === "pague") await c.locator(".promo-tipo").selectOption("lp");
        if (k === "seg") await c.locator(".promo-tipo").selectOption("seg");
      }
      if (k === "usos") await c.locator(".rende").evaluate((d) => { d.open = true; });
      await c.locator("." + (classe[k] || k)).fill(v);
    }
    await p.locator("#produto").focus();
  };
  const limpaPromo = async (i) => {
    const c = p.locator(".pkg").nth(i);
    // limpa pelo DOM (os campos do tipo de promoção não escolhido ficam escondidos)
    for (const k of ["leve", "pague", "seg2", "desc", "cash"]) await c.locator("." + k).evaluate((i) => { i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await c.locator(".promo-tipo").selectOption("");
    await p.locator("#produto").focus();
  };

  ok((await txt()).includes("pelo menos duas ofertas"), "estado vazio");
  ok(!(await p.locator("#copiar").isVisible()), "sem botão de copiar quando vazio");
  ok((await p.locator("#copia").innerText()) === "Copia a oferta", "botão 'Copia a oferta'");
  await p.click("#exemplo");
  let t = await txt();
  ok(t.includes("Melhor compra") && t.includes("Becker, 5 L"), "exemplo: melhor = Becker 5 L");
  ok(/R\$ 5,98/.test(t) && /R\$ 6,63/.test(t), "5,98 e 6,63 por litro");
  ok(t.includes("R$ 0,653 a menos por litro que a mais cara"), "economia 0,653 (3 casas abaixo de R$ 1)");
  ok(t.includes("11% mais caro"), "OMO 11% mais caro");
  ok(t.includes("Pão de Açúcar") && t.includes("Mercado do bairro"), "lojas aparecem");
  ok(!t.includes("Flagra"), "sem flagra quando a maior é a melhor");

  // leve 3, pague 2 na OMO: 19,90*2/3 = 13,27 -> 4,42/L
  await set(0, { leve: "3", pague: "2" });
  t = await txt();
  ok(t.includes("OMO, 3 L") && /R\$ 4,42/.test(t), "leve 3 pague 2 -> R$ 4,42/L");
  ok(t.includes("Leve 3, pague 2: cada uma sai R$ 13,27."), "texto da promoção");
  ok(t.includes("Flagra: a embalagem maior sai mais cara por litro."), "flagra com promoção");
  ok(t.indexOf("Melhor compra") < t.indexOf("OMO, 3 L") && t.indexOf("OMO, 3 L") < t.indexOf("Becker"), "OMO é a melhor");
  // promoção inválida é ignorada
  await set(0, { leve: "2", pague: "3" });
  ok((await p.locator(".promo-msg").first().innerText()).includes("leve precisa ser maior que pague"), "aviso de promoção inválida");
  t = await txt(); ok(/R\$ 6,63/.test(t), "promoção inválida é ignorada");
  await limpaPromo(0);

  // desconto na 2ª unidade 40%: média = 1 - 0,40/2 = 0,8 -> 15,92 -> R$ 5,31/L
  await set(0, { seg: "40" });
  t = await txt();
  ok(/R\$ 5,31/.test(t) && t.includes("40% na 2ª unidade, comprando 2"), "2ª unidade com 40% -> R$ 5,31/L");
  await limpaPromo(0);

  // desconto extra 10% no Becker: 26,91 -> R$ 5,38/L
  await set(1, { desc: "10" });
  t = await txt(); ok(/R\$ 5,38/.test(t) && t.includes("10% de desconto extra"), "desconto extra 10% -> R$ 5,38/L");
  await limpaPromo(1);

  // cashback R$ 3 na OMO: 16,90 / 3 = R$ 5,63/L
  await set(0, { cash: "3" });
  t = await txt(); ok(/R\$ 5,63/.test(t) && t.includes("R$ 3,00 de cashback"), "cashback R$ 3 -> R$ 5,63/L");
  await set(0, { cash: "25" });
  ok((await p.locator(".promo-msg").first().innerText()).includes("cashback precisa ser maior que zero e menor que o preço"), "cashback maior que o preço é recusado");
  t = await txt(); ok(/R\$ 6,63/.test(t), "cashback inválido é ignorado");
  await limpaPromo(0);

  // preço por uso: OMO rende 60 lavagens, Becker 50
  t = await txt();
  ok(t.includes("Becker, 5 L") && t.indexOf("Melhor compra") < t.indexOf("Becker, 5 L"), "por litro: Becker é a melhor");
  await set(0, { usos: "60" });
  t = await txt(); ok(t.includes("Põe os usos de todas as ofertas pra comparar por lavagem."), "pede os usos das outras ofertas");
  await set(1, { usos: "50" });
  t = await txt();
  ok(t.indexOf("Melhor compra") < t.indexOf("OMO, 3 L") && t.indexOf("OMO, 3 L") < t.indexOf("Becker, 5 L"), "por lavagem: OMO vira a melhor");
  ok(/R\$ 0,332\s*\/lavagem/.test(t) && /R\$ 0,598\s*\/lavagem/.test(t), "R$ 0,332 e R$ 0,598 por lavagem");
  ok(t.includes("80% mais caro"), "Becker 80% mais caro por lavagem");
  ok(t.includes("R$ 0,266 a menos por lavagem que a mais cara"), "economia por lavagem");
  ok(t.includes("R$ 6,63 por L."), "detalhe mostra o preço por litro também");
  // usos + promoção juntos: OMO leve 3 pague 2 -> 13,27/60
  await set(0, { leve: "3", pague: "2" });
  t = await txt(); ok(/R\$ 0,221\s*\/lavagem/.test(t), "usos + leve 3 pague 2 -> R$ 0,221/lavagem");
  await limpaPromo(0);

  // copia a oferta (por lavagem)
  await p.click("#copia");
  await p.waitForTimeout(150);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  const texto = clip || await p.inputValue("#copiaTexto");
  ok(texto.startsWith("Clica e Compara: Sabão líquido"), "texto copiado começa com produto");
  ok(texto.includes("Melhor compra: OMO, 3 L (Pão de Açúcar), a R$ 0,332/lavagem"), "texto traz melhor compra por lavagem com loja");
  ok(texto.includes("Becker, 5 L (Mercado do bairro): R$ 0,598/lavagem, 80% mais caro"), "texto traz a outra oferta");
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(texto), "sem emoji no texto");
  ok((await p.locator("#aviso").innerText()).startsWith("Copiou") || await p.locator("#copiaTexto").isVisible(), "aviso ou plano B");

  // sem marca: Oferta A / B
  await p.click("#limpa");
  await set(0, { preco: "10", qtd: "1", unidade: "kg" }); await set(1, { preco: "6", qtd: "500", unidade: "g" });
  t = await txt(); ok(t.includes("Oferta A, 1 kg") && t.includes("Oferta B, 500 g"), "sem marca usa Oferta A/B");

  // tipos misturados
  await set(1, { preco: "6", qtd: "1", unidade: "L" });
  t = await txt(); ok(t.includes("Peso, volume e unidade não se misturam"), "tipos misturados");

  for (let i = 0; i < 8; i++) if (await p.locator("#add").isVisible()) await p.click("#add");
  ok((await p.locator(".pkg").count()) === 8, "máximo de 8");
  while ((await p.locator(".del").count()) > 0) await p.locator(".del").last().click();
  ok((await p.locator(".pkg").count()) === 2, "remove até 2");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sem rolagem horizontal em 360px");

  // captura de tela com tudo aberto
  await p.click("#exemplo");
  await set(0, { leve: "3", pague: "2", cash: "2", usos: "60" });
  await set(1, { usos: "50" });
  await p.screenshot({ path: "/tmp/oferta-shot.png", fullPage: true });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sem rolagem horizontal com os blocos abertos");
  ok(erros.length === 0, "sem erros no console " + erros.join(" | "));
  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
  process.exit(falhas ? 1 : 0);
})();
