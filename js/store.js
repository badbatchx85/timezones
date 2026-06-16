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
    clearReference() {
      try {
        storage.removeItem(REF_KEY);
      } catch {
        /* modo privado: ignora, app segue na sessão */
      }
    },
    getSettings() {
      return readJSON(SETTINGS_KEY, { colorHint: true });
    },
    setSettings(obj) {
      writeJSON(SETTINGS_KEY, { ...this.getSettings(), ...obj });
    },
  };
}
