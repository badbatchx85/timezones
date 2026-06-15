export function formatTime(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function getOffsetLabel(timeZone, date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName").value; // ex.: "GMT-3"
  return name.replace("GMT-0", "GMT-").replace("GMT+0", "GMT+");
}

export function getCityLabel(timeZone) {
  return timeZone.split("/").pop().replaceAll("_", " ");
}

export function formatDateShort(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, day: "2-digit", month: "2-digit",
  }).format(date);
}
