import { describe, it, expect } from 'vitest';
import { cardLogic } from '../src/engine/cards/cardEffects';
import { CARD_POOL_IDS, cardDef } from '../src/engine/cards/cardDefs';
import { initGame, type GameState, type HeroChoice } from '../src/engine/state';
import type { DamageSnapshot } from '../src/engine/damage';

const heroes: HeroChoice[] = [
  { heroId: 'geda', isAI: false, name: 'P0' },
  { heroId: 'aimage', isAI: true, name: 'P1' },
  { heroId: 'aimage', isAI: true, name: 'P2' },
  { heroId: 'aimage', isAI: true, name: 'P3' },
];

function fresh(): GameState {
  const s = initGame({ seed: 77, heroes });
  s.turn = 0;
  return s;
}

function use(s: GameState, cardId: string, extra: Record<string, unknown> = {}) {
  return cardLogic.resolve(s, { type: 'useCard', cardId, ...extra } as never);
}

describe('卡池与抽卡', () => {
  it('每次抽卡随机抽 3 种（来自全集，互不相同）', () => {
    const s = fresh();
    const c = cardLogic.candidates(s, 0);
    expect(c.length).toBe(3);
    expect(new Set(c).size).toBe(3);
    for (const id of c) expect(CARD_POOL_IDS).toContain(id);
  });

  it('AP 消耗与定义一致', () => {
    for (const id of CARD_POOL_IDS) expect(cardLogic.apCost(id)).toBe(cardDef(id)!.ap);
  });
});

describe('卡牌效果', () => {
  it('求你别摸：目标获得 skipTurn 负面状态', () => {
    const s = fresh();
    use(s, 'qiubiemo', { target: 1 });
    expect(s.players[1].statuses.some((st) => st.kind === 'skipTurn')).toBe(true);
  });

  it('有感觉了：出伤 +30%', () => {
    const s = fresh();
    use(s, 'yougan');
    expect(cardLogic.outgoing(s, 0, 60, false)).toBeCloseTo(78);
  });

  it('向我开炮：放炮（荣和）承伤减半，自摸不减', () => {
    const s = fresh();
    use(s, 'yidalipao');
    expect(cardLogic.incoming(s, 0, 96, 1, false)).toBe(48);
    expect(cardLogic.incoming(s, 0, 96, 1, true)).toBe(96);
  });

  it('跟你爆了：受伤时链接者分担 30%', () => {
    const s = fresh();
    use(s, 'genibao', { target: 2 });
    const snap: DamageSnapshot = {
      winners: [{ player: 1, fan: 24 }],
      isSelfDraw: false,
      winningTile: 5,
      entries: [{ target: 0, amount: 60, source: 1 }],
    };
    cardLogic.redistribute(s, snap);
    expect(snap.entries.find((e) => e.target === 0)!.amount).toBe(42);
    expect(snap.entries.find((e) => e.target === 2)!.amount).toBe(18);
  });

  it('有安全箱：指定 3 张进入保护', () => {
    const s = fresh();
    const picks = s.players[0].hand.slice(0, 3);
    use(s, 'anzhang', { payload: { tiles: picks } });
    const st = s.players[0].statuses.find((x) => x.kind === 'protected');
    expect(st).toBeTruthy();
    expect((st!.data!.tiles as number[]).length).toBe(3);
  });

  it('不吃压力：移除 1 个负面状态', () => {
    const s = fresh();
    use(s, 'qiubiemo', { target: 0 }); // 给自己挂个负面（测试用）
    expect(s.players[0].statuses.some((x) => x.negative)).toBe(true);
    use(s, 'buchi');
    expect(s.players[0].statuses.some((x) => x.negative)).toBe(false);
  });

  it('我要重开：置换后手牌张数不变、牌墙总长不变', () => {
    const s = fresh();
    const before = s.players[0].hand.length;
    const wallLen = s.wall.length;
    use(s, 'chongkai');
    expect(s.players[0].hand.length).toBe(before);
    expect(s.wall.length).toBe(wallLen);
  });

  it('就差这张：牌山不存在该牌时返还 1 AP', () => {
    const s = fresh();
    s.players[0].ap = 2;
    // 构造一个牌山中不存在的“named”：把牌山里所有该牌清成别的，取 hand[0]
    const named = s.players[0].hand[0];
    for (let i = s.head; i < s.tail; i++) if (s.wall[i] === named) s.wall[i] = (named + 1) % 34;
    use(s, 'jiucha', { payload: { tiles: [named] } });
    expect(s.players[0].ap).toBe(3);
  });
});
