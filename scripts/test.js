// Teste automático (Playwright). Uso: node scripts/test.js [arquivo.html]
const { chromium, devices } = require("playwright");
const path = require("path");
const alvo = path.resolve(process.argv[2] || "index.html");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|net::/.test(m.text())) erros.push(m.text()); });
  await p.goto("file://" + alvo);
  const txt = () => p.locator("#resultado").innerText();

  ok((await txt()).includes("Preenche o preço"), "estado vazio");
  await p.click("#exemplo");
  let t = await txt();
  ok(t.includes("Melhor compra") && t.includes("B, 200 g"), "exemplo: melhor = B, 200 g");
  ok(/R\$ 35,00/.test(t) && /R\$ 45,20/.test(t), "35,00 e 45,20 por kg");
  ok(t.includes("R$ 10,20 a menos por kg que a mais cara"), "economia 10,20");
  ok(t.includes("29% mais caro"), "29% mais caro");
  ok(t.includes("Flagra: a embalagem maior sai mais cara por kg."), "flagra");
  ok(t.includes("200 g por R$ 7,00. R$ 3,50 por 100 g."), "detalhe por 100 g");
  ok((await p.inputValue("#produto")) === "Leite em pó Camponesa", "produto do exemplo");

  // máscara de preço
  const preco = p.locator(".price").first();
  const digita = async (s) => { await preco.focus(); await p.keyboard.press("Control+A"); await p.keyboard.type(s, { delay: 10 }); };
  for (const [entrada, esperado] of [["4","4,00"],["40","40,00"],["04","0,40"],["33,9","33,90"],["12,99","12,99"],["33.9","33,90"],["1234,5","1.234,50"],["0",""]]) {
    await digita(entrada); await p.locator("#produto").focus();
    ok((await preco.inputValue()) === esperado, `preço ${entrada} -> "${esperado}" (veio "${await preco.inputValue()}")`);
  }
  await digita("33,90"); await p.locator("#produto").focus();
  await preco.focus();
  ok(await preco.evaluate((i) => i.selectionStart === 0 && i.selectionEnd === i.value.length), "foco seleciona tudo");
  await digita("12345678"); ok((await preco.inputValue()).replace(",","").length <= 7, "limite de 6 dígitos inteiros");
  await digita("33,90");

  // empate
  await p.click("#limpa");
  const set = async (i, pr, q, u) => {
    const c = p.locator(".pkg").nth(i);
    await c.locator(".price").fill(pr); await c.locator(".qty").fill(q);
    if (u) await c.locator(`input[value="${u}"]`).check({ force: true });
    await p.locator("#produto").focus();
  };
  await set(0, "10,00", "1", "kg"); await set(1, "5,00", "500", "g");
  t = await txt(); ok(t.includes("Empate"), "empate (10/kg x 5/500g)");
  // tipos misturados
  await set(0, "10,00", "1", "kg"); await set(1, "5,00", "1", "L");
  t = await txt(); ok(t.includes("Peso, volume e unidade não se misturam"), "tipos misturados");
  ok(t.includes("Põe outra embalagem"), "uma só por tipo");
  // vários itens: fardo 6 x 350 ml R$ 12,60 = 6,00/L ; avulsa 1 L R$ 7,50
  await set(0, "12,60", "350", "ml"); await p.locator(".pkg").nth(0).locator("summary").click();
  await p.locator(".pkg").nth(0).locator(".items").fill("6");
  await set(1, "7,50", "1", "L");
  t = await txt(); ok(t.includes("A, 350 ml x 6") && t.includes("R$ 6,00"), "fardo 6 x 350 ml = R$ 6,00/L");
  // adicionar e remover
  for (let i = 0; i < 8; i++) if (await p.locator("#add").isVisible()) await p.click("#add");
  ok((await p.locator(".pkg").count()) === 8 && !(await p.locator("#add").isVisible()), "máximo de 8 embalagens");
  while ((await p.locator(".del").count()) > 0) await p.locator(".del").last().click();
  ok((await p.locator(".pkg").count()) === 2, "remove até 2");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sem rolagem horizontal em 360px");

  // histórico
  await p.click("#exemplo"); await p.fill("#estab", "Atacadão Boa Vista");
  await p.click("#salva");
  ok((await p.locator("#aviso").innerText()) === "Salvou no histórico.", "salvou");
  ok((await p.locator("#histLista").innerText()).includes("Atacadão Boa Vista"), "histórico mostra estabelecimento");
  await p.click('[data-acao="edita"]');
  ok(await p.locator("#salvaNova").isVisible() && (await p.locator("#salva").innerText()) === "Atualiza consulta", "modo edição");
  await p.locator(".pkg").nth(1).locator(".price").fill("7,50"); await p.locator("#produto").focus();
  await p.click("#salva");
  ok((await p.locator("#histLista").innerText()).includes("Alterado: embalagem B, preço R$ 7,00 para R$ 7,50"), "linha de alteração");
  await p.click("#salvaNova");
  ok((await p.locator(".hentry").count()) === 2, "salva como nova");
  await p.reload();
  ok((await p.locator(".hentry").count()) === 2, "histórico sobrevive ao recarregar");
  await p.click("#histApaga");
  ok((await p.locator("#histApaga").innerText()).startsWith("Toca de novo"), "confirma no segundo toque");
  await p.click("#histApaga");
  ok((await p.locator(".hentry").count()) === 0, "apagou tudo");

  // animação de troca: muda a melhor compra
  await p.click("#exemplo");
  await p.locator(".pkg").nth(1).locator(".price").fill("20,00"); await p.locator("#produto").focus();
  ok(await p.locator(".best.swap").count() === 1, "animação ao trocar a melhor compra");

  await p.click("#exemplo");
  await p.screenshot({ path: path.join(__dirname, "..", "dist", "shot-mobile.png"), fullPage: true });
  ok(erros.length === 0, "sem erros no console " + erros.join(" | "));
  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
  process.exit(falhas ? 1 : 0);
})();
