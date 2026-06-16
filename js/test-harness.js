// Mini test runner sem dependências. Resultados vão para o DOM e console.
const results = [];

export function assertEqual(actual, expected, msg = "") {
  const pass = Object.is(actual, expected);
  results.push({ pass, msg, detail: pass ? "" : `esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}` });
}

export function assert(cond, msg = "") {
  results.push({ pass: !!cond, msg, detail: cond ? "" : "condição falsa" });
}

export function it(name, fn) {
  try {
    fn();
    results.push({ pass: true, msg: `it: ${name}`, detail: "", group: true });
  } catch (e) {
    results.push({ pass: false, msg: `it: ${name}`, detail: String(e), group: true });
  }
}

export function report() {
  const failed = results.filter(r => !r.pass);
  const el = document.getElementById("out");
  el.innerHTML = results
    .map(r => `<div style="color:${r.pass ? "green" : "red"}">${r.pass ? "✓" : "✗"} ${r.msg} ${r.detail}</div>`)
    .join("");
  const summary = `${results.length - failed.length}/${results.length} passaram`;
  el.insertAdjacentHTML("afterbegin", `<h2 style="color:${failed.length ? "red" : "green"}">${summary}</h2>`);
  console.log(summary);
}
