/**
 * 咯哒（山鸣学院代表）——「鸡」流派，三个技能都围绕幺鸡与指示牌，是把双刃剑：
 *  1. 冲锋鸡（触发）：每局首次打出幺鸡时——
 *       · 若由你打出且未被副露响应 → 对全场其他存活各造成 3 点；
 *       · 若不是你打出、或你的幺鸡被副露响应 → 你自己承受 6 点。
 *     （结算需要“是否被副露响应”的信息，故实际触发点在 turnMachine，见 resolveChongfengji）
 *  2. 鸡关枪（被动）：当你造成或受到和牌伤害时，来源牌型中每有 1 张幺鸡，伤害 +6。
 *  3. 鸡生蛋（被动）：对局内你首次和牌时随机生成 1 张“指示牌”，你本次及以后和牌牌型中
 *     每有 1 张该指示牌同名牌，伤害 +6（指示牌跨局延续）。
 */
import type { HeroLogic } from './types';
import { YAOJI_INDEX, tileName } from '../tiles';
import { applyDirectDamage } from '../damage';
import { pushEvent, alivePlayers, type GameState, type PlayerId, type Meld } from '../state';
import { makeRng } from '../rng';

/** 手牌 + 副露中某种牌的物理张数。 */
function countTileWithMelds(hand: readonly number[], melds: readonly Meld[], tile: number): number {
  let n = 0;
  for (const t of hand) if (t === tile) n++;
  for (const m of melds) for (const t of m.tiles) if (t === tile) n++;
  return n;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export const geda: HeroLogic = {
  outgoing(s, pid, base, _isSelfDraw, trace) {
    const p = s.players[pid];
    if (p.heroId !== 'geda') return base;
    let dmg = base;

    // 鸡关枪：来源牌型（手牌+副露）中每张幺鸡 +6
    const yaoji = countTileWithMelds(p.hand, p.melds, YAOJI_INDEX);
    if (yaoji > 0) {
      dmg = r1(dmg + 6 * yaoji);
      trace?.push({ label: `鸡关枪 ×${yaoji}`, op: 'add', operand: 6 * yaoji, after: dmg });
    }

    // 鸡生蛋：对局内首次和牌时随机生成指示牌（含本次生效）
    if (p.eggIndicator === null) {
      const rng = makeRng(s.rngState);
      p.eggIndicator = rng.int(34);
      s.rngState = rng.state();
      pushEvent(s, 'skill', `${p.name}【鸡生蛋】生成指示牌：${tileName(p.eggIndicator)}`, true, {
        player: pid,
        egg: p.eggIndicator,
      });
    }
    const eggs = countTileWithMelds(p.hand, p.melds, p.eggIndicator);
    if (eggs > 0) {
      dmg = r1(dmg + 6 * eggs);
      trace?.push({ label: `鸡生蛋 ×${eggs}`, op: 'add', operand: 6 * eggs, after: dmg });
    }
    return dmg;
  },

  incoming(s, pid, amount, source, _isSelfDraw, trace) {
    // 鸡关枪·反噬：他人以“含幺鸡的牌型”对你造成和牌伤害时，每张幺鸡使你承伤 +6
    const p = s.players[pid];
    if (p.heroId !== 'geda') return amount;
    const attacker = s.players[source];
    if (!attacker || attacker.id === pid) return amount;
    const yaoji = countTileWithMelds(attacker.hand, attacker.melds, YAOJI_INDEX);
    if (yaoji === 0) return amount;
    const after = r1(amount + 6 * yaoji);
    trace?.push({ label: `鸡关枪·反噬 ×${yaoji}`, op: 'add', operand: 6 * yaoji, after });
    return after;
  },

  onWin(s, pid, _isSelfDraw) {
    const p = s.players[pid];
    if (p.heroId !== 'geda') return;
    p.hasWon = true;
  },
};

/**
 * 冲锋鸡结算：本局“第一张幺鸡”被打出并完成鸣牌响应后由 turnMachine 调用。
 * discarder = 打出该幺鸡的玩家；claimed = 该幺鸡是否被副露（吃/碰/杠）或荣和响应。
 * 对场上每名咯哒各自结算一次。
 */
export function resolveChongfengji(s: GameState, discarder: PlayerId, claimed: boolean): void {
  for (const g of s.players) {
    if (g.heroId !== 'geda' || !g.alive) continue;
    if (g.id === discarder && !claimed) {
      // 你打出且未被响应 → 对全场其他存活各 3 点
      const targets = alivePlayers(s)
        .filter((o) => o.id !== g.id)
        .map((o) => ({ target: o.id, amount: 3 }));
      applyDirectDamage(s, g.id, targets, '冲锋鸡');
    } else {
      // 不是你打出、或你的幺鸡被响应 → 你自己承受 6 点
      applyDirectDamage(s, g.id, [{ target: g.id, amount: 6 }], '冲锋鸡·失手');
    }
  }
}
