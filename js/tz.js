export function formatTime(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function getOffsetLabel(timeZone, date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName").value; // ex.: "GMT-3", "GMT+9", "GMT"
  return name.replace(/^GMT[+-]0$/, "GMT");
}

export function getCityLabel(timeZone) {
  return timeZone.split("/").pop().replaceAll("_", " ");
}

export function formatDateShort(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, day: "2-digit", month: "2-digit",
  }).format(date);
}

// Hora local (0-23) no fuso, derivada via Intl.
function localHour(timeZone, date) {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone, hour: "2-digit", hour12: false,
  }).format(date);
  return parseInt(h, 10) % 24; // "24" → 0
}

export function dayPart(timeZone, date) {
  const h = localHour(timeZone, date);
  if (h >= 9 && h < 18) return "comercial";   // 09:00–18:00
  if (h >= 0 && h < 6) return "madrugada";     // 00:00–06:00
  return "outro";
}

export function listAllZones() {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  // Fallback mínimo para navegadores muito antigos.
  return ["America/Sao_Paulo", "America/New_York", "Europe/London", "Asia/Tokyo"];
}

// Offset do fuso em minutos para um instante (ex.: São Paulo → -180).
function offsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName").value; // "GMT-3" | "GMT" | "GMT+5:30"
  const m = parts.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
}

// Dado o dia de `base`, devolve o instante UTC em que o relógio do fuso de
// referência marca `minuteOfDay` (0..1439).
export function dateForReferenceMinute(referenceTz, base, minuteOfDay) {
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: referenceTz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(base); // "2026-06-15"
  const off = offsetMinutes(referenceTz, base);
  // Hora local desejada (em minutos) menos o offset → minutos UTC desde a meia-noite local.
  const utcMs = Date.parse(`${y}T00:00:00Z`) + (minuteOfDay - off) * 60000;
  return new Date(utcMs);
}
