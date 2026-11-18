# Clica e Compara

> Põe o preço e o tamanho de cada embalagem e vê qual compensa.

Comparador de **preço por embalagem do mesmo produto** (mesma prateleira). Embalagem maior nem sempre compensa: o app converte tudo para kg, litro ou unidade e mostra a melhor compra.

Exemplo: leite em pó 750 g por R$ 33,90 (R$ 45,20/kg) contra 200 g por R$ 7,00 (R$ 35,00/kg). A pequena compensa mais, e o app dá o "flagra".

**Etapa atual: protótipo para teste com o público.** Sem banco de dados, sem login e sem envio de nada. O histórico fica só no aparelho (`localStorage`).

## Como rodar

Não precisa instalar nada. Abra `index.html` no navegador.

Para testar como PWA (instalar na tela inicial), sirva por HTTP:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

## Publicar

- **Netlify / GitHub Pages / Cloudflare Pages:** publique a pasta raiz como site estático (sem build).
- **Artefato do Claude:** `python3 scripts/build_artifact.py` gera `dist/clica-e-compara.artifact.html` (arquivo único).
- Ao alterar `index.html`, `style.css` ou `app.js`, aumente `VERSION` em `sw.js` para os aparelhos receberem a atualização.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html`, `style.css`, `app.js` | O app (HTML, CSS e JavaScript puros) |
| `manifest.webmanifest`, `sw.js`, `pwa.js` | PWA: instalar e abrir sem internet |
| `icons/` | Ícones do app |
| `assets/brand/` | Símbolo da marca (PNG nas 4 cores e SVG) |
| `docs/` | Marca, roadmap e modelo de dados futuro |
| `scripts/` | Build do artefato, geração de ícones e teste automático |

## Testes

```bash
npm i -D playwright && npx playwright install chromium
node scripts/test.js index.html
```

Cobre o exemplo do leite, a máscara de preço, empate, tipos misturados, fardos, histórico e largura de 360 px.

## Regras do produto

- Compara só embalagens do mesmo produto. Nunca compara lojas.
- Tipos separados: massa (kg), volume (L), unidade.
- Empate quando a diferença entre as duas mais baratas é menor que 0,5%.
- Nenhum dado pessoal é coletado.

## Marca

Identidade em `docs/marca.md` e no manual (`docs/Manual_de_Marca_Clica_e_Compara_2026.docx`). Azul Cobalto `#143A8C`, Coral `#E85D40`, Fundo Claro `#F7F9FD`; JetBrains Mono e Manrope.

## Licença

Todos os direitos reservados, até o autor escolher uma licença.

Uma empresa do Grupo Clix.
