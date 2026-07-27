import { describe, it, expect } from 'vitest';
import { registerAll } from '../src/engine/register';
import { startGame, getDecision, applyAction } from '../src/engine/turnMachine';
import { startNextRound } from '../src/engine/round';
import type { Action } from '../src/engine/actions';
import type { GameState, HeroChoice } from '../src/engine/state';

registerAll();

const heroes: HeroChoice[] = [
  { heroId: 'geda', isAI: false, name: '咯哒' },
  { heroId: 'aimage', isAI: true, name: '爱麻鸽1' },
  { heroId: 'aimage', isAI: true, name: '爱麻鸽2' },
  { heroId: 'aimage', isAI: true, name: '爱麻鸽3' },
];

// 策略：优先和牌 > 过牌 > 结束技能阶段 > 放弃抽卡 > 荒牌确认 > 多摸选留 > 摸切
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

describe('集成：开启英雄技能的整局对战', () => {
  it('能跑通完整对局并产生唯一胜者（技能/被动无冲突）', () => {
    let s: GameState = startGame({ seed: 8888, heroes });
    let steps = 0;
    while (s.phase !== 'gameOver' && steps < 400000) {
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
    expect(s.players.filter((p) => p.alive).length).toBe(1);
  });
});
