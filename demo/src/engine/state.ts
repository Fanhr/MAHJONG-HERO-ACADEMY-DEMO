/**
 * 对局状态模型（引擎真值）与初始化/发牌。
 * 引擎持有全量真值 GameState；对外派发给决策主体时经 redactStateFor 投影（见 redact.ts）。
 * 所有状态变更走纯函数（返回新状态），必要时用 cloneState 复制后局部修改。
 */
import { createWall, YAOJI_INDEX } from './tiles';
import { makeRng, type RNG } from './rng';
import {
  DEFAULT_AP_INIT,
  DEFAULT_AP_MAX,
  DEFAULT_HP,
  HAND_SIZE,
  PLAYER_COUNT,
} from './constants';

export type PlayerId = number; // 0..3
/** 英雄（学院代表）：geda=咯哒(山鸣学院·玩家)，aimage=爱麻鸽(人机)。 */
export type HeroId = 'geda' | 'aimage';

/**
 * 标准回合五阶段（对齐《局内游戏流程 ver2.0》）：
 *   开始(start) → 抽卡(drawCard) → 技能与技能卡(action) → 摸牌(drawTile) → 切牌(discard)
 * 其中「技能与技能卡阶段」合并了英雄主动技能发动与技能卡打出，位于抽卡之后、摸牌之前。
 */
export type Phase =
  | 'start'
  | 'drawCard'
  | 'action' // 技能与技能卡（合并）
  | 'drawTile'
  | 'discard'
  | 'awaitMeld' // 弃牌后的鸣牌响应窗口
  | 'tribute' // 和牌上贡机制（collect 收集上贡牌 / exchange 和牌者选交换）
  | 'roundSafety' // 荒牌后，存活玩家依次确认要保留至下一局的安全牌
  | 'roundOver'
  | 'gameOver';

export type MeldType = 'chi' | 'pon' | 'minkan' | 'ankan' | 'kakan';

export interface Meld {
  type: MeldType;
  /** 组成该副露的牌索引（升序）。杠为 4 张。 */
  tiles: number[];
  /** 来源玩家（吃/碰/明杠为被鸣者；暗杠为 null）。 */
  from: PlayerId | null;
  /** 被鸣的那张牌索引（暗杠为 null）。 */
  claimed: number | null;
}

/** 通用状态效果（buff/debuff/护盾/减伤/伤害分担等），由技能与卡牌统一挂载。 */
export interface StatusEffect {
  id: string;
  kind: string;
  /** 剩余回合/巡数；-1 表示直到手动移除或条件消耗。 */
  remaining: number;
  data?: Record<string, number | string | boolean | number[]>;
  /** 是否为负面状态（供“移除负面状态”类效果识别）。 */
  negative?: boolean;
}

/** 冷却中的卡牌：还需经过 draws 个抽卡阶段回池。 */
export interface CooldownCard {
  cardId: string;
  draws: number;
}

/** 伤害计算的单步（供“乘区/加区/防御区”明细展示）。 */
export interface DamageStep {
  /** 步骤名称，如“门清之心”“翻鸡”“意大利炮”。 */
  label: string;
  /** 运算类型：base=基础值；mul=乘区；add=加区；sub=减区（防御）。 */
  op: 'base' | 'mul' | 'add' | 'sub';
  /** 运算数（mul 为倍率、add/sub 为增减量、base 为番数）。 */
  operand: number;
  /** 该步之后的伤害值。 */
  after: number;
}

/** 单个目标承受伤害的明细（自摸时按人均分后再各自结算防御）。 */
export interface TargetBreakdown {
  target: PlayerId;
  /** 该目标承受的初始份额（自摸=总额/对手数；荣和=全额）。 */
  incoming: number;
  /** 防御乘区/减区明细。 */
  defSteps: DamageStep[];
  /** 最终实际扣血（防御后；不含事后分担转移）。 */
  final: number;
}

/** 一次和牌造成伤害的完整计算明细。 */
export interface WinBreakdown {
  fan: number;
  base: number;
  /** 出伤乘区/加区明细（门清之心/立直/里宝/翻鸡/有感觉了等）。 */
  outSteps: DamageStep[];
  /** 出伤加成后的总额（自摸为未均分前的总额）。 */
  outDamage: number;
  isSelfDraw: boolean;
  /** 自摸均分的对手人数（荣和为 1）。 */
  splitCount: number;
  targets: TargetBreakdown[];
}

/** 一次和牌记录。自摸背面朝上（hiddenFace=true），荣和正面朝上。 */
export interface WinRecord {
  winner: PlayerId;
  isSelfDraw: boolean;
  winningTile: number;
  hiddenFace: boolean;
  damage: number;
  fan: number;
  seq: number;
  /** 番种明细（如 ["清一色","碰碰和"]），供对局结束后揭示。 */
  yaku: string[];
  /** 和牌时的手内牌（含和牌张），供结束后展示牌型。 */
  hand: number[];
  /** 和牌时的副露。 */
  melds: Meld[];
  /** 伤害计算明细（乘区/防御区），供结算页揭示。 */
  breakdown?: WinBreakdown;
}

export interface PlayerState {
  id: PlayerId;
  heroId: HeroId;
  name: string;
  hp: number;
  ap: number;
  apMax: number;
  alive: boolean;
  isAI: boolean;

  hand: number[]; // 私有信息
  melds: Meld[]; // 公开信息
  discards: number[]; // 公开信息（弃牌河）
  safeTiles: number[]; // 手牌中被指定为安全牌的牌值多重集（私有，按物理张数计）
  menzen: boolean; // 门前清（未吃/碰/明杠）

  reserve: string[]; // 技能卡备用区（私有）
  cooldown: CooldownCard[]; // 技能卡冷却区（私有）
  statuses: StatusEffect[];

  // 英雄/机制专属状态
  eggIndicator: number | null; // 咯哒·鸡生蛋指示牌（对局内首次和牌随机生成，跨局延续）
  hasWon: boolean; // 是否已在本对局和过牌（鸡生蛋“首次和牌”判定；跨局延续）
  firstDiscardDone: boolean; // 是否完成本局第一次摸切
  healPityGranted: number; // 玩家·已发放的“掉血保底生牌”次数（每掉 30 触发一次）
  healPityDue: boolean; // 玩家·下次抽卡是否必出一张“生”类技能卡
  gold: number; // 金豆累计（即时奖励+终局结算奖励；跨局延续）
}

export type MeldIntentKind = 'ron' | 'kan' | 'pon' | 'chi' | 'pass';
export interface MeldIntent {
  kind: MeldIntentKind;
  tiles?: number[]; // 吃/碰/杠所用的手牌
}

/** 弃牌后的鸣牌响应窗口挂起态。 */
export interface PendingMeld {
  discarder: PlayerId;
  tile: number;
  responders: PlayerId[]; // 有合法响应的玩家
  intents: Record<PlayerId, MeldIntent>; // 已声明意向
  /** 该弃牌来自常规切牌（nextTurn）或效果摸切（返回发动者）。 */
  resume: 'nextTurn' | { initiator: PlayerId };
}

export interface GameEvent {
  seq: number;
  type: string;
  text: string;
  /** 公开可见（true）或仅调试（false）。伤害数值公开，牌型保密。 */
  publicInfo?: boolean;
  data?: Record<string, unknown>;
}

export interface HeroChoice {
  heroId: HeroId;
  isAI: boolean;
  name: string;
}

export interface GameState {
  seed: number;
  rngState: number;

  players: PlayerState[];
  wall: number[]; // 完整 136 张（洗牌后）
  head: number; // 下一张常规摸牌（从前端）
  tail: number; // 下一张杠尾补牌取 wall[tail-1]
  dealer: PlayerId; // 本局起家
  turn: PlayerId; // 当前行动玩家
  phase: Phase;

  roundNumber: number;
  events: GameEvent[];
  seqCounter: number;
  winRecords: WinRecord[];
  winner: PlayerId | null;

  // 回合内瞬时状态
  justDrew: boolean; // 当前玩家刚摸牌（可自摸判定）
  drawnTile: number | null; // 刚摸到的牌
  lastActor: PlayerId; // 最近一位常规行动玩家（荒牌定新起家用）
  pending: PendingMeld | null; // 副露响应挂起
  pendingDraw: number[] | null; // 多多益善：待玩家选择保留的两张候选牌
  roundSafetyPending: PlayerId[] | null; // 荒牌后尚未确认安全牌保留的存活玩家
  candidates: string[]; // 抽卡阶段候选卡 id
  firstYaojiDone: boolean; // 咯哒·冲锋鸡：本局是否已结算过“第一张幺鸡”事件
  pendingYaojiDiscarder: PlayerId | null; // 冲锋鸡：本局第一张幺鸡的打出者（等待鸣牌窗口结束后结算）
  winFanContext: number | null; // 当前正在结算的和牌番数（供“平和鸽”等按番数判定的效果读取）
  /** 和牌上贡机制（ver2.0 §3.2.1）待处理状态；非 null 时处于 tribute 阶段。 */
  pendingTribute: PendingTribute | null;
  /** 场上和牌总伤害（结算时点）：本场对局累计的全部和牌伤害之和（ver3.0 §0.5）。 */
  totalDamageDealt: number;
  /** 结算顺序：玩家被淘汰/获胜的先后（第1位最先淘汰，获胜者最后）。用于金豆终局奖励比例。 */
  settleOrder: PlayerId[];
}

/** 单名应上贡玩家提交的上贡牌。tile===null 表示尚未提交；-1 表示该玩家无可用非安全手牌、跳过。 */
export interface TributeOffer {
  from: PlayerId;
  tile: number | null;
}

/** 上贡机制待处理状态：collect=收集各家上贡牌；exchange=和牌者选择是否交换。 */
export interface PendingTribute {
  winner: PlayerId;
  fan: number;
  isSelfDraw: boolean;
  discarder: PlayerId | null; // 荣和时的点炮者；自摸为 null。上贡完成后从其下家恢复行动顺序。
  offers: TributeOffer[]; // 应上贡者列表（荣和=点炮者1人；自摸=除和牌者外各对手）
  stage: 'collect' | 'exchange';
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

export function rngFromState(s: GameState): RNG {
  return makeRng(s.rngState);
}

/** 记录事件并推进 seq，返回新 seq。原地修改（调用方应在克隆后使用）。 */
export function pushEvent(
  s: GameState,
  type: string,
  text: string,
  publicInfo = true,
  data?: Record<string, unknown>
): void {
  s.events.push({ seq: s.seqCounter++, type, text, publicInfo, data });
}

export function alivePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => p.alive);
}

/** 下一位存活玩家（逆时针，跳过淘汰席位）。 */
export function nextAlive(s: GameState, from: PlayerId): PlayerId {
  for (let step = 1; step <= PLAYER_COUNT; step++) {
    const cand = (from + step) % PLAYER_COUNT;
    if (s.players[cand].alive) return cand;
  }
  return from;
}

const HERO_LABEL: Record<HeroId, string> = {
  geda: '咯哒',
  aimage: '爱麻鸽',
};

function makePlayer(id: PlayerId, choice: HeroChoice): PlayerState {
  return {
    id,
    heroId: choice.heroId,
    name: choice.name || HERO_LABEL[choice.heroId],
    hp: DEFAULT_HP,
    ap: DEFAULT_AP_INIT,
    apMax: DEFAULT_AP_MAX,
    alive: true,
    isAI: choice.isAI,
    hand: [],
    melds: [],
    discards: [],
    safeTiles: [],
    menzen: true,
    reserve: [],
    cooldown: [],
    statuses: [],
    eggIndicator: null,
    hasWon: false,
    firstDiscardDone: false,
    healPityGranted: 0,
    healPityDue: false,
    gold: 0,
  };
}

export interface InitOptions {
  seed: number;
  heroes: HeroChoice[]; // 长度 4，索引即座次
  dealer?: PlayerId;
}

/**
 * 初始化整场对局并完成第一局发牌。
 * 每位玩家发 13 张；起家在其首个摸牌阶段自然摸得第 14 张，不额外多发。
 */
export function initGame(opts: InitOptions): GameState {
  const rng = makeRng(opts.seed);
  const wall = createWall(rng);
  const players = opts.heroes
    .slice(0, PLAYER_COUNT)
    .map((c, i) => makePlayer(i, c));

  // 依次发 13 张
  let idx = 0;
  for (let p = 0; p < players.length; p++) {
    players[p].hand = wall.slice(idx, idx + HAND_SIZE).sort((a, b) => a - b);
    idx += HAND_SIZE;
  }

  const dealer = opts.dealer ?? 0;
  const state: GameState = {
    seed: opts.seed,
    rngState: rng.state(),
    players,
    wall,
    head: idx, // 52
    tail: wall.length, // 136
    dealer,
    turn: dealer,
    phase: 'start',
    roundNumber: 1,
    events: [],
    seqCounter: 0,
    winRecords: [],
    winner: null,
    justDrew: false,
    drawnTile: null,
    lastActor: dealer,
    pending: null,
    pendingDraw: null,
    roundSafetyPending: null,
    candidates: [],
    firstYaojiDone: false,
    pendingYaojiDiscarder: null,
    winFanContext: null,
    pendingTribute: null,
    totalDamageDealt: 0,
    settleOrder: [],
  };
  // 体验保障：玩家（非 AI）初始手牌保证含 1 张幺鸡，便于展示“鸡”系技能
  const humanSeat = players.findIndex((p) => !p.isAI);
  if (humanSeat >= 0) ensurePlayerHasYaoji(state, humanSeat);
  pushEvent(state, 'round-start', `第 ${state.roundNumber} 局开始，起家为 ${players[dealer].name}`);
  return state;
}

/**
 * 保证指定玩家手牌至少有 1 张幺鸡（一条）。若没有，则从活牌墙或其他玩家手牌换入一张，
 * 换出该玩家手中一张非幺鸡牌，保持全场牌数守恒。用于开局/重发时的玩家体验保障。
 */
export function ensurePlayerHasYaoji(s: GameState, pid: PlayerId): void {
  const p = s.players[pid];
  if (!p || p.hand.includes(YAOJI_INDEX)) return;
  const giveIdx = p.hand.findIndex((t) => t !== YAOJI_INDEX);
  if (giveIdx < 0) return;
  const give = p.hand[giveIdx];
  // 优先从活牌墙换入
  for (let k = s.head; k < s.tail; k++) {
    if (s.wall[k] === YAOJI_INDEX) {
      s.wall[k] = give;
      p.hand[giveIdx] = YAOJI_INDEX;
      p.hand.sort((a, b) => a - b);
      return;
    }
  }
  // 其次从其他玩家手牌换入
  for (const o of s.players) {
    if (o.id === pid) continue;
    const oi = o.hand.indexOf(YAOJI_INDEX);
    if (oi >= 0) {
      o.hand[oi] = give;
      p.hand[giveIdx] = YAOJI_INDEX;
      o.hand.sort((a, b) => a - b);
      p.hand.sort((a, b) => a - b);
      return;
    }
  }
}

/** 牌墙剩余可摸张数。 */
export function wallRemaining(s: GameState): number {
  return s.tail - s.head;
}
