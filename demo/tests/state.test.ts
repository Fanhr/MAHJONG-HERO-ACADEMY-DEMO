import { describe, it, expect } from 'vitest';
import { initGame, wallRemaining, nextAlive, type HeroChoice } from '../src/engine/state';
import { redactStateFor } from '../src/engine/redact';

const heroes: HeroChoice[] = [
  { heroId: 'geda', isAI: false, name: 'P0' },
  { heroId: 'aimage', isAI: true, name: 'P1' },
  { heroId: 'aimage', isAI: true, name: 'P2' },
  { heroId: 'aimage', isAI: true, name: 'P3' },
];

describe('对局初始化与发牌', () => {
  it('每人 13 张，牌墙剩余 84 张（无死墙）', () => {
    const s = initGame({ seed: 7, heroes });
    expect(s.players.length).toBe(4);
    for (const p of s.players) {
      expect(p.hand.length).toBe(13);
      expect(p.hp).toBe(100);
      expect(p.ap).toBe(2);
    }
    // 136 - 13*4 = 84
    expect(wallRemaining(s)).toBe(84);
    expect(s.head).toBe(52);
    expect(s.tail).toBe(136);
  });

  it('相同种子发牌可复现', () => {
    const a = initGame({ seed: 123, heroes });
    const b = initGame({ seed: 123, heroes });
    expect(a.players[0].hand).toEqual(b.players[0].hand);
    const c = initGame({ seed: 124, heroes });
    expect(a.players[0].hand).not.toEqual(c.players[0].hand);
  });

  it('nextAlive 跳过淘汰席位', () => {
    const s = initGame({ seed: 1, heroes });
    s.players[1].alive = false;
    expect(nextAlive(s, 0)).toBe(2);
    expect(nextAlive(s, 3)).toBe(0);
  });
});

describe('redactStateFor 防上帝视角', () => {
  it('看不到他家手牌牌面与牌墙顺序，只有张数/剩余数', () => {
    const s = initGame({ seed: 55, heroes });
    const view = redactStateFor(s, 0);
    // 自己能看到完整手牌
    expect(view.self.hand.length).toBe(13);
    // 公共视图里没有 hand 字段，只有 handCount
    const other = view.publicBoard.players[1] as unknown as Record<string, unknown>;
    expect(other.hand).toBeUndefined();
    expect(view.publicBoard.players[1].handCount).toBe(13);
    // 只暴露牌墙剩余张数，不暴露 wall 顺序
    expect(view.publicBoard.wallRemaining).toBe(84);
    expect((view.publicBoard as unknown as Record<string, unknown>).wall).toBeUndefined();
  });
});
