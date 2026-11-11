// A stable number from 0 up to 1 for any text, so simulated data never changes between loads.
// Shared by the signal and emotion mocks, so the same seed always gives the same reading.

export function seeded(seed: string, k = 0) {
  let h = 2166136261
  for (const ch of `${seed}|${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) / 2 ** 32
}

export const r1 = (x: number) => Math.round(x * 10) / 10
