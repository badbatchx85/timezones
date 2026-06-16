# Agrupar Cidades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizar as cidades do app em grupos nomeados independentes (cada um com suas cidades, ordem e referência), alternados por abas no tema do painel.

**Architecture:** O `store.js` passa a guardar grupos no `localStorage` e expõe as operações de cidade/referência já existentes resolvidas para o **grupo ativo** — então `app.js`/`ui.js` quase não mudam. A UI ganha uma faixa de abas (`renderTabs` em `ui.js`) acima da grade; `app.js` fia os handlers (trocar/criar/renomear/apagar) e re-renderiza.

**Tech Stack:** HTML/CSS/JS vanilla (ES modules), API `Intl`, `localStorage`, `crypto.randomUUID`. Testes em JS puro no navegador (`tests.html`) com `fakeStorage` injetável; verificação de UI via Chrome DevTools MCP.

---

## Estrutura de arquivos

- `js/store.js` — **reescrito** para o modelo de grupos + migração + ops escopadas no grupo ativo. Continua sendo o único módulo de persistência.
- `js/store.test.js` — novos testes (migração, escopo por grupo, gestão de grupos). Os testes existentes continuam válidos.
- `js/ui.js` — **novo** `renderTabs(container, state, handlers)` (com renomear inline). `renderBoard`/`updateTimes`/`wireBoard` inalterados.
- `index.html` — nova faixa `<nav id="tabs" class="group-tabs">` entre `#comparator` e `<section class="board">`, + CSS das abas.
- `js/app.js` — `paintTabs(editId)` + `renderAll(editId)` + handlers das abas; troca de grupo reseta o modo de comparação.

---

## Task 1: store.js — modelo de grupos, migração e ops escopadas

**Files:**
- Modify: `js/store.js` (reescrita completa)
- Test: `js/store.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao FINAL de `js/store.test.js` (o arquivo já tem `import { it, assertEqual, assert }` e o helper `fakeStorage()` no topo — reutilize-os; NÃO redeclare `fakeStorage`):

```javascript
// --- Grupos ---

it("migra rm.cities/rm.reference antigos para um grupo 'Geral' ativo", () => {
  const fs = fakeStorage();
  fs.setItem("rm.cities", JSON.stringify(["America/Sao_Paulo", "Asia/Tokyo"]));
  fs.setItem("rm.reference", JSON.stringify("Asia/Tokyo"));
  const s = createStore(fs);
  const groups = s.getGroups();
  assertEqual(groups.length, 1);
  assertEqual(groups[0].name, "Geral");
  assertEqual(s.getActiveGroupId(), groups[0].id);
  assertEqual(s.getCities().length, 2);
  assertEqual(s.getCities()[0], "America/Sao_Paulo");
  assertEqual(s.getReference(), "Asia/Tokyo");
});

it("cria 'Geral' vazio quando não há dados legados", () => {
  const s = createStore(fakeStorage());
  assertEqual(s.getGroups().length, 1);
  assertEqual(s.getGroups()[0].name, "Geral");
  assertEqual(s.getCities().length, 0);
});

it("cidades e referência são escopadas ao grupo ativo", () => {
  const s = createStore(fakeStorage());
  s.addCity("America/Sao_Paulo");        // no grupo Geral
  const g2 = s.addGroup("Time");          // cria e ativa
  assertEqual(s.getActiveGroupId(), g2);
  assertEqual(s.getCities().length, 0);   // grupo novo começa vazio
  s.addCity("Asia/Tokyo");
  s.setReference("Asia/Tokyo");
  assertEqual(s.getCities()[0], "Asia/Tokyo");
  // volta ao primeiro grupo
  const g1 = s.getGroups()[0].id;
  s.setActiveGroup(g1);
  assertEqual(s.getCities()[0], "America/Sao_Paulo");
});

it("addGroup retorna id e ativa; renameGroup renomeia; nome vazio é ignorado", () => {
  const s = createStore(fakeStorage());
  const id = s.addGroup("Família");
  assertEqual(typeof id, "string");
  assertEqual(s.getActiveGroupId(), id);
  s.renameGroup(id, "Casa");
  assertEqual(s.getGroups().find(g => g.id === id).name, "Casa");
  s.renameGroup(id, "   ");
  assertEqual(s.getGroups().find(g => g.id === id).name, "Casa"); // mantém
});

it("removeGroup remove e reativa o primeiro; nunca apaga o último", () => {
  const s = createStore(fakeStorage());
  const g1 = s.getGroups()[0].id;
  const g2 = s.addGroup("Time"); // ativo = g2
  s.removeGroup(g2);
  assertEqual(s.getGroups().length, 1);
  assertEqual(s.getActiveGroupId(), g1); // reativou o primeiro
  s.removeGroup(g1); // último: ignorado
  assertEqual(s.getGroups().length, 1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
node --input-type=module -e '
globalThis.document = { getElementById: () => ({ set innerHTML(v){}, get innerHTML(){return ""}, insertAdjacentHTML(){} }) };
await import("./js/tz.test.js"); await import("./js/store.test.js");
const { report } = await import("./js/test-harness.js"); report();
' 2>&1 | tail -1
```
Expected: FALHA — `getGroups`/`addGroup`/etc. não existem (várias asserções vermelhas).

- [ ] **Step 3: Reescrever `js/store.js`**

Substitua TODO o conteúdo de `js/store.js` por:

```javascript
const GROUPS_KEY = "rm.groups";
const ACTIVE_KEY = "rm.activeGroup";
const SETTINGS_KEY = "rm.settings";
// chaves legadas (modelo plano anterior)
const CITIES_KEY = "rm.cities";
const REF_KEY = "rm.reference";

function localZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "g-" + Math.abs(Date.now()).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
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

  // --- grupos (modelo interno) ---
  function groups() { return readJSON(GROUPS_KEY, []); }
  function writeGroups(gs) { writeJSON(GROUPS_KEY, gs); }

  function activeId() {
    const id = readJSON(ACTIVE_KEY, null);
    const gs = groups();
    if (gs.some(g => g.id === id)) return id;
    return gs.length ? gs[0].id : null; // fallback: primeiro grupo
  }
  function active() {
    const gs = groups();
    return gs.find(g => g.id === activeId()) || gs[0] || null;
  }
  function updateActive(mutator) {
    const gs = groups();
    const id = activeId();
    const i = gs.findIndex(g => g.id === id);
    if (i < 0) return;
    mutator(gs[i]);
    writeGroups(gs);
  }

  // migração: se não há grupos, cria "Geral" com dados legados (ou vazio)
  if (groups().length === 0) {
    const legacy = readJSON(CITIES_KEY, []);
    const ref = readJSON(REF_KEY, null);
    const g = {
      id: newId(),
      name: "Geral",
      cities: Array.isArray(legacy) ? legacy : [],
      reference: ref || null,
    };
    writeGroups([g]);
    writeJSON(ACTIVE_KEY, g.id);
  }

  return {
    // --- gestão de grupos ---
    getGroups() {
      return groups().map(g => ({ id: g.id, name: g.name }));
    },
    getActiveGroupId() {
      return activeId();
    },
    setActiveGroup(id) {
      if (groups().some(g => g.id === id)) writeJSON(ACTIVE_KEY, id);
    },
    addGroup(name) {
      const gs = groups();
      const g = { id: newId(), name: (name || `Grupo ${gs.length + 1}`).trim() || `Grupo ${gs.length + 1}`, cities: [], reference: null };
      gs.push(g);
      writeGroups(gs);
      writeJSON(ACTIVE_KEY, g.id);
      return g.id;
    },
    renameGroup(id, name) {
      const n = (name || "").trim();
      if (!n) return;
      const gs = groups();
      const g = gs.find(x => x.id === id);
      if (g) { g.name = n; writeGroups(gs); }
    },
    removeGroup(id) {
      const gs = groups();
      if (gs.length <= 1) return; // nunca apaga o último
      const wasActive = activeId() === id;
      const next = gs.filter(g => g.id !== id);
      writeGroups(next);
      if (wasActive) writeJSON(ACTIVE_KEY, next[0].id);
    },

    // --- cidades/referência do GRUPO ATIVO (assinatura inalterada) ---
    getCities() {
      const g = active();
      return g ? g.cities.slice() : [];
    },
    addCity(tz) {
      updateActive(g => { if (!g.cities.includes(tz)) g.cities.push(tz); });
    },
    removeCity(tz) {
      updateActive(g => { g.cities = g.cities.filter(c => c !== tz); });
    },
    setCities(arr) {
      updateActive(g => { g.cities = Array.isArray(arr) ? arr : []; });
    },
    getReference() {
      const g = active();
      return (g && g.reference) || localZone();
    },
    setReference(tz) {
      updateActive(g => { g.reference = tz; });
    },
    clearReference() {
      updateActive(g => { g.reference = null; });
    },

    // --- settings globais (inalterado) ---
    getSettings() {
      return readJSON(SETTINGS_KEY, { colorHint: true, hour12: false });
    },
    setSettings(obj) {
      writeJSON(SETTINGS_KEY, { ...this.getSettings(), ...obj });
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (mesmo comando do Step 2). Expected: PASSA — todos os testes verdes (os existentes + os novos de grupos).

- [ ] **Step 5: Commit**

```bash
git add js/store.js js/store.test.js
git commit -m "feat(store): groups model with migration and active-group scoping"
```

---

## Task 2: index.html — faixa de abas + CSS

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Inserir a faixa de abas no markup**

Em `index.html`, localize a seção do quadro:
```html
      <section class="board" aria-label="Quadro de cidades">
```
Imediatamente ANTES dessa linha, insira:
```html
      <nav class="group-tabs" id="tabs" aria-label="Grupos"></nav>
```

- [ ] **Step 2: Adicionar o CSS das abas**

Em `index.html`, dentro do `<style>`, logo APÓS a regra do `.empty { ... }` (procure por `.empty {`), adicione:
```css
    /* ===== abas de grupo ===== */
    .group-tabs {
      display:flex; gap:5px; align-items:center; margin-bottom:12px;
      overflow-x:auto; padding-bottom:2px;
    }
    .tab {
      position:relative; font-family:"Oswald"; font-size:12px; font-weight:600;
      letter-spacing:.14em; text-transform:uppercase; color:var(--amber-dim);
      padding:9px 14px; border:1px solid transparent; border-radius:6px;
      cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:8px;
      background:none; transition:color .15s, background .15s, border-color .15s;
    }
    .tab:hover { color:var(--cream); }
    .tab.active { color:var(--amber); border-color:#3a3025; background:rgba(255,179,0,.06); }
    .tab.active::after {
      content:""; position:absolute; left:12px; right:12px; bottom:-3px; height:2px;
      background:var(--amber); box-shadow:var(--glow);
    }
    .tab-x { color:var(--amber-dim); font-size:11px; line-height:1; padding:2px; border-radius:3px; }
    .tab-x:hover { color:#c0392b; }
    .tab-input {
      font-family:"Oswald"; font-size:12px; font-weight:600; letter-spacing:.14em;
      text-transform:uppercase; color:var(--amber); background:#0f0d0b;
      border:1px solid var(--amber); border-radius:4px; padding:2px 6px; width:9ch;
      outline:none;
    }
    .tab-add {
      font-family:"Oswald"; color:var(--amber-dim); font-size:15px; line-height:1;
      padding:7px 11px; border:1px dashed #3a3025; border-radius:6px; cursor:pointer;
      background:none;
    }
    .tab-add:hover { color:var(--amber); border-color:var(--amber-dim); }
```

- [ ] **Step 3: Verificar carregamento**

Run: `python3 -m http.server 8000` (em background) e abra `http://localhost:8000/`.
Expected: a página carrega; aparece uma faixa vazia (`#tabs`) acima do quadro (ainda sem abas, pois `app.js` será fiado na Task 4); sem erros novos no console além do já existente.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): group tabs container and styles"
```

---

## Task 3: ui.js — renderTabs com renomear inline

**Files:**
- Modify: `js/ui.js`

- [ ] **Step 1: Implementar `renderTabs` (sem teste unitário — verificação é no navegador na Task 4)**

Acrescente ao FINAL de `js/ui.js`:

```javascript
// renderTabs — desenha as abas de grupo e fia eventos.
// state: { groups:[{id,name}], activeId, canDelete, editId }
// handlers: { onSwitch(id), onCreate(), onRename(id, name), onDelete(id) }
export function renderTabs(container, state, handlers) {
  container.innerHTML = "";
  state.groups.forEach(g => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `tab ${g.id === state.activeId ? "active" : ""}`;
    tab.dataset.id = g.id;

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = g.name;
    tab.append(label);

    if (g.id === state.activeId && state.canDelete) {
      const x = document.createElement("span");
      x.className = "tab-x";
      x.title = "Apagar grupo";
      x.setAttribute("aria-label", `Apagar grupo ${g.name}`);
      x.textContent = "✕";
      tab.append(x);
    }

    tab.addEventListener("click", e => {
      if (e.target.closest(".tab-x")) { handlers.onDelete(g.id); return; }
      if (g.id !== state.activeId) handlers.onSwitch(g.id);
    });
    tab.addEventListener("dblclick", e => {
      if (e.target.closest(".tab-x")) return;
      startRename(tab, label, g, handlers);
    });

    container.append(tab);
    if (state.editId && g.id === state.editId) startRename(tab, label, g, handlers);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "tab-add";
  add.title = "Novo grupo";
  add.setAttribute("aria-label", "Novo grupo");
  add.textContent = "＋";
  add.addEventListener("click", () => handlers.onCreate());
  container.append(add);
}

// Edição inline do nome de um grupo.
function startRename(tab, label, g, handlers) {
  if (tab.querySelector(".tab-input")) return; // já editando
  const input = document.createElement("input");
  input.className = "tab-input";
  input.value = g.name;
  tab.replaceChild(input, label);
  input.focus();
  input.select();

  let done = false;
  const finish = commit => {
    if (done) return;
    done = true;
    if (commit) handlers.onRename(g.id, input.value); // store ignora vazio → re-render restaura
    else handlers.onRename(g.id, g.name);             // cancela: re-render com o nome atual
  };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}
```

- [ ] **Step 2: Sanidade de sintaxe**

Run: leia o arquivo e confirme que `renderTabs` é exportado e `startRename` é privado (sem `export`). (Módulo de navegador; `node --check` pode reclamar de `export` — verifique por inspeção.)

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): renderTabs with inline rename"
```

---

## Task 4: app.js — fiar as abas + verificação no navegador

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Importar `renderTabs` e pegar o container**

Em `js/app.js`, na linha de import de `./ui.js`:
```javascript
import { renderBoard, updateTimes, wireBoard, renderSearch } from "./ui.js";
```
troque por:
```javascript
import { renderBoard, updateTimes, wireBoard, renderSearch, renderTabs } from "./ui.js";
```
E após a obtenção dos outros elementos (perto de `const grid = document.getElementById("grid");`), adicione:
```javascript
const tabsEl = document.getElementById("tabs");
```

- [ ] **Step 2: Adicionar `paintTabs` e `renderAll`; trocar o build inicial**

Em `js/app.js`, ANTES da função `rebuild()`, adicione:
```javascript
// Desenha as abas de grupo. editId (opcional) entra direto em modo renomear.
function paintTabs(editId) {
  renderTabs(tabsEl, {
    groups: store.getGroups(),
    activeId: store.getActiveGroupId(),
    canDelete: store.getGroups().length > 1,
    editId,
  }, {
    onSwitch: id => {
      store.setActiveGroup(id);
      comparing = false; timeInput.value = ""; // troca de grupo volta ao vivo
      renderAll();
    },
    onCreate: () => {
      const id = store.addGroup();
      comparing = false; timeInput.value = "";
      renderAll(id); // novo grupo já entra em modo renomear
    },
    onRename: (id, name) => {
      store.renameGroup(id, name);
      paintTabs(); // só as abas mudam
    },
    onDelete: id => {
      if (!window.confirm("Apagar este grupo e a lista de cidades dele?")) return;
      store.removeGroup(id);
      comparing = false; timeInput.value = "";
      renderAll();
    },
  });
}

// Re-renderiza abas + quadro (evento estrutural).
function renderAll(editId) {
  paintTabs(editId);
  rebuild();
}
```

Localize a chamada do build inicial no fim do arquivo:
```javascript
// Build inicial (revelação em cascata + flip de assentamento via CSS).
rebuild();
```
e troque por:
```javascript
// Build inicial (revelação em cascata + flip de assentamento via CSS).
renderAll();
```

> Observação: a semeadura de primeira visita (`if (store.getCities().length === 0) { ... }`) e a poda de fusos inválidos continuam funcionando — agora operam sobre o grupo ativo ("Geral") via store, sem alteração.

- [ ] **Step 3: Verificar no navegador (Chrome DevTools MCP)**

Suba `python3 -m http.server 8000` (mate instância anterior). Então:
1. `localStorage.clear()` e recarregue `http://localhost:8000/`. Confirme: aparece a aba **"Geral"** ativa (sublinhado âmbar) + aba **"＋"**; a grade mostra as cidades semeadas.
2. Clique **"＋"** → cria um grupo novo, ativo, **vazio** (estado vazio na grade) e já em **modo renomear** (campo inline focado). Digite "Time" + Enter → a aba vira "TIME".
3. No grupo "Time", busque e adicione uma cidade (ex.: Tokyo). Volte para "Geral" (clique na aba) → a grade volta às cidades originais (independência confirmada). Volte para "Time" → só Tokyo.
4. Duplo-clique numa aba → renomeia inline (Enter confirma; Esc/!vazio mantém o nome).
5. Com 2+ grupos, clique no **✕** da aba ativa → aparece confirmação; confirmar remove o grupo e reativa o primeiro. Com só 1 grupo, o ✕ não aparece.
6. Confirme que comparador, reordenar, cores e 12h seguem funcionando no grupo ativo, e que a referência é por grupo (definir referência num grupo não muda a do outro).
7. `http://localhost:8000/tests.html` → todos os testes passam, sem erros no console.
Não deixe screenshots/temporários no repositório.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat(ui): wire group tabs (switch/create/rename/delete)"
```

---

## Self-Review (cobertura da spec)

- Modelo de grupos independentes (cidades/ordem/referência por grupo) → Task 1 (store). ✓
- Multi-pertencimento (mesma cidade em vários grupos) → consequência do modelo: `addCity` opera no grupo ativo; adicionar em cada grupo é independente (Task 1). ✓
- Referência por grupo; settings globais → Task 1 (`getReference`/`setReference` escopados; `getSettings` inalterado). ✓
- Migração do modelo plano antigo → Task 1 (bloco de migração). ✓
- Abas acima da grade, tema do painel, sublinhado na ativa, rolagem no estouro → Tasks 2 (CSS) + 3 (render). ✓
- Trocar de grupo (rebuild + barra segue a referência do grupo) → Task 4 (`onSwitch` + `renderAll`; tick já segue a referência). ✓
- Criar (＋, nome padrão, entra em renomear) → Tasks 3 (`editId`) + 4 (`onCreate`). ✓
- Renomear (duplo-clique, inline, vazio mantém) → Task 3 (`startRename`) + 1 (`renameGroup` ignora vazio). ✓
- Apagar (✕ na ativa, confirmação, não apaga o último, reativa o primeiro) → Tasks 3 (✕ só na ativa quando `canDelete`) + 1 (`removeGroup`) + 4 (`confirm`). ✓
- Casos de borda (grupo vazio, referência inválida, activeGroup inexistente, poda de inválidos) → Task 1 (fallbacks) + comportamento atual preservado. ✓
- Testes do store (migração, escopo, gestão) → Task 1. ✓
