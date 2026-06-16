import { createStore } from "./store.js";
import { startClock } from "./clock.js";
import { listAllZones, dateForReferenceMinute, formatTime, formatDateShort, getCityLabel, getLocalZone, minuteToHHMM, hhmmToMinute, isValidZone, zoneMinuteOfDay } from "./tz.js";
import { renderBoard, updateTimes, wireBoard, renderSearch, renderTabs } from "./ui.js";

const store = createStore();
// Autocorreção: remove fusos inválidos persistidos antes do primeiro desenho.
store.getCities().forEach(tz => { if (!isValidZone(tz)) store.removeCity(tz); });

const grid = document.getElementById("grid");
const tabsEl = document.getElementById("tabs");
const emptyEl = document.getElementById("empty");
const search = document.getElementById("search");
const results = document.getElementById("results");
const slider = document.getElementById("slider");
const timeInput = document.getElementById("timeInput");
const resetBtn = document.getElementById("reset");
const refLabel = document.getElementById("ref-label");
const colorToggle = document.getElementById("colorToggle");
const fmtToggle = document.getElementById("fmtToggle");
const localTimeEl = document.getElementById("localTime");
const localDateEl = document.getElementById("localDate");
const localZone = getLocalZone();
const allZones = listAllZones();

colorToggle.checked = store.getSettings().colorHint;
colorToggle.addEventListener("change", () => {
  store.setSettings({ colorHint: colorToggle.checked });
  rebuild();
});
fmtToggle.checked = store.getSettings().hour12;
fmtToggle.addEventListener("change", () => {
  store.setSettings({ hour12: fmtToggle.checked });
  rebuild(); // estrutura dos flaps muda (HH:MM vs HH:MM AM)
});

let comparing = false;   // false = ao vivo; true = comparando um horário escolhido
let comparingMinute = 0; // fonte única do minuto comparado (0..1439)
let currentDate = new Date();

function displayDate() {
  const refTz = store.getReference();
  return comparing ? dateForReferenceMinute(refTz, currentDate, comparingMinute) : currentDate;
}

// Atualiza o rótulo de referência e o relógio do masthead.
function refreshLabels(date) {
  const refTz = store.getReference();
  const hour12 = store.getSettings().hour12;
  refLabel.innerHTML =
    `<span class="ref-key">Referência:</span> <span class="ref-val">${getCityLabel(refTz)} · ${formatTime(refTz, date, hour12)}</span>`;
}

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

// Reconstrói a estrutura do quadro (evento estrutural) e em seguida pinta as horas.
function rebuild() {
  const date = displayDate();
  renderBoard({
    grid, emptyEl,
    cities: store.getCities(),
    displayDate: date,
    referenceTz: store.getReference(),
    colorHint: store.getSettings().colorHint,
    hour12: store.getSettings().hour12,
  });
  wireBoard(grid, {
    onRemove: tz => {
      store.removeCity(tz);
      if (store.getReference() === tz) store.clearReference();
      rebuild();
    },
    onSetReference: tz => {
      store.setReference(tz);
      comparing = false; timeInput.value = ""; // troca de referência volta ao vivo
      rebuild(); // tick reposiciona a barra na hora local da nova referência
    },
    onReorder: newOrder => { store.setCities(newOrder); rebuild(); },
  });
  tick();
}

// Atualiza apenas valores (horas/flaps/glifo/offset) + rótulos. Sem rebuild.
function tick() {
  const date = displayDate();
  updateTimes({
    grid,
    displayDate: date,
    colorHint: store.getSettings().colorHint,
    hour12: store.getSettings().hour12,
  });
  refreshLabels(date);
  updateMasthead();
  // ao vivo: a barra acompanha o horário local da cidade de referência (escala 24h)
  if (!comparing) slider.value = String(zoneMinuteOfDay(store.getReference(), currentDate));
}

function updateMasthead() {
  const hour12 = store.getSettings().hour12;
  // o relógio do masthead acompanha a cidade de REFERÊNCIA (principal) do grupo ativo
  const refTz = store.getReference();
  localTimeEl.textContent = formatTime(refTz, currentDate, hour12);
  localDateEl.textContent = formatDateShort(refTz, currentDate) + " · " + getCityLabel(refTz);
}

// Entra/atualiza o modo de comparação (estrutura inalterada → só updateTimes).
function startComparing(minute) {
  comparing = true;
  comparingMinute = minute;
  slider.value = String(minute);
  timeInput.value = minuteToHHMM(minute);
  tick();
}

// Sugestões na primeira visita: zona LOCAL primeiro, depois as fixas (dedup via store).
if (store.getCities().length === 0) {
  [localZone, "America/Sao_Paulo", "America/New_York", "Europe/London", "Asia/Tokyo"]
    .forEach(tz => store.addCity(tz));
}

search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  if (!q) { results.innerHTML = ""; return; }
  const hour12 = store.getSettings().hour12;
  const now = new Date();
  const matches = allZones.filter(z => z.toLowerCase().includes(q)).slice(0, 20)
    .map(tz => ({ tz, time: formatTime(tz, now, hour12) }));
  renderSearch(results, matches, tz => {
    store.addCity(tz);
    search.value = ""; results.innerHTML = "";
    rebuild(); // novo destino entra com revelação em flap
  });
});

slider.addEventListener("input", () => startComparing(Number(slider.value)));
timeInput.addEventListener("input", () => {
  const min = hhmmToMinute(timeInput.value);
  if (min != null) startComparing(min);
});
resetBtn.addEventListener("click", () => {
  comparing = false;
  timeInput.value = ""; // volta o campo para "--:--"
  tick(); // tick reposiciona a barra na hora atual da referência
});

// Build inicial (revelação em cascata + flip de assentamento via CSS).
renderAll();

startClock(date => {
  currentDate = date;
  if (!comparing) tick(); // tick a cada 1s: flips funcionam, DOM não é reconstruído
  else updateMasthead();  // mantém o relógio do masthead vivo mesmo comparando
});
