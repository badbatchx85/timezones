import { it, assert, assertEqual } from "./test-harness.js";
import { formatTime, getOffsetLabel, getCityLabel, formatDateShort, dayPart, listAllZones } from "./tz.js";
import { dateForReferenceMinute } from "./tz.js";
import { minuteToHHMM, hhmmToMinute } from "./tz.js";
import { isValidZone } from "./tz.js";

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

it("getOffsetLabel colapsa offset zero para GMT", () => {
  assertEqual(getOffsetLabel("UTC", ref), "GMT");
  assertEqual(getOffsetLabel("Europe/London", new Date("2026-01-15T12:00:00Z")), "GMT");
});

it("listAllZones devolve muitos fusos IANA incluindo Sao_Paulo", () => {
  const zones = listAllZones();
  assert(zones.length > 100, "deve haver centenas de fusos");
  assert(zones.includes("America/Sao_Paulo"), "inclui Sao_Paulo");
});

it("dateForReferenceMinute monta a hora escolhida no fuso de referência", () => {
  // base: qualquer instante de 2026-06-15; escolher 15:00 (=900 min) em São Paulo (GMT-3)
  // 15:00 em GMT-3 == 18:00Z
  const base = new Date("2026-06-15T10:00:00Z");
  const d = dateForReferenceMinute("America/Sao_Paulo", base, 900);
  assertEqual(d.toISOString(), "2026-06-15T18:00:00.000Z");
});

it("minuteToHHMM formata minutos do dia como HH:MM", () => {
  assertEqual(minuteToHHMM(0), "00:00");
  assertEqual(minuteToHHMM(90), "01:30");
  assertEqual(minuteToHHMM(870), "14:30");
  assertEqual(minuteToHHMM(1439), "23:59");
});

it("hhmmToMinute converte HH:MM em minutos (null se inválido)", () => {
  assertEqual(hhmmToMinute("00:00"), 0);
  assertEqual(hhmmToMinute("14:30"), 870);
  assertEqual(hhmmToMinute("23:59"), 1439);
  assertEqual(hhmmToMinute("xx"), null);
  assertEqual(hhmmToMinute(""), null);
});

it("isValidZone valida fusos IANA", () => {
  assertEqual(isValidZone("America/Sao_Paulo"), true);
  assertEqual(isValidZone("Asia/Tokyo"), true);
  assertEqual(isValidZone("Mars/Phobos"), false);
  assertEqual(isValidZone("not a zone"), false);
});
