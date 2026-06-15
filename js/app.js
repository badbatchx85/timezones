import { createStore } from "./store.js";
import { startClock } from "./clock.js";
import { listAllZones, dateForReferenceMinute, formatTime, getCityLabel } from "./tz.js";
import { renderGrid, renderSearch } from "./ui.js";

const store = createStore();
const grid = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const search = document.getElementById("search");
const results = document.getElementById("results");
const allZones = listAllZones();
const slider = document.getElementById("slider");
const resetBtn = document.getElementById("reset");
const refLabel = document.getElementById("ref-label");

let comparing = false; // false = modo ao vivo; true = usando o slider

// Sugestões na primeira visita.
if (store.getCities().length === 0) {
  ["America/Sao_Paulo", "America/New_York", "Europe/London", "Asia/Tokyo"].forEach(tz => store.addCity(tz));
}

let currentDate = new Date();

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

slider.addEventListener("input", () => { comparing = true; draw(); });
resetBtn.addEventListener("click", () => { comparing = false; draw(); });

startClock(date => {
  currentDate = date;
  if (!comparing) draw();
});
