/**
 * 简单 AI（爱麻鸽/通用）：只消费 RedactedView（投影视图），物理上看不到他家手牌与牌墙顺序。
 * 策略要点（对齐需求 4）：
 *   - 尽快和牌：能自摸/荣和必和；切牌走“听牌优先 + 进张最大”。
 *   - 简单用技能加速：未听牌时用节奏/运类卡挖牌、用「回购」从弃牌堆换回有用牌；听牌用增伤卡。
 *   - 降智（需求 6）：当玩家「咯哒」HP<30 时，爱麻鸽故意不和牌，并随机切牌放水。
 */
import type { Action } from '../engine/actions';
import type { RedactedView } from '../engine/redact';
import { redactStateFor } from '../engine/redact';
import { canWin, isTenpai } from '../engine/winning';
import { counts34, isHonor, rankOfIndex } from '../engine/tiles';
import type { GameState } from '../engine/state';
import type { Decision } from '../engine/turnMachine';

function firstOf(acts: Action[], type: Action['type']): Action | undefined {
  return acts.find((a) => a.type === type);
}

function aliveOpponents(view: RedactedView): number[] {
  return view.publicBoard.players.filter((p) => p.alive && p.id !== view.self.id).map((p) => p.id);
}

/** 玩家（咯哒）是否处于低血保护线（HP<30）。 */
function humanLow(view: RedactedView): boolean {
  const human = view.publicBoard.players.find((p) => p.heroId === 'geda');
  return !!human && human.alive && human.hp < 30;
}

/** 单张牌的“成型有用度”，越低越该被打出。 */
function usefulness(tile: number, counts: number[]): number {
  if (isHonor(tile)) return (counts[tile] - 1) * 3;
  const suitBase = tile < 9 ? 0 : tile < 18 ? 9 : 18;
  const rank = rankOfIndex(tile);
  let score = (counts[tile] - 1) * 3;
  for (const d of [-2, -1, 1, 2]) {
    const r2 = rank + d;
    if (r2 >= 1 && r2 <= 9 && counts[suitBase + (r2 - 1)] > 0) score += Math.abs(d) === 1 ? 2 : 1;
  }
  return score;
}

function chooseDiscard(view: RedactedView, discards: Action[]): Action {
  const self = view.self;
  const counts = counts34(self.hand);
  const tiles = [...new Set(discards.map((a) => (a as { tile: number }).tile))];

  let bestTenpai: { tile: number; ukeire: number } | null = null;
  for (const tile of tiles) {
    const h = self.hand.slice();
    h.splice(h.indexOf(tile), 1);
    if (!isTenpai(h, self.melds)) continue;
    let ukeire = 0;
    for (let t = 0; t < 34; t++) if (canWin([...h, t], self.melds)) ukeire++;
    if (!bestTenpai || ukeire > bestTenpai.ukeire) bestTenpai = { tile, ukeire };
  }
  if (bestTenpai) return { type: 'discard', tile: bestTenpai.tile };

  let worst = tiles[0];
  let worstScore = Infinity;
  for (const tile of tiles) {
    const sc = usefulness(tile, counts);
    if (sc < worstScore) {
      worstScore = sc;
      worst = tile;
    }
  }
  return { type: 'discard', tile: worst };
}

function choosePickCard(view: RedactedView, acts: Action[]): Action {
  if (view.self.reserve.length >= 3) return { type: 'pickCard', cardId: null };
  const low = view.self.hp < 40;
  const pref = low
    ? ['xiangsi', 'xiuyang', 'shengsheng', 'guanghe', 'yidalipao', 'genibao', 'yanguang', 'duoduo', 'chongkai', 'jiucha']
    : ['duoduo', 'chongkai', 'jiucha', 'ruguo', 'duidedui', 'yougan', 'buduibudui', 'qiubiemo', 'dongni', 'nalai'];
  const available = acts.filter((a) => a.type === 'pickCard' && a.cardId) as Extract<Action, { type: 'pickCard' }>[];
  for (const id of pref) {
    const hit = available.find((a) => a.cardId === id);
    if (hit) return hit;
  }
  return available[0] ?? { type: 'pickCard', cardId: null };
}

function chooseKeepDrawn(view: RedactedView, keepActs: Action[]): Action {
  const self = view.self;
  const opts = (keepActs as Extract<Action, { type: 'keepDrawn' }>[]).map((a) => a.tile);
  const counts = counts34(self.hand);
  let best = keepActs[0];
  let bestScore = -Infinity;
  for (const act of keepActs as Extract<Action, { type: 'keepDrawn' }>[]) {
    const keepT = act.tile;
    const other = opts.find((t) => t !== keepT) ?? keepT;
    const h = self.hand.slice();
    h.splice(h.indexOf(other), 1);
    let score = -Infinity;
    if (canWin(h, self.melds)) score = 1e6;
    else {
      for (let d = 0; d < h.length; d++) {
        const h2 = h.slice();
        const dropped = h2.splice(d, 1)[0];
        if (!isTenpai(h2, self.melds)) continue;
        let ukeire = 0;
        for (let t = 0; t < 34; t++) if (canWin([...h2, t], self.melds)) ukeire++;
        score = Math.max(score, 1000 + ukeire - (dropped === keepT ? 5 : 0));
      }
      if (score === -Infinity) score = usefulness(keepT, counts);
    }
    if (score > bestScore) {
      bestScore = score;
      best = act;
    }
  }
  return best;
}

/** 技能与技能卡（合并）阶段：先考虑「回购」，再考虑打一张卡，否则结束阶段。 */
function chooseAction(view: RedactedView, acts: Action[]): Action {
  const self = view.self;
  const tenpai = isTenpai(self.hand, self.melds);
  // 回购：未听牌时用来从弃牌堆换回有用牌
  const huigou = acts.find((a) => a.type === 'useSkill' && a.skillId === 'huigou');
  if (huigou && !tenpai) return huigou;

  const affordable = new Set(
    acts.filter((a) => a.type === 'useCard').map((a) => (a as { cardId: string }).cardId)
  );
  const opps = aliveOpponents(view);
  const strongest = opps.slice().sort((a, b) => view.publicBoard.players[b].hp - view.publicBoard.players[a].hp)[0];
  const use = (cardId: string, target?: number): Action => ({ type: 'useCard', cardId, target });

  if (self.hp <= 30) {
    for (const id of ['xiangsi', 'xiuyang', 'shengsheng', 'guanghe', 'yidalipao']) if (affordable.has(id)) return use(id);
    if (affordable.has('genibao')) return use('genibao', strongest);
    if (affordable.has('yanguang')) return use('yanguang', strongest);
    if (affordable.has('buchi') && self.statuses.some((st) => st.negative)) return use('buchi');
  }
  if (tenpai && affordable.has('yougan')) return use('yougan');
  if (!tenpai) {
    for (const id of ['duoduo', 'chongkai', 'jiucha', 'ruguo', 'duidedui', 'buduibudui']) if (affordable.has(id)) return use(id);
  }
  if (affordable.has('qiubiemo') && strongest !== undefined) return use('qiubiemo', strongest);
  return { type: 'endAction' };
}

/** 主决策：输入投影视图（含 legalActions），输出一个动作。 */
export function decide(view: RedactedView): Action {
  const acts = view.legalActions;
  if (acts.length === 0) return { type: 'respondPass' };
  const dumb = humanLow(view) && view.self.heroId !== 'geda';

  const tsumo = firstOf(acts, 'declareTsumo');
  if (tsumo && !dumb) return tsumo;
  const ron = firstOf(acts, 'respondRon');
  if (ron && !dumb) return ron;
  // 其他鸣牌响应一律过（若处于降智，则连和都放弃）
  if (acts.some((a) => a.type.startsWith('respond'))) return firstOf(acts, 'respondPass') ?? acts[0];

  if (firstOf(acts, 'confirmRoundSafety')) return { type: 'confirmRoundSafety' };

  const keepActs = acts.filter((a) => a.type === 'keepDrawn');
  if (keepActs.length) return chooseKeepDrawn(view, keepActs);

  if (acts.some((a) => a.type === 'pickCard')) return choosePickCard(view, acts);

  if (firstOf(acts, 'endAction')) return chooseAction(view, acts);

  const discards = acts.filter((a) => a.type === 'discard');
  if (discards.length) {
    if (dumb) {
      // 降智：随机切一张（放水，避免整理成听牌）
      return discards[Math.floor(Math.random() * discards.length)];
    }
    return chooseDiscard(view, discards);
  }

  return acts[0];
}

/** 便捷：给定引擎状态与决策点，构造该行动者的投影视图并决策。 */
export function aiDecide(state: GameState, decision: Decision): Action {
  const view = redactStateFor(state, decision.actor, decision.actions);
  return decide(view);
}
