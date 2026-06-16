import { createStore } from "./store.js";
import { startClock } from "./clock.js";
import { listAllZones, dateForReferenceMinute, formatTime, getCityLabel, minuteToHHMM, hhmmToMinute, isValidZone, getLocalZone } from "./tz.js";
import { renderGrid, renderSearch } from "./ui.js";

const store = createStore();
// Autocorreção: remove fusos inválidos persistidos antes do primeiro desenho.
store.getCities().forEach(tz => { if (!isValidZone(tz)) store.removeCity(tz); });
const grid = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const search = document.getElementById("search");
const results = document.getElementById("results");
const allZones = listAllZones();
const slider = document.getElementById("slider");
const timeInput = document.getElementById("timeInput");
const resetBtn = document.getElementById("reset");
const refLabel = document.getElementById("ref-label");
const colorToggle = document.getElementById("colorToggle");
colorToggle.checked = store.getSettings().colorHint;
colorToggle.addEventListener("change", () => {
  store.setSettings({ colorHint: colorToggle.checked });
  draw();
});
const fmtToggle = document.getElementById("fmtToggle");
fmtToggle.checked = store.getSettings().hour12;
fmtToggle.addEventListener("change", () => {
  store.setSettings({ hour12: fmtToggle.checked });
  draw();
});

let comparing = false; // false = modo ao vivo; true = comparando um horário escolhido
let comparingMinute = 0; // fonte única de verdade do minuto comparado (0..1439)

// Entra/atualiza o modo de comparação para um minuto do dia e sincroniza ambos
// os controles (slider e campo de hora) antes de redesenhar.
function startComparing(minute) {
  comparing = true;
  comparingMinute = minute;
  slider.value = String(minute);
  timeInput.value = minuteToHHMM(minute);
  draw();
}

// Sugestões na primeira visita.
if (store.getCities().length === 0) {
  [getLocalZone(), "America/Sao_Paulo", "America/New_York", "Europe/London", "Asia/Tokyo"]
    .forEach(tz => store.addCity(tz));
}

let currentDate = new Date();

function draw() {
  const refTz = store.getReference();
  const displayDate = comparing
    ? dateForReferenceMinute(refTz, currentDate, comparingMinute)
    : currentDate;

  const hour12 = store.getSettings().hour12;
  refLabel.textContent = `Referência: ${getCityLabel(refTz)} · ${formatTime(refTz, displayDate, hour12)}`;

  renderGrid({
    grid, emptyEl,
    cities: store.getCities(),
    displayDate,
    referenceTz: refTz,
    colorHint: store.getSettings().colorHint,
    hour12,
    handlers: {
      onRemove: tz => {
        store.removeCity(tz);
        if (store.getReference() === tz) store.clearReference();
        draw();
      },
      onSetReference: tz => { store.setReference(tz); draw(); },
    },
  });
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
    draw();
  });
});

slider.addEventListener("input", () => startComparing(Number(slider.value)));
timeInput.addEventListener("input", () => {
  const min = hhmmToMinute(timeInput.value);
  if (min != null) startComparing(min);
});
resetBtn.addEventListener("click", () => { comparing = false; draw(); });

startClock(date => {
  currentDate = date;
  if (!comparing) draw();
});
