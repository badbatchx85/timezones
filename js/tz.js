export function formatTime(timeZone, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}
