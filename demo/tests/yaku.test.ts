import { describe, it, expect } from 'vitest';
import { parseHand } from '../src/engine/tiles';
import { evaluateYaku } from '../src/engine/yaku';
import { fanToDamage } from '../src/engine/constants';

function fanOf(handStr: string, isTsumo = false): { fan: number; names: string[] } {
  const hand = parseHand(handStr);
  const r = evaluateYaku({ concealedTiles: hand, melds: [], winningTile: hand[0], isTsumo });
  if (!r) throw new Error('not a win: ' + handStr);
  return { fan: r.fan, names: r.hits.map((h) => h.name) };
}

describe('番种识别（精选子集）', () => {
  it('清一色', () => {
    const { names } = fanOf('1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 8m 8m 9m 9m');
    expect(names).toContain('清一色');
  });

  it('碰碰和 + 混一色', () => {
    const { names } = fanOf('2m 2m 2m 5m 5m 5m 8m 8m 8m E E E W W');
    expect(names).toContain('碰碰和');
    expect(names).toContain('混一色');
  });

  it('平和 + 断幺', () => {
    const { names } = fanOf('2m 3m 4m 5m 6m 7m 3p 4p 5p 6p 7p 8p 5s 5s');
    expect(names).toContain('平和');
    expect(names).toContain('断幺');
  });

  it('大三元（役满级，高额伤害）', () => {
    const { fan, names } = fanOf('C C C F F F B B B 2m 3m 4m 5m 5m');
    expect(names).toContain('大三元');
    expect(fanToDamage(fan)).toBeGreaterThanOrEqual(90);
    expect(fanToDamage(fan)).toBeLessThanOrEqual(96);
  });

  it('七对', () => {
    const { names } = fanOf('1m 1m 3m 3m 5m 5m 7m 7m 9m 9m 2p 2p 4p 4p');
    expect(names).toContain('七对');
  });

  it('十三幺（88 番 → 役满级高伤）', () => {
    const { fan, names } = fanOf('1m 9m 1p 9p 1s 9s E S W N C F B 1m');
    expect(names).toContain('十三幺');
    expect(fanToDamage(fan)).toBeGreaterThanOrEqual(90);
    expect(fanToDamage(fan)).toBeLessThanOrEqual(96);
  });

  it('自摸门清 → 不求人', () => {
    const { names } = fanOf('2m 3m 4m 5m 6m 7m 3p 4p 5p 6p 7p 8p 5s 5s', true);
    expect(names).toContain('不求人');
  });
});

describe('番数→伤害映射（平滑递增曲线）', () => {
  it('随番数单调递增，高番显著高于低番，无大范围断档', () => {
    // 下限 6、上限 96
    expect(fanToDamage(1)).toBe(6);
    expect(fanToDamage(88)).toBeLessThanOrEqual(96);
    // 梯度与难度成比例：清一色(24) < 清一色+清龙(40) < 役满(88)
    expect(fanToDamage(24)).toBeLessThan(fanToDamage(40));
    expect(fanToDamage(40)).toBeLessThan(fanToDamage(88));
    // 单调不减（相邻番不再出现 25 与 40 同值这类断档）
    for (let f = 1; f < 88; f++) {
      expect(fanToDamage(f + 1)).toBeGreaterThanOrEqual(fanToDamage(f));
    }
    // 中低段确有明显爬升
    expect(fanToDamage(6)).toBeGreaterThan(fanToDamage(1));
    expect(fanToDamage(24)).toBeGreaterThan(fanToDamage(6));
  });
});
