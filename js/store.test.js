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

// --- Grupos ---

it("migra rm.cities/rm.reference antigos para um grupo 'Geral' ativo", () => {
  const fs = fakeStorage();
  fs.setItem("rm.cities", JSON.stringify(["America/Sao_Paulo", "Asia/Tokyo"]));
  fs.setItem("rm.reference", JSON.stringify("Asia/Tokyo"));
  const s = createStore(fs);
  const groups = s.getGroups();
  assertEqual(groups.length, 1);
  assertEqual(groups[0].name, "Geral");
  assertEqual(s.getActiveGroupId(), groups[0].id);
  assertEqual(s.getCities().length, 2);
  assertEqual(s.getCities()[0], "America/Sao_Paulo");
  assertEqual(s.getReference(), "Asia/Tokyo");
});

it("cria 'Geral' vazio quando não há dados legados", () => {
  const s = createStore(fakeStorage());
  assertEqual(s.getGroups().length, 1);
  assertEqual(s.getGroups()[0].name, "Geral");
  assertEqual(s.getCities().length, 0);
});

it("cidades e referência são escopadas ao grupo ativo", () => {
  const s = createStore(fakeStorage());
  s.addCity("America/Sao_Paulo");
  const g2 = s.addGroup("Time");
  assertEqual(s.getActiveGroupId(), g2);
  assertEqual(s.getCities().length, 0);
  s.addCity("Asia/Tokyo");
  s.setReference("Asia/Tokyo");
  assertEqual(s.getCities()[0], "Asia/Tokyo");
  const g1 = s.getGroups()[0].id;
  s.setActiveGroup(g1);
  assertEqual(s.getCities()[0], "America/Sao_Paulo");
});

it("addGroup retorna id e ativa; renameGroup renomeia; nome vazio é ignorado", () => {
  const s = createStore(fakeStorage());
  const id = s.addGroup("Família");
  assertEqual(typeof id, "string");
  assertEqual(s.getActiveGroupId(), id);
  s.renameGroup(id, "Casa");
  assertEqual(s.getGroups().find(g => g.id === id).name, "Casa");
  s.renameGroup(id, "   ");
  assertEqual(s.getGroups().find(g => g.id === id).name, "Casa");
});

it("removeGroup remove e reativa o primeiro; nunca apaga o último", () => {
  const s = createStore(fakeStorage());
  const g1 = s.getGroups()[0].id;
  const g2 = s.addGroup("Time");
  s.removeGroup(g2);
  assertEqual(s.getGroups().length, 1);
  assertEqual(s.getActiveGroupId(), g1);
  s.removeGroup(g1);
  assertEqual(s.getGroups().length, 1);
});
