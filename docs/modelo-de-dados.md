# Modelo de dados do registro anônimo (Etapa 3, ainda não implementado)

Um documento novo por consulta salva, com somente estes campos:

```json
{
  "criado_em": "2026-11-18T14:30:00Z",
  "estabelecimento": "Atacadão Boa Vista",
  "estabelecimento_chave": "atacadao boa vista",
  "produto": "Leite em pó Camponesa",
  "produto_chave": "leite em po camponesa",
  "embalagens": [
    { "quantidade": 750, "unidade": "g", "itens": 1, "preco": 33.9 },
    { "quantidade": 200, "unidade": "g", "itens": 1, "preco": 7.0 }
  ]
}
```

- **Chave:** minúsculas, sem acentos, pontuação trocada por espaço, espaços colapsados ("Boa-Vista" = "Boa Vista").
- **Proibido gravar:** nome, e-mail, id de usuário ou de aparelho, IP, localização, cookies, fingerprint, analytics.
- **Texto livre:** até 80 caracteres; no estabelecimento recusar "@" e 8+ dígitos seguidos.
- **Envio:** só ao salvar a consulta, com produto e estabelecimento preenchidos e 2+ embalagens válidas. Sem retry em loop.
- **Segurança (Supabase):** escrita anônima só por `insert` em `registros`; leitura só para a equipe (RLS).
- Antes de lançar, atualizar o aviso de privacidade e consultar a LGPD.
