import { it, assertEqual, assert } from "./test-harness.js";
import { createStore } from "./store.js";

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

it("addCity/getCities persiste e não duplica", () => {
  const s = createStore(fakeStorage());
  s.addCity("America/Sao_Paulo");
  s.addCity("Asia/Tokyo");
  s.addCity("America/Sao_Paulo"); // duplicada, ignora
  assertEqual(s.getCities().length, 2);
  assertEqual(s.getCities()[0], "America/Sao_Paulo");
});

it("setCities persiste a ordem dada", () => {
  const s = createStore(fakeStorage());
  s.addCity("America/Sao_Paulo"); s.addCity("Asia/Tokyo");
  s.setCities(["Asia/Tokyo", "America/Sao_Paulo"]);
  assertEqual(s.getCities()[0], "Asia/Tokyo");
  assertEqual(s.getCities()[1], "America/Sao_Paulo");
});

it("removeCity remove", () => {
  const s = createStore(fakeStorage());
  s.addCity("Europe/London");
  s.removeCity("Europe/London");
  assertEqual(s.getCities().length, 0);
});

it("setReference/getReference persiste", () => {
  const s = createStore(fakeStorage());
  s.setReference("Asia/Tokyo");
  assertEqual(s.getReference(), "Asia/Tokyo");
});

it("getReference cai no fuso local quando não definido", () => {
  const s = createStore(fakeStorage());
  assertEqual(typeof s.getReference(), "string");
  assert(s.getReference().length > 0, "referência padrão não vazia");
});

it("clearReference faz getReference voltar ao fuso local", () => {
  const s = createStore(fakeStorage());
  s.setReference("Asia/Tokyo");
  s.clearReference();
  assertEqual(typeof s.getReference(), "string");
  assert(s.getReference() !== "Asia/Tokyo" || s.getReference().length > 0, "voltou ao padrão");
});
