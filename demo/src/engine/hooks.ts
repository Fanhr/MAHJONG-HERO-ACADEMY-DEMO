/**
 * 引擎钩子：把“英雄技能 / 技能牌 / 被动触发”从回合状态机中解耦。
 * turnMachine 只调用这些钩子；heroes/ 与 cards/ 模块在加载时覆盖默认实现。
 * 默认全部为无副作用的安全实现，保证在未加载英雄/卡牌时引擎也能自洽运行。
 */
import type { Action } from './actions';
import type { GameState, PlayerId, Meld, DamageStep } from './state';
import type { DamageSnapshot } from './damage';
export interface EngineHooks {
  /** 技能释放阶段：该玩家当前可用的主动技能动作。 */
  getSkillActions(state: GameState, playerId: PlayerId): Action[];
  /** 结算一个技能动作（原地修改）。 */
  resolveSkill(state: GameState, action: Action): void;
  /** 开始阶段的被动触发（如状态结算）。 */
  onTurnStart(state: GameState, playerId: PlayerId): void;

  /** 抽卡阶段：生成 3 张候选卡 id（从卡牌全集随机抽取）。 */
  getCardCandidates(state: GameState, playerId: PlayerId): string[];
  /** 结算一张技能牌（原地修改）。 */
  resolveCard(state: GameState, action: Action): void;
  /** 查询卡牌 AP 消耗。 */
  cardApCost(cardId: string): number;

  /** 计算某目标最终承受的伤害（护盾/减伤/分担等）。默认原样返回。trace 收集防御明细。 */
  modifyIncomingDamage(
    state: GameState,
    target: PlayerId,
    amount: number,
    source: PlayerId,
    isSelfDraw: boolean,
    trace?: DamageStep[]
  ): number;

  /** 计算某和牌者造成的基础伤害加成（门清之心/立直/有感觉了/冲锋鸡等）。默认原样返回。trace 收集出伤明细。 */
  modifyOutgoingDamage(
    state: GameState,
    source: PlayerId,
    baseDamage: number,
    isSelfDraw: boolean,
    trace?: DamageStep[]
  ): number;

  /** 和牌后触发（翻鸡等宝牌刷新、状态清理）。 */
  onWin(state: GameState, winner: PlayerId, isSelfDraw: boolean): void;

  /** 杠牌后触发（如蜀道山阴阳的杠伤害）。from 为被杠者（暗杠为 null）。 */
  onKan(
    state: GameState,
    player: PlayerId,
    kanType: 'minkan' | 'ankan' | 'kakan',
    from: PlayerId | null
  ): void;

  /** 切牌后触发（如捉鸡流冲锋鸡：本局第一张幺鸡）。 */
  onDiscard(state: GameState, player: PlayerId, tile: number): void;

  /** 场上任意玩家副露（吃/碰/杠）后触发（瑞雪、休养生息等）。 */
  onAnyMeld(state: GameState, melder: PlayerId, meldType: Meld['type']): void;

  /** 伤害再分配（责任鸡分担、跟你爆了转移等）：在扣血前可增改 entries。 */
  redistributeDamage(state: GameState, snap: DamageSnapshot): void;

  /** 英雄自限：某些情况下即便牌型合法也不得和牌（如蜀道山定缺、立直流振听）。 */
  winBlocked(
    state: GameState,
    playerId: PlayerId,
    concealedTiles: number[],
    melds: Meld[],
    isTsumo: boolean,
    winningTile: number
  ): boolean;

  /** 和牌番数的英雄/宝牌加成（在基础番数上追加）。返回追加番数。 */
  fanBonus(
    state: GameState,
    winner: PlayerId,
    concealedTiles: number[],
    isTsumo: boolean
  ): number;
}

const defaultHooks: EngineHooks = {
  getSkillActions: () => [],
  resolveSkill: () => {},
  onTurnStart: () => {},
  getCardCandidates: () => [],
  resolveCard: () => {},
  cardApCost: () => 0,
  modifyIncomingDamage: (_s, _t, amount) => amount,
  modifyOutgoingDamage: (_s, _src, amount) => amount,
  onWin: () => {},
  onKan: () => {},
  onDiscard: () => {},
  onAnyMeld: () => {},
  redistributeDamage: () => {},
  winBlocked: () => false,
  fanBonus: () => 0,
};

/** 全局可变钩子单例。heroes/cards 模块通过 setHooks 覆盖。 */
export const engineHooks: EngineHooks = { ...defaultHooks };

export function setHooks(partial: Partial<EngineHooks>): void {
  Object.assign(engineHooks, partial);
}

export function resetHooks(): void {
  Object.assign(engineHooks, defaultHooks);
}
