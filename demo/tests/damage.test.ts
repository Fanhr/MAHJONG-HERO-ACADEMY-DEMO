import { describe, it, expect } from 'vitest';
import { initGame, type HeroChoice } from '../src/engine/state';
import {
  applyDamageSnapshot,
  buildRonSnapshot,
  buildTsumoSnapshot,
} from '../src/engine/damage';

const heroes: HeroChoice[] = [
  { heroId: 'geda', isAI: false, name: 'P0' },
  { heroId: 'aimage', isAI: true, name: 'P1' },
  { heroId: 'aimage', isAI: true, name: 'P2' },
  { heroId: 'aimage', isAI: true, name: 'P3' },
];

describe('伤害快照结算', () => {
  it('自摸：24 番 → 基础 60，对 3 名对手各均分 20', () => {
    const s = initGame({ seed: 1, heroes });
    const snap = buildTsumoSnapshot(s, 0, 60, 5, 24);
    applyDamageSnapshot(s, snap);
    expect(s.players[0].hp).toBe(100); // 和牌者不受伤
    expect(s.players[1].hp).toBe(80);
    expect(s.players[2].hp).toBe(80);
    expect(s.players[3].hp).toBe(80);
    expect(s.winRecords[0].hiddenFace).toBe(true); // 自摸背面朝上
  });

  it('荣和：88 番 → 96 伤害命中点炮者', () => {
    const s = initGame({ seed: 2, heroes });
    const snap = buildRonSnapshot(1, [{ player: 0, fan: 88, damage: 96 }], 5);
    applyDamageSnapshot(s, snap);
    expect(s.players[1].hp).toBe(4);
    expect(s.players[0].hp).toBe(100);
    expect(s.winRecords[0].hiddenFace).toBe(false); // 荣和正面朝上
  });

  it('一炮多响：两家荣和分别结算', () => {
    const s = initGame({ seed: 3, heroes });
    const snap = buildRonSnapshot(3, [
      { player: 0, fan: 6, damage: 24 }, // 6 番 → 24 伤害
      { player: 2, fan: 24, damage: 60 }, // 24 番 → 60 伤害
    ], 5);
    applyDamageSnapshot(s, snap);
    expect(s.players[3].hp).toBe(100 - 24 - 60);
    expect(s.winRecords.length).toBe(2);
  });

  it('同步击杀与终局：HP 可为负，剩 1 人则对局结束', () => {
    const s = initGame({ seed: 4, heroes });
    s.players[1].hp = 10;
    s.players[2].hp = 10;
    s.players[3].hp = 10;
    const snap = buildTsumoSnapshot(s, 0, 96, 5, 88); // 96/3 = 32 each
    applyDamageSnapshot(s, snap);
    expect(s.players[1].alive).toBe(false);
    expect(s.players[2].alive).toBe(false);
    expect(s.players[3].alive).toBe(false);
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(0);
  });
});
