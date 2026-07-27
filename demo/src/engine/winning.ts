/**
 * 和牌判定：标准型（4 面子 + 1 将）回溯分解，叠加七对、十三幺两种特殊型。
 * 仅对“合法牌型”做判定（无起和门槛）；番种识别在 yaku.ts。
 */
import { NUM_TILE_TYPES, isSuited, isYaojiu, rankOfIndex, suitOfIndex } from './tiles';
import type { Meld } from './state';

export type SetKind = 'chi' | 'pon';

/** 一个面子：chi 记最小牌，pon 记刻子牌。 */
export interface DecompSet {
  kind: SetKind;
  tile: number;
  concealed: boolean; // 是否为暗（手内），副露为 false，暗杠为 true
  kan?: boolean;
}

export interface Decomposition {
  pair: number;
  sets: DecompSet[]; // 含副露与手内共 4 个
  special?: 'qidui' | 'shisan';
}

/** 拷贝并统计手内牌计数（长度 34）。 */
function toCounts(tiles: readonly number[]): number[] {
  const c = new Array<number>(NUM_TILE_TYPES).fill(0);
  for (const t of tiles) c[t]++;
  return c;
}

/**
 * 递归拆出 needed 个面子（不含将）。counts 会被回溯修改后复原。
 * 返回所有可能的手内面子组合。
 */
function extractSets(counts: number[], needed: number): DecompSet[][] {
  if (needed === 0) {
    return counts.every((n) => n === 0) ? [[]] : [];
  }
  // 找到最低的非零牌，必须先消化它
  let t = 0;
  while (t < NUM_TILE_TYPES && counts[t] === 0) t++;
  if (t >= NUM_TILE_TYPES) return [];

  const results: DecompSet[][] = [];

  // 尝试刻子
  if (counts[t] >= 3) {
    counts[t] -= 3;
    for (const rest of extractSets(counts, needed - 1)) {
      results.push([{ kind: 'pon', tile: t, concealed: true }, ...rest]);
    }
    counts[t] += 3;
  }

  // 尝试顺子（仅数牌，且不跨花色，rank<=7）
  if (isSuited(t) && rankOfIndex(t) <= 7 && counts[t + 1] > 0 && counts[t + 2] > 0) {
    counts[t]--;
    counts[t + 1]--;
    counts[t + 2]--;
    for (const rest of extractSets(counts, needed - 1)) {
      results.push([{ kind: 'chi', tile: t, concealed: true }, ...rest]);
    }
    counts[t]++;
    counts[t + 1]++;
    counts[t + 2]++;
  }

  return results;
}

function meldToSet(m: Meld): DecompSet {
  if (m.type === 'chi') {
    const min = Math.min(...m.tiles);
    return { kind: 'chi', tile: min, concealed: false };
  }
  const kan = m.type === 'minkan' || m.type === 'ankan' || m.type === 'kakan';
  return {
    kind: 'pon',
    tile: m.tiles[0],
    concealed: m.type === 'ankan',
    kan,
  };
}

/**
 * 标准型分解：给定手内牌（含和牌张）与副露，返回所有合法分解。
 * setsNeeded = 4 - melds.length。
 */
export function decomposeStandard(
  concealedTiles: readonly number[],
  melds: readonly Meld[]
): Decomposition[] {
  const setsNeeded = 4 - melds.length;
  if (setsNeeded < 0) return [];
  const expected = setsNeeded * 3 + 2;
  if (concealedTiles.length !== expected) return [];

  const counts = toCounts(concealedTiles);
  const meldSets = melds.map(meldToSet);
  const out: Decomposition[] = [];

  for (let p = 0; p < NUM_TILE_TYPES; p++) {
    if (counts[p] < 2) continue;
    counts[p] -= 2;
    for (const handSets of extractSets(counts, setsNeeded)) {
      out.push({ pair: p, sets: [...meldSets, ...handSets] });
    }
    counts[p] += 2;
  }
  return out;
}

/** 七对：14 张全暗、7 个对子（本 demo 不允许四张算两对，须 7 个不同对子）。 */
export function isSevenPairs(concealedTiles: readonly number[], melds: readonly Meld[]): boolean {
  if (melds.length > 0 || concealedTiles.length !== 14) return false;
  const counts = toCounts(concealedTiles);
  let pairs = 0;
  for (const c of counts) {
    if (c === 2) pairs++;
    else if (c !== 0) return false;
  }
  return pairs === 7;
}

/** 十三幺：13 种幺九各 1 张 + 其中 1 张作对。 */
export function isThirteenOrphans(
  concealedTiles: readonly number[],
  melds: readonly Meld[]
): boolean {
  if (melds.length > 0 || concealedTiles.length !== 14) return false;
  const counts = toCounts(concealedTiles);
  const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let hasPair = false;
  for (let t = 0; t < NUM_TILE_TYPES; t++) {
    if (!orphans.includes(t)) {
      if (counts[t] !== 0) return false;
      continue;
    }
    if (counts[t] === 0) return false;
    if (counts[t] === 2) hasPair = true;
    else if (counts[t] !== 1) return false;
  }
  return hasPair;
}

/** 是否可和牌（任意合法牌型）。 */
export function canWin(concealedTiles: readonly number[], melds: readonly Meld[]): boolean {
  if (isSevenPairs(concealedTiles, melds)) return true;
  if (isThirteenOrphans(concealedTiles, melds)) return true;
  return decomposeStandard(concealedTiles, melds).length > 0;
}

/** 听牌判定：13 张（或 3n+1）状态下，存在某张牌可使之成和。 */
export function isTenpai(concealedTiles: readonly number[], melds: readonly Meld[]): boolean {
  for (let t = 0; t < 34; t++) {
    if (canWin([...concealedTiles, t], melds)) return true;
  }
  return false;
}

/** 返回全部分解（含特殊型标记），供番种识别取最高番。 */
export function allDecompositions(
  concealedTiles: readonly number[],
  melds: readonly Meld[]
): Decomposition[] {
  const list = decomposeStandard(concealedTiles, melds);
  if (isSevenPairs(concealedTiles, melds)) {
    list.push({ pair: -1, sets: [], special: 'qidui' });
  }
  if (isThirteenOrphans(concealedTiles, melds)) {
    list.push({ pair: -1, sets: [], special: 'shisan' });
  }
  return list;
}

/** 便捷：花色集合（数牌）。 */
export function numberSuitsUsed(tiles: readonly number[]): Set<string> {
  const s = new Set<string>();
  for (const t of tiles) if (isSuited(t)) s.add(suitOfIndex(t));
  return s;
}

export { isYaojiu };
