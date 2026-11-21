/* Clica e Compara Ofertas — variante para comparar ofertas de marcas e lojas diferentes.
   Protótipo: sem banco de dados, sem histórico, sem envio de nada.
   Novidades em relação ao app principal: marca e loja por oferta, promoção
   ("leve X, pague Y" e desconto extra) e o botão "Copia pro grupo". */
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

  /* ---------- Estado ---------- */
  let proxId = 1;
  let pkgs = [];
  let ultimo = [];                   // grupos do último resultado (usado pelo "Copia pro grupo")
  const ultimoMelhor = {};

  const novaPkg = (o) => Object.assign({
    id: proxId++, nome: "", loja: "", preco: "", qtd: "", unidade: "g", itens: "", leve: "", pague: "", desc: ""
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
          '<div class="tres">' +
            '<label>Leve<input class="field num leve" inputmode="numeric" autocomplete="off" placeholder="3" aria-label="Leve quantas, oferta ' + L + '"></label>' +
            '<label>Pague<input class="field num pague" inputmode="numeric" autocomplete="off" placeholder="2" aria-label="Pague quantas, oferta ' + L + '"></label>' +
            '<label>Desconto %<input class="field num desc" inputmode="decimal" autocomplete="off" placeholder="10" aria-label="Desconto extra em porcentagem, oferta ' + L + '"></label>' +
          "</div>" +
          '<p class="dica promo-msg"></p>' +
          '<p class="dica">Exemplo: leve 3, pague 2. O desconto extra é de cartão da loja ou cashback.</p>' +
        "</div></details>" +
        '<details class="mais"><summary>Vem com vários itens iguais?</summary><div class="conteudo">' +
          '<label>Número de itens<input class="field num items" inputmode="numeric" autocomplete="off" placeholder="1"></label>' +
          '<p class="dica">Exemplo: fardo com 6 latas de 350 ml. Quantidade 350 ml, número de itens 6.</p>' +
        "</div></details>";
      a.querySelector(".nome").value = p.nome;
      a.querySelector(".loja").value = p.loja;
      a.querySelector(".price").value = p.preco;
      atualizaFantasma(a.querySelector(".price"));
      a.querySelector(".qty").value = p.qtd;
      a.querySelector(".items").value = p.itens;
      a.querySelector(".leve").value = p.leve;
      a.querySelector(".pague").value = p.pague;
      a.querySelector(".desc").value = p.desc;
      if (p.itens !== "" && num(p.itens) !== 1) a.querySelector(".mais:not(.promo)").open = true;
      if (p.leve || p.pague || p.desc) a.querySelector(".promo").open = true;
      atualizaPromoMsg(a, p);
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
     Leve X, pague Y: o preço de cada embalagem vira preço × Y ÷ X.
     Desconto extra (%): tira essa porcentagem do valor final.
     Promoção inválida é ignorada e a pessoa é avisada no próprio cartão. */
  function promo(p) {
    const leve = p.leve === "" ? NaN : Number(p.leve);
    const pague = p.pague === "" ? NaN : Number(p.pague);
    const desc = p.desc === "" ? 0 : num(p.desc);
    const temLP = p.leve !== "" || p.pague !== "";
    let fator = 1, erro = "", textos = [];
    if (temLP) {
      if (Number.isInteger(leve) && Number.isInteger(pague) && leve >= 2 && pague >= 1 && pague < leve) {
        fator *= pague / leve;
        textos.push("Leve " + leve + ", pague " + pague);
      } else {
        erro = "Pra valer, leve precisa ser maior que pague. Ex.: leve 3, pague 2.";
      }
    }
    if (p.desc !== "") {
      if (desc > 0 && desc < 100) {
        fator *= 1 - desc / 100;
        textos.push(fmtNum(desc) + "% de desconto");
      } else if (!erro) {
        erro = "Desconto tem que ficar entre 0 e 100%.";
      }
    }
    return { fator, erro, texto: textos.join(" + ") };
  }
  function atualizaPromoMsg(cartao, p) {
    const m = cartao.querySelector(".promo-msg");
    const r = promo(p);
    m.textContent = r.erro;
    m.hidden = !r.erro;
    ["leve", "pague", "desc"].forEach((c) => cartao.querySelector("." + c).classList.toggle("invalido", !!r.erro));
  }

  function aoMudar(e) {
    const p = acharPkg(e.target);
    if (!p) return;
    const t = e.target;
    if (t.classList.contains("price")) {
      const limpo = limpaPreco(t.value);
      if (t.value !== limpo) {
        t.value = limpo;
        try { t.setSelectionRange(limpo.length, limpo.length); } catch (err) {}
      }
      p.preco = limpo;
      atualizaFantasma(t);
    } else if (t.classList.contains("qty")) {
      p.qtd = t.value.replace(/[^\d.,]/g, "");
      if (t.value !== p.qtd) t.value = p.qtd;
    } else if (t.classList.contains("items")) {
      p.itens = t.value.replace(/\D/g, "").slice(0, 4);
      if (t.value !== p.itens) t.value = p.itens;
    } else if (t.classList.contains("leve") || t.classList.contains("pague")) {
      const c = t.classList.contains("leve") ? "leve" : "pague";
      p[c] = t.value.replace(/\D/g, "").slice(0, 3);
      if (t.value !== p[c]) t.value = p[c];
      atualizaPromoMsg(t.closest(".pkg"), p);
    } else if (t.classList.contains("desc")) {
      p.desc = t.value.replace(/[^\d.,]/g, "").slice(0, 5);
      if (t.value !== p.desc) t.value = p.desc;
      atualizaPromoMsg(t.closest(".pkg"), p);
    } else if (t.classList.contains("nome")) {
      p.nome = t.value;
    } else if (t.classList.contains("loja")) {
      p.loja = t.value;
    } else if (t.type === "radio") {
      p.unidade = t.value;
    }
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

  function recomeca(produto) {
    pkgs = [novaPkg(), novaPkg()];
    $("#produto").value = produto || "";
    aviso("");
    esconderTexto();
    montaCartoes();
    mostraResultado();
  }
  $("#limpa").addEventListener("click", () => recomeca(""));
  $("#exemplo").addEventListener("click", () => {
    recomeca("Sabão líquido");
    Object.assign(pkgs[0], { nome: "OMO", loja: "Pão de Açúcar", preco: "19,90", qtd: "3", unidade: "L" });
    Object.assign(pkgs[1], { nome: "Becker", loja: "Mercado do bairro", preco: "29,90", qtd: "5", unidade: "L" });
    montaCartoes();
    mostraResultado();
  });
  $("#produto").addEventListener("input", () => { esconderTexto(); });

  /* ---------- Cálculo ---------- */
  // Preço por unidade base = preço efetivo ÷ (quantidade × itens × fator da unidade)
  // Preço efetivo = preço da embalagem com a promoção aplicada
  function calcula(lista) {
    return lista.map((p, i) => {
      const preco = num(p.preco);
      const qtd = num(p.qtd);
      const itens = p.itens === "" ? 1 : num(p.itens);
      const u = UNIDADES[p.unidade];
      const pr = promo(p);
      const ok = preco > 0 && qtd > 0 && Number.isInteger(itens) && itens >= 1 && isFinite(preco * qtd * itens);
      const efetivo = ok ? preco * (pr.erro ? 1 : pr.fator) : 0;
      const total = ok ? qtd * itens * u.f : 0;
      return {
        letra: LETRAS[i], ok, preco, efetivo, promoTexto: pr.erro ? "" : pr.texto,
        qtd, itens, unidade: p.unidade, tipo: u.tipo, total,
        marca: limpaTexto(p.nome), loja: limpaTexto(p.loja),
        up: ok ? efetivo / total : null
      };
    });
  }
  const textoQtd = (r) => fmtNum(r.qtd) + " " + UNIDADES[r.unidade].rotulo + (r.itens > 1 ? " x " + r.itens : "");
  // Sem marca, usa "Oferta A"
  const nomeDe = (r) => (r.marca || "Oferta " + r.letra) + ", " + textoQtd(r);
  const nomeComLoja = (r) => nomeDe(r) + (r.loja ? " (" + r.loja + ")" : "");
  function detalhe(r) {
    const partes = [textoQtd(r) + " por " + dinheiro(r.preco) + "."];
    if (r.promoTexto) partes.push(r.promoTexto + ": cada uma sai " + dinheiro(r.efetivo) + ".");
    const t = TIPOS[r.tipo];
    if (t.cem) partes.push(dinheiro(r.up / t.cem) + " por " + t.rotuloCem + ".");
    return partes.join(" ");
  }

  /* ---------- Resultado ---------- */
  function cartaoMelhor(arr, empate) {
    const t = TIPOS[arr[0].tipo];
    const melhor = arr[0];
    const pior = arr[arr.length - 1];
    const c = el("div", "best");
    const k = el("p", "kicker");
    k.innerHTML = simbolo(30, 24);
    k.appendChild(el("span", "", empate ? "Empate" : "Melhor compra"));
    c.appendChild(k);
    c.appendChild(el("p", "nome", empate ? nomeDe(melhor) + " e " + nomeDe(arr[1]) : nomeDe(melhor)));
    if (!empate && melhor.loja) c.appendChild(el("p", "det", melhor.loja));
    const p = el("p", "preco", dinheiro(melhor.up));
    p.appendChild(el("small", "", "/" + t.abrev));
    c.appendChild(p);
    if (empate) {
      c.appendChild(el("p", "eco", "O preço por " + t.por + " é praticamente o mesmo. Leva a que for mais útil."));
    } else {
      c.appendChild(el("p", "eco", dinheiro(pior.up - melhor.up) + " a menos por " + t.por + " que a mais cara"));
      c.appendChild(el("p", "det", detalhe(melhor)));
    }
    const chave = (empate ? "e" : "m") + melhor.letra;
    if (ultimoMelhor[melhor.tipo] && ultimoMelhor[melhor.tipo].chave !== chave) ultimoMelhor[melhor.tipo] = { chave, quando: Date.now() };
    else if (!ultimoMelhor[melhor.tipo]) ultimoMelhor[melhor.tipo] = { chave, quando: 0 };
    if (Date.now() - ultimoMelhor[melhor.tipo].quando < 400) c.classList.add("swap");
    return c;
  }

  const pctMaisCaro = (r, melhor) => Math.max(1, Math.round((r.up / melhor.up - 1) * 100));

  function linha(r, melhor) {
    const t = TIPOS[r.tipo];
    const li = el("li", "row");
    const esq = el("div");
    esq.appendChild(el("p", "nome", nomeDe(r)));
    if (r.loja) esq.appendChild(el("p", "loja", r.loja));
    esq.appendChild(el("p", "det", detalhe(r)));
    const dir = el("div", "dir");
    const v = el("p", "val", dinheiro(r.up));
    v.appendChild(el("small", "", "/" + t.abrev));
    dir.appendChild(v);
    dir.appendChild(el("span", "selo", pctMaisCaro(r, melhor) + "% mais caro"));
    li.appendChild(esq);
    li.appendChild(dir);
    return li;
  }

  function flagraDe(arr, empate) {
    const melhor = arr[0];
    const maior = arr.reduce((m, r) => (r.total > m.total ? r : m), arr[0]);
    return !empate && maior !== melhor && maior.up / melhor.up - 1 >= 0.005;
  }

  function grupoResultado(arr, vario) {
    const sec = el("section", "grupo");
    if (vario) sec.appendChild(el("h3", "", TIPOS[arr[0].tipo].titulo));
    if (arr.length < 2) {
      sec.appendChild(el("p", "vazio-res", "Põe outra oferta do mesmo tipo pra comparar."));
      return sec;
    }
    arr.sort((a, b) => a.up - b.up);
    const melhor = arr[0];
    const empate = arr[1].up / melhor.up - 1 < 0.005;
    sec.appendChild(cartaoMelhor(arr, empate));
    const flagra = flagraDe(arr, empate);
    if (flagra) {
      const f = el("div", "flagra");
      f.innerHTML = simbolo(25, 20);
      const txt = el("p");
      txt.innerHTML = "<strong>Flagra:</strong> ";
      txt.appendChild(document.createTextNode("a embalagem maior sai mais cara por " + TIPOS[melhor.tipo].por + "."));
      f.appendChild(txt);
      sec.appendChild(f);
    }
    const ul = el("ul", "ranking");
    arr.slice(empate ? 2 : 1).forEach((r) => ul.appendChild(linha(r, melhor)));
    if (ul.children.length) sec.appendChild(ul);
    ultimo.push({ arr, empate, flagra });
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

  /* ---------- Copia pro grupo ---------- */
  // Monta um texto curto, sem emoji, pra colar no WhatsApp
  function textoGrupo() {
    const produto = limpaTexto($("#produto").value);
    const linhas = ["Clica e Compara" + (produto ? ": " + produto : "")];
    ultimo.forEach((g) => {
      const t = TIPOS[g.arr[0].tipo];
      const melhor = g.arr[0];
      if (g.empate) {
        linhas.push("Empate: " + nomeComLoja(melhor) + " e " + nomeComLoja(g.arr[1]) + ", a " + dinheiro(melhor.up) + "/" + t.abrev);
      } else {
        linhas.push("Melhor compra: " + nomeComLoja(melhor) + ", a " + dinheiro(melhor.up) + "/" + t.abrev);
        if (melhor.promoTexto) linhas.push("(com promoção: " + melhor.promoTexto + ")");
        g.arr.slice(1).forEach((r) => {
          linhas.push(nomeComLoja(r) + ": " + dinheiro(r.up) + "/" + t.abrev + ", " + pctMaisCaro(r, melhor) + "% mais caro");
        });
        if (g.flagra) linhas.push("Flagra: a embalagem maior sai mais cara por " + t.por + ".");
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
