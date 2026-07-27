import { describe, it, expect } from 'vitest';
import { parseHand } from '../src/engine/tiles';
import { evaluateYaku } from '../src/engine/yaku';
import { baseDamage, fanToDamage } from '../src/engine/constants';

function fanOf(handStr: string, isTsumo = false): { fan: number; yakumanCount: number; names: string[] } {
  const hand = parseHand(handStr);
  const r = evaluateYaku({ concealedTiles: hand, melds: [], winningTile: hand[0], isTsumo });
  if (!r) throw new Error('not a win: ' + handStr);
  return { fan: r.fan, yakumanCount: r.yakumanCount, names: r.hits.map((h) => h.name) };
}

describe('番种识别（对齐番种精选子集）', () => {
  it('清一色', () => {
    const { names } = fanOf('1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 8m 8m 9m 9m');
    expect(names).toContain('清一色');
  });

  it('对对和 + 混一色', () => {
    const { names } = fanOf('2m 2m 2m 5m 5m 5m 8m 8m 8m E E E W W');
    expect(names).toContain('对对和');
    expect(names).toContain('混一色');
  });

  it('平和 + 断幺', () => {
    const { names } = fanOf('2m 3m 4m 5m 6m 7m 3p 4p 5p 6p 7p 8p 5s 5s');
    expect(names).toContain('平和');
    expect(names).toContain('断幺');
  });

  it('大三元（役满，78 伤害）', () => {
    const { fan, yakumanCount, names } = fanOf('C C C F F F B B B 2m 3m 4m 5m 5m');
    expect(names).toContain('大三元');
    expect(yakumanCount).toBe(1);
    expect(baseDamage(fan, yakumanCount)).toBe(78);
  });

  it('七对子', () => {
    const { names } = fanOf('1m 1m 3m 3m 5m 5m 7m 7m 9m 9m 2p 2p 4p 4p');
    expect(names).toContain('七对子');
  });

  it('国士无双（役满；十三面为双倍）', () => {
    const { fan, yakumanCount, names } = fanOf('1m 9m 1p 9p 1s 9s E S W N C F B 1m');
    expect(names.some((n) => n.includes('国士无双'))).toBe(true);
    expect(yakumanCount).toBeGreaterThanOrEqual(1);
    // 该手牌为十三面听（双倍役满）→ 156；普通国士无双为 78
    expect(baseDamage(fan, yakumanCount)).toBe(yakumanCount === 2 ? 156 : 78);
  });

  it('自摸门清 → 门前清自摸', () => {
    const { names } = fanOf('2m 3m 4m 5m 6m 7m 3p 4p 5p 6p 7p 8p 5s 5s', true);
    expect(names).toContain('门前清自摸');
  });
});

describe('番数→基础伤害（文档公式）', () => {
  it('0 番=6，每番 +6；累计役满封顶 78；役满 78×n', () => {
    expect(fanToDamage(0)).toBe(6);
    expect(fanToDamage(1)).toBe(12);
    expect(fanToDamage(2)).toBe(18);
    expect(fanToDamage(6)).toBe(42);
    expect(fanToDamage(12)).toBe(78);
    expect(fanToDamage(13)).toBe(78); // 累计役满封顶
    expect(baseDamage(0, 1)).toBe(78); // 单倍役满
    expect(baseDamage(0, 2)).toBe(156); // 双倍役满
    expect(baseDamage(0, 3)).toBe(234); // 三倍役满
  });
});
