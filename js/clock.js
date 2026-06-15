// Chama onTick(new Date()) imediatamente e a cada 1s. Devolve uma função stop().
export function startClock(onTick) {
  onTick(new Date());
  const id = setInterval(() => onTick(new Date()), 1000);
  return function stop() { clearInterval(id); };
}
