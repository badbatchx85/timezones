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
      const fallbackName = `Grupo ${gs.length + 1}`;
      const g = { id: newId(), name: (name || fallbackName).trim() || fallbackName, cities: [], reference: null };
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
