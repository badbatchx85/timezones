# Relógios Mundiais

App web leve para ver as horas em vários fusos e comparar horários ao agendar reuniões.

## Rodar

Por usar módulos ES, sirva via HTTP (não abra como `file://`):

```bash
python3 -m http.server 8000
# abra http://localhost:8000/
```

## Testes

Abra `http://localhost:8000/tests.html` no navegador.

## Como funciona

- Arquivo único + módulos JS, **sem dependências**.
- Fusos via API `Intl` nativa (base IANA do navegador).
- Favoritos e preferências em `localStorage`.
