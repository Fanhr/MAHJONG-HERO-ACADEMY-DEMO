import { describe, it, expect } from 'vitest';
import { registerAll } from '../src/engine/register';
import { startGame, getDecision, applyAction } from '../src/engine/turnMachine';
import { startNextRound } from '../src/engine/round';
import { aiDecide } from '../src/ai/simpleAI';
import type { GameState, HeroChoice } from '../src/engine/state';

registerAll();

const heroes: HeroChoice[] = [
  { heroId: 'aimage', isAI: true, name: 'AI鸽0' },
  { heroId: 'aimage', isAI: true, name: 'AI鸽1' },
  { heroId: 'aimage', isAI: true, name: 'AI鸽2' },
  { heroId: 'aimage', isAI: true, name: 'AI鸽3' },
];

describe('简单 AI 自对弈', () => {
  it('四家全 AI 能跑通完整对局并产生唯一胜者', () => {
    let s: GameState = startGame({ seed: 4242, heroes });
    let steps = 0;
    let cards = 0;
    while (s.phase !== 'gameOver' && steps < 400000) {
      if (s.phase === 'roundOver') {
        s = startNextRound(s);
        continue;
      }
      const d = getDecision(s);
      expect(d).not.toBeNull();
      const action = aiDecide(s, d!);
      if (action.type === 'useCard') cards++;
      s = applyAction(s, action);
      steps++;
    }
    expect(s.phase).toBe('gameOver');
    expect(s.winner).not.toBeNull();
    expect(s.players.filter((p) => p.alive).length).toBe(1);
    // AI 应当至少使用过若干次技能牌（体现“会用卡牌加速/防御”）
    expect(cards).toBeGreaterThan(0);
  });

  it('多个种子均能稳定收敛，无异常', () => {
    for (const seed of [1, 2, 3, 7, 99]) {
      let s: GameState = startGame({ seed, heroes });
      let steps = 0;
      while (s.phase !== 'gameOver' && steps < 400000) {
        if (s.phase === 'roundOver') {
          s = startNextRound(s);
          continue;
        }
        const d = getDecision(s);
        s = applyAction(s, aiDecide(s, d!));
        steps++;
      }
      expect(s.phase).toBe('gameOver');
      expect(s.winner).not.toBeNull();
    }
  });
});
