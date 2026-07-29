/**
 * 防上帝视角投影：把引擎全量真值 GameState 投影成某个决策主体（人类/AI）可见的视图。
 *
 * 关键约束：AI 的决策函数只接受 RedactedView，从物理上无法访问：
 *   - 其他玩家的具体手牌牌面（只知道张数）
 *   - 牌墙的具体顺序/未来将摸到的牌（只知道剩余张数）
 *   - 其他玩家的 AP 数值、备用区卡牌身份、安全牌具体是哪几张
 *   - 自摸和牌记录的牌面（背面朝上）
 *
 * 人类 UI 与 AI 共用同一投影接口，确保信息可见性一致。
 */
import type { Action } from './actions';
import {
  wallRemaining,
  type GameState,
  type HeroId,
  type Meld,
  type PendingTribute,
  type PlayerId,
  type PlayerState,
  type StatusEffect,
  type TributeOffer,
} from './state';

/** 其他玩家的公开信息（不含手牌牌面、AP、备用区身份等私有数据）。 */
export interface PublicPlayer {
  id: PlayerId;
  heroId: HeroId;
  name: string;
  hp: number;
  alive: boolean;
  handCount: number;
  melds: Meld[];
  discards: number[];
  menzen: boolean;
  safeTileCount: number;
  reserveCount: number;
  cooldownCount: number;
  /** 金豆累计（即时奖励数额为公开信息，ver3.0 §3.2.2）。 */
  gold: number;
  /** 咯哒·鸡生蛋指示牌（规则信息，可公开）。 */
  eggIndicator: number | null;
  /** 场面可观察到的状态效果（不泄露隐藏手牌信息）。 */
  statuses: StatusEffect[];
}

/** 自己完整可见的信息。 */
export interface SelfInfo {
  id: PlayerId;
  heroId: HeroId;
  name: string;
  hp: number;
  ap: number;
  apMax: number;
  alive: boolean;
  hand: number[];
  melds: Meld[];
  discards: number[];
  safeTiles: number[];
  menzen: boolean;
  reserve: string[];
  cooldownCount: number;
  statuses: StatusEffect[];
  gold: number;
  eggIndicator: number | null;
  firstDiscardDone: boolean;
  /** 上贡机制待处理状态（tile 按可见性过滤：和牌者看全部，上贡者看自己，其余背面）。 */
  pendingTribute: PendingTribute | null;
}

/** 和牌记录的公开投影：荣和牌面公开，自摸牌面隐藏。 */
export interface PublicWinRecord {
  winner: PlayerId;
  isSelfDraw: boolean;
  damage: number;
  seq: number;
  winningTile: number | null; // 自摸时为 null（保密）
}

export interface PublicBoard {
  turn: PlayerId;
  phase: GameState['phase'];
  roundNumber: number;
  wallRemaining: number;
  players: PublicPlayer[];
  winRecords: PublicWinRecord[];
  /** 仅公开事件（伤害数值等），不含牌型/番数。 */
  recentEvents: { seq: number; type: string; text: string }[];
}

export interface RedactedView {
  self: SelfInfo;
  publicBoard: PublicBoard;
  legalActions: Action[];
  /** 仅对“使用了我要验牌的玩家自己”可见的最近一次窥牌结果（他人视图恒为 null）。 */
  inspect: InspectReveal | null;
}

/** 我要验牌的窥牌结果（仅使用者本人可见）。 */
export interface InspectReveal {
  target: PlayerId;
  targetName: string;
  tiles: number[];
  seq: number;
}

function toPublicPlayer(p: PlayerState): PublicPlayer {
  return {
    id: p.id,
    heroId: p.heroId,
    name: p.name,
    hp: p.hp,
    alive: p.alive,
    handCount: p.hand.length,
    melds: p.melds,
    discards: p.discards,
    menzen: p.menzen,
    safeTileCount: p.safeTiles.length,
    reserveCount: p.reserve.length,
    cooldownCount: p.cooldown.length,
    gold: p.gold,
    eggIndicator: p.eggIndicator,
    statuses: p.statuses,
  };
}

/** 按可见性过滤上贡牌：和牌者看全部 offers.tile；上贡者仅看自己；其余背面（-1）。 */
function visibleTribute(pt: PendingTribute, viewer: PlayerId): PendingTribute {
  const isWinner = viewer === pt.winner;
  const offers: TributeOffer[] = pt.offers.map((o) => ({
    from: o.from,
    tile: isWinner || viewer === o.from ? o.tile : o.tile === null ? null : -1,
  }));
  return { ...pt, offers };
}

function toSelfInfo(p: PlayerState): SelfInfo {
  return {
    id: p.id,
    heroId: p.heroId,
    name: p.name,
    hp: p.hp,
    ap: p.ap,
    apMax: p.apMax,
    alive: p.alive,
    hand: p.hand,
    melds: p.melds,
    discards: p.discards,
    safeTiles: p.safeTiles,
    menzen: p.menzen,
    reserve: p.reserve,
    cooldownCount: p.cooldown.length,
    statuses: p.statuses,
    gold: p.gold,
    eggIndicator: p.eggIndicator,
    firstDiscardDone: p.firstDiscardDone,
    pendingTribute: null,
  };
}

/**
 * 投影入口。legalActions 由回合状态机在当前时点计算后传入（该玩家实际可执行的动作）。
 * 未提供时默认空数组（观察态）。
 */
export function redactStateFor(
  state: GameState,
  playerId: PlayerId,
  legalActions: Action[] = []
): RedactedView {
  const self = state.players[playerId];
  const publicBoard: PublicBoard = {
    turn: state.turn,
    phase: state.phase,
    roundNumber: state.roundNumber,
    wallRemaining: wallRemaining(state),
    players: state.players.map(toPublicPlayer),
    winRecords: state.winRecords.map((w) => ({
      winner: w.winner,
      isSelfDraw: w.isSelfDraw,
      damage: w.damage,
      seq: w.seq,
      winningTile: w.hiddenFace ? null : w.winningTile,
    })),
    recentEvents: state.events
      .filter((e) => e.publicInfo)
      .slice(-40)
      .map((e) => ({ seq: e.seq, type: e.type, text: e.text })),
  };
  // 我要验牌：仅把“查看者为本人”的最近一次窥牌结果投影给自己
  let inspect: InspectReveal | null = null;
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'inspect' && e.data && (e.data as Record<string, unknown>).viewer === playerId) {
      const d = e.data as Record<string, unknown>;
      inspect = {
        target: d.target as PlayerId,
        targetName: state.players[d.target as PlayerId]?.name ?? '',
        tiles: (d.tiles as number[]) ?? [],
        seq: e.seq,
      };
      break;
    }
  }
  const selfInfo = toSelfInfo(self);
  selfInfo.pendingTribute = state.pendingTribute ? visibleTribute(state.pendingTribute, playerId) : null;
  return { self: selfInfo, publicBoard, legalActions, inspect };
}

/** 深拷贝投影视图（供 AI 使用，避免其误改真值引用）。 */
export function freezeView(view: RedactedView): RedactedView {
  return structuredClone(view);
}
