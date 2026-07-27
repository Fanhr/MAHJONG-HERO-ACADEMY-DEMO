/**
 * 统一钩子注册：把英雄逻辑（heroRegistry）与技能卡逻辑（cardLogic）组合进 engineHooks。
 * 组合语义：
 *   - dispatch 类（技能结算）：按当前玩家英雄分派
 *   - additive 类（出伤/承伤/再分配）：英雄与卡牌依次叠加
 *   - broadcast 类（onAnyMeld）：所有英雄逻辑 + 卡牌逻辑各自扫描相关玩家处理
 * App 与测试在启动时调用一次 registerAll()。
 */
import { setHooks } from './hooks';
import { heroRegistry } from './heroes';
import { cardLogic } from './cards/cardEffects';

export function registerAll(): void {
  setHooks({
    getSkillActions: (s, pid) => heroRegistry[s.players[pid].heroId].skillActions?.(s, pid) ?? [],

    resolveSkill: (s, action) => {
      heroRegistry[s.players[s.turn].heroId].resolveSkill?.(s, action);
    },

    onTurnStart: (s, pid) => {
      heroRegistry[s.players[pid].heroId].onTurnStart?.(s, pid);
      cardLogic.onTurnStart(s, pid);
    },

    onKan: (s, pid, type, from) => {
      heroRegistry[s.players[pid].heroId].onKan?.(s, pid, type, from);
    },

    onDiscard: (s, pid, tile) => {
      heroRegistry[s.players[pid].heroId].onDiscard?.(s, pid, tile);
    },

    onAnyMeld: (s, melder, type) => {
      for (const logic of Object.values(heroRegistry)) logic.onAnyMeld?.(s, melder, type);
      cardLogic.onAnyMeld(s, melder, type);
    },

    onWin: (s, pid, isSelfDraw) => {
      heroRegistry[s.players[pid].heroId].onWin?.(s, pid, isSelfDraw);
    },

    modifyOutgoingDamage: (s, src, base, isSelfDraw, trace) => {
      let d = heroRegistry[s.players[src].heroId].outgoing?.(s, src, base, isSelfDraw, trace) ?? base;
      d = cardLogic.outgoing(s, src, d, isSelfDraw, trace);
      return d;
    },

    modifyIncomingDamage: (s, target, amount, source, isSelfDraw, trace) => {
      let d = heroRegistry[s.players[target].heroId].incoming?.(s, target, amount, source, isSelfDraw, trace) ?? amount;
      d = cardLogic.incoming(s, target, d, source, isSelfDraw, trace);
      return d;
    },

    redistributeDamage: (s, snap) => {
      for (const logic of Object.values(heroRegistry)) logic.redistribute?.(s, snap);
      cardLogic.redistribute(s, snap);
    },

    getCardCandidates: (s, pid) => cardLogic.candidates(s, pid),
    cardApCost: (id) => cardLogic.apCost(id),
    resolveCard: (s, action) => {
      cardLogic.resolve(s, action);
    },

    winBlocked: (s, pid, concealed, melds, isTsumo, tile) => {
      return heroRegistry[s.players[pid].heroId].winBlocked?.(s, pid, concealed, melds, isTsumo, tile) ?? false;
    },

    fanBonus: () => 0,
  });
}
