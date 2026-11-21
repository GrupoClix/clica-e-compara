#!/usr/bin/env python3
"""Gera dist/clica-e-compara.artifact.html: o app inteiro em um único arquivo,
no formato que o Artifact do Claude espera (sem <html>/<head>/<body>).

Uso (na raiz do projeto):  python3 scripts/build_artifact.py
"""
import pathlib
import re
import sys

raiz = pathlib.Path(__file__).resolve().parent.parent
# Sem argumento gera o app principal; com argumento gera uma variante (ex.: variantes/oferta)
pasta = raiz / (sys.argv[1] if len(sys.argv) > 1 else ".")
html = (pasta / "index.html").read_text(encoding="utf-8")
css = (pasta / "style.css").read_text(encoding="utf-8")
js = (pasta / "app.js").read_text(encoding="utf-8")

titulo = re.search(r"<title>(.*?)</title>", html).group(1)
corpo = re.search(r"<!--APP-START-->(.*?)<!--APP-END-->", html, re.S).group(1).strip()
fontes = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', html).group(1)

saida = f"""<title>{titulo}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="{fontes}">
<style>
{css}
</style>
{corpo}
<script>
{js}
</script>
"""
destino = raiz / "dist" / ("clica-e-compara.artifact.html" if pasta == raiz else f"clica-e-compara-{pasta.name}.artifact.html")
destino.parent.mkdir(exist_ok=True)
destino.write_text(saida, encoding="utf-8")
print(f"Gerado {destino} ({len(saida)/1024:.1f} KB)")
