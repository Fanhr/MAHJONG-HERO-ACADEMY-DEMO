/**
 * 听牌/待牌分析（供 UI 提示）：给定引擎状态与玩家，计算其当前手牌可和的牌及预估伤害。
 * 预估伤害 = fanToDamage(番数 + 英雄番加成) 经出伤加成（门清/立直/翻鸡/有感觉了）后的数值；
 * 实际结算还受自摸均分/对手减伤影响，故标注为“预估”。
 */
import { canWin, isTenpai } from '../engine/winning';
import { evaluateYaku } from '../engine/yaku';
import { baseDamage } from '../engine/constants';
import { engineHooks } from '../engine/hooks';
import type { GameState, Meld, PlayerId } from '../engine/state';

export interface WaitInfo {
  tile: number;
  fan: number;
  damage: number;
  yaku: string[];
  tsumoOnly: boolean; // 仅能自摸（如振听/定缺限制荣和）
}

export interface DiscardWait {
  discard: number | null; // null 表示当前形已听（无需再切）
  waits: WaitInfo[];
}

function computeWaits(state: GameState, pid: PlayerId, concealed: number[], melds: Meld[]): WaitInfo[] {
  const out: WaitInfo[] = [];
  for (let t = 0; t < 34; t++) {
    const hand = [...concealed, t];
    if (!canWin(hand, melds)) continue;
    const blockedRon = engineHooks.winBlocked(state, pid, hand, melds, false, t);
    const blockedTsumo = engineHooks.winBlocked(state, pid, hand, melds, true, t);
    if (blockedRon && blockedTsumo) continue; // 完全不能和（如定缺）
    const res = evaluateYaku({ concealedTiles: hand, melds, winningTile: t, isTsumo: false });
    if (!res) continue;
    const fan = res.fan + engineHooks.fanBonus(state, pid, hand, false);
    const base = baseDamage(fan, res.yakumanCount);
    const dmg = engineHooks.modifyOutgoingDamage(state, pid, base, false);
    out.push({
      tile: t,
      fan,
      damage: Math.round(dmg * 10) / 10,
      yaku: res.hits.map((h) => h.name),
      tsumoOnly: blockedRon && !blockedTsumo,
    });
  }
  return out;
}

/**
 * 分析听牌：
 * - 手牌为 3n+1（如 13 张，多在他家回合）→ 直接给出当前待牌。
 * - 手牌为 3n+2（如 14 张，自己摸牌后）→ 列出“切某张后仍听牌”的选项及各自待牌。
 */
export function analyzeTenpai(state: GameState, pid: PlayerId): DiscardWait[] {
  const p = state.players[pid];
  const concealed = p.hand;
  if (concealed.length % 3 === 1) {
    const waits = computeWaits(state, pid, concealed, p.melds);
    return waits.length ? [{ discard: null, waits }] : [];
  }
  const res: DiscardWait[] = [];
  const seen = new Set<number>();
  for (const d of concealed) {
    if (seen.has(d)) continue;
    seen.add(d);
    const rest = [...concealed];
    rest.splice(rest.indexOf(d), 1);
    if (!isTenpai(rest, p.melds)) continue;
    const waits = computeWaits(state, pid, rest, p.melds);
    if (waits.length) res.push({ discard: d, waits });
  }
  return res;
}
