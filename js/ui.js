import { formatTime, formatDateShort, getOffsetLabel, getCityLabel, dayPart, isValidZone, getRegionLabel } from "./tz.js";

const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

// A cascata de revelação só roda no primeiro desenho; reordenar/add/remover é instantâneo.
let firstPaint = true;
// Fuso que acabou de ser movido (arrastar/setas) → pulso de "encaixe" no próximo render.
let justDropped = null;

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
    if (firstPaint) {
      row.style.animationDelay = `${i * 70}ms`; // staggered cascade reveal (1ª pintura)
    } else if (tz === justDropped) {
      row.classList.add("just-dropped"); // pulso de encaixe na linha recém-movida
    } else {
      row.classList.add("no-anim"); // reordenar/add/remover = instantâneo
    }

    // drag handle (início da linha) — só ativa draggable enquanto segura o grip
    const handle = document.createElement("button");
    handle.className = "handle";
    handle.type = "button";
    handle.setAttribute("aria-label", "Arrastar para reordenar");
    handle.title = "Arrastar para reordenar";
    handle.textContent = "⠿";

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
      tag.innerHTML = `<span class="dot">●</span> Referência`;
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

    // controls group (fim da linha): subir, descer, remover
    const controls = document.createElement("div");
    controls.className = "row-controls";

    const moveUp = document.createElement("button");
    moveUp.className = "move-up";
    moveUp.type = "button";
    moveUp.setAttribute("aria-label", "Mover para cima");
    moveUp.title = "Subir";
    moveUp.textContent = "↑";
    if (i === 0) moveUp.disabled = true;

    const moveDown = document.createElement("button");
    moveDown.className = "move-down";
    moveDown.type = "button";
    moveDown.setAttribute("aria-label", "Mover para baixo");
    moveDown.title = "Descer";
    moveDown.textContent = "↓";
    if (i === valid.length - 1) moveDown.disabled = true;

    // remove control
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.type = "button";
    remove.title = "Remover";
    remove.setAttribute("aria-label", `Remover ${getCityLabel(tz)}`);
    remove.textContent = "✕";

    controls.append(moveUp, moveDown, remove);
    row.append(handle, left, timeWrap, offset, controls);
    grid.append(row);

    // stash live refs for updateTimes
    row._flaps = flaps;
    row._lastTime = flaps.map(f => f.textContent).join("");
    row._glyph = glyph;
    row._offset = offset;
  });

  firstPaint = false; // cascata só na 1ª pintura
  justDropped = null; // pulso consumido neste render
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

    // glyph + row colour state — atualização cirúrgica (preserva no-anim/just-dropped/dragging/is-ref)
    const part = colorHint ? dayPart(tz, displayDate) : "outro";
    const desiredGlyph = colorHint ? partGlyph(part) : "☀";
    if (row._glyph && row._glyph.textContent !== desiredGlyph) row._glyph.textContent = desiredGlyph;
    row.classList.remove("neutral", "comercial", "night");
    row.classList.add(partRowClass(part));

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

// Attach click (set reference) + remove + reorder (arrows & drag). Called once after renderBoard.
export function wireBoard(grid, handlers) {
  // Ordem atual das linhas conforme o DOM.
  const order = () => [...grid.querySelectorAll(".row")].map(r => r.dataset.tz);

  let dragged = null; // linha sendo arrastada (escopo desta wireBoard)

  grid.querySelectorAll(".row").forEach(row => {
    // clique no corpo da linha → define referência; ignora controles e grip
    row.addEventListener("click", e => {
      if (e.target.closest(".row-controls") || e.target.closest(".handle")) return;
      handlers.onSetReference(row.dataset.tz);
    });

    // setas: reordena uma posição
    const up = row.querySelector(".move-up");
    const down = row.querySelector(".move-down");
    if (up) up.addEventListener("click", e => {
      e.stopPropagation();
      const o = order();
      const i = o.indexOf(row.dataset.tz);
      if (i > 0) { [o[i - 1], o[i]] = [o[i], o[i - 1]]; justDropped = row.dataset.tz; handlers.onReorder(o); }
    });
    if (down) down.addEventListener("click", e => {
      e.stopPropagation();
      const o = order();
      const i = o.indexOf(row.dataset.tz);
      if (i < o.length - 1) { [o[i], o[i + 1]] = [o[i + 1], o[i]]; justDropped = row.dataset.tz; handlers.onReorder(o); }
    });

    // remover
    const remove = row.querySelector(".remove");
    if (remove) remove.addEventListener("click", e => {
      e.stopPropagation(); // não dispara onSetReference
      handlers.onRemove(row.dataset.tz);
    });

    // grip: drag só inicia ao segurar o ⠿; corpo da linha continua clicável
    const handle = row.querySelector(".handle");
    if (handle) {
      const enable = () => { row.draggable = true; };
      const disable = () => { row.draggable = false; };
      handle.addEventListener("pointerdown", enable);
      handle.addEventListener("mousedown", enable);
      handle.addEventListener("pointerup", disable);
      handle.addEventListener("click", e => e.stopPropagation()); // não define referência
    }

    row.addEventListener("dragstart", e => {
      dragged = row;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.tz);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      row.draggable = false;
      dragged = null;
      justDropped = row.dataset.tz; // pulso de encaixe na linha recém-solta
      handlers.onReorder(order()); // persiste a ordem final do DOM
    });
  });

  // dragover/drop no container: reordenação ao vivo conforme o cursor
  grid.addEventListener("dragover", e => {
    e.preventDefault();
    if (!dragged) return;
    const over = e.target.closest(".row");
    if (!over || over === dragged) return;
    const rect = over.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const refNode = after ? over.nextSibling : over;
    if (refNode !== dragged) over.parentNode.insertBefore(dragged, refNode);
  });
  grid.addEventListener("drop", e => e.preventDefault());
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
