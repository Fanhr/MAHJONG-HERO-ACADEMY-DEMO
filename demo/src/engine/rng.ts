/**
 * 可复现随机数：mulberry32 + 基于种子的洗牌。
 * 引擎内所有随机（洗牌、宝牌生成、AI 抖动）都应经过 RNG，便于单测复现。
 */

export interface RNG {
  /** 返回 [0,1) 浮点 */
  next(): number;
  /** 返回 [0,max) 整数 */
  int(max: number): number;
  /** 当前内部状态（用于持久化到 GameState） */
  state(): number;
}

export function makeRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max: number) => Math.floor(next() * max),
    state: () => a >>> 0,
  };
}

/** Fisher–Yates 洗牌（原地），使用给定 RNG。 */
export function shuffleInPlace<T>(arr: T[], rng: RNG): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** 从数组中按 RNG 随机取 n 个不重复元素（返回新数组，不改原数组）。 */
export function sampleN<T>(arr: readonly T[], n: number, rng: RNG): T[] {
  const pool = arr.slice();
  shuffleInPlace(pool, rng);
  return pool.slice(0, Math.min(n, pool.length));
}
