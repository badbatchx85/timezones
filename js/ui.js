import { formatTime, formatDateShort, getOffsetLabel, getCityLabel, dayPart, isValidZone, getRegionLabel } from "./tz.js";

// Desenha a grade. `displayDate` é a hora atual OU a hora derivada do comparador.
export function renderGrid({ grid, emptyEl, cities, displayDate, referenceTz, colorHint, hour12, handlers }) {
  emptyEl.hidden = cities.length > 0;
  grid.innerHTML = cities.map(tz => {
    if (!isValidZone(tz)) return ""; // fuso inválido salvo: ignorado com segurança
    const part = colorHint ? dayPart(tz, displayDate) : "outro";
    const isRef = tz === referenceTz;
    return `
      <div class="card ${part} ${isRef ? "is-ref" : ""}" data-tz="${tz}">
        ${isRef ? `<div class="badge">PRINCIPAL</div>` : ""}
        <button class="remove" title="Remover" aria-label="Remover ${getCityLabel(tz)}">✕</button>
        <div class="name">${getCityLabel(tz)}</div>
        <div class="time">${formatTime(tz, displayDate, hour12)}</div>
        <div class="meta">${formatDateShort(tz, displayDate)} · ${getOffsetLabel(tz, displayDate)}</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".remove")) return;
      handlers.onSetReference(card.dataset.tz);
    });
  });
  grid.querySelectorAll(".remove").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation();
      handlers.onRemove(e.target.closest(".card").dataset.tz);
    }));
}

export function renderSearch(resultsEl, matches, onPick) {
  resultsEl.innerHTML = matches.map(({ tz, time }) =>
    `<li data-tz="${tz}" title="${tz}">
       <span class="r-name">${getCityLabel(tz)}<span class="r-region">${getRegionLabel(tz)}</span></span>
       <span class="r-time">${time} ＋</span>
     </li>`).join("");
  resultsEl.querySelectorAll("li").forEach(li =>
    li.addEventListener("click", () => onPick(li.dataset.tz)));
}
