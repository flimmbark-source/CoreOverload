export type Rng = {
  /**
   * Returns a float in the range [0, 1).
   */
  next: () => number;
};

const FALLBACK_RNG: Rng = {
  next: () => Math.random(),
};

/**
 * Mulberry32 PRNG for deterministic playtest runs.
 */
const mulberry32 = (seed: number): Rng => {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5; // avoid a zero-lock state
  }
  return {
    next: () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
};

export const createRng = (seed?: number): Rng => {
  if (typeof seed !== "number" || !Number.isFinite(seed)) {
    return FALLBACK_RNG;
  }
  return mulberry32(seed);
};

export const shuffleArray = <T>(values: T[], rng: Rng): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
