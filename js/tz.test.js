import { it, assert, assertEqual } from "./test-harness.js";
import { formatTime } from "./tz.js";

// 2026-06-15T18:00:00Z → São Paulo (GMT-3) = 15:00; Tóquio (GMT+9) = sex 03:00
const ref = new Date("2026-06-15T18:00:00Z");

it("formatTime devolve HH:MM no fuso pedido", () => {
  assertEqual(formatTime("America/Sao_Paulo", ref), "15:00");
  assertEqual(formatTime("Asia/Tokyo", ref), "03:00");
});
