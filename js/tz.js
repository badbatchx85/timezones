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
