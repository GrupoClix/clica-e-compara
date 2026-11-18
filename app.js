/* Clica e Compara — lógica do comparador.
   Sem banco de dados e sem envio de nada: tudo fica no aparelho (localStorage). */
(function () {
  "use strict";

  const LETRAS = "ABCDEFGH";
  const MAX = 8, MIN = 2;
  const CHAVE_HIST = "clicaecompara:historico:v1";

  // Unidade -> tipo (massa, volume, un) e fator para a unidade base (kg, L, unid.)
  const UNIDADES = {
    g:  { tipo: "massa",  f: 0.001, rotulo: "g" },
    kg: { tipo: "massa",  f: 1,     rotulo: "kg" },
    ml: { tipo: "volume", f: 0.001, rotulo: "ml" },
    L:  { tipo: "volume", f: 1,     rotulo: "L" },
    un: { tipo: "un",     f: 1,     rotulo: "unid." }
  };
  // por: como aparece na frase; abrev: como aparece ao lado do preço; cem: divisor do preço por 100 g/ml
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

  // Converte "1.234,50", "33,9" ou "7.5" em número. Sem valor válido, devolve NaN.
  function num(s) {
    s = String(s == null ? "" : s).trim().replace(/\s/g, "");
    if (!s) return NaN;
    if (s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");   // 1.500 = mil e quinhentos
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

  // Texto livre: sem caracteres de controle, sem espaço sobrando, no máximo 80 caracteres
  const limpaTexto = (s) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

  /* ---------- Estado ---------- */
  let proxId = 1;
  let pkgs = [];
  let editandoId = null;
  let salvos = [];
  const ultimoMelhor = {};           // tipo -> { chave, quando } da melhor compra (para animar a troca)

  const novaPkg = (o) => Object.assign({ id: proxId++, preco: "", qtd: "", unidade: "g", itens: "" }, o || {});

  /* ---------- Campo de preço (máscara mista) ----------
     - o valor digitado é em reais e o ",00" aparece sozinho: 4 = 4,00 | 40 = 40,00
     - zero na frente manda para os centavos: 04 = 0,40
     - para centavos em outros preços, digita a vírgula: 33,9 = 33,90
     - o ponto vira vírgula; até 6 dígitos antes da vírgula */
  function limpaPreco(bruto) {
    const s = String(bruto).replace(/\./g, ",").replace(/[^\d,]/g, "");
    const i = s.indexOf(",");
    let inteiro = s, dec = null;
    if (i !== -1) {
      inteiro = s.slice(0, i);
      dec = s.slice(i + 1).replace(/,/g, "").slice(0, 2);
    }
    if (dec === null && /^0\d/.test(inteiro)) {      // 04 -> 0,4
      dec = inteiro.slice(1, 3);
      inteiro = "0";
    } else {
      inteiro = inteiro.replace(/^0+(?=\d)/, "");
    }
    inteiro = inteiro.slice(0, 6);
    return dec === null ? inteiro : (inteiro || "0") + "," + dec;
  }
  const fmtPreco = (v) => (v > 0 ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  // parte cinza que completa o que foi digitado: ",00", "00" ou "0"
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

  /* ---------- Cartões das embalagens ---------- */
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
        ' aria-label="Unidade ' + UNIDADES[u].rotulo + ', embalagem ' + L + '"><span>' + UNIDADES[u].rotulo + "</span></label>"
      ).join("");
      a.innerHTML =
        '<div class="pkg-topo">' +
          '<span class="bolinha" aria-hidden="true">' + L + "</span>" +
          '<span class="pkg-nome">Embalagem ' + L + "</span>" +
          (pkgs.length > MIN
            ? '<button type="button" class="del" aria-label="Tira a embalagem ' + L + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
            : "") +
        "</div>" +
        '<div class="dupla">' +
          '<label>Preço<span class="money"><i>R$</i><span class="pwrap"><span class="ghost" aria-hidden="true"><span class="gv"></span><span class="gs"></span></span>' +
            '<input class="price" inputmode="decimal" autocomplete="off" placeholder="Digita" aria-label="Preço da embalagem ' + L + ' em reais"></span></span></label>' +
          '<label>Quantidade<input class="field num qty" inputmode="decimal" autocomplete="off" placeholder="Digita" aria-label="Quantidade da embalagem ' + L + '"></label>' +
        "</div>" +
        '<fieldset class="seg"><legend class="sr">Unidade da embalagem ' + L + '</legend><div class="seg-linha">' + unidades + "</div></fieldset>" +
        '<details class="mais"><summary>Vem com vários itens iguais?</summary><div class="conteudo">' +
          '<label>Número de itens<input class="field num items" inputmode="numeric" autocomplete="off" placeholder="1"></label>' +
          '<p class="dica">Exemplo: fardo com 6 latas de 350 ml. Quantidade 350 ml, número de itens 6.</p>' +
        "</div></details>";
      a.querySelector(".price").value = p.preco;
      atualizaFantasma(a.querySelector(".price"));
      a.querySelector(".qty").value = p.qtd;
      a.querySelector(".items").value = p.itens;
      if (p.itens !== "" && num(p.itens) !== 1) a.querySelector(".mais").open = true;
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
    } else if (t.type === "radio") {
      p.unidade = t.value;
    }
    mostraResultado();
  }

  const lista = $("#lista");
  lista.addEventListener("input", aoMudar);
  lista.addEventListener("change", aoMudar);

  // Colar "33,90" funciona
  lista.addEventListener("paste", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("price")) return;
    const v = num((e.clipboardData || window.clipboardData).getData("text").replace(/[^\d.,]/g, ""));
    if (!(v > 0)) return;
    e.preventDefault();
    t.value = String(Math.round(v * 100) / 100).replace(".", ",");
    t.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Ao tocar no preço, o valor inteiro fica selecionado para digitar por cima
  let primeiroToque = null;
  lista.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("price")) return;
    t.value = t.value.replace(/\./g, "");            // tira o ponto de milhar para editar
    const p = acharPkg(t);
    if (p) p.preco = t.value;
    atualizaFantasma(t);
    primeiroToque = t;
    const valorAoFocar = t.value;
    setTimeout(() => {
      if (t.value !== valorAoFocar) return;          // já começou a digitar
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
  // Ao sair, formata com duas casas e separador de milhar: 4 -> 4,00 | 33,9 -> 33,90
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
    cartoes[cartoes.length - 1].querySelector(".price").focus();
    mostraResultado();
  });

  function recomeca(produto, estab) {
    pkgs = [novaPkg(), novaPkg()];
    editandoId = null;
    $("#produto").value = produto || "";
    $("#estab").value = estab || "";
    aviso("");
    atualizaSalvar();
    renderHistorico();
    montaCartoes();
    mostraResultado();
  }
  $("#limpa").addEventListener("click", () => recomeca("", ""));
  $("#exemplo").addEventListener("click", () => {
    recomeca("Leite em pó Camponesa", $("#estab").value);
    pkgs[0].preco = "33,90"; pkgs[0].qtd = "750"; pkgs[0].unidade = "g";
    pkgs[1].preco = "7,00";  pkgs[1].qtd = "200"; pkgs[1].unidade = "g";
    montaCartoes();
    mostraResultado();
  });

  /* ---------- Cálculo ---------- */
  // Preço por unidade base = preço ÷ (quantidade × número de itens × fator da unidade)
  function calcula(lista) {
    return lista.map((p, i) => {
      const preco = num(p.preco);
      const qtd = num(p.qtd);
      const itens = p.itens === "" ? 1 : num(p.itens);
      const u = UNIDADES[p.unidade];
      // Embalagem válida: preço > 0, quantidade > 0 e itens inteiro >= 1
      const ok = preco > 0 && qtd > 0 && Number.isInteger(itens) && itens >= 1 && isFinite(preco * qtd * itens);
      const total = ok ? qtd * itens * u.f : 0;
      return { letra: LETRAS[i], ok, preco, qtd, itens, unidade: p.unidade, tipo: u.tipo, total, up: ok ? preco / total : null };
    });
  }
  const textoQtd = (r) => fmtNum(r.qtd) + " " + UNIDADES[r.unidade].rotulo + (r.itens > 1 ? " x " + r.itens : "");
  const nomeDe = (r) => r.letra + ", " + textoQtd(r);
  const porCem = (r) => {
    const t = TIPOS[r.tipo];
    return t.cem ? dinheiro(r.up / t.cem) + " por " + t.rotuloCem : "";
  };
  const detalhe = (r) => textoQtd(r) + " por " + dinheiro(r.preco) + "." + (porCem(r) ? " " + porCem(r) + "." : "");

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
    const p = el("p", "preco", dinheiro(melhor.up));
    p.appendChild(el("small", "", "/" + t.abrev));
    c.appendChild(p);
    if (empate) {
      c.appendChild(el("p", "eco", "O preço por " + t.por + " é praticamente o mesmo. Leva a que for mais útil."));
    } else {
      c.appendChild(el("p", "eco", dinheiro(pior.up - melhor.up) + " a menos por " + t.por + " que a mais cara"));
      c.appendChild(el("p", "det", detalhe(melhor)));
    }
    // Anima só quando a melhor compra troca de embalagem
    const chave = (empate ? "e" : "m") + melhor.letra;
    // (a janela de 400ms evita perder a animação quando o resultado é redesenhado logo em seguida)
    if (ultimoMelhor[melhor.tipo] && ultimoMelhor[melhor.tipo].chave !== chave) ultimoMelhor[melhor.tipo] = { chave, quando: Date.now() };
    else if (!ultimoMelhor[melhor.tipo]) ultimoMelhor[melhor.tipo] = { chave, quando: 0 };
    if (Date.now() - ultimoMelhor[melhor.tipo].quando < 400) c.classList.add("swap");
    return c;
  }

  function linha(r, melhor) {
    const t = TIPOS[r.tipo];
    const li = el("li", "row");
    const esq = el("div");
    esq.appendChild(el("p", "nome", nomeDe(r)));
    esq.appendChild(el("p", "det", detalhe(r)));
    const dir = el("div", "dir");
    const v = el("p", "val", dinheiro(r.up));
    v.appendChild(el("small", "", "/" + t.abrev));
    dir.appendChild(v);
    // "% mais caro" = (preço por unidade base ÷ preço da melhor compra − 1) × 100, mínimo 1%
    const pct = Math.max(1, Math.round((r.up / melhor.up - 1) * 100));
    dir.appendChild(el("span", "selo", pct + "% mais caro"));
    li.appendChild(esq);
    li.appendChild(dir);
    return li;
  }

  function grupoResultado(arr, vario) {
    const sec = el("section", "grupo");
    if (vario) sec.appendChild(el("h3", "", TIPOS[arr[0].tipo].titulo));
    if (arr.length < 2) {
      sec.appendChild(el("p", "vazio-res", "Põe outra embalagem do mesmo produto pra comparar."));
      return sec;
    }
    arr.sort((a, b) => a.up - b.up);
    const melhor = arr[0];
    // Empate: diferença entre as duas mais baratas menor que 0,5%
    const empate = arr[1].up / melhor.up - 1 < 0.005;
    sec.appendChild(cartaoMelhor(arr, empate));

    // Flagra: a embalagem de maior quantidade total não é a melhor compra
    const maior = arr.reduce((m, r) => (r.total > m.total ? r : m), arr[0]);
    if (!empate && maior !== melhor && maior.up / melhor.up - 1 >= 0.005) {
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
    return sec;
  }

  function mostraResultado() {
    const box = $("#resultado");
    box.textContent = "";
    const validas = calcula(pkgs).filter((r) => r.ok);
    if (!validas.length) {
      box.appendChild(el("p", "vazio-res", "Preenche o preço e a quantidade de pelo menos duas embalagens. O resultado aparece aqui."));
      return;
    }
    const grupos = ["massa", "volume", "un"]
      .map((t) => validas.filter((r) => r.tipo === t))
      .filter((a) => a.length);
    const vario = grupos.length > 1;
    if (vario) box.appendChild(el("p", "nota", "Peso, volume e unidade não se misturam. Cada tipo foi comparado separado."));
    grupos.forEach((arr) => box.appendChild(grupoResultado(arr, vario)));
  }

  /* ---------- Histórico (só neste aparelho) ---------- */
  function lerHistorico() {
    try {
      const s = window.localStorage.getItem(CHAVE_HIST);
      const a = s ? JSON.parse(s) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function gravaHistorico() {
    try { window.localStorage.setItem(CHAVE_HIST, JSON.stringify(salvos)); return true; }
    catch (e) { return false; }
  }

  let avisoTimer = null;
  function aviso(texto) {
    const a = $("#aviso");
    clearTimeout(avisoTimer);
    a.textContent = texto;
    a.classList.toggle("on", !!texto);
    if (texto) avisoTimer = setTimeout(() => a.classList.remove("on"), 4500);
  }
  function atualizaSalvar() {
    $("#salva").textContent = editandoId ? "Atualiza consulta" : "Salva consulta";
    $("#salvaNova").hidden = !editandoId;
    $("#editando").hidden = !editandoId;
  }

  function fmtData(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const dinheiroTexto = (s) => (num(s) > 0 ? dinheiro(num(s)) : "sem valor");
  const qtdTexto = (p) => (num(p.qtd) > 0 ? fmtNum(num(p.qtd)) + " " + UNIDADES[p.unidade].rotulo : "sem valor");

  // Linhas "Alterado: ..." comparando a consulta antiga com a nova
  function mudancas(antigas, novas) {
    const out = [];
    novas.forEach((n, i) => {
      const o = antigas[i];
      if (!o) return;
      const partes = [];
      if (num(o.preco) !== num(n.preco) && !(isNaN(num(o.preco)) && isNaN(num(n.preco)))) {
        partes.push("preço " + dinheiroTexto(o.preco) + " para " + dinheiroTexto(n.preco));
      }
      if (num(o.qtd) !== num(n.qtd) && !(isNaN(num(o.qtd)) && isNaN(num(n.qtd))) || o.unidade !== n.unidade) {
        partes.push("quantidade " + qtdTexto(o) + " para " + qtdTexto(n));
      }
      if (partes.length) out.push("embalagem " + LETRAS[i] + ", " + partes.join("; "));
    });
    return out;
  }

  function melhorDoMomento(entrada) {
    const validas = calcula(entrada.pkgs).filter((r) => r.ok);
    const grupos = ["massa", "volume", "un"].map((t) => validas.filter((r) => r.tipo === t)).filter((a) => a.length >= 2);
    if (!grupos.length) return "Falta embalagem pra comparar";
    const arr = grupos[0].sort((a, b) => a.up - b.up);
    return "Melhor compra: " + nomeDe(arr[0]) + ", " + dinheiro(arr[0].up) + "/" + TIPOS[arr[0].tipo].abrev;
  }

  function renderHistorico() {
    const ul = $("#histLista");
    ul.textContent = "";
    const tem = salvos.length > 0;
    $("#histVazio").hidden = tem;
    $("#histApaga").hidden = !tem;
    salvos.slice()
      .sort((a, b) => String(b.atualizadoEm || b.criadoEm).localeCompare(String(a.atualizadoEm || a.criadoEm)))
      .forEach((e) => {
        const li = el("li", "hentry" + (e.id === editandoId ? " editando-item" : ""));
        li.dataset.id = e.id;
        li.appendChild(el("p", "h-titulo", e.produto || "Consulta sem nome"));
        if (e.estab) li.appendChild(el("p", "h-onde", e.estab));
        li.appendChild(el("p", "h-data", "Criada em " + fmtData(e.criadoEm)));
        if (e.atualizadoEm && e.atualizadoEm !== e.criadoEm) li.appendChild(el("p", "h-data", "Atualizada em " + fmtData(e.atualizadoEm)));
        li.appendChild(el("p", "h-melhor", melhorDoMomento(e)));
        (e.ultimasMudancas || []).forEach((t) => li.appendChild(el("p", "h-mudou", "Alterado: " + t)));
        const btns = el("div", "h-btns");
        const ed = el("button", "btn sec", "Edita valores"); ed.type = "button"; ed.dataset.acao = "edita";
        const ex = el("button", "btn sec", "Exclui"); ex.type = "button"; ex.dataset.acao = "exclui";
        btns.appendChild(ed); btns.appendChild(ex);
        li.appendChild(btns);
        ul.appendChild(li);
      });
    // sugestões de estabelecimento: só os já usados neste aparelho
    const dl = $("#estabs");
    dl.textContent = "";
    const vistos = {};
    salvos.forEach((e) => {
      const k = (e.estab || "").toLowerCase();
      if (!k || vistos[k]) return;
      vistos[k] = true;
      const o = document.createElement("option");
      o.value = e.estab;
      dl.appendChild(o);
    });
  }

  function salvar(comoNova) {
    const validas = calcula(pkgs).filter((r) => r.ok);
    if (!validas.length) {
      aviso("Preenche o preço e a quantidade de pelo menos uma embalagem pra salvar.");
      return;
    }
    const agora = new Date().toISOString();
    const foto = pkgs.map((p) => ({ preco: p.preco, qtd: p.qtd, unidade: p.unidade, itens: p.itens }));
    const produto = limpaTexto($("#produto").value);
    const estab = limpaTexto($("#estab").value);
    let entrada = null;
    if (editandoId && !comoNova) entrada = salvos.find((x) => x.id === editandoId) || null;
    let msg;
    if (entrada) {
      entrada.ultimasMudancas = mudancas(entrada.pkgs, foto);
      entrada.pkgs = foto;
      entrada.produto = produto;
      entrada.estab = estab;
      entrada.atualizadoEm = agora;
      msg = "Atualizou.";
    } else {
      entrada = { id: String(Date.now()), produto, estab, criadoEm: agora, atualizadoEm: agora, pkgs: foto, ultimasMudancas: [] };
      salvos.unshift(entrada);
      editandoId = entrada.id;
      msg = "Salvou no histórico.";
    }
    aviso(gravaHistorico() ? msg : "Não deu pra guardar o histórico neste navegador.");
    atualizaSalvar();
    renderHistorico();
  }

  function editar(id) {
    const e = salvos.find((x) => x.id === id);
    if (!e) return;
    pkgs = e.pkgs.map((p) => novaPkg(p));
    while (pkgs.length < MIN) pkgs.push(novaPkg());
    editandoId = id;
    $("#produto").value = e.produto || "";
    $("#estab").value = e.estab || "";
    montaCartoes();
    mostraResultado();
    atualizaSalvar();
    renderHistorico();
    aviso("");
    window.scrollTo(0, 0);
  }

  $("#salva").addEventListener("click", () => salvar(false));
  $("#salvaNova").addEventListener("click", () => salvar(true));
  $("#histLista").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    const li = e.target.closest(".hentry");
    if (!b || !li) return;
    const id = li.dataset.id;
    if (b.dataset.acao === "edita") {
      editar(id);
    } else if (b.dataset.acao === "exclui") {
      salvos = salvos.filter((x) => x.id !== id);
      if (editandoId === id) { editandoId = null; atualizaSalvar(); }
      gravaHistorico();
      renderHistorico();
    }
  });

  // "Apaga o histórico": confirma no segundo toque
  let armado = false, armaTimer = null;
  function desarma() { armado = false; $("#histApaga").textContent = "Apaga o histórico"; }
  $("#histApaga").addEventListener("click", function () {
    if (!armado) {
      armado = true;
      this.textContent = "Toca de novo pra apagar tudo";
      armaTimer = setTimeout(desarma, 4000);
      return;
    }
    clearTimeout(armaTimer);
    salvos = [];
    editandoId = null;
    gravaHistorico();
    aviso("");
    atualizaSalvar();
    renderHistorico();
    desarma();
  });

  /* ---------- Início ---------- */
  pkgs = [novaPkg(), novaPkg()];
  salvos = lerHistorico();
  atualizaSalvar();
  renderHistorico();
  montaCartoes();
  mostraResultado();
})();
