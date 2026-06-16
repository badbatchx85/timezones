import { formatTime, formatDateShort, getOffsetLabel, getCityLabel, dayPart, isValidZone } from "./tz.js";

// Desenha a grade. `displayDate` é a hora atual OU a hora derivada do comparador.
export function renderGrid({ grid, emptyEl, cities, displayDate, referenceTz, colorHint, hour12, handlers }) {
  emptyEl.hidden = cities.length > 0;
  grid.innerHTML = cities.map(tz => {
    if (!isValidZone(tz)) return ""; // fuso inválido salvo: ignorado com segurança
    const part = colorHint ? dayPart(tz, displayDate) : "outro";
    const isRef = tz === referenceTz;
    return `
      <div class="card ${part} ${isRef ? "is-ref" : ""}" data-tz="${tz}">
        <button class="ref" title="Definir como referência">🎯</button>
        <button class="star" title="Remover">⭐</button>
        <div class="name">${getCityLabel(tz)}</div>
        <div class="time">${formatTime(tz, displayDate, hour12)}</div>
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
