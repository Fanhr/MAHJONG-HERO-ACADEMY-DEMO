import { describe, it, expect, beforeAll } from 'vitest';
import { registerAll } from '../src/engine/register';
import { engineHooks } from '../src/engine/hooks';
import { resolveChongfengji } from '../src/engine/heroes';
import { initGame, type GameState, type HeroChoice } from '../src/engine/state';
import { indexOf, YAOJI_INDEX } from '../src/engine/tiles';

const heroes: HeroChoice[] = [
  { heroId: 'geda', isAI: false, name: '咯哒' },
  { heroId: 'aimage', isAI: true, name: '鸽1' },
  { heroId: 'aimage', isAI: true, name: '鸽2' },
  { heroId: 'aimage', isAI: true, name: '鸽3' },
];

function fresh(): GameState {
  return initGame({ seed: 100, heroes });
}

beforeAll(() => registerAll());

describe('咯哒（山鸣学院）', () => {
  it('鸡关枪·出伤：和牌牌型每含 1 张幺鸡，伤害 +6', () => {
    const s = fresh();
    s.players[0].eggIndicator = indexOf('z', 1); // 指示牌设为不在手的字牌，排除鸡生蛋干扰
    s.players[0].hand = [YAOJI_INDEX, indexOf('m', 2), indexOf('m', 3)];
    expect(engineHooks.modifyOutgoingDamage(s, 0, 60, true)).toBe(66);
  });

  it('鸡关枪·反噬：他人以含幺鸡的牌型打你，每张幺鸡使你承伤 +6', () => {
    const s = fresh();
    s.players[0].eggIndicator = indexOf('z', 1);
    s.players[1].hand = [YAOJI_INDEX, YAOJI_INDEX, indexOf('m', 2)];
    expect(engineHooks.modifyIncomingDamage(s, 0, 20, 1, false)).toBe(32);
    s.players[3].hand = [indexOf('m', 4), indexOf('m', 5)];
    expect(engineHooks.modifyIncomingDamage(s, 0, 20, 3, false)).toBe(20);
  });

  it('鸡生蛋：牌型每含 1 张与指示牌同名的牌，伤害 +6', () => {
    const s = fresh();
    s.players[0].eggIndicator = indexOf('m', 5);
    s.players[0].hand = [indexOf('m', 5), indexOf('m', 5), indexOf('p', 1)];
    // 无幺鸡，鸡生蛋 2 张 → +12
    expect(engineHooks.modifyOutgoingDamage(s, 0, 60, true)).toBe(72);
  });

  it('冲锋鸡：你打出且未被响应→全场其他各 3 点；被响应/非你打出→你自伤 6', () => {
    const s = fresh();
    resolveChongfengji(s, 0, false);
    expect(s.players[1].hp).toBe(97);
    expect(s.players[2].hp).toBe(97);
    expect(s.players[3].hp).toBe(97);
    expect(s.players[0].hp).toBe(100);

    const s2 = fresh();
    resolveChongfengji(s2, 0, true); // 你的幺鸡被响应 → 自伤 6
    expect(s2.players[0].hp).toBe(94);

    const s3 = fresh();
    resolveChongfengji(s3, 1, false); // 非你打出 → 自伤 6
    expect(s3.players[0].hp).toBe(94);
  });
});

describe('爱麻鸽（人机）', () => {
  it('平和鸽：和牌番数 ≤3 时伤害 +6，>3 不加', () => {
    const s = fresh();
    s.winFanContext = 3;
    expect(engineHooks.modifyOutgoingDamage(s, 1, 60, false)).toBe(66);
    s.winFanContext = 5;
    expect(engineHooks.modifyOutgoingDamage(s, 1, 60, false)).toBe(60);
  });

  it('瑞雪：场上有人副露时，每名有 AP 的爱麻鸽各消耗 1 AP 造成 3 点', () => {
    const s = fresh();
    const beforeAp = s.players[1].ap;
    engineHooks.onAnyMeld(s, 0, 'pon'); // 玩家 0 副露 → 3 名爱麻鸽各打 3
    expect(s.players[0].hp).toBe(100 - 9);
    expect(s.players[1].ap).toBe(beforeAp - 1);
  });

  it('回购：消耗 2 AP，用手牌换回自己弃牌堆中的牌', () => {
    const s = fresh();
    s.turn = 1;
    const p = s.players[1];
    p.ap = 2;
    p.hand = [indexOf('m', 1), indexOf('m', 9), indexOf('p', 5)];
    p.discards = [indexOf('m', 2)];
    engineHooks.resolveSkill(s, { type: 'useSkill', skillId: 'huigou' });
    expect(p.ap).toBe(0);
    expect(p.hand).toContain(indexOf('m', 2)); // 换回了弃牌
    expect(p.hand.length).toBe(3);
  });
});
