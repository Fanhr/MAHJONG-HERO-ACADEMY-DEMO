/**
 * 副露合法性检测：吃（仅下家）、碰、明杠、荣和。
 * 应用（改手牌/加副露/转移行动权）在 turnMachine 中完成。
 */
import { isSuited, rankOfIndex, suitOfIndex } from './tiles';
import { canWin } from './winning';
import type { Meld } from './state';

export function countInHand(hand: readonly number[], tile: number): number {
  let n = 0;
  for (const t of hand) if (t === tile) n++;
  return n;
}

export function canPon(hand: readonly number[], tile: number): boolean {
  return countInHand(hand, tile) >= 2;
}

export function canMinkan(hand: readonly number[], tile: number): boolean {
  return countInHand(hand, tile) >= 3;
}

/**
 * 吃的所有组合（返回需要从手牌拿出的两张）。仅当 tile 为数牌、且宣告者为打出者的下家时有效。
 */
export function chiOptions(hand: readonly number[], tile: number): number[][] {
  if (!isSuited(tile)) return [];
  const suit = suitOfIndex(tile);
  const r = rankOfIndex(tile);
  const has = (rank: number) =>
    rank >= 1 && rank <= 9 && hand.includes(tileIdx(suit, rank));
  const idx = (rank: number) => tileIdx(suit, rank);
  const opts: number[][] = [];
  // tile 作为顺子的高/中/低
  if (has(r - 2) && has(r - 1)) opts.push([idx(r - 2), idx(r - 1)]);
  if (has(r - 1) && has(r + 1)) opts.push([idx(r - 1), idx(r + 1)]);
  if (has(r + 1) && has(r + 2)) opts.push([idx(r + 1), idx(r + 2)]);
  return opts;
}

function tileIdx(suit: string, rank: number): number {
  const base = suit === 'm' ? 0 : suit === 'p' ? 9 : suit === 's' ? 18 : 27;
  return base + (rank - 1);
}

/** 荣和判定：把 tile 并入手牌后是否成和。 */
export function canRonTile(
  concealed: readonly number[],
  melds: readonly Meld[],
  tile: number
): boolean {
  return canWin([...concealed, tile], melds);
}

/** 自家可暗杠的牌（手牌中恰有 4 张）。 */
export function ankanOptions(hand: readonly number[]): number[] {
  const cnt = new Map<number, number>();
  for (const t of hand) cnt.set(t, (cnt.get(t) ?? 0) + 1);
  const out: number[] = [];
  for (const [t, n] of cnt) if (n === 4) out.push(t);
  return out;
}

/** 自家可加杠的牌（已有碰的刻子，且手中再摸到同名）。 */
export function kakanOptions(hand: readonly number[], melds: readonly Meld[]): number[] {
  const out: number[] = [];
  for (const m of melds) {
    if (m.type === 'pon' && hand.includes(m.tiles[0])) out.push(m.tiles[0]);
  }
  return out;
}
