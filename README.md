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
- Favoritos, grupos e preferências em `localStorage` (por navegador/dispositivo).

## Deploy (Docker / Portainer)

App estático servido por nginx. Localmente:

```bash
docker compose up -d --build
# abra http://localhost:8080/
```

No **Portainer** (método *Git repository*):

1. Stacks → Add stack → **Git repository**.
2. Aponte para a URL deste repositório e `docker-compose.yml`.
3. Deploy — o Portainer faz o build do `Dockerfile` e publica em `:8080`.

Ajuste a porta no `docker-compose.yml` (`8080:80`) se necessário, ou coloque atrás de um reverse proxy (Traefik / Nginx Proxy Manager).
