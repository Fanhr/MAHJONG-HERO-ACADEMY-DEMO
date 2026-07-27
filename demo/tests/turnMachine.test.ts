import { describe, it, expect } from 'vitest';
import { registerAll } from '../src/engine/register';
import { startGame, getDecision, applyAction } from '../src/engine/turnMachine';
import { startNextRound } from '../src/engine/round';
import type { Action } from '../src/engine/actions';
import type { GameState, HeroChoice } from '../src/engine/state';

registerAll();

const heroes: HeroChoice[] = [
  { heroId: 'geda', isAI: false, name: 'P0' },
  { heroId: 'aimage', isAI: true, name: 'P1' },
  { heroId: 'aimage', isAI: true, name: 'P2' },
  { heroId: 'aimage', isAI: true, name: 'P3' },
];

describe('回合状态机 · 基础流程（ver2.0）', () => {
  it('起家首个决策点为抽卡三选一', () => {
    const s = startGame({ seed: 9, heroes });
    const d = getDecision(s)!;
    expect(d.actor).toBe(0);
    expect(d.actions.some((a) => a.type === 'pickCard')).toBe(true);
    expect(d.actions.some((a) => a.type === 'pickCard' && a.cardId === null)).toBe(true);
  });

  it('放弃抽卡后（无技能/卡）自动推进到切牌阶段，手牌为 14 张', () => {
    let s = startGame({ seed: 9, heroes });
    s = applyAction(s, { type: 'pickCard', cardId: null });
    const d = getDecision(s)!;
    expect(s.phase).toBe('discard');
    expect(s.players[0].hand.length).toBe(14);
    expect(d.actions.some((a) => a.type === 'discard')).toBe(true);
  });

  it('切牌后轮转到下一位，且切出的牌进入弃牌河', () => {
    let s = startGame({ seed: 11, heroes });
    s = applyAction(s, { type: 'pickCard', cardId: null });
    const tile = (getDecision(s)!.actions.find((a) => a.type === 'discard') as { tile: number }).tile;
    s = applyAction(s, { type: 'discard', tile });
    expect(s.players[0].discards).toContain(tile);
    expect([1, 2, 3]).toContain(getDecision(s)!.actor);
  });
});

// 简单策略：优先和牌，其次过牌 / 结束技能阶段 / 放弃抽卡，标准流程走摸切
function choose(actions: Action[]): Action {
  const find = (t: Action['type']) => actions.find((a) => a.type === t);
  return (
    find('declareTsumo') ||
    find('respondRon') ||
    find('respondPass') ||
    find('endAction') ||
    actions.find((a) => a.type === 'pickCard' && a.cardId === null) ||
    find('confirmRoundSafety') ||
    find('keepDrawn') ||
    actions.find((a) => a.type === 'discard') ||
    actions[0]
  );
}

describe('整局冒烟测试（无技能/卡牌，纯摸切+和牌）', () => {
  it('能持续推进多局并最终产生唯一胜者，无异常', () => {
    let s: GameState = startGame({ seed: 2026, heroes });
    let steps = 0;
    while (s.phase !== 'gameOver' && steps < 300000) {
      if (s.phase === 'roundOver') {
        s = startNextRound(s);
        continue;
      }
      const d = getDecision(s);
      expect(d).not.toBeNull();
      expect(d!.actions.length).toBeGreaterThan(0);
      s = applyAction(s, choose(d!.actions));
      steps++;
    }
    expect(s.phase).toBe('gameOver');
    expect(s.winner).not.toBeNull();
    // 存活人数应恰为 1
    expect(s.players.filter((p) => p.alive).length).toBe(1);
    // 至少发生过若干次和牌
    expect(s.winRecords.length).toBeGreaterThan(0);
  });
});
