/* Clica e Compara Ofertas — variante para comparar ofertas de marcas e lojas diferentes.
   Protótipo: sem banco de dados, sem histórico, sem envio de nada.
   Novidades em relação ao app principal:
   - marca e loja por oferta;
   - promoções: "leve X, pague Y", desconto na 2ª unidade, desconto extra (cartão) e cashback;
   - preço por uso (ex.: por lavagem), quando todas as ofertas dizem quantos usos rendem;
   - botão "Copia a oferta" com um texto curto pro WhatsApp. */
(function () {
  "use strict";

  const LETRAS = "ABCDEFGH";
  const MAX = 8, MIN = 2;

  const UNIDADES = {
    g:  { tipo: "massa",  f: 0.001, rotulo: "g" },
    kg: { tipo: "massa",  f: 1,     rotulo: "kg" },
    ml: { tipo: "volume", f: 0.001, rotulo: "ml" },
    L:  { tipo: "volume", f: 1,     rotulo: "L" },
    un: { tipo: "un",     f: 1,     rotulo: "unid." }
  };
  const TIPOS = {
    massa:  { titulo: "Peso",    por: "kg",      abrev: "kg",    cem: 10, rotuloCem: "100 g" },
    volume: { titulo: "Volume",  por: "litro",   abrev: "L",     cem: 10, rotuloCem: "100 ml" },
    un:     { titulo: "Unidade", por: "unidade", abrev: "unid.", cem: 0,  rotuloCem: "" }
  };

  /* ---------- Formatação (padrão brasileiro) ---------- */
  const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brl3 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
  // Abaixo de R$ 1,00 mostra 3 casas decimais
  const dinheiro = (v) => (v < 1 ? brl3 : brl2).format(v).replace(/ /g, " ");
  const fmtNum = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  function num(s) {
    s = String(s == null ? "" : s).trim().replace(/\s/g, "");
    if (!s) return NaN;
    if (s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    return parseFloat(s);
  }

  const $ = (sel) => document.querySelector(sel);
  function el(tag, cls, texto) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto != null) n.textContent = texto;
    return n;
  }
  const simbolo = (w, h) => '<svg width="' + w + '" height="' + h + '" aria-hidden="true"><use href="#cc-check"/></svg>';
  const limpaTexto = (s) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  // Nome do "uso" (lavagem, folha, fralda...). Sem nome, vira "uso".
  const nomeUso = () => limpaTexto($("#uso").value).slice(0, 20).toLowerCase() || "uso";

  /* ---------- Estado ---------- */
  let proxId = 1;
  let pkgs = [];
  let ultimo = [];                   // grupos do último resultado (usado pelo "Copia a oferta")
  const ultimoMelhor = {};

  const novaPkg = (o) => Object.assign({
    id: proxId++, nome: "", loja: "", preco: "", qtd: "", unidade: "g", itens: "", usos: "",
    promo: "",               // "", "lp" (leve/pague) ou "seg" (desconto na 2ª unidade)
    leve: "", pague: "", seg: "", desc: "", cash: ""
  }, o || {});

  /* ---------- Campo de preço (mesma máscara do app principal) ---------- */
  function limpaPreco(bruto) {
    const s = String(bruto).replace(/\./g, ",").replace(/[^\d,]/g, "");
    const i = s.indexOf(",");
    let inteiro = s, dec = null;
    if (i !== -1) {
      inteiro = s.slice(0, i);
      dec = s.slice(i + 1).replace(/,/g, "").slice(0, 2);
    }
    if (dec === null && /^0\d/.test(inteiro)) {
      dec = inteiro.slice(1, 3);
      inteiro = "0";
    } else {
      inteiro = inteiro.replace(/^0+(?=\d)/, "");
    }
    inteiro = inteiro.slice(0, 6);
    return dec === null ? inteiro : (inteiro || "0") + "," + dec;
  }
  const fmtPreco = (v) => (v > 0 ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  function fantasma(v) {
    if (!v) return "";
    const i = v.indexOf(",");
    if (i === -1) return ",00";
    return ["00", "0", ""][v.length - i - 1] || "";
  }
  function atualizaFantasma(input) {
    const g = input.parentNode.querySelector(".ghost");
    if (!g) return;
    g.querySelector(".gv").textContent = input.value;
    g.querySelector(".gs").textContent = fantasma(input.value);
  }

  /* ---------- Cartões das ofertas ---------- */
  const UNID_ORDEM = ["g", "kg", "ml", "L", "un"];

  function montaCartoes() {
    const lista = $("#lista");
    lista.textContent = "";
    pkgs.forEach((p, i) => {
      const L = LETRAS[i];
      p.preco = fmtPreco(num(p.preco));
      const a = el("article", "pkg");
      a.dataset.id = p.id;
      const unidades = UNID_ORDEM.map((u) =>
        '<label><input type="radio" name="u' + p.id + '" value="' + u + '"' + (p.unidade === u ? " checked" : "") +
        ' aria-label="Unidade ' + UNIDADES[u].rotulo + ', oferta ' + L + '"><span>' + UNIDADES[u].rotulo + "</span></label>"
      ).join("");
      a.innerHTML =
        '<div class="pkg-topo">' +
          '<span class="bolinha" aria-hidden="true">' + L + "</span>" +
          '<span class="pkg-nome">Oferta ' + L + "</span>" +
          (pkgs.length > MIN
            ? '<button type="button" class="del" aria-label="Tira a oferta ' + L + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
            : "") +
        "</div>" +
        '<div class="dupla">' +
          '<label>Marca ou nome<input class="field nome" type="text" maxlength="40" autocomplete="off" placeholder="Becker" aria-label="Marca ou nome da oferta ' + L + '"></label>' +
          '<label>Loja<input class="field loja" type="text" maxlength="40" autocomplete="off" placeholder="Pão de Açúcar" aria-label="Loja da oferta ' + L + '"></label>' +
        "</div>" +
        '<div class="dupla">' +
          '<label>Preço<span class="money"><i>R$</i><span class="pwrap"><span class="ghost" aria-hidden="true"><span class="gv"></span><span class="gs"></span></span>' +
            '<input class="price" inputmode="decimal" autocomplete="off" placeholder="Digita" aria-label="Preço da oferta ' + L + ' em reais"></span></span></label>' +
          '<label>Quantidade<input class="field num qty" inputmode="decimal" autocomplete="off" placeholder="Digita" aria-label="Quantidade da oferta ' + L + '"></label>' +
        "</div>" +
        '<fieldset class="seg"><legend class="sr">Unidade da oferta ' + L + '</legend><div class="seg-linha">' + unidades + "</div></fieldset>" +

        '<details class="mais promo"><summary>Tem promoção?</summary><div class="conteudo">' +
          '<label>Promoção da loja<select class="field promo-tipo" aria-label="Tipo de promoção da oferta ' + L + '">' +
            '<option value="">Nenhuma</option>' +
            '<option value="lp">Leve X, pague Y</option>' +
            '<option value="seg">Desconto na 2ª unidade</option>' +
          "</select></label>" +
          '<div class="dupla g-lp" hidden>' +
            '<label>Leve<input class="field num leve" inputmode="numeric" autocomplete="off" placeholder="3" aria-label="Leve quantas, oferta ' + L + '"></label>' +
            '<label>Pague<input class="field num pague" inputmode="numeric" autocomplete="off" placeholder="2" aria-label="Pague quantas, oferta ' + L + '"></label>' +
          "</div>" +
          '<div class="g-seg" hidden>' +
            '<label>Desconto na 2ª unidade (%)<input class="field num seg2" inputmode="decimal" autocomplete="off" placeholder="50" aria-label="Desconto na segunda unidade em porcentagem, oferta ' + L + '"></label>' +
          "</div>" +
          '<div class="dupla">' +
            '<label>Desconto extra (%)<input class="field num desc" inputmode="decimal" autocomplete="off" placeholder="10" aria-label="Desconto extra em porcentagem, oferta ' + L + '"></label>' +
            '<label>Cashback (R$)<input class="field num cash" inputmode="decimal" autocomplete="off" placeholder="5" aria-label="Cashback em reais por embalagem, oferta ' + L + '"></label>' +
          "</div>" +
          '<p class="dica promo-msg"></p>' +
          '<p class="dica">Desconto na 2ª unidade vale comprando duas. Desconto extra é de cartão da loja. Cashback é o que volta em reais por embalagem.</p>' +
        "</div></details>" +

        '<details class="mais rende"><summary>Rende quantos usos?</summary><div class="conteudo">' +
          '<label>Usos por embalagem<input class="field num usos" inputmode="decimal" autocomplete="off" placeholder="40" aria-label="Quantos usos rende a oferta ' + L + '"></label>' +
          '<p class="dica">Exemplo: sabão que rende 40 lavagens. Põe 40 e o nome do uso lá em cima. Se todas as ofertas tiverem usos, o app compara por uso.</p>' +
        "</div></details>" +

        '<details class="mais itens"><summary>Vem com vários itens iguais?</summary><div class="conteudo">' +
          '<label>Número de itens<input class="field num items" inputmode="numeric" autocomplete="off" placeholder="1"></label>' +
          '<p class="dica">Exemplo: fardo com 6 latas de 350 ml. Quantidade 350 ml, número de itens 6.</p>' +
        "</div></details>";
      a.querySelector(".nome").value = p.nome;
      a.querySelector(".loja").value = p.loja;
      a.querySelector(".price").value = p.preco;
      atualizaFantasma(a.querySelector(".price"));
      a.querySelector(".qty").value = p.qtd;
      a.querySelector(".items").value = p.itens;
      a.querySelector(".usos").value = p.usos;
      a.querySelector(".promo-tipo").value = p.promo;
      ["leve", "pague", "seg", "desc", "cash"].forEach((c) => { a.querySelector("." + (c === "seg" ? "seg2" : c)).value = p[c]; });
      if (p.itens !== "" && num(p.itens) !== 1) a.querySelector(".itens").open = true;
      if (p.usos !== "") a.querySelector(".rende").open = true;
      if (p.promo || p.desc || p.cash) a.querySelector(".promo").open = true;
      atualizaPromoUI(a, p);
      lista.appendChild(a);
    });
    $("#add").hidden = pkgs.length >= MAX;
  }

  function acharPkg(no) {
    const a = no.closest(".pkg");
    if (!a) return null;
    const id = Number(a.dataset.id);
    return pkgs.find((p) => p.id === id) || null;
  }

  /* ---------- Promoção ----------
     preço efetivo da embalagem = preço × fator − cashback
     - leve X, pague Y:       fator × (Y ÷ X)
     - 2ª unidade com D% off: fator × (1 − D ÷ 200)   (comprando duas, a média cai D/2 %)
     - desconto extra E%:     fator × (1 − E ÷ 100)
     - cashback R$ C:         tira C de cada embalagem
     Promoção inválida é ignorada e a pessoa é avisada no próprio cartão. */
  function promo(p, preco) {
    let fator = 1, cash = 0;
    const textos = [], erros = {};
    if (p.promo === "lp") {
      const leve = p.leve === "" ? NaN : Number(p.leve);
      const pague = p.pague === "" ? NaN : Number(p.pague);
      if (p.leve === "" && p.pague === "") {
        // ainda não preencheu: nada a aplicar
      } else if (Number.isInteger(leve) && Number.isInteger(pague) && leve >= 2 && pague >= 1 && pague < leve) {
        fator *= pague / leve;
        textos.push("Leve " + leve + ", pague " + pague);
      } else {
        erros.lp = "Pra valer, leve precisa ser maior que pague. Ex.: leve 3, pague 2.";
      }
    } else if (p.promo === "seg" && p.seg !== "") {
      const d = num(p.seg);
      if (d > 0 && d <= 100) {
        fator *= 1 - d / 200;
        textos.push(fmtNum(d) + "% na 2ª unidade, comprando 2");
      } else {
        erros.seg = "O desconto da 2ª unidade tem que ficar entre 0 e 100%.";
      }
    }
    if (p.desc !== "") {
      const d = num(p.desc);
      if (d > 0 && d < 100) {
        fator *= 1 - d / 100;
        textos.push(fmtNum(d) + "% de desconto extra");
      } else {
        erros.desc = "O desconto extra tem que ficar entre 0 e 100%.";
      }
    }
    if (p.cash !== "") {
      const c = num(p.cash);
      if (c > 0 && (!(preco > 0) || preco * fator - c > 0)) {
        cash = c;
        textos.push(dinheiro(c) + " de cashback");
      } else {
        erros.cash = "O cashback precisa ser maior que zero e menor que o preço.";
      }
    }
    const msg = erros.lp || erros.seg || erros.desc || erros.cash || "";
    return { fator, cash, erros, msg, texto: textos.join(" + ") };
  }

  // Mostra só os campos do tipo de promoção escolhido e marca os campos com erro
  function atualizaPromoUI(cartao, p) {
    cartao.querySelector(".g-lp").hidden = p.promo !== "lp";
    cartao.querySelector(".g-seg").hidden = p.promo !== "seg";
    const r = promo(p, num(p.preco));
    const m = cartao.querySelector(".promo-msg");
    m.textContent = r.msg;
    m.hidden = !r.msg;
    cartao.querySelector(".leve").classList.toggle("invalido", !!r.erros.lp);
    cartao.querySelector(".pague").classList.toggle("invalido", !!r.erros.lp);
    cartao.querySelector(".seg2").classList.toggle("invalido", !!r.erros.seg);
    cartao.querySelector(".desc").classList.toggle("invalido", !!r.erros.desc);
    cartao.querySelector(".cash").classList.toggle("invalido", !!r.erros.cash);
  }

  const soDigitos = (v, n) => v.replace(/\D/g, "").slice(0, n);
  const soDecimal = (v, n) => v.replace(/[^\d.,]/g, "").slice(0, n);

  function aoMudar(e) {
    const p = acharPkg(e.target);
    if (!p) return;
    const t = e.target;
    const c = t.classList;
    const campoLimpo = (chave, valor) => { p[chave] = valor; if (t.value !== valor) t.value = valor; };
    if (c.contains("price")) {
      const limpo = limpaPreco(t.value);
      if (t.value !== limpo) {
        t.value = limpo;
        try { t.setSelectionRange(limpo.length, limpo.length); } catch (err) {}
      }
      p.preco = limpo;
      atualizaFantasma(t);
    } else if (c.contains("qty")) campoLimpo("qtd", soDecimal(t.value, 10));
    else if (c.contains("items")) campoLimpo("itens", soDigitos(t.value, 4));
    else if (c.contains("usos")) campoLimpo("usos", soDecimal(t.value, 8));
    else if (c.contains("leve")) campoLimpo("leve", soDigitos(t.value, 3));
    else if (c.contains("pague")) campoLimpo("pague", soDigitos(t.value, 3));
    else if (c.contains("seg2")) campoLimpo("seg", soDecimal(t.value, 5));
    else if (c.contains("desc")) campoLimpo("desc", soDecimal(t.value, 5));
    else if (c.contains("cash")) campoLimpo("cash", soDecimal(t.value, 9));
    else if (c.contains("promo-tipo")) p.promo = t.value;
    else if (c.contains("nome")) p.nome = t.value;
    else if (c.contains("loja")) p.loja = t.value;
    else if (t.type === "radio") p.unidade = t.value;
    atualizaPromoUI(t.closest(".pkg"), p);
    mostraResultado();
  }

  const lista = $("#lista");
  lista.addEventListener("input", aoMudar);
  lista.addEventListener("change", aoMudar);

  lista.addEventListener("paste", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("price")) return;
    const v = num((e.clipboardData || window.clipboardData).getData("text").replace(/[^\d.,]/g, ""));
    if (!(v > 0)) return;
    e.preventDefault();
    t.value = String(Math.round(v * 100) / 100).replace(".", ",");
    t.dispatchEvent(new Event("input", { bubbles: true }));
  });

  let primeiroToque = null;
  lista.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("price")) return;
    t.value = t.value.replace(/\./g, "");
    const p = acharPkg(t);
    if (p) p.preco = t.value;
    atualizaFantasma(t);
    primeiroToque = t;
    const valorAoFocar = t.value;
    setTimeout(() => {
      if (t.value !== valorAoFocar) return;
      try { t.select(); } catch (err) {}
    }, 0);
  });
  lista.addEventListener("mouseup", (e) => { if (e.target === primeiroToque) e.preventDefault(); });
  lista.addEventListener("click", (e) => {
    if (e.target === primeiroToque) {
      try { e.target.select(); } catch (err) {}
      primeiroToque = null;
    }
  });
  lista.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("price")) return;
    const v = fmtPreco(num(t.value));
    t.value = v;
    const p = acharPkg(t);
    if (p) p.preco = v;
    atualizaFantasma(t);
    atualizaPromoUI(t.closest(".pkg"), p);
    mostraResultado();
  });

  lista.addEventListener("click", (e) => {
    const b = e.target.closest(".del");
    if (!b) return;
    const p = acharPkg(b);
    if (!p || pkgs.length <= MIN) return;
    pkgs = pkgs.filter((x) => x !== p);
    montaCartoes();
    mostraResultado();
  });
  $("#add").addEventListener("click", () => {
    if (pkgs.length >= MAX) return;
    pkgs.push(novaPkg());
    montaCartoes();
    const cartoes = document.querySelectorAll(".pkg");
    cartoes[cartoes.length - 1].querySelector(".nome").focus();
    mostraResultado();
  });

  function recomeca(produto, uso) {
    pkgs = [novaPkg(), novaPkg()];
    $("#produto").value = produto || "";
    $("#uso").value = uso || "";
    aviso("");
    esconderTexto();
    montaCartoes();
    mostraResultado();
  }
  $("#limpa").addEventListener("click", () => recomeca("", ""));
  $("#exemplo").addEventListener("click", () => {
    recomeca("Sabão líquido", "lavagem");
    Object.assign(pkgs[0], { nome: "OMO", loja: "Pão de Açúcar", preco: "19,90", qtd: "3", unidade: "L" });
    Object.assign(pkgs[1], { nome: "Becker", loja: "Mercado do bairro", preco: "29,90", qtd: "5", unidade: "L" });
    montaCartoes();
    mostraResultado();
  });
  $("#produto").addEventListener("input", esconderTexto);
  $("#uso").addEventListener("input", mostraResultado);

  /* ---------- Cálculo ---------- */
  // Preço por unidade base = preço efetivo ÷ (quantidade × itens × fator da unidade)
  // Custo por uso = preço efetivo ÷ usos por embalagem (só quando a pessoa informa os usos)
  function calcula(lista) {
    return lista.map((p, i) => {
      const preco = num(p.preco);
      const qtd = num(p.qtd);
      const itens = p.itens === "" ? 1 : num(p.itens);
      const u = UNIDADES[p.unidade];
      const ok = preco > 0 && qtd > 0 && Number.isInteger(itens) && itens >= 1 && isFinite(preco * qtd * itens);
      const pr = promo(p, preco);
      // promoção com erro é ignorada (fator 1, sem cashback)
      const fator = pr.msg ? 1 : pr.fator;
      const cash = pr.msg ? 0 : pr.cash;
      const efetivo = ok ? Math.max(preco * fator - cash, 0.01) : 0;
      const total = ok ? qtd * itens * u.f : 0;
      const usos = p.usos === "" ? NaN : num(p.usos);
      return {
        letra: LETRAS[i], ok, preco, efetivo, promoTexto: pr.msg ? "" : pr.texto,
        qtd, itens, unidade: p.unidade, tipo: u.tipo, total,
        usos: usos > 0 ? usos : 0,
        marca: limpaTexto(p.nome), loja: limpaTexto(p.loja),
        up: ok ? efetivo / total : null,
        ref: null                       // valor usado pra comparar (por unidade base ou por uso)
      };
    });
  }
  const textoQtd = (r) => fmtNum(r.qtd) + " " + UNIDADES[r.unidade].rotulo + (r.itens > 1 ? " x " + r.itens : "");
  const nomeDe = (r) => (r.marca || "Oferta " + r.letra) + ", " + textoQtd(r);
  const nomeComLoja = (r) => nomeDe(r) + (r.loja ? " (" + r.loja + ")" : "");

  // Contexto de comparação do grupo: por unidade base (kg, L, unid.) ou por uso (lavagem...)
  function contextoDe(modo, tipo) {
    const t = TIPOS[tipo];
    return modo === "uso" ? { por: nomeUso(), abrev: nomeUso() } : { por: t.por, abrev: t.abrev };
  }

  function detalhe(r, modo) {
    const t = TIPOS[r.tipo];
    const partes = [textoQtd(r) + " por " + dinheiro(r.preco) + "."];
    if (r.promoTexto) partes.push(r.promoTexto + ": cada uma sai " + dinheiro(r.efetivo) + ".");
    if (r.usos) {
      partes.push(modo === "uso"
        ? dinheiro(r.up) + " por " + t.abrev + "."
        : dinheiro(r.efetivo / r.usos) + " por " + nomeUso() + ".");
    }
    if (t.cem) partes.push(dinheiro(r.up / t.cem) + " por " + t.rotuloCem + ".");
    return partes.join(" ");
  }

  /* ---------- Resultado ---------- */
  function cartaoMelhor(arr, empate, modo) {
    const cx = contextoDe(modo, arr[0].tipo);
    const melhor = arr[0];
    const pior = arr[arr.length - 1];
    const c = el("div", "best");
    const k = el("p", "kicker");
    k.innerHTML = simbolo(30, 24);
    k.appendChild(el("span", "", empate ? "Empate" : "Melhor compra"));
    c.appendChild(k);
    c.appendChild(el("p", "nome", empate ? nomeDe(melhor) + " e " + nomeDe(arr[1]) : nomeDe(melhor)));
    if (!empate && melhor.loja) c.appendChild(el("p", "det", melhor.loja));
    const p = el("p", "preco", dinheiro(melhor.ref));
    p.appendChild(el("small", "", "/" + cx.abrev));
    c.appendChild(p);
    if (empate) {
      c.appendChild(el("p", "eco", "O preço por " + cx.por + " é praticamente o mesmo. Leva a que for mais útil."));
    } else {
      c.appendChild(el("p", "eco", dinheiro(pior.ref - melhor.ref) + " a menos por " + cx.por + " que a mais cara"));
      c.appendChild(el("p", "det", detalhe(melhor, modo)));
    }
    const chave = (empate ? "e" : "m") + melhor.letra + modo;
    const memo = ultimoMelhor[melhor.tipo];
    if (memo && memo.chave !== chave) ultimoMelhor[melhor.tipo] = { chave, quando: Date.now() };
    else if (!memo) ultimoMelhor[melhor.tipo] = { chave, quando: 0 };
    if (Date.now() - ultimoMelhor[melhor.tipo].quando < 400) c.classList.add("swap");
    return c;
  }

  // "% mais caro" = (valor da oferta ÷ valor da melhor compra − 1) × 100, mínimo 1%
  const pctMaisCaro = (r, melhor) => Math.max(1, Math.round((r.ref / melhor.ref - 1) * 100));

  function linha(r, melhor, modo) {
    const cx = contextoDe(modo, r.tipo);
    const li = el("li", "row");
    const esq = el("div");
    esq.appendChild(el("p", "nome", nomeDe(r)));
    if (r.loja) esq.appendChild(el("p", "loja", r.loja));
    esq.appendChild(el("p", "det", detalhe(r, modo)));
    const dir = el("div", "dir");
    const v = el("p", "val", dinheiro(r.ref));
    v.appendChild(el("small", "", "/" + cx.abrev));
    dir.appendChild(v);
    dir.appendChild(el("span", "selo", pctMaisCaro(r, melhor) + "% mais caro"));
    li.appendChild(esq);
    li.appendChild(dir);
    return li;
  }

  function grupoResultado(arr, vario) {
    const sec = el("section", "grupo");
    if (vario) sec.appendChild(el("h3", "", TIPOS[arr[0].tipo].titulo));
    if (arr.length < 2) {
      sec.appendChild(el("p", "vazio-res", "Põe outra oferta do mesmo tipo pra comparar."));
      return sec;
    }
    // Por uso só quando TODAS as ofertas do grupo dizem quantos usos rendem
    const modo = arr.every((r) => r.usos > 0) ? "uso" : "base";
    arr.forEach((r) => { r.ref = modo === "uso" ? r.efetivo / r.usos : r.up; });
    arr.sort((a, b) => a.ref - b.ref);
    const melhor = arr[0];
    // Empate: diferença entre as duas mais baratas menor que 0,5%
    const empate = arr[1].ref / melhor.ref - 1 < 0.005;
    const cx = contextoDe(modo, melhor.tipo);
    if (modo === "base" && arr.some((r) => r.usos > 0)) {
      sec.appendChild(el("p", "nota", "Põe os usos de todas as ofertas pra comparar por " + nomeUso() + "."));
    }
    sec.appendChild(cartaoMelhor(arr, empate, modo));

    // Flagra: a embalagem de maior quantidade total não é a melhor compra
    const maior = arr.reduce((m, r) => (r.total > m.total ? r : m), arr[0]);
    const flagra = !empate && maior !== melhor && maior.ref / melhor.ref - 1 >= 0.005;
    if (flagra) {
      const f = el("div", "flagra");
      f.innerHTML = simbolo(25, 20);
      const txt = el("p");
      txt.innerHTML = "<strong>Flagra:</strong> ";
      txt.appendChild(document.createTextNode("a embalagem maior sai mais cara por " + cx.por + "."));
      f.appendChild(txt);
      sec.appendChild(f);
    }
    const ul = el("ul", "ranking");
    arr.slice(empate ? 2 : 1).forEach((r) => ul.appendChild(linha(r, melhor, modo)));
    if (ul.children.length) sec.appendChild(ul);
    ultimo.push({ arr, empate, flagra, modo });
    return sec;
  }

  function mostraResultado() {
    const box = $("#resultado");
    box.textContent = "";
    ultimo = [];
    const validas = calcula(pkgs).filter((r) => r.ok);
    if (!validas.length) {
      box.appendChild(el("p", "vazio-res", "Preenche o preço e a quantidade de pelo menos duas ofertas. O resultado aparece aqui."));
    } else {
      const grupos = ["massa", "volume", "un"].map((t) => validas.filter((r) => r.tipo === t)).filter((a) => a.length);
      const vario = grupos.length > 1;
      if (vario) box.appendChild(el("p", "nota", "Peso, volume e unidade não se misturam. Cada tipo foi comparado separado."));
      grupos.forEach((arr) => box.appendChild(grupoResultado(arr, vario)));
    }
    $("#copiar").hidden = ultimo.length === 0;
    esconderTexto();
  }

  /* ---------- Copia a oferta ---------- */
  // Monta um texto curto, sem emoji, pra colar no WhatsApp
  function textoGrupo() {
    const produto = limpaTexto($("#produto").value);
    const linhas = ["Clica e Compara" + (produto ? ": " + produto : "")];
    ultimo.forEach((g) => {
      const cx = contextoDe(g.modo, g.arr[0].tipo);
      const melhor = g.arr[0];
      if (g.empate) {
        linhas.push("Empate: " + nomeComLoja(melhor) + " e " + nomeComLoja(g.arr[1]) + ", a " + dinheiro(melhor.ref) + "/" + cx.abrev);
      } else {
        linhas.push("Melhor compra: " + nomeComLoja(melhor) + ", a " + dinheiro(melhor.ref) + "/" + cx.abrev);
        if (melhor.promoTexto) linhas.push("(com promoção: " + melhor.promoTexto + ")");
        g.arr.slice(1).forEach((r) => {
          linhas.push(nomeComLoja(r) + ": " + dinheiro(r.ref) + "/" + cx.abrev + ", " + pctMaisCaro(r, melhor) + "% mais caro");
        });
        if (g.flagra) linhas.push("Flagra: a embalagem maior sai mais cara por " + cx.por + ".");
      }
    });
    linhas.push("Compara só o preço, não a qualidade.");
    return linhas.join("\n");
  }

  let avisoTimer = null;
  function aviso(texto) {
    const a = $("#aviso");
    clearTimeout(avisoTimer);
    a.textContent = texto;
    a.classList.toggle("on", !!texto);
    if (texto) avisoTimer = setTimeout(() => a.classList.remove("on"), 4500);
  }
  function esconderTexto() { $("#copiaTexto").hidden = true; }

  $("#copia").addEventListener("click", () => {
    const texto = textoGrupo();
    const area = $("#copiaTexto");
    area.value = texto;
    // Plano B: se o navegador não deixar copiar, mostra o texto já selecionado
    const mostra = () => {
      area.hidden = false;
      area.focus();
      area.select();
      aviso("Não deu pra copiar sozinho. Seleciona o texto e copia.");
    };
    try {
      navigator.clipboard.writeText(texto).then(() => aviso("Copiou. Cola no grupo."), mostra);
    } catch (e) { mostra(); }
  });

  /* ---------- Início ---------- */
  pkgs = [novaPkg(), novaPkg()];
  montaCartoes();
  mostraResultado();
})();
