import { describe, it, expect } from 'vitest';
import {
  createWall,
  counts34,
  countsToTiles,
  indexOf,
  rankOfIndex,
  suitOfIndex,
  isYaojiu,
  isHonor,
  YAOJI_INDEX,
  parseHand,
  shortName,
  TOTAL_TILES,
  NUM_TILE_TYPES,
} from '../src/engine/tiles';
import { seededRng } from '../src/engine/tiles';

describe('tiles 基础', () => {
  it('索引编码与花色/点数一致', () => {
    expect(indexOf('m', 1)).toBe(0);
    expect(indexOf('p', 1)).toBe(9);
    expect(indexOf('s', 1)).toBe(18);
    expect(indexOf('z', 1)).toBe(27);
    expect(YAOJI_INDEX).toBe(indexOf('s', 1));
    expect(suitOfIndex(0)).toBe('m');
    expect(suitOfIndex(9)).toBe('p');
    expect(suitOfIndex(18)).toBe('s');
    expect(suitOfIndex(33)).toBe('z');
    expect(rankOfIndex(8)).toBe(9);
    expect(rankOfIndex(31)).toBe(5); // 中
  });

  it('幺九与字牌判定', () => {
    expect(isYaojiu(indexOf('m', 1))).toBe(true);
    expect(isYaojiu(indexOf('m', 9))).toBe(true);
    expect(isYaojiu(indexOf('m', 5))).toBe(false);
    expect(isYaojiu(indexOf('z', 3))).toBe(true);
    expect(isHonor(indexOf('z', 1))).toBe(true);
    expect(isHonor(indexOf('s', 1))).toBe(false);
  });

  it('牌墙为完整 136 张，每种恰好 4 张', () => {
    const wall = createWall(seededRng(42));
    expect(wall.length).toBe(TOTAL_TILES);
    const cnt = counts34(wall);
    expect(cnt.length).toBe(NUM_TILE_TYPES);
    expect(cnt.every((c) => c === 4)).toBe(true);
  });

  it('counts34 与 countsToTiles 互逆', () => {
    const tiles = parseHand('1m 1m 2m 3m 9p 9p E E C');
    const back = countsToTiles(counts34(tiles));
    expect(back).toEqual([...tiles].sort((a, b) => a - b));
  });

  it('shortName 可读', () => {
    expect(shortName(indexOf('m', 3))).toBe('3m');
    expect(shortName(indexOf('s', 1))).toBe('1s');
    expect(shortName(indexOf('z', 5))).toBe('C');
  });
});
