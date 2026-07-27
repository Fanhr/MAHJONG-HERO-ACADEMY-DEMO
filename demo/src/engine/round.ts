/**
 * 局与对局循环：荒牌后开新局的重洗发牌与资源延续（ver2.0 §5/§6）。
 * 延续：HP / AP / 备用区 / 冷却区 / 状态 / 对局级英雄状态；重置：手牌 / 副露 / 弃牌 / 安全牌 / 每局标记。
 * 起家：上一局荒牌时行动玩家的下家（跳过淘汰席位）。
 */
import { makeRng } from './rng';
import { NUM_TILE_TYPES, COPIES_PER_TYPE } from './tiles';
import { checkGameOver } from './damage';
import { settle } from './turnMachine';
import { HAND_SIZE } from './constants';
import {
  alivePlayers,
  cloneState,
  ensurePlayerHasYaoji,
  nextAlive,
  pushEvent,
  wallRemaining,
  type GameState,
  type PlayerState,
} from './state';

function fullBag(): number[] {
  const bag: number[] = [];
  for (let t = 0; t < NUM_TILE_TYPES; t++) for (let c = 0; c < COPIES_PER_TYPE; c++) bag.push(t);
  return bag;
}

function resetPlayerForRound(p: PlayerState): void {
  p.melds = [];
  p.discards = [];
  p.menzen = true;
  p.firstDiscardDone = false;
  // 保留：eggIndicator / hasWon / healPity*（均为对局级，跨局延续）；safeTiles 由下方按保留规则处理。
}

/**
 * 荒牌后开始下一局。若仅剩 1 人则对局结束。
 * 规则（ver2.0 §5/§6）：荒牌时清除全部安全牌标记，全部麻将牌（牌墙+弃牌+手牌+副露）共同重洗；
 * 再按逆时针座次向存活玩家依次补足 13 张，淘汰席位跳过。HP/AP/备用区/冷却区/对局级英雄状态延续。
 * 新局起家为上一局荒牌玩家的下家（跳过淘汰席位）。
 */
export function startNextRound(prev: GameState): GameState {
  const s = cloneState(prev);
  if (checkGameOver(s)) return s;

  const rng = makeRng(s.rngState);
  const alive = alivePlayers(s).map((p) => p.id);
  const shuffle = (arr: number[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const bag = shuffle(fullBag()); // 全部牌重洗（含原安全牌，均不保留）

  // 逆时针座次：从新起家（上一局荒牌行动者的下家）开始绕存活席位
  const startDealer = nextAlive(s, s.lastActor);
  const order: number[] = [];
  {
    let cur = startDealer;
    for (let k = 0; k < alive.length; k++) {
      order.push(cur);
      cur = nextAlive(s, cur);
    }
  }

  // 重置每局标记与手牌；清除全部安全牌标记
  for (const p of s.players) {
    resetPlayerForRound(p);
    p.hand = [];
    p.safeTiles = [];
  }

  // 按逆时针座次依次向存活玩家发 13 张（淘汰席位跳过）
  const dealt: number[] = [];
  let cursor = 0;
  for (const id of order) {
    const extra = bag.slice(cursor, cursor + HAND_SIZE);
    dealt.push(...extra);
    cursor += HAND_SIZE;
    s.players[id].hand = [...extra].sort((a, b) => a - b);
  }
  const liveWall = bag.slice(cursor);
  s.wall = [...dealt, ...liveWall];
  s.head = dealt.length;
  s.tail = s.wall.length;

  // 体验保障：玩家（非 AI）若存活，重发后手牌保证含 1 张幺鸡
  const humanSeat = s.players.findIndex((p) => !p.isAI && p.alive);
  if (humanSeat >= 0) ensurePlayerHasYaoji(s, humanSeat);

  s.rngState = rng.state();
  s.roundNumber++;
  s.pending = null;
  s.pendingDraw = null;
  s.roundSafetyPending = null;
  s.firstYaojiDone = false;
  s.pendingYaojiDiscarder = null;
  s.winFanContext = null;
  s.justDrew = false;
  s.drawnTile = null;
  s.candidates = [];
  const dealer = startDealer;
  s.dealer = dealer;
  s.turn = dealer;
  s.lastActor = dealer;
  s.phase = 'start';
  pushEvent(
    s,
    'round-start',
    `第 ${s.roundNumber} 局开始，起家为 ${s.players[dealer].name}（存活 ${alive.length} 人；全部重洗、清除安全牌）`,
    true
  );
  settle(s);
  return s;
}

export { wallRemaining };
