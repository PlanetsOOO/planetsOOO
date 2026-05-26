/** Shared UTC simulation clock — advances in real time unless paused. */

let simUnixMs = Date.now();
let lastRealMs = Date.now();

export function resetSimulationClock(now = Date.now()) {
  simUnixMs = now;
  lastRealMs = now;
}

export function tickSimulation(paused: boolean, timeScale: number): Date {
  const now = Date.now();
  if (!paused) {
    simUnixMs += (now - lastRealMs) * timeScale;
  }
  lastRealMs = now;
  return new Date(simUnixMs);
}

export function getSimulationDate(): Date {
  return new Date(simUnixMs);
}

resetSimulationClock();
