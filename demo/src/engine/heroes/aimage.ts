/**
 * 爱麻鸽（人机对手）——鸽系三技能：
 *  1. 瑞雪（触发/主动）：场上有人副露时，可消耗 1 点 AP 立即对其造成 3 点伤害（人机自动触发）。
 *  2. 平和鸽（被动）：若你和牌的番数 ≤ 3，本次伤害 +6。
 *  3. 回购（主动）：消耗 2 点 AP，将手牌中的 1 张与自己弃牌堆中的 1 张交换。
 */
import type { HeroLogic } from './types';
import type { Action } from '../actions';
import { applyDirectDamage } from '../damage';
import { pushEvent, type GameState, type PlayerId } from '../state';
import { counts34, rankOfIndex, suitOfIndex, isHonor, tileName } from '../tiles';

const r1 = (x: number) => Math.round(x * 10) / 10;

/** 一张牌对手牌的“价值”：越高越该保留（对子/刻子/搭子加分）。 */
function tileValue(tile: number, counts: number[]): number {
  let score = (counts[tile] - 1) * 3;
  if (!isHonor(tile)) {
    const base = tile < 9 ? 0 : tile < 18 ? 9 : 18;
    const rank = rankOfIndex(tile);
    for (const d of [-2, -1, 1, 2]) {
      const r = rank + d;
      if (r >= 1 && r <= 9 && counts[base + (r - 1)] > 0) score += Math.abs(d) === 1 ? 2 : 1;
    }
  }
  return score;
}

export const aimage: HeroLogic = {
  skillActions(s, pid) {
    const p = s.players[pid];
    const acts: Action[] = [];
    // 回购：AP≥2 且弃牌堆非空
    if (p.ap >= 2 && p.discards.length > 0 && p.hand.length > 0) {
      acts.push({ type: 'useSkill', skillId: 'huigou' });
    }
    return acts;
  },

  resolveSkill(s, action) {
    if (action.type !== 'useSkill' || action.skillId !== 'huigou') return false;
    const p = s.players[s.turn];
    if (p.ap < 2 || p.discards.length === 0) return false;
    const counts = counts34(p.hand);
    // 取回弃牌堆中对当前手牌最有价值的一张
    let takeIdx = 0;
    let takeVal = -Infinity;
    p.discards.forEach((t, i) => {
      const v = tileValue(t, counts) + (counts[t] > 0 ? 3 : 0);
      if (v > takeVal) {
        takeVal = v;
        takeIdx = i;
      }
    });
    const take = p.discards[takeIdx];
    // 交出手牌中最无用的一张
    let give = p.hand[0];
    let giveVal = Infinity;
    for (const t of p.hand) {
      const v = tileValue(t, counts);
      if (v < giveVal) {
        giveVal = v;
        give = t;
      }
    }
    const gi = p.hand.indexOf(give);
    if (gi < 0) return false;
    p.ap -= 2;
    p.hand.splice(gi, 1);
    p.hand.push(take);
    p.hand.sort((a, b) => a - b);
    p.discards.splice(takeIdx, 1);
    p.discards.push(give);
    pushEvent(s, 'skill', `${p.name}【回购】用 ${tileName(give)} 换回弃牌 ${tileName(take)}`, true, { player: p.id });
    return true;
  },

  onAnyMeld(s, melder, _type) {
    // 瑞雪：每名爱麻鸽在有人副露时，若 AP≥1 则消耗 1 点对副露者造成 3 点
    for (const a of s.players) {
      if (a.heroId !== 'aimage' || !a.alive || a.id === melder) continue;
      if (a.ap < 1) continue;
      if (!s.players[melder].alive) continue;
      a.ap -= 1;
      applyDirectDamage(s, a.id, [{ target: melder, amount: 3 }], '瑞雪');
      if (s.phase === 'gameOver') return;
    }
  },

  outgoing(s, pid, base, _isSelfDraw, trace) {
    const p = s.players[pid];
    if (p.heroId !== 'aimage') return base;
    // 平和鸽：本次和牌番数 ≤ 3 → +6
    const fan = s.winFanContext ?? 99;
    if (fan <= 3) {
      const after = r1(base + 6);
      trace?.push({ label: '平和鸽', op: 'add', operand: 6, after });
      return after;
    }
    return base;
  },
};
