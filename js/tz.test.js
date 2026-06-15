import { it, assert, assertEqual } from "./test-harness.js";
import { formatTime, getOffsetLabel, getCityLabel, formatDateShort } from "./tz.js";

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
