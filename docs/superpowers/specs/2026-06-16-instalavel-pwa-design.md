# Instalável / PWA — Documento de Design

**Data:** 2026-06-16
**Status:** Aprovado para planejamento
**Projeto:** Relógios Mundiais / WORLD TIMETABLE (`~/Projects/Timezones`)

## Objetivo

Tornar o app **instalável** (PWA) e **funcional offline**: instalar como app a partir do navegador e abrir sem internet, servindo o shell estático do cache.

## Decisões principais

| Decisão | Escolha |
|---|---|
| Escopo | Instalável **+** offline (service worker) |
| Ícones | PNG gerados de um `icon.svg` via `qlmanage` (macOS), tema âmbar/preto do app |
| Estratégia | Precache do shell + cache-first; runtime-cache das Google Fonts |
| Atualização | Cache versionado; `activate` limpa caches antigos + `clients.claim()` |
| Persistência de dados | Inalterada (`localStorage`); independente do SW |

## Arquitetura

App estático servido por nginx (já containerizado). Adiciona-se a camada PWA por **progressive enhancement**: se o navegador não suportar service worker, o app funciona normalmente, só sem offline.

```
icon.svg                      ← fonte do ícone (âmbar sobre preto)
icons/
 ├─ icon-192.png              ← gerados de icon.svg via qlmanage/sips
 ├─ icon-512.png
 ├─ maskable-512.png
 └─ apple-touch-180.png
manifest.webmanifest          ← metadados de instalação
sw.js                         ← service worker (precache + offline + update)
index.html                    ← <link rel=manifest>, theme-color, apple-touch, registro do SW
Dockerfile                    ← passa a copiar manifest.webmanifest, sw.js, icons/
```

## Componentes

### `icon.svg` → ícones PNG
Motivo na identidade do app: placar âmbar (`#ffb300`) sobre preto (`#0a0a0a`), cantos arredondados (ex.: célula de flap com dígitos, ou relógio âmbar com glow). Gerar com:
```
qlmanage -t -s 512 -o icons icon.svg   # rasteriza; renomear/redimensionar com sips
sips -z 192 192 ... ; sips -z 180 180 ...
```
Saída: `icon-192.png`, `icon-512.png`, `maskable-512.png` (com margem de segurança p/ máscara), `apple-touch-180.png`.

### `manifest.webmanifest`
- `name`: "Relógios Mundiais" · `short_name`: "Timetable"
- `start_url`: "." · `scope`: "." · `display`: "standalone"
- `background_color`: "#0a0a0a" · `theme_color`: "#ffb300"
- `icons`: 192 e 512 (`purpose: "any"`) + maskable-512 (`purpose: "maskable"`)

### `sw.js`
- `CACHE = "rm-v1"` (versionado por deploy).
- **install:** precache do shell — `./`, `index.html`, `js/app.js`, `js/ui.js`, `js/tz.js`, `js/store.js`, `js/clock.js`, `manifest.webmanifest`, os 4 ícones. `self.skipWaiting()`. (Arquivos de teste — `tests.html`, `js/*.test.js`, `js/test-harness.js` — NÃO entram no shell.)
- **activate:** apaga caches cujo nome ≠ `CACHE`; `clients.claim()`.
- **fetch:**
  - Navegação (`request.mode === "navigate"`): tenta rede, cai pro `index.html` do cache offline.
  - Mesma origem (assets do shell): **cache-first** (responde do cache; senão busca e guarda).
  - Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`): runtime cache cache-first (guarda CSS e arquivos de fonte na 1ª visita; offline usa o cache ou cai no fallback do navegador).
  - Demais requisições: passa pela rede normalmente.

### `index.html`
- No `<head>`: `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color" content="#0a0a0a">`, `<link rel="apple-touch-icon" href="icons/apple-touch-180.png">`, `<link rel="icon" href="icons/icon-192.png">`.
- Registro do SW (após carregar): `if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});`

### `Dockerfile`
Acrescentar ao COPY: `manifest.webmanifest`, `sw.js`, `icon.svg` (opcional) e `icons/` para `/usr/share/nginx/html/`.

## Atualização (deploy novo)
Cada deploy que mude assets bumpa `CACHE` (`rm-v2`, …). No `activate`, caches antigos são removidos e `clients.claim()` assume as abas abertas; o usuário recebe a versão nova no próximo carregamento após o SW atualizar. Evita ficar preso em versão antiga.

## Casos de borda
- **Sem suporte a SW:** `register` falha em silêncio; app funciona (sem offline).
- **Offline sem fontes em cache:** navegador usa fallback (`system-ui`/`monospace`); app 100% funcional.
- **`localStorage`:** independente do SW; cidades/grupos/preferências inalterados.
- **Servir local via `python3 -m http.server`:** SW requer origem segura — `http://localhost` conta como seguro, então funciona em dev; em produção, atrás de HTTPS (reverse proxy) ou `http://IP` conforme política do navegador.

## Testes
- Service worker não cabe no harness de testes puros (`tz`/`store` seguem com seus 98 testes inalterados).
- Verificação manual via **Chrome DevTools**: Application → **Manifest** marcado como *installable*; **Service Workers** *activated*; **recarregar offline** (Network: Offline) e confirmar que o app abre e renderiza.

## Fora de escopo (YAGNI)
- Notificações push / background sync.
- Estratégia de cache sofisticada (stale-while-revalidate por rota) — cache-first simples basta.
- Tela de "nova versão disponível, recarregue" — atualização no próximo load é suficiente.
- Self-hosting das fontes (runtime cache resolve o offline).
