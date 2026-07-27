/** 技能牌逻辑接口（与 heroes/types 的 HeroLogic 对应），由 register.ts 组合进 engineHooks。 */
import type { GameState, PlayerId, DamageStep } from '../state';
import type { Action } from '../actions';
import type { DamageSnapshot } from '../damage';

export interface CardLogic {
  /** 抽卡阶段：从卡牌全集随机抽 3 种候选。 */
  candidates(s: GameState, pid: PlayerId): string[];
  /** 卡牌 AP 消耗。 */
  apCost(cardId: string): number;
  /** 结算卡牌效果，返回是否已处理。 */
  resolve(s: GameState, action: Action): boolean;
  /** 出伤加成（有感觉了等）。trace 收集出伤明细。 */
  outgoing(s: GameState, pid: PlayerId, base: number, isSelfDraw: boolean, trace?: DamageStep[]): number;
  /** 承伤减免（意大利炮等）。trace 收集防御明细。 */
  incoming(
    s: GameState,
    target: PlayerId,
    amount: number,
    source: PlayerId,
    isSelfDraw: boolean,
    trace?: DamageStep[]
  ): number;
  /** 伤害再分配（跟你爆了）。 */
  redistribute(s: GameState, snap: DamageSnapshot): void;
  /** 开始阶段：状态时间轴推进。 */
  onTurnStart(s: GameState, pid: PlayerId): void;
  /** 场上任意玩家副露后触发（休养生息回血）。 */
  onAnyMeld(s: GameState, melder: PlayerId, meldType: string): void;
}
