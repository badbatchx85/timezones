import { it, assert, assertEqual } from "./test-harness.js";
import { formatTime, getOffsetLabel, getCityLabel, formatDateShort, dayPart, listAllZones } from "./tz.js";

// 2026-06-15T18:00:00Z → São Paulo (GMT-3) = 15:00; Tóquio (GMT+9) = sex 03:00
const ref = new Date("2026-06-15T18:00:00Z");

it("formatTime devolve HH:MM no fuso pedido", () => {
  assertEqual(formatTime("America/Sao_Paulo", ref), "15:00");
  assertEqual(formatTime("Asia/Tokyo", ref), "03:00");
});

it("getOffsetLabel devolve GMT±N", () => {
  assertEqual(getOffsetLabel("America/Sao_Paulo", ref), "GMT-3");
  assertEqual(getOffsetLabel("Asia/Tokyo", ref), "GMT+9");
});

it("getCityLabel humaniza o nome IANA", () => {
  assertEqual(getCityLabel("America/Sao_Paulo"), "Sao Paulo");
  assertEqual(getCityLabel("America/New_York"), "New York");
});

it("formatDateShort mostra a data no fuso", () => {
  assertEqual(formatDateShort("Asia/Tokyo", ref), "16/06");
  assertEqual(formatDateShort("America/Sao_Paulo", ref), "15/06");
});

it("dayPart classifica por faixa de hora local", () => {
  // ref = 18:00Z → SP 15:00 (comercial), Tóquio 03:00 (madrugada), Londres 19:00 (outro)
  assertEqual(dayPart("America/Sao_Paulo", ref), "comercial");
  assertEqual(dayPart("Asia/Tokyo", ref), "madrugada");
  assertEqual(dayPart("Europe/London", ref), "outro");
});

it("listAllZones devolve muitos fusos IANA incluindo Sao_Paulo", () => {
  const zones = listAllZones();
  assert(zones.length > 100, "deve haver centenas de fusos");
  assert(zones.includes("America/Sao_Paulo"), "inclui Sao_Paulo");
});
