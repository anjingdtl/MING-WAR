export interface RandomSource {
  seed: number;
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  }

  return {
    get seed() {
      return state;
    },
    next,
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(items: T[]) {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }
      return items[Math.floor(next() * items.length)];
    }
  };
}
