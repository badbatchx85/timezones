# Instalável / PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o Relógios Mundiais instalável (PWA) e funcional offline, servindo o shell estático a partir de um service worker.

**Architecture:** Camada PWA por progressive enhancement sobre o app estático existente: um `manifest.webmanifest` torna instalável; um `sw.js` faz precache do shell (cache-first) e runtime-cache das Google Fonts; ícones PNG são gerados de um `icon.svg` com ferramentas nativas do macOS (`qlmanage`/`sips`). Nada quebra se o navegador não suportar service worker.

**Tech Stack:** HTML/CSS/JS vanilla, Web App Manifest, Service Worker API, Cache Storage API. Geração de ícones com `qlmanage` + `sips` (macOS). Verificação via Chrome DevTools MCP.

---

## Estrutura de arquivos

- `icon.svg` — **criar**: fonte do ícone (relógio âmbar sobre preto).
- `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `icons/apple-touch-180.png` — **gerar** de `icon.svg`.
- `manifest.webmanifest` — **criar**: metadados de instalação.
- `sw.js` — **criar**: service worker (precache + offline + update).
- `index.html` — **modificar**: links de manifest/ícones/theme-color + registro do SW.
- `Dockerfile` — **modificar**: copiar os novos assets para o webroot.

> Não há testes unitários para SW/manifest (não cabem no harness puro). Os 98 testes de `tz`/`store` permanecem inalterados; rode-os ao final para confirmar que nada regrediu. Verificação principal é no navegador (Chrome DevTools).

---

## Task 1: Ícone (icon.svg → PNGs)

**Files:**
- Create: `icon.svg`
- Create: `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `icons/apple-touch-180.png`

- [ ] **Step 1: Criar `icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0a0a"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#ffb300" stroke-width="26"/>
  <line x1="256" y1="256" x2="256" y2="150" stroke="#ffb300" stroke-width="22" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="338" y2="296" stroke="#ffb300" stroke-width="22" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="16" fill="#0a0a0a"/>
</svg>
```

- [ ] **Step 2: Gerar os PNGs** (macOS: `qlmanage` rasteriza SVG; `sips` redimensiona)

Run:
```bash
cd /Users/affonsofranco/Projects/Timezones
mkdir -p icons
qlmanage -t -s 512 -o icons icon.svg >/dev/null 2>&1
# qlmanage gera icons/icon.svg.png — redimensiona para os tamanhos finais:
sips -z 512 512 icons/icon.svg.png --out icons/icon-512.png >/dev/null
sips -z 512 512 icons/icon.svg.png --out icons/maskable-512.png >/dev/null
sips -z 192 192 icons/icon.svg.png --out icons/icon-192.png >/dev/null
sips -z 180 180 icons/icon.svg.png --out icons/apple-touch-180.png >/dev/null
rm -f icons/icon.svg.png
ls -1 icons/
```
Expected: lista mostra `apple-touch-180.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png`.

- [ ] **Step 3: Conferir visualmente o ícone**

Use a ferramenta Read no arquivo `icons/icon-512.png` e confirme que aparece um **relógio âmbar (anel + 2 ponteiros) sobre fundo preto arredondado**. Se o `qlmanage` tiver falhado (PNG em branco/transparente), reporte BLOCKED com o que viu — não prossiga com ícone quebrado.

- [ ] **Step 4: Commit**

```bash
git add icon.svg icons/
git commit -m "feat(pwa): app icon (amber clock) + generated PNG sizes"
```

---

## Task 2: manifest.webmanifest

**Files:**
- Create: `manifest.webmanifest`

- [ ] **Step 1: Criar `manifest.webmanifest`**

```json
{
  "name": "Relógios Mundiais",
  "short_name": "Timetable",
  "description": "Painel de fusos horários — veja as horas pelo mundo e compare horários.",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#ffb300",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Validar JSON**

Run: `python3 -c "import json; json.load(open('manifest.webmanifest')); print('JSON ok')"`
Expected: `JSON ok`

- [ ] **Step 3: Commit**

```bash
git add manifest.webmanifest
git commit -m "feat(pwa): web app manifest"
```

---

## Task 3: sw.js (service worker)

**Files:**
- Create: `sw.js`

- [ ] **Step 1: Criar `sw.js`**

```javascript
const CACHE = "rm-v1";
const SHELL = [
  "./",
  "index.html",
  "js/app.js",
  "js/ui.js",
  "js/tz.js",
  "js/store.js",
  "js/clock.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-180.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navegação → rede; offline cai no index.html cacheado.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("index.html")));
    return;
  }

  // Google Fonts → cache-first em runtime.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        try { const res = await fetch(req); c.put(req, res.clone()); return res; }
        catch { return hit || Response.error(); }
      })
    );
    return;
  }

  // Mesma origem → cache-first.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit =>
        hit || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        }).catch(() => hit)
      )
    );
    return;
  }
  // Demais: deixa passar pela rede (sem respondWith).
});
```

- [ ] **Step 2: Sanidade de sintaxe**

Run: `node --check sw.js && echo "sintaxe ok"`
Expected: `sintaxe ok` (sw.js não usa import/export, então `node --check` valida sem ressalvas).

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat(pwa): service worker (precache shell, offline, font runtime-cache)"
```

---

## Task 4: index.html — links + registro do SW, e verificação no navegador

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Adicionar os links no `<head>`**

Em `index.html`, logo APÓS a linha:
```html
  <title>Relógios Mundiais</title>
```
insira:
```html
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#0a0a0a">
  <link rel="icon" href="icons/icon-192.png">
  <link rel="apple-touch-icon" href="icons/apple-touch-180.png">
```

- [ ] **Step 2: Registrar o service worker**

Em `index.html`, imediatamente ANTES de `</body>`, insira:
```html
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () =>
        navigator.serviceWorker.register("sw.js").catch(() => {})
      );
    }
  </script>
```

- [ ] **Step 3: Verificar no navegador via Chrome DevTools MCP**

Suba o servidor (mate instância anterior): `python3 -m http.server 8000` em background. Então:
1. Navegue para `http://localhost:8000/`. Confirme no console: sem erros; o SW registra.
2. `navigator.serviceWorker.controller` (via evaluate_script) — após um reload, deve ser não-nulo (SW no controle). Ou cheque `navigator.serviceWorker.getRegistration().then(r => r && r.active && r.active.state)` → `"activated"`.
3. Confirme o manifest: `fetch('manifest.webmanifest').then(r=>r.json()).then(m=>m.name)` → `"Relógios Mundiais"`.
4. **Offline:** habilite Network Offline (ou pare o servidor python) e **recarregue** — o app deve abrir e renderizar o quadro (servido do cache). Reative a rede depois.
5. Confirme que as features (relógio, grupos, comparador) seguem funcionando.
Capture evidência por inspeção de DOM / screenshot (NÃO deixe screenshots no repo).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(pwa): manifest/icon links and service worker registration"
```

---

## Task 5: Dockerfile — copiar os assets PWA

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Acrescentar os COPY**

Em `Dockerfile`, APÓS a linha:
```dockerfile
COPY js/ /usr/share/nginx/html/js/
```
adicione:
```dockerfile
COPY manifest.webmanifest sw.js icon.svg /usr/share/nginx/html/
COPY icons/ /usr/share/nginx/html/icons/
```

- [ ] **Step 2: Conferência final + testes de regressão**

Run:
```bash
node --input-type=module -e '
globalThis.document = { getElementById: () => ({ set innerHTML(v){}, get innerHTML(){return ""}, insertAdjacentHTML(){} }) };
await import("./js/tz.test.js"); await import("./js/store.test.js");
const { report } = await import("./js/test-harness.js"); report();
' 2>&1 | tail -1
```
Expected: `98/98 passaram` (PWA não toca em tz/store).

Confirme também que os arquivos referenciados pelo Dockerfile existem: `ls manifest.webmanifest sw.js icon.svg icons/`.
> Docker NÃO está instalado nesta máquina — não há build local; o build acontece no host do Portainer. Apenas confirme que os caminhos copiados existem.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore(docker): include PWA assets (manifest, sw, icons) in image"
```

---

## Self-Review (cobertura da spec)

- Instalável (manifest + ícones + theme/display) → Tasks 1, 2, 4. ✓
- Ícones PNG gerados de SVG via qlmanage/sips, tema âmbar/preto → Task 1. ✓
- Offline via service worker (precache shell, cache-first) → Task 3. ✓
- Runtime-cache das Google Fonts → Task 3 (branch fonts.googleapis/gstatic). ✓
- Atualização: cache versionado + activate limpa antigos + clients.claim → Task 3. ✓
- Registro do SW + links no index → Task 4. ✓
- Progressive enhancement (sem SW = app normal) → Task 4 (`if ("serviceWorker" in navigator)` + `.catch`). ✓
- Dockerfile inclui os novos assets → Task 5. ✓
- `localStorage` inalterado; 98 testes tz/store verdes → Task 5 (regressão). ✓
- Verificação: manifest installable, SW activated, reload offline → Task 4 Step 3. ✓
