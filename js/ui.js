import { formatTime, formatDateShort, getOffsetLabel, getCityLabel, dayPart, isValidZone, getRegionLabel } from "./tz.js";

const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

// Glyph + row-state class derived from dayPart.
function partGlyph(part) {
  return part === "madrugada" ? "☾" : "☀";
}
function partRowClass(part) {
  if (part === "comercial") return "comercial";
  if (part === "madrugada") return "night";
  return "neutral";
}

// Builds the per-character flap cells for an HH:MM (or HH:MM AM) string.
function buildFlaps(timeStr) {
  return [...timeStr].map(ch => {
    const span = document.createElement("span");
    if (ch === ":") span.className = "flap colon";
    else if (ch === " ") span.className = "flap gap"; // separador AM/PM sem moldura
    else span.className = "flap";
    span.textContent = ch;
    return span;
  });
}

// Trigger a flap animation, swapping textContent at the hinge.
function flipTo(flap, ch) {
  if (REDUCED_MOTION.matches) {
    flap.textContent = ch;
    return;
  }
  // Swap mid-turn: set text now, restart the animation cleanly.
  flap.classList.remove("flip");
  void flap.offsetWidth; // force reflow so re-adding restarts the keyframe
  flap.textContent = ch;
  flap.classList.add("flip");
  flap.addEventListener("animationend", () => flap.classList.remove("flip"), { once: true });
}

// renderBoard — builds the STATIC structure once per structural change.
// Each row keeps a reference to its flap cells so updateTimes can mutate in place.
export function renderBoard({ grid, emptyEl, cities, displayDate, referenceTz, colorHint, hour12 }) {
  const valid = cities.filter(isValidZone); // pular fusos inválidos com segurança
  emptyEl.hidden = valid.length > 0;
  grid.innerHTML = "";

  valid.forEach((tz, i) => {
    const part = colorHint ? dayPart(tz, displayDate) : "outro";
    const isRef = tz === referenceTz;

    const row = document.createElement("div");
    row.className = `row ${partRowClass(part)} ${isRef ? "is-ref" : ""}`;
    row.dataset.tz = tz;
    row.style.animationDelay = `${i * 70}ms`; // staggered cascade reveal

    // left: glyph + city name (+ optional PRINCIPAL tag)
    const left = document.createElement("div");
    left.className = "row-city";
    const glyph = document.createElement("span");
    glyph.className = "glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = colorHint ? partGlyph(part) : "☀";
    const name = document.createElement("span");
    name.className = "city-name";
    name.textContent = getCityLabel(tz);
    name.title = tz; // IANA técnico só no title
    left.append(glyph, name);
    if (isRef) {
      const tag = document.createElement("span");
      tag.className = "tag-ref";
      tag.innerHTML = `<span class="dot">●</span> Principal`;
      left.append(tag);
    }

    // center: split-flap time
    const timeWrap = document.createElement("span");
    timeWrap.className = "time";
    const flaps = buildFlaps(formatTime(tz, displayDate, hour12));
    timeWrap.append(...flaps);

    // right: offset + date
    const offset = document.createElement("span");
    offset.className = "offset";
    offset.innerHTML = `<span class="gmt">${getOffsetLabel(tz, displayDate)}</span><span class="date">${formatDateShort(tz, displayDate)}</span>`;

    // remove control
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.type = "button";
    remove.title = "Remover";
    remove.setAttribute("aria-label", `Remover ${getCityLabel(tz)}`);
    remove.textContent = "✕";

    row.append(left, timeWrap, offset, remove);
    grid.append(row);

    // stash live refs for updateTimes
    row._flaps = flaps;
    row._lastTime = flaps.map(f => f.textContent).join("");
    row._glyph = glyph;
    row._offset = offset;
  });
}

// updateTimes — called each tick / comparator change. Flips only changed chars,
// and refreshes glyph/offset/date/row-state when the displayed instant changes.
export function updateTimes({ grid, displayDate, colorHint, hour12 }) {
  grid.querySelectorAll(".row").forEach(row => {
    const tz = row.dataset.tz;
    if (!tz || !row._flaps) return;

    const next = formatTime(tz, displayDate, hour12);

    // Structure (length/colon positions) is stable for a given hour12 setting,
    // so a per-position char compare is safe; rebuild defensively if it drifts.
    if (next.length !== row._flaps.length) {
      const wrap = row.querySelector(".time");
      const flaps = buildFlaps(next);
      wrap.replaceChildren(...flaps);
      row._flaps = flaps;
    } else {
      [...next].forEach((ch, idx) => {
        const flap = row._flaps[idx];
        if (flap.textContent !== ch) flipTo(flap, ch);
      });
    }
    row._lastTime = next;

    // glyph + row colour state
    const part = colorHint ? dayPart(tz, displayDate) : "outro";
    const desiredGlyph = colorHint ? partGlyph(part) : "☀";
    if (row._glyph && row._glyph.textContent !== desiredGlyph) row._glyph.textContent = desiredGlyph;
    const isRef = row.classList.contains("is-ref");
    row.className = `row ${partRowClass(part)} ${isRef ? "is-ref" : ""}`;

    // offset + date
    if (row._offset) {
      const gmt = getOffsetLabel(tz, displayDate);
      const date = formatDateShort(tz, displayDate);
      const gmtEl = row._offset.querySelector(".gmt");
      const dateEl = row._offset.querySelector(".date");
      if (gmtEl && gmtEl.textContent !== gmt) gmtEl.textContent = gmt;
      if (dateEl && dateEl.textContent !== date) dateEl.textContent = date;
    }
  });
}

// Attach click (set reference) + remove listeners. Called once after renderBoard.
export function wireBoard(grid, handlers) {
  grid.querySelectorAll(".row").forEach(row => {
    row.addEventListener("click", e => {
      if (e.target.closest(".remove")) return;
      handlers.onSetReference(row.dataset.tz);
    });
  });
  grid.querySelectorAll(".remove").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation(); // não dispara onSetReference
      handlers.onRemove(e.target.closest(".row").dataset.tz);
    }));
}

export function renderSearch(resultsEl, matches, onPick) {
  resultsEl.innerHTML = matches.map(({ tz, time }) =>
    `<li data-tz="${tz}" title="${tz}">
       <span class="r-name">${getCityLabel(tz)}<span class="r-region">${getRegionLabel(tz)}</span></span>
       <span class="r-time">${time}<span class="r-add">＋</span></span>
     </li>`).join("");
  resultsEl.querySelectorAll("li").forEach(li =>
    li.addEventListener("click", () => onPick(li.dataset.tz)));
}
