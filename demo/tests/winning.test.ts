import { describe, it, expect } from 'vitest';
import { parseHand } from '../src/engine/tiles';
import {
  canWin,
  decomposeStandard,
  isSevenPairs,
  isThirteenOrphans,
} from '../src/engine/winning';

describe('和牌判定', () => {
  it('标准型：顺子刻子混合可和', () => {
    const h = parseHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5p 5p');
    expect(decomposeStandard(h, []).length).toBeGreaterThan(0);
    expect(canWin(h, [])).toBe(true);
  });

  it('未成型不可和', () => {
    const h = parseHand('1m 2m 4m 5m 7m 9m 1p 3p 5p 7p 9p E S W');
    expect(canWin(h, [])).toBe(false);
  });

  it('七对判定', () => {
    const h = parseHand('1m 1m 3m 3m 5m 5m 7m 7m 9m 9m 2p 2p 4p 4p');
    expect(isSevenPairs(h, [])).toBe(true);
    expect(canWin(h, [])).toBe(true);
    // 含副露不算七对
    expect(isSevenPairs(h, [{ type: 'pon', tiles: [0, 0, 0], from: 1, claimed: 0 }])).toBe(false);
  });

  it('十三幺判定', () => {
    const h = parseHand('1m 9m 1p 9p 1s 9s E S W N C F B 1m');
    expect(isThirteenOrphans(h, [])).toBe(true);
    expect(canWin(h, [])).toBe(true);
  });

  it('副露 + 手内组合可和（3 副露 + 手内 1 顺 + 将）', () => {
    // 3 个碰 + 手内 2m3m4m + 将 5p5p = 需要手内 3*1+2=5 张
    const hand = parseHand('2m 3m 4m 5p 5p');
    const melds = [
      { type: 'pon' as const, tiles: parseHand('E E E'), from: 1, claimed: 27 },
      { type: 'pon' as const, tiles: parseHand('S S S'), from: 2, claimed: 28 },
      { type: 'pon' as const, tiles: parseHand('W W W'), from: 3, claimed: 29 },
    ];
    expect(canWin(hand, melds)).toBe(true);
  });
});
