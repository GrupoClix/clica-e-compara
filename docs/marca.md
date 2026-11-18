# Marca (resumo de implementação)

Fonte completa: `Manual_de_Marca_Clica_e_Compara_2026.docx`.

## Cores
| Token | Hex | Uso |
|---|---|---|
| `--azul-cobalto` | #143A8C | wordmark, símbolo, botão primário, cartão da melhor compra, foco |
| `--coral` | #E85D40 | só alerta ("flagra", selo "% mais caro"). Nunca texto nem botão primário. Texto sobre coral é `--tinta` |
| `--fundo-claro` | #F7F9FD | fundo da página |
| `--branco` | #FFFFFF | cartões e campos |
| `--tinta` / `--tinta-suave` | #0B1210 / #4A525E | texto |
| `--linha` | #E4E9F5 | divisórias |

Apenas tema claro.

## Tipografia
JetBrains Mono: wordmark (caixa-alta, 700), preços, números. Manrope: o resto.

## Símbolo
Check assimétrico, SVG oficial em `assets/brand/` (azul, branco, coral, preto e mono com `currentColor`; viewBox 0 0 1000 1000). No app, o símbolo está recortado com viewBox `190 190 680 550`. Cores permitidas: azul, branco, coral, preto. Mínimo 16 px. É o único check da interface.

## Voz
Informal, imperativo ("Põe", "Vê", "Salva"). Sem "Clique", sem emojis, no máximo uma exclamação por tela. O "flagra" é o momento de maior energia.

## Selo do grupo
"Uma empresa do Grupo Clix": só no rodapé, em texto, sem logo nem link.
