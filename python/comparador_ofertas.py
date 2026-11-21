#!/usr/bin/env python3
"""Clica e Compara Ofertas, em Python, para estudar.

Esta é a mesma lógica da versão de teste em JavaScript (variantes/oferta/app.js),
escrita de forma didática. Não precisa instalar nada: só o Python 3.9 ou mais novo.

Como usar:
    python3 comparador_ofertas.py --exemplo    mostra o exemplo do sabão (OMO x Becker)
    python3 comparador_ofertas.py              modo interativo: o programa pergunta tudo
    python3 comparador_ofertas.py --testes     roda os testes automáticos

Como ler este arquivo (de cima pra baixo):
    1. Formatação:  como mostrar dinheiro e números no padrão brasileiro
    2. Dados:       a classe Oferta (o que a pessoa digita) e Resultado (o que calculamos)
    3. Cálculo:     promoção, preço efetivo, preço por kg/litro e preço por uso
    4. Comparação:  ranking, empate, "flagra" e "% mais caro"
    5. Texto:       o que aparece na tela e o texto do "Copia a oferta"
    6. Programa:    exemplo, modo interativo e testes
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

# ----------------------------------------------------------------------------
# 1. FORMATAÇÃO (padrão brasileiro)
# ----------------------------------------------------------------------------


def arredondar(valor: float, casas: int) -> Decimal:
    """Arredonda como a gente aprende na escola: 0,5 sobe (half up).

    O round() do Python usa outra regra (arredonda para o par mais próximo),
    então usamos Decimal para o resultado ficar igual ao do app.
    """
    return Decimal(repr(valor)).quantize(Decimal(1).scaleb(-casas), rounding=ROUND_HALF_UP)


def dinheiro(valor: float) -> str:
    """R$ 1.234,56. Abaixo de R$ 1,00 mostra 3 casas (R$ 0,332), porque os centavos
    sozinhos esconderiam a diferença entre ofertas baratas."""
    casas = 3 if valor < 1 else 2
    texto = f"{arredondar(valor, casas):,.{casas}f}"       # 1,234.56
    texto = texto.replace(",", "X").replace(".", ",").replace("X", ".")  # 1.234,56
    return "R$ " + texto


def fmt_num(valor: float) -> str:
    """Número com até 3 casas, sem zeros sobrando: 5 -> '5', 0.75 -> '0,75'."""
    texto = f"{arredondar(valor, 3):f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def ler_numero(texto: str) -> Optional[float]:
    """Converte o que a pessoa digitou em número. Aceita '33,90', '1.234,50' e '7.5'.

    Devolve None quando não dá para entender (o app trata como campo vazio).
    """
    texto = texto.strip().replace(" ", "")
    if not texto:
        return None
    if "," in texto:                       # vírgula é decimal; pontos são milhar
        texto = texto.replace(".", "").replace(",", ".")
    elif texto.count(".") >= 1 and all(len(p) == 3 for p in texto.split(".")[1:]) and 1 <= len(texto.split(".")[0]) <= 3:
        texto = texto.replace(".", "")     # '1.500' = mil e quinhentos
    try:
        return float(texto)
    except ValueError:
        return None


# ----------------------------------------------------------------------------
# 2. DADOS
# ----------------------------------------------------------------------------

# Cada unidade pertence a um tipo e tem um fator para a unidade base (kg, litro, unidade).
# Exemplo: 500 g = 500 x 0,001 = 0,5 kg.
UNIDADES = {
    "g":  ("massa", 0.001, "g"),
    "kg": ("massa", 1.0, "kg"),
    "ml": ("volume", 0.001, "ml"),
    "L":  ("volume", 1.0, "L"),
    "un": ("un", 1.0, "unid."),
}

# Como cada tipo aparece nas frases. 'cem' é o divisor do preço "por 100 g / 100 ml".
TIPOS = {
    "massa":  {"titulo": "Peso",    "por": "kg",      "abrev": "kg",    "cem": 10, "rotulo_cem": "100 g"},
    "volume": {"titulo": "Volume",  "por": "litro",   "abrev": "L",     "cem": 10, "rotulo_cem": "100 ml"},
    "un":     {"titulo": "Unidade", "por": "unidade", "abrev": "unid.", "cem": 0,  "rotulo_cem": ""},
}


@dataclass
class Oferta:
    """O que a pessoa digita em cada cartão. Só preço e quantidade são obrigatórios."""
    preco: float                      # preço da embalagem, em reais
    quantidade: float                 # quanto vem na embalagem (ex.: 3 para 3 L)
    unidade: str = "g"                # g, kg, ml, L ou un
    nome: str = ""                    # marca ou nome (opcional)
    loja: str = ""                    # loja (opcional)
    itens: int = 1                    # embalagens iguais juntas (fardo de 6 latas = 6)
    usos: Optional[float] = None      # quantos usos rende (ex.: 40 lavagens)
    promo: str = ""                   # "", "lp" (leve X, pague Y) ou "seg" (desconto na 2ª unidade)
    leve: Optional[int] = None
    pague: Optional[int] = None
    seg: Optional[float] = None       # % de desconto na 2ª unidade
    desc: Optional[float] = None      # % de desconto extra (cartão da loja)
    cash: Optional[float] = None      # cashback em reais, por embalagem


@dataclass
class Resultado:
    """O que calculamos para cada oferta."""
    letra: str
    oferta: Oferta
    valida: bool
    efetivo: float = 0.0              # preço da embalagem depois da promoção
    promo_texto: str = ""             # descrição da promoção aplicada
    erro_promo: str = ""              # mensagem quando a promoção é inválida
    tipo: str = ""                    # massa, volume ou un
    total: float = 0.0                # quantidade total na unidade base (kg, L, unid.)
    por_base: float = 0.0             # preço por kg / litro / unidade
    ref: float = 0.0                  # valor usado para comparar (por base ou por uso)


# ----------------------------------------------------------------------------
# 3. CÁLCULO
# ----------------------------------------------------------------------------


def aplicar_promocao(o: Oferta) -> tuple[float, float, str, str]:
    """Calcula o efeito da promoção. Devolve (fator, cashback, texto, erro).

    Preço efetivo da embalagem = preço x fator - cashback

    - Leve X, pague Y:       fator x (Y / X).             Ex.: leve 3, pague 2 -> x 0,6667
    - 2ª unidade com D% off: fator x (1 - D / 200).       Comprando duas, a média cai D/2 %
    - Desconto extra E%:     fator x (1 - E / 100).
    - Cashback C:            tira C reais de cada embalagem.

    Promoção inválida é ignorada (fator 1, sem cashback) e volta uma mensagem de erro.
    """
    fator, cash, textos, erro = 1.0, 0.0, [], ""

    if o.promo == "lp" and (o.leve is not None or o.pague is not None):
        leve, pague = o.leve, o.pague
        if leve is not None and pague is not None and leve >= 2 and 1 <= pague < leve:
            fator *= pague / leve
            textos.append(f"Leve {leve}, pague {pague}")
        else:
            erro = erro or "Pra valer, leve precisa ser maior que pague. Ex.: leve 3, pague 2."
    elif o.promo == "seg" and o.seg is not None:
        if 0 < o.seg <= 100:
            fator *= 1 - o.seg / 200
            textos.append(f"{fmt_num(o.seg)}% na 2ª unidade, comprando 2")
        else:
            erro = erro or "O desconto da 2ª unidade tem que ficar entre 0 e 100%."

    if o.desc is not None:
        if 0 < o.desc < 100:
            fator *= 1 - o.desc / 100
            textos.append(f"{fmt_num(o.desc)}% de desconto extra")
        else:
            erro = erro or "O desconto extra tem que ficar entre 0 e 100%."

    if o.cash is not None:
        if 0 < o.cash and (o.preco <= 0 or o.preco * fator - o.cash > 0):
            cash = o.cash
            textos.append(f"{dinheiro(o.cash)} de cashback")
        else:
            erro = erro or "O cashback precisa ser maior que zero e menor que o preço."

    if erro:                                    # promoção inválida: ignora tudo
        return 1.0, 0.0, "", erro
    return fator, cash, " + ".join(textos), ""


def calcular(ofertas: list[Oferta]) -> list[Resultado]:
    """Para cada oferta: valida, aplica a promoção e converte para a unidade base."""
    letras = "ABCDEFGH"
    resultados = []
    for i, o in enumerate(ofertas):
        tipo, fator_unidade, _ = UNIDADES[o.unidade]
        valida = o.preco > 0 and o.quantidade > 0 and o.itens >= 1
        r = Resultado(letra=letras[i], oferta=o, valida=valida, tipo=tipo)
        if valida:
            fator, cash, texto, erro = aplicar_promocao(o)
            r.erro_promo = erro
            r.promo_texto = texto
            r.efetivo = max(o.preco * fator - cash, 0.01)
            # preço por unidade base = preço efetivo / (quantidade x itens x fator da unidade)
            r.total = o.quantidade * o.itens * fator_unidade
            r.por_base = r.efetivo / r.total
        resultados.append(r)
    return resultados


# ----------------------------------------------------------------------------
# 4. COMPARAÇÃO
# ----------------------------------------------------------------------------


@dataclass
class Grupo:
    """Um grupo de ofertas do mesmo tipo (peso, volume ou unidade), já em ordem."""
    tipo: str
    ranking: list[Resultado]          # da mais barata para a mais cara
    modo: str                         # "base" (por kg/L/unid.) ou "uso" (por lavagem etc.)
    empate: bool
    flagra: bool
    nome_uso: str = "uso"
    avisos: list[str] = field(default_factory=list)


def comparar(resultados: list[Resultado], nome_uso: str = "uso") -> list[Grupo]:
    """Separa por tipo (não dá pra comparar kg com litro) e monta o ranking de cada grupo."""
    grupos = []
    validas = [r for r in resultados if r.valida]
    for tipo in ("massa", "volume", "un"):
        arr = [r for r in validas if r.tipo == tipo]
        if len(arr) < 2:
            continue                  # com uma só oferta não há o que comparar
        grupo = montar_grupo(tipo, arr, nome_uso)
        grupos.append(grupo)
    return grupos


def montar_grupo(tipo: str, arr: list[Resultado], nome_uso: str) -> Grupo:
    # Compara por uso só quando TODAS as ofertas do grupo dizem quantos usos rendem.
    # Senão estaríamos comparando coisas diferentes.
    por_uso = all(r.oferta.usos and r.oferta.usos > 0 for r in arr)
    modo = "uso" if por_uso else "base"
    for r in arr:
        r.ref = r.efetivo / r.oferta.usos if por_uso else r.por_base
    arr.sort(key=lambda r: r.ref)

    melhor = arr[0]
    # Empate: a diferença entre as duas mais baratas é menor que 0,5%
    empate = arr[1].ref / melhor.ref - 1 < 0.005
    # Flagra: a embalagem de maior quantidade total NÃO é a melhor compra
    maior = max(arr, key=lambda r: r.total)
    flagra = (not empate) and maior is not melhor and maior.ref / melhor.ref - 1 >= 0.005

    avisos = []
    if not por_uso and any(r.oferta.usos for r in arr):
        avisos.append(f"Põe os usos de todas as ofertas pra comparar por {nome_uso}.")
    return Grupo(tipo, arr, modo, empate, flagra, nome_uso, avisos)


def pct_mais_caro(r: Resultado, melhor: Resultado) -> int:
    """% mais caro = (valor da oferta / valor da melhor - 1) x 100, no mínimo 1%."""
    return max(1, int(arredondar((r.ref / melhor.ref - 1) * 100, 0)))


# ----------------------------------------------------------------------------
# 5. TEXTO
# ----------------------------------------------------------------------------


def texto_qtd(r: Resultado) -> str:
    o = r.oferta
    rotulo = UNIDADES[o.unidade][2]
    return f"{fmt_num(o.quantidade)} {rotulo}" + (f" x {o.itens}" if o.itens > 1 else "")


def nome_de(r: Resultado) -> str:
    """'Becker, 5 L'. Sem marca, vira 'Oferta A, 5 L'."""
    return f"{r.oferta.nome or 'Oferta ' + r.letra}, {texto_qtd(r)}"


def nome_com_loja(r: Resultado) -> str:
    return nome_de(r) + (f" ({r.oferta.loja})" if r.oferta.loja else "")


def contexto(g: Grupo) -> tuple[str, str]:
    """Devolve (palavra da frase, abreviação do preço): ('litro', 'L') ou ('lavagem', 'lavagem')."""
    t = TIPOS[g.tipo]
    return (g.nome_uso, g.nome_uso) if g.modo == "uso" else (t["por"], t["abrev"])


def detalhe(r: Resultado, g: Grupo) -> str:
    t = TIPOS[r.tipo]
    partes = [f"{texto_qtd(r)} por {dinheiro(r.oferta.preco)}."]
    if r.promo_texto:
        partes.append(f"{r.promo_texto}: cada uma sai {dinheiro(r.efetivo)}.")
    if r.oferta.usos:
        if g.modo == "uso":
            partes.append(f"{dinheiro(r.por_base)} por {t['abrev']}.")
        else:
            partes.append(f"{dinheiro(r.efetivo / r.oferta.usos)} por {g.nome_uso}.")
    if t["cem"]:
        partes.append(f"{dinheiro(r.por_base / t['cem'])} por {t['rotulo_cem']}.")
    return " ".join(partes)


def mostrar_resultado(grupos: list[Grupo]) -> str:
    """O resultado como aparece na tela (versão texto)."""
    if not grupos:
        return "Preenche o preço e a quantidade de pelo menos duas ofertas. O resultado aparece aqui."
    linhas = []
    if len(grupos) > 1:
        linhas.append("Peso, volume e unidade não se misturam. Cada tipo foi comparado separado.\n")
    for g in grupos:
        por, abrev = contexto(g)
        melhor, pior = g.ranking[0], g.ranking[-1]
        if len(grupos) > 1:
            linhas.append(f"== {TIPOS[g.tipo]['titulo']} ==")
        linhas += g.avisos
        if g.empate:
            linhas.append(f"EMPATE: {nome_de(melhor)} e {nome_de(g.ranking[1])}")
            linhas.append(f"  {dinheiro(melhor.ref)}/{abrev}")
            linhas.append(f"  O preço por {por} é praticamente o mesmo. Leva a que for mais útil.")
        else:
            linhas.append(f"MELHOR COMPRA: {nome_de(melhor)}" + (f" ({melhor.oferta.loja})" if melhor.oferta.loja else ""))
            linhas.append(f"  {dinheiro(melhor.ref)}/{abrev}")
            linhas.append(f"  {dinheiro(pior.ref - melhor.ref)} a menos por {por} que a mais cara")
            linhas.append(f"  {detalhe(melhor, g)}")
        if g.flagra:
            linhas.append(f"FLAGRA: a embalagem maior sai mais cara por {por}.")
        for r in g.ranking[2 if g.empate else 1:]:
            linhas.append(f"- {nome_de(r)}" + (f" ({r.oferta.loja})" if r.oferta.loja else ""))
            linhas.append(f"    {dinheiro(r.ref)}/{abrev}, {pct_mais_caro(r, melhor)}% mais caro")
            linhas.append(f"    {detalhe(r, g)}")
        linhas.append("")
    return "\n".join(linhas).rstrip()


def texto_para_copiar(grupos: list[Grupo], produto: str = "") -> str:
    """O texto curto do botão "Copia a oferta", sem emoji, pra colar no WhatsApp."""
    linhas = ["Clica e Compara" + (f": {produto}" if produto else "")]
    for g in grupos:
        por, abrev = contexto(g)
        melhor = g.ranking[0]
        if g.empate:
            linhas.append(f"Empate: {nome_com_loja(melhor)} e {nome_com_loja(g.ranking[1])}, a {dinheiro(melhor.ref)}/{abrev}")
            continue
        linhas.append(f"Melhor compra: {nome_com_loja(melhor)}, a {dinheiro(melhor.ref)}/{abrev}")
        if melhor.promo_texto:
            linhas.append(f"(com promoção: {melhor.promo_texto})")
        for r in g.ranking[1:]:
            linhas.append(f"{nome_com_loja(r)}: {dinheiro(r.ref)}/{abrev}, {pct_mais_caro(r, melhor)}% mais caro")
        if g.flagra:
            linhas.append(f"Flagra: a embalagem maior sai mais cara por {por}.")
    linhas.append("Compara só o preço, não a qualidade.")
    return "\n".join(linhas)


# ----------------------------------------------------------------------------
# 6. PROGRAMA
# ----------------------------------------------------------------------------


def exemplo() -> tuple[list[Oferta], str, str]:
    """O exemplo do sabão que o amigo sugeriu: OMO 3 L a R$ 19,90 x Becker 5 L a R$ 29,90."""
    ofertas = [
        Oferta(preco=19.90, quantidade=3, unidade="L", nome="OMO", loja="Pão de Açúcar"),
        Oferta(preco=29.90, quantidade=5, unidade="L", nome="Becker", loja="Mercado do bairro"),
    ]
    return ofertas, "Sabão líquido", "lavagem"


def rodar(ofertas: list[Oferta], produto: str = "", nome_uso: str = "uso") -> None:
    grupos = comparar(calcular(ofertas), nome_uso)
    print(mostrar_resultado(grupos))
    if grupos:
        print("\n--- Texto pra colar no grupo ---")
        print(texto_para_copiar(grupos, produto))


def perguntar(texto: str, padrao: str = "") -> str:
    resposta = input(texto + (f" [{padrao}]" if padrao else "") + ": ").strip()
    return resposta or padrao


def perguntar_numero(texto: str, obrigatorio: bool = False) -> Optional[float]:
    while True:
        valor = ler_numero(input(texto + ": "))
        if valor is not None or not obrigatorio:
            return valor
        print("  Põe um número, tipo 33,90.")


def modo_interativo() -> None:
    print("Clica e Compara Ofertas. Deixa em branco o que não quiser preencher.\n")
    produto = perguntar("O que tá comparando? (ex.: sabão líquido)")
    nome_uso = perguntar("Como medir o uso? (ex.: lavagem; Enter pula)", "uso").lower()
    ofertas: list[Oferta] = []
    while len(ofertas) < 8:
        print(f"\n--- Oferta {'ABCDEFGH'[len(ofertas)]} ---")
        nome = perguntar("Marca ou nome")
        loja = perguntar("Loja")
        preco = perguntar_numero("Preço (R$)", obrigatorio=True)
        quantidade = perguntar_numero("Quantidade", obrigatorio=True)
        unidade = perguntar("Unidade (g, kg, ml, L, un)", "g")
        while unidade not in UNIDADES:
            unidade = perguntar("Unidade inválida. Escolhe g, kg, ml, L ou un")
        itens = int(perguntar_numero("Número de itens iguais (Enter = 1)") or 1)
        usos = perguntar_numero(f"Quantos usos rende, em {nome_uso}? (Enter pula)")
        promo = perguntar("Promoção: n = nenhuma, lp = leve/pague, seg = 2ª unidade", "n")
        o = Oferta(preco, quantidade, unidade, nome, loja, itens, usos)
        if promo == "lp":
            o.promo = "lp"
            leve, pague = perguntar_numero("Leve quantas?"), perguntar_numero("Pague quantas?")
            o.leve = int(leve) if leve else None
            o.pague = int(pague) if pague else None
        elif promo == "seg":
            o.promo, o.seg = "seg", perguntar_numero("Desconto na 2ª unidade (%)")
        o.desc = perguntar_numero("Desconto extra de cartão (%) (Enter pula)")
        o.cash = perguntar_numero("Cashback por embalagem (R$) (Enter pula)")
        ofertas.append(o)
        if len(ofertas) >= 2 and perguntar("Mais uma oferta? (s/n)", "n").lower() != "s":
            break
    print("\n" + "=" * 40)
    rodar(ofertas, produto, nome_uso)


def testes() -> None:
    """Testes automáticos. Cada 'assert' é uma afirmação: se for falsa, o programa para."""

    def melhor_de(ofertas, nome_uso="uso"):
        return comparar(calcular(ofertas), nome_uso)[0]

    # Formatação
    assert dinheiro(1234.5) == "R$ 1.234,50"
    assert dinheiro(0.6633) == "R$ 0,663"                      # abaixo de R$ 1: 3 casas
    assert ler_numero("1.234,50") == 1234.5 and ler_numero("33,9") == 33.9 and ler_numero("1.500") == 1500
    assert ler_numero("") is None and ler_numero("abc") is None

    # Exemplo do sabão: o Becker 5 L compensa mais por litro
    ofertas, produto, uso = exemplo()
    g = melhor_de(ofertas, uso)
    assert g.ranking[0].oferta.nome == "Becker" and not g.flagra
    assert dinheiro(g.ranking[0].ref) == "R$ 5,98" and dinheiro(g.ranking[1].ref) == "R$ 6,63"
    assert pct_mais_caro(g.ranking[1], g.ranking[0]) == 11
    assert dinheiro(g.ranking[1].ref - g.ranking[0].ref) == "R$ 0,653"

    # Leve 3, pague 2 na OMO: 19,90 x 2/3 = R$ 13,27 por embalagem = R$ 4,42/L, e dá flagra
    ofertas, _, _ = exemplo()
    ofertas[0].promo, ofertas[0].leve, ofertas[0].pague = "lp", 3, 2
    g = melhor_de(ofertas)
    assert g.ranking[0].oferta.nome == "OMO" and dinheiro(g.ranking[0].ref) == "R$ 4,42" and g.flagra
    assert dinheiro(g.ranking[0].efetivo) == "R$ 13,27"

    # Promoção inválida (leve 2, pague 3) é ignorada
    ofertas, _, _ = exemplo()
    ofertas[0].promo, ofertas[0].leve, ofertas[0].pague = "lp", 2, 3
    assert dinheiro(melhor_de(ofertas).ranking[1].ref) == "R$ 6,63"

    # 2ª unidade com 40%: média = 1 - 0,40/2 = 0,8 -> R$ 15,92 -> R$ 5,31/L
    ofertas, _, _ = exemplo()
    ofertas[0].promo, ofertas[0].seg = "seg", 40
    assert dinheiro(melhor_de(ofertas).ranking[0].ref) == "R$ 5,31"

    # Desconto extra de 10% no Becker: R$ 26,91 -> R$ 5,38/L
    ofertas, _, _ = exemplo()
    ofertas[1].desc = 10
    assert dinheiro(melhor_de(ofertas).ranking[0].ref) == "R$ 5,38"

    # Cashback de R$ 3 na OMO: R$ 16,90 -> R$ 5,63/L. Cashback maior que o preço é ignorado.
    ofertas, _, _ = exemplo()
    ofertas[0].cash = 3
    assert dinheiro(melhor_de(ofertas).ranking[0].ref) == "R$ 5,63"
    ofertas[0].cash = 25
    assert dinheiro(melhor_de(ofertas).ranking[1].ref) == "R$ 6,63"

    # Preço por uso: OMO rende 60 lavagens e Becker 50 -> a OMO vira a melhor
    ofertas, _, _ = exemplo()
    ofertas[0].usos, ofertas[1].usos = 60, 50
    g = melhor_de(ofertas, "lavagem")
    assert g.modo == "uso" and g.ranking[0].oferta.nome == "OMO"
    assert dinheiro(g.ranking[0].ref) == "R$ 0,332" and dinheiro(g.ranking[1].ref) == "R$ 0,598"
    assert pct_mais_caro(g.ranking[1], g.ranking[0]) == 80
    # Só uma oferta com usos: compara por litro e avisa
    ofertas[1].usos = None
    g = melhor_de(ofertas, "lavagem")
    assert g.modo == "base" and g.avisos

    # Empate: R$ 10 por 1 kg x R$ 5 por 500 g
    g = melhor_de([Oferta(10, 1, "kg"), Oferta(5, 500, "g")])
    assert g.empate

    # Fardo: 6 latas de 350 ml por R$ 12,60 = R$ 6,00/L
    g = melhor_de([Oferta(12.60, 350, "ml", itens=6), Oferta(7.50, 1, "L")])
    assert dinheiro(g.ranking[0].ref) == "R$ 6,00"

    # Tipos misturados ficam em grupos separados
    assert len(comparar(calcular([Oferta(10, 1, "kg"), Oferta(5, 1, "L")]))) == 0   # um de cada: nada a comparar
    assert len(comparar(calcular([Oferta(10, 1, "kg"), Oferta(5, 1, "L"), Oferta(9, 1, "kg")]))) == 1

    # Texto pra copiar
    ofertas, produto, uso = exemplo()
    texto = texto_para_copiar(comparar(calcular(ofertas), uso), produto)
    assert texto.startswith("Clica e Compara: Sabão líquido")
    assert "Melhor compra: Becker, 5 L (Mercado do bairro), a R$ 5,98/L" in texto
    assert "OMO, 3 L (Pão de Açúcar): R$ 6,63/L, 11% mais caro" in texto
    print("Todos os testes passaram.")


if __name__ == "__main__":
    if "--testes" in sys.argv:
        testes()
    elif "--exemplo" in sys.argv:
        rodar(*exemplo())
    else:
        modo_interativo()
