/** 英雄逻辑接口：每个英雄实现其中需要的钩子片段，由 register.ts 组合进 engineHooks。 */
import type { Action } from '../actions';
import type { GameState, Meld, PlayerId, DamageStep } from '../state';
import type { DamageSnapshot } from '../damage';

export interface HeroLogic {
  /** 技能释放阶段可用的主动技能动作。 */
  skillActions?(s: GameState, pid: PlayerId): Action[];
  /** 结算技能动作，返回是否已处理。 */
  resolveSkill?(s: GameState, action: Action): boolean;
  /** 开始阶段被动。 */
  onTurnStart?(s: GameState, pid: PlayerId): void;
  /** 杠牌触发。 */
  onKan?(s: GameState, pid: PlayerId, kanType: 'minkan' | 'ankan' | 'kakan', from: PlayerId | null): void;
  /** 切牌触发。 */
  onDiscard?(s: GameState, pid: PlayerId, tile: number): void;
  /** 场上任意玩家副露（吃/碰/杠）时触发（瑞雪、休养生息等）。melder 为副露者。 */
  onAnyMeld?(s: GameState, melder: PlayerId, meldType: Meld['type']): void;
  /** 和牌后触发（鸡生蛋等）。 */
  onWin?(s: GameState, pid: PlayerId, isSelfDraw: boolean): void;
  /** 出伤加成（鸡关枪/鸡生蛋/平和鸽等）。 */
  outgoing?(s: GameState, pid: PlayerId, base: number, isSelfDraw: boolean, trace?: DamageStep[]): number;
  /** 承伤修正（鸡关枪·反噬等）。 */
  incoming?(
    s: GameState,
    pid: PlayerId,
    amount: number,
    source: PlayerId,
    isSelfDraw: boolean,
    trace?: DamageStep[]
  ): number;
  /** 伤害再分配。 */
  redistribute?(s: GameState, snap: DamageSnapshot): void;
  /** 自限禁和。 */
  winBlocked?(
    s: GameState,
    pid: PlayerId,
    concealed: number[],
    melds: Meld[],
    isTsumo: boolean,
    winningTile: number
  ): boolean;
}
