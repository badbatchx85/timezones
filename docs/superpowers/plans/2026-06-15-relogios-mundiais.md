# Relógios Mundiais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um app web leve, em arquivo único, para ver as horas em vários fusos ao vivo e comparar horários para agendar reuniões.

**Architecture:** Um único `index.html` com HTML + CSS + JS embutidos, sem build e sem dependências. Toda lógica de fuso vem da API `Intl` nativa, concentrada num módulo `tz`. Favoritos e preferências persistem em `localStorage` via um módulo `store`. Um `clock` re-renderiza a cada segundo e o `ui` desenha grade de cartões, busca e comparador.

**Tech Stack:** HTML5, CSS, JavaScript (ES modules via `<script type="module">`), API `Intl`, `localStorage`. Testes em JavaScript puro rodando no navegador (`tests.html`), sem framework.

---

## Estrutura de arquivos

- `index.html` — app completo (markup + `<style>` + `<script type="module">` que importa os módulos).
- `js/tz.js` — único ponto que toca `Intl`: formatação, offset, labels, lista de fusos, `dayPart`.
- `js/store.js` — leitura/escrita no `localStorage` (favoritos, referência, settings).
- `js/clock.js` — loop ao vivo (1s) que chama um callback de render.
- `js/ui.js` — renderiza grade, busca e comparador; trata eventos.
- `tests.html` — carrega `js/tz.js` e `js/store.js` e roda asserts no navegador, imprimindo resultados na página.
- `js/test-harness.js` — mini runner de testes (`describe`/`it`/`assertEqual`) sem dependências.

> Nota: módulos ES (`import`/`export`) exigem servir via `http://` (ex.: `python3 -m http.server`), não `file://`. Os comandos de teste abaixo assumem um servidor estático local.

---

## Task 1: Mini test harness

**Files:**
- Create: `js/test-harness.js`
- Create: `tests.html`

- [ ] **Step 1: Escrever o harness de testes**

`js/test-harness.js`:

```javascript
// Mini test runner sem dependências. Resultados vão para o DOM e console.
const results = [];

export function assertEqual(actual, expected, msg = "") {
  const pass = Object.is(actual, expected);
  results.push({ pass, msg, detail: pass ? "" : `esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}` });
}

export function assert(cond, msg = "") {
  results.push({ pass: !!cond, msg, detail: cond ? "" : "condição falsa" });
}

export function it(name, fn) {
  try {
    fn();
    results.push({ pass: true, msg: `it: ${name}`, detail: "", group: true });
  } catch (e) {
    results.push({ pass: false, msg: `it: ${name}`, detail: String(e), group: true });
  }
}

export function report() {
  const failed = results.filter(r => !r.pass);
  const el = document.getElementById("out");
  el.innerHTML = results
    .map(r => `<div style="color:${r.pass ? "green" : "red"}">${r.pass ? "✓" : "✗"} ${r.msg} ${r.detail}</div>`)
    .join("");
  const summary = `${results.length - failed.length}/${results.length} passaram`;
  el.insertAdjacentHTML("afterbegin", `<h2 style="color:${failed.length ? "red" : "green"}">${summary}</h2>`);
  console.log(summary);
}
```

- [ ] **Step 2: Escrever a página de testes**

`tests.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Testes — Relógios Mundiais</title></head>
<body>
  <div id="out"></div>
  <script type="module">
    import "./js/tz.test.js";
    import "./js/store.test.js";
    import { report } from "./js/test-harness.js";
    report();
  </script>
</body>
</html>
```

- [ ] **Step 3: Criar arquivos de teste vazios para a página carregar**

Crie `js/tz.test.js` e `js/store.test.js` com um comentário só (`// testes a seguir`) para o `import` não quebrar agora.

- [ ] **Step 4: Servir e abrir**

Run: `python3 -m http.server 8000` e abra `http://localhost:8000/tests.html`
Expected: página em branco com "0/0 passaram" (sem erros no console).

- [ ] **Step 5: Commit**

```bash
git add js/test-harness.js tests.html js/tz.test.js js/store.test.js
git commit -m "test: add zero-dependency browser test harness"
```

---

## Task 2: Módulo `tz` — formatação de hora

**Files:**
- Create: `js/tz.js`
- Test: `js/tz.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Em `js/tz.test.js`:

```javascript
import { it, assertEqual } from "./test-harness.js";
import { formatTime } from "./tz.js";

// 2026-06-15T18:00:00Z → São Paulo (GMT-3) = 15:00; Tóquio (GMT+9) = sex 03:00
const ref = new Date("2026-06-15T18:00:00Z");

it("formatTime devolve HH:MM no fuso pedido", () => {
  assertEqual(formatTime("America/Sao_Paulo", ref), "15:00");
  assertEqual(formatTime("Asia/Tokyo", ref), "03:00");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: abrir `http://localhost:8000/tests.html`
Expected: FALHA — `formatTime is not a function` / módulo não encontrado.

- [ ] **Step 3: Implementar o mínimo**

`js/tz.js`:

```javascript
export function formatTime(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: PASSA (2/2 asserts da seção).

- [ ] **Step 5: Commit**

```bash
git add js/tz.js js/tz.test.js
git commit -m "feat(tz): formatTime via Intl"
```

---

## Task 3: Módulo `tz` — offset, label de cidade e data

**Files:**
- Modify: `js/tz.js`
- Test: `js/tz.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente em `js/tz.test.js`:

```javascript
import { getOffsetLabel, getCityLabel, formatDateShort } from "./tz.js";

it("getOffsetLabel devolve GMT±N", () => {
  assertEqual(getOffsetLabel("America/Sao_Paulo", ref), "GMT-3");
  assertEqual(getOffsetLabel("Asia/Tokyo", ref), "GMT+9");
});

it("getCityLabel humaniza o nome IANA", () => {
  assertEqual(getCityLabel("America/Sao_Paulo"), "Sao Paulo");
  assertEqual(getCityLabel("America/New_York"), "New York");
});

it("formatDateShort mostra a data no fuso", () => {
  // Em Tóquio já é 16 de junho às 03:00
  assertEqual(formatDateShort("Asia/Tokyo", ref), "16/06");
  assertEqual(formatDateShort("America/Sao_Paulo", ref), "15/06");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: FALHA — funções não exportadas.

- [ ] **Step 3: Implementar**

Acrescente em `js/tz.js`:

```javascript
export function getOffsetLabel(timeZone, date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName").value; // ex.: "GMT-3"
  return name.replace("GMT-0", "GMT-").replace("GMT+0", "GMT+");
}

export function getCityLabel(timeZone) {
  return timeZone.split("/").pop().replaceAll("_", " ");
}

export function formatDateShort(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, day: "2-digit", month: "2-digit",
  }).format(date);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: PASSA.

- [ ] **Step 5: Commit**

```bash
git add js/tz.js js/tz.test.js
git commit -m "feat(tz): offset, city label, short date"
```

---

## Task 4: Módulo `tz` — `dayPart` (base da dica de cor) e `listAllZones`

**Files:**
- Modify: `js/tz.js`
- Test: `js/tz.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente em `js/tz.test.js`:

```javascript
import { dayPart, listAllZones } from "./tz.js";

it("dayPart classifica por faixa de hora local", () => {
  // ref = 18:00Z → SP 15:00 (comercial), Tóquio 03:00 (madrugada), Londres 19:00 (outro)
  assertEqual(dayPart("America/Sao_Paulo", ref), "comercial");
  assertEqual(dayPart("Asia/Tokyo", ref), "madrugada");
  assertEqual(dayPart("Europe/London", ref), "outro");
});

it("listAllZones devolve muitos fusos IANA incluindo Sao_Paulo", () => {
  const zones = listAllZones();
  assert(zones.length > 100, "deve haver centenas de fusos");
  assert(zones.includes("America/Sao_Paulo"), "inclui Sao_Paulo");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: FALHA — funções não exportadas.

- [ ] **Step 3: Implementar**

Acrescente em `js/tz.js`:

```javascript
// Hora local (0-23) no fuso, derivada via Intl.
function localHour(timeZone, date) {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone, hour: "2-digit", hour12: false,
  }).format(date);
  return parseInt(h, 10) % 24; // "24" → 0
}

export function dayPart(timeZone, date) {
  const h = localHour(timeZone, date);
  if (h >= 9 && h < 18) return "comercial";   // 09:00–18:00
  if (h >= 0 && h < 6) return "madrugada";     // 00:00–06:00
  return "outro";
}

export function listAllZones() {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  // Fallback mínimo para navegadores muito antigos.
  return ["America/Sao_Paulo", "America/New_York", "Europe/London", "Asia/Tokyo"];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: PASSA.

- [ ] **Step 5: Commit**

```bash
git add js/tz.js js/tz.test.js
git commit -m "feat(tz): dayPart classification and listAllZones"
```

---

## Task 5: Módulo `store` — favoritos, referência e settings no localStorage

**Files:**
- Create: `js/store.js`
- Test: `js/store.test.js`

- [ ] **Step 1: Escrever os testes que falham**

`js/store.test.js`:

```javascript
import { it, assertEqual, assert } from "./test-harness.js";
import { createStore } from "./store.js";

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

it("addCity/getCities persiste e não duplica", () => {
  const s = createStore(fakeStorage());
  s.addCity("America/Sao_Paulo");
  s.addCity("Asia/Tokyo");
  s.addCity("America/Sao_Paulo"); // duplicada, ignora
  assertEqual(s.getCities().length, 2);
  assertEqual(s.getCities()[0], "America/Sao_Paulo");
});

it("removeCity remove", () => {
  const s = createStore(fakeStorage());
  s.addCity("Europe/London");
  s.removeCity("Europe/London");
  assertEqual(s.getCities().length, 0);
});

it("setReference/getReference persiste", () => {
  const s = createStore(fakeStorage());
  s.setReference("Asia/Tokyo");
  assertEqual(s.getReference(), "Asia/Tokyo");
});

it("getReference cai no fuso local quando não definido", () => {
  const s = createStore(fakeStorage());
  assertEqual(typeof s.getReference(), "string");
  assert(s.getReference().length > 0, "referência padrão não vazia");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: FALHA — `createStore` não existe.

- [ ] **Step 3: Implementar**

`js/store.js`:

```javascript
const CITIES_KEY = "rm.cities";
const REF_KEY = "rm.reference";
const SETTINGS_KEY = "rm.settings";

function localZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// Recebe um storage injetável (default: localStorage) para facilitar testes.
export function createStore(storage = window.localStorage) {
  function readJSON(key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* modo privado: ignora, app segue na sessão */
    }
  }

  return {
    getCities() {
      return readJSON(CITIES_KEY, []);
    },
    addCity(tz) {
      const cities = readJSON(CITIES_KEY, []);
      if (!cities.includes(tz)) {
        cities.push(tz);
        writeJSON(CITIES_KEY, cities);
      }
    },
    removeCity(tz) {
      writeJSON(CITIES_KEY, readJSON(CITIES_KEY, []).filter(c => c !== tz));
    },
    getReference() {
      return readJSON(REF_KEY, null) || localZone();
    },
    setReference(tz) {
      writeJSON(REF_KEY, tz);
    },
    getSettings() {
      return readJSON(SETTINGS_KEY, { colorHint: true });
    },
    setSettings(obj) {
      writeJSON(SETTINGS_KEY, { ...this.getSettings(), ...obj });
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: PASSA.

- [ ] **Step 5: Commit**

```bash
git add js/store.js js/store.test.js
git commit -m "feat(store): localStorage-backed favorites, reference, settings"
```

---

## Task 6: Módulo `clock` — loop ao vivo

**Files:**
- Create: `js/clock.js`

- [ ] **Step 1: Implementar (sem teste unitário — é só timer)**

`js/clock.js`:

```javascript
// Chama onTick(new Date()) imediatamente e a cada 1s. Devolve uma função stop().
export function startClock(onTick) {
  onTick(new Date());
  const id = setInterval(() => onTick(new Date()), 1000);
  return function stop() { clearInterval(id); };
}
```

> Justificativa de não-teste: o módulo só envolve `setInterval`; a lógica testável está em `tz`/`store`. Mantemos YAGNI.

- [ ] **Step 2: Commit**

```bash
git add js/clock.js
git commit -m "feat(clock): 1s live tick loop"
```

---

## Task 7: `index.html` — esqueleto, CSS e montagem dos módulos

**Files:**
- Create: `index.html`

- [ ] **Step 1: Escrever a casca do app**

`index.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relógios Mundiais</title>
  <style>
    :root { --bg:#f4f5f7; --card:#fff; --line:#e3e6ea; --muted:#888;
            --ok-bg:#eef6ee; --ok-line:#bcdcbc; --ok-text:#3a8a3a;
            --bad-bg:#fbeceb; --bad-line:#e6bcb8; --bad-text:#c0392b; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin:0; background:var(--bg); color:#222; }
    header { padding:16px; }
    h1 { font-size:20px; margin:0 0 12px; }
    #search { width:100%; padding:10px 12px; border:1px solid var(--line);
              border-radius:8px; font-size:14px; }
    #results { list-style:none; margin:6px 0 0; padding:0; max-height:220px; overflow:auto; }
    #results li { padding:8px 12px; background:var(--card); border:1px solid var(--line);
                  border-top:none; cursor:pointer; }
    #results li:hover { background:#f0f1f3; }
    main { padding:0 16px 16px; }
    #grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:10px;
            padding:14px; text-align:center; position:relative; }
    .card.comercial { background:var(--ok-bg); border-color:var(--ok-line); }
    .card.madrugada { background:var(--bad-bg); border-color:var(--bad-line); }
    .card .name { font-weight:600; font-size:14px; }
    .card .time { font-size:24px; font-weight:700; margin:4px 0; letter-spacing:-1px; }
    .card .meta { color:var(--muted); font-size:11px; }
    .card .star, .card .ref { position:absolute; top:6px; cursor:pointer; background:none;
            border:none; font-size:13px; }
    .card .star { right:6px; }
    .card .ref { left:6px; opacity:.5; }
    .card.is-ref .ref { opacity:1; }
    #comparator { background:var(--card); border:1px solid var(--line); border-radius:10px;
                  padding:12px; margin-bottom:12px; }
    #comparator .row { display:flex; justify-content:space-between; font-size:12px;
                       color:var(--muted); margin-bottom:8px; }
    #slider { width:100%; }
    #reset { background:none; border:none; color:#2a6cc0; cursor:pointer; font-size:12px; }
    .empty { color:var(--muted); font-size:14px; padding:20px 0; text-align:center; }
  </style>
</head>
<body>
  <header>
    <h1>🌍 Relógios Mundiais</h1>
    <input id="search" type="search" placeholder="🔍 Buscar cidade…" autocomplete="off">
    <ul id="results"></ul>
  </header>
  <main>
    <section id="comparator">
      <div class="row">
        <button id="reset">↩︎ Voltar para agora</button>
        <span id="ref-label"></span>
      </div>
      <input id="slider" type="range" min="0" max="1439" step="5">
    </section>
    <div id="grid"></div>
    <p id="empty" class="empty" hidden>Nenhuma cidade ainda. Busque acima para adicionar.</p>
  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verificar carregamento (vai dar erro de app.js ausente — esperado)**

Run: abrir `http://localhost:8000/`
Expected: layout aparece; console reclama de `js/app.js` não encontrado (criado na Task 8).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): app shell, CSS grid, search and comparator markup"
```

---

## Task 8: `js/ui.js` + `js/app.js` — render da grade e clock ao vivo

**Files:**
- Create: `js/ui.js`
- Create: `js/app.js`

- [ ] **Step 1: Implementar o render da grade**

`js/ui.js`:

```javascript
import { formatTime, formatDateShort, getOffsetLabel, getCityLabel, dayPart } from "./tz.js";

// Desenha a grade. `displayDate` é a hora atual OU a hora derivada do comparador.
export function renderGrid({ grid, emptyEl, cities, displayDate, referenceTz, colorHint, handlers }) {
  emptyEl.hidden = cities.length > 0;
  grid.innerHTML = cities.map(tz => {
    const part = colorHint ? dayPart(tz, displayDate) : "outro";
    const isRef = tz === referenceTz;
    return `
      <div class="card ${part} ${isRef ? "is-ref" : ""}" data-tz="${tz}">
        <button class="ref" title="Definir como referência">🎯</button>
        <button class="star" title="Remover">⭐</button>
        <div class="name">${getCityLabel(tz)}</div>
        <div class="time">${formatTime(tz, displayDate)}</div>
        <div class="meta">${formatDateShort(tz, displayDate)} · ${getOffsetLabel(tz, displayDate)}</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".star").forEach(btn =>
    btn.addEventListener("click", e => handlers.onRemove(e.target.closest(".card").dataset.tz)));
  grid.querySelectorAll(".ref").forEach(btn =>
    btn.addEventListener("click", e => handlers.onSetReference(e.target.closest(".card").dataset.tz)));
}

export function renderSearch(resultsEl, matches, onPick) {
  resultsEl.innerHTML = matches.map(tz =>
    `<li data-tz="${tz}">${getCityLabel(tz)} <span style="color:#888">(${tz})</span></li>`).join("");
  resultsEl.querySelectorAll("li").forEach(li =>
    li.addEventListener("click", () => onPick(li.dataset.tz)));
}
```

- [ ] **Step 2: Implementar o orquestrador `app.js` (somente relógios ao vivo + busca; comparador na Task 9)**

`js/app.js`:

```javascript
import { createStore } from "./store.js";
import { startClock } from "./clock.js";
import { listAllZones } from "./tz.js";
import { renderGrid, renderSearch } from "./ui.js";

const store = createStore();
const grid = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const search = document.getElementById("search");
const results = document.getElementById("results");
const allZones = listAllZones();

// Sugestões na primeira visita.
if (store.getCities().length === 0) {
  ["America/Sao_Paulo", "America/New_York", "Europe/London", "Asia/Tokyo"].forEach(tz => store.addCity(tz));
}

let currentDate = new Date();

function draw() {
  renderGrid({
    grid, emptyEl,
    cities: store.getCities(),
    displayDate: currentDate,
    referenceTz: store.getReference(),
    colorHint: store.getSettings().colorHint,
    handlers: {
      onRemove: tz => { store.removeCity(tz); draw(); },
      onSetReference: tz => { store.setReference(tz); draw(); },
    },
  });
}

search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  if (!q) { results.innerHTML = ""; return; }
  const matches = allZones.filter(z => z.toLowerCase().includes(q)).slice(0, 20);
  renderSearch(results, matches, tz => {
    store.addCity(tz);
    search.value = ""; results.innerHTML = "";
    draw();
  });
});

startClock(date => { currentDate = date; draw(); });
```

- [ ] **Step 3: Verificar no navegador**

Run: abrir `http://localhost:8000/`
Expected: grade mostra as 4 cidades sugeridas com horas atualizando a cada segundo; cores aplicadas; buscar "tokyo" lista resultado; clicar adiciona; ⭐ remove; 🎯 marca referência (borda destacada).

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat(ui): live grid, search-to-add, remove and set-reference"
```

---

## Task 9: Comparador — slider de horário de referência

**Files:**
- Modify: `js/app.js`
- Test: `js/tz.test.js` (nova função `dateForReferenceMinute`)
- Modify: `js/tz.js`

- [ ] **Step 1: Escrever o teste que falha para a função de cálculo**

Acrescente em `js/tz.test.js`:

```javascript
import { dateForReferenceMinute } from "./tz.js";

it("dateForReferenceMinute monta a hora escolhida no fuso de referência", () => {
  // base: qualquer instante de 2026-06-15; escolher 15:00 (=900 min) em São Paulo (GMT-3)
  // 15:00 em GMT-3 == 18:00Z
  const base = new Date("2026-06-15T10:00:00Z");
  const d = dateForReferenceMinute("America/Sao_Paulo", base, 900);
  assertEqual(d.toISOString(), "2026-06-15T18:00:00.000Z");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: FALHA — `dateForReferenceMinute` não existe.

- [ ] **Step 3: Implementar a função em `tz.js`**

Acrescente em `js/tz.js`:

```javascript
// Offset do fuso em minutos para um instante (ex.: São Paulo → -180).
function offsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName").value; // "GMT-3" | "GMT" | "GMT+5:30"
  const m = parts.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
}

// Dado o dia de `base`, devolve o instante UTC em que o relógio do fuso de
// referência marca `minuteOfDay` (0..1439).
export function dateForReferenceMinute(referenceTz, base, minuteOfDay) {
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: referenceTz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(base); // "2026-06-15"
  const off = offsetMinutes(referenceTz, base);
  // Hora local desejada (em minutos) menos o offset → minutos UTC desde a meia-noite local.
  const utcMs = Date.parse(`${y}T00:00:00Z`) + (minuteOfDay - off) * 60000;
  return new Date(utcMs);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: recarregar `http://localhost:8000/tests.html`
Expected: PASSA.

- [ ] **Step 5: Ligar o slider no `app.js`**

Substitua, em `js/app.js`, a linha `import { listAllZones } from "./tz.js";` por:

```javascript
import { listAllZones, dateForReferenceMinute, formatTime, getCityLabel } from "./tz.js";
```

Adicione, logo após a obtenção dos elementos do DOM:

```javascript
const slider = document.getElementById("slider");
const resetBtn = document.getElementById("reset");
const refLabel = document.getElementById("ref-label");

let comparing = false; // false = modo ao vivo; true = usando o slider
```

Substitua a função `draw` por esta versão (que escolhe a data exibida e atualiza o rótulo da referência):

```javascript
function draw() {
  const refTz = store.getReference();
  const displayDate = comparing
    ? dateForReferenceMinute(refTz, currentDate, Number(slider.value))
    : currentDate;

  refLabel.textContent = `Referência: ${getCityLabel(refTz)} · ${formatTime(refTz, displayDate)}`;

  renderGrid({
    grid, emptyEl,
    cities: store.getCities(),
    displayDate,
    referenceTz: refTz,
    colorHint: store.getSettings().colorHint,
    handlers: {
      onRemove: tz => { store.removeCity(tz); draw(); },
      onSetReference: tz => { store.setReference(tz); draw(); },
    },
  });
}
```

Adicione, antes de `startClock(...)`:

```javascript
slider.addEventListener("input", () => { comparing = true; draw(); });
resetBtn.addEventListener("click", () => { comparing = false; draw(); });
```

E ajuste o tick do clock para não sobrescrever a comparação:

```javascript
startClock(date => {
  currentDate = date;
  if (!comparing) draw();
});
```

- [ ] **Step 6: Verificar no navegador**

Run: abrir `http://localhost:8000/`
Expected: arrastar o slider congela a grade na hora escolhida e todos os cartões mostram a hora correspondente no seu fuso; o rótulo "Referência:" reflete a cidade-alvo; mudar a referência (🎯) e arrastar recalcula a partir do fuso dela; "Voltar para agora" volta ao modo ao vivo.

- [ ] **Step 7: Commit**

```bash
git add js/tz.js js/tz.test.js js/app.js
git commit -m "feat(comparator): reference-city time slider"
```

---

## Task 10: Polimento — settings de cor e README

**Files:**
- Modify: `index.html`
- Create: `README.md`

- [ ] **Step 1: Adicionar toggle da dica de cor**

Em `index.html`, dentro de `#comparator .row`, antes do `#ref-label`, adicione:

```html
<label style="cursor:pointer"><input id="colorToggle" type="checkbox" checked> cores</label>
```

Em `js/app.js`, após pegar os elementos, adicione:

```javascript
const colorToggle = document.getElementById("colorToggle");
colorToggle.checked = store.getSettings().colorHint;
colorToggle.addEventListener("change", () => {
  store.setSettings({ colorHint: colorToggle.checked });
  draw();
});
```

- [ ] **Step 2: Escrever o README**

`README.md`:

```markdown
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
```

- [ ] **Step 3: Verificar**

Run: abrir `http://localhost:8000/` e `http://localhost:8000/tests.html`
Expected: toggle "cores" liga/desliga a dica de cor e persiste ao recarregar; todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add index.html js/app.js README.md
git commit -m "feat: color-hint toggle persistence; add README"
```

---

## Self-Review (cobertura da spec)

- Arquitetura de arquivo único, JS puro, zero deps → Tasks 7–10. ✓
- API `Intl` concentrada em `tz` → Tasks 2–4, 9. ✓
- `localStorage` para favoritos/referência/settings → Task 5. ✓
- Grade de cartões (layout escolhido) → Tasks 7–8. ✓
- Relógios ao vivo (1s) → Tasks 6, 8. ✓
- Busca global de fusos → Tasks 4 (`listAllZones`), 8. ✓
- Comparador com cidade-referência escolhida → Task 9. ✓
- Dica de cor 09–18 / 00–06 → Tasks 4, 8, 10. ✓
- Casos de borda: primeira visita (Task 8), localStorage indisponível (Task 5 try/catch), virada de dia (Task 3 data no cartão). ✓
- Testes das funções puras de `tz` e do `store` → Tasks 1–5, 9. ✓
