/**
 * 麻将牌定义（最大公约数基础层）：万/筒/条 三种数牌 + 风/箭字牌，不含花牌。
 * 34 种牌型，每种 4 张，共 136 张。
 *
 * 34 索引编码：
 *   0..8   万 m1..m9
 *   9..17  筒 p1..p9
 *   18..26 条 s1..s9   （幺鸡 = 1 条 = 索引 18）
 *   27..30 风 东/南/西/北
 *   31..33 箭 中/发/白
 */
import { makeRng, shuffleInPlace, type RNG } from './rng';

export type Suit = 'm' | 'p' | 's' | 'z';

export const NUM_TILE_TYPES = 34;
export const COPIES_PER_TYPE = 4;
export const TOTAL_TILES = NUM_TILE_TYPES * COPIES_PER_TYPE; // 136

/** 幺鸡（1 条）索引——捉鸡流的核心宝牌。 */
export const YAOJI_INDEX = 18;

export function suitOfIndex(i: number): Suit {
  if (i < 9) return 'm';
  if (i < 18) return 'p';
  if (i < 27) return 's';
  return 'z';
}

/** 数牌返回 1..9；字牌返回 1..7（东南西北中发白）。 */
export function rankOfIndex(i: number): number {
  if (i < 27) return (i % 9) + 1;
  return i - 27 + 1;
}

export function indexOf(suit: Suit, rank: number): number {
  switch (suit) {
    case 'm':
      return rank - 1;
    case 'p':
      return 9 + (rank - 1);
    case 's':
      return 18 + (rank - 1);
    case 'z':
      return 27 + (rank - 1);
  }
}

export function isHonor(i: number): boolean {
  return i >= 27;
}
export function isWind(i: number): boolean {
  return i >= 27 && i <= 30;
}
export function isDragon(i: number): boolean {
  return i >= 31 && i <= 33;
}
/** 数牌的 1 或 9（老头牌）。 */
export function isTerminal(i: number): boolean {
  if (i >= 27) return false;
  const r = rankOfIndex(i);
  return r === 1 || r === 9;
}
/** 幺九牌：老头牌或字牌。 */
export function isYaojiu(i: number): boolean {
  return isHonor(i) || isTerminal(i);
}
/** 是否为数牌（万/筒/条）。 */
export function isSuited(i: number): boolean {
  return i < 27;
}

export const HONOR_NAMES = ['东', '南', '西', '北', '中', '发', '白'];
const SUIT_CN: Record<Exclude<Suit, 'z'>, string> = { m: '万', p: '筒', s: '条' };

/** 中文全名，如 “三万”“幺鸡→1条=一条”“发”。 */
export function tileName(i: number): string {
  if (i >= 27) return HONOR_NAMES[i - 27];
  const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return cn[rankOfIndex(i) - 1] + SUIT_CN[suitOfIndex(i) as Exclude<Suit, 'z'>];
}

/** 简短英文名，便于调试/测试，如 3m / 1s / E / C。 */
export function shortName(i: number): string {
  if (i >= 27) return ['E', 'S', 'W', 'N', 'C', 'F', 'B'][i - 27];
  return `${rankOfIndex(i)}${suitOfIndex(i)}`;
}

/** 解析简短名到索引（测试用）。支持 "3m" "1s" "E" 等。 */
export function parseTile(s: string): number {
  const honorIdx = ['E', 'S', 'W', 'N', 'C', 'F', 'B'].indexOf(s.toUpperCase());
  if (honorIdx >= 0) return 27 + honorIdx;
  const rank = parseInt(s[0], 10);
  const suit = s[1] as Suit;
  return indexOf(suit, rank);
}

/** 批量解析，如 "1m 1m 2m 3m ..."。 */
export function parseHand(s: string): number[] {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseTile);
}

/** 生成完整牌墙（136 张牌的索引数组），并用 RNG 洗牌。 */
export function createWall(rng: RNG): number[] {
  const wall: number[] = [];
  for (let t = 0; t < NUM_TILE_TYPES; t++) {
    for (let c = 0; c < COPIES_PER_TYPE; c++) wall.push(t);
  }
  return shuffleInPlace(wall, rng);
}

/** 将牌索引数组转换为长度 34 的计数数组。 */
export function counts34(tiles: readonly number[]): number[] {
  const arr = new Array<number>(NUM_TILE_TYPES).fill(0);
  for (const t of tiles) arr[t]++;
  return arr;
}

/** 将计数数组展开回牌索引数组（升序）。 */
export function countsToTiles(counts: readonly number[]): number[] {
  const out: number[] = [];
  for (let t = 0; t < counts.length; t++) {
    for (let c = 0; c < counts[t]; c++) out.push(t);
  }
  return out;
}

/** 便捷：以固定种子生成 RNG（测试/复现用）。 */
export function seededRng(seed: number): RNG {
  return makeRng(seed);
}
