/**
 * 回合状态机（对齐《局内游戏流程 ver2.0》）：
 *   开始 → 抽卡 → 技能与技能卡(合并) → 摸牌 → 切牌
 * 负责：阶段推进、摸牌/自摸、暗杠/加杠、切牌后鸣牌响应窗口与「和>杠>碰>吃」裁决、
 * 即时伤害同步结算（经 hooks 应用减伤/分担）、和牌上贡、荒牌。
 *
 * 对外主接口：
 *   startGame(opts) -> GameState（已推进到首个决策点）
 *   getDecision(state) -> { actor, actions } | null
 *   applyAction(state, action) -> 新 GameState
 */
import {
  cloneState,
  initGame,
  alivePlayers,
  nextAlive,
  pushEvent,
  wallRemaining,
  type GameState,
  type InitOptions,
  type Meld,
  type MeldIntent,
  type PlayerId,
  type PlayerState,
  type DamageStep,
  type WinBreakdown,
} from './state';
import type { Action } from './actions';
import { engineHooks } from './hooks';
import {
  canMinkan,
  canPon,
  canRonTile,
  chiOptions,
  ankanOptions,
  kakanOptions,
} from './meld';
import { canWin, isTenpai } from './winning';
import { evaluateYaku } from './yaku';
import { tileName, counts34, suitOfIndex, isHonor, rankOfIndex, type Suit } from './tiles';
import {
  applyDamageSnapshot,
  buildRonSnapshot,
  buildTsumoSnapshot,
  type WinnerInfo,
} from './damage';
import { resolveChongfengji } from './heroes';
import { cardOnDiscard, findPlayerStatus, removePlayerStatus } from './cards/cardEffects';
import {
  AP_REGEN_PER_TURN,
  CARD_COOLDOWN_DRAWS,
  CARD_RESERVE_MAX,
  SAFE_TILE_MAX,
  fanToDamage,
} from './constants';

// ---------------------------------------------------------------------------
// 手牌工具
// ---------------------------------------------------------------------------

function addTile(hand: number[], tile: number): void {
  hand.push(tile);
  hand.sort((a, b) => a - b);
}
function removeOne(hand: number[], tile: number): boolean {
  const i = hand.indexOf(tile);
  if (i < 0) return false;
  hand.splice(i, 1);
  return true;
}
function removeN(hand: number[], tile: number, n: number): boolean {
  for (let k = 0; k < n; k++) if (!removeOne(hand, tile)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 和牌判定
// ---------------------------------------------------------------------------

function canDeclareWin(
  s: GameState,
  player: PlayerId,
  concealed: number[],
  isTsumo: boolean,
  winningTile: number
): boolean {
  const p = s.players[player];
  if (!canWin(concealed, p.melds)) return false;
  if (engineHooks.winBlocked(s, player, concealed, p.melds, isTsumo, winningTile)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 阶段推进
// ---------------------------------------------------------------------------

function enterTurnStart(s: GameState): void {
  const p = s.players[s.turn];
  p.ap = Math.min(p.apMax, p.ap + AP_REGEN_PER_TURN);
  for (const c of p.cooldown) c.draws--;
  p.cooldown = p.cooldown.filter((c) => c.draws > 0);
  engineHooks.onTurnStart(s, s.turn);
  s.candidates = [];
  s.phase = 'drawCard'; // ver2.0：先抽卡
}

function reserveAffordable(s: GameState): string[] {
  const p = s.players[s.turn];
  return p.reserve.filter((id) => engineHooks.cardApCost(id) <= p.ap);
}

// —— 摸牌：支持“系统喂好牌”（玩家 HP<30）与运类摸牌状态 —— //

/** 轻量评分：某张牌加入手牌后的“成型收益”。 */
function drawGainScore(hand: readonly number[], melds: readonly Meld[], t: number): number {
  if (canWin([...hand, t], melds)) return 1e9;
  const counts = counts34(hand);
  let sc = counts[t] * 4;
  if (!isHonor(t)) {
    const base = t < 9 ? 0 : t < 18 ? 9 : 18;
    const rank = rankOfIndex(t);
    for (const d of [-2, -1, 1, 2]) {
      const r = rank + d;
      if (r >= 1 && r <= 9 && counts[base + (r - 1)] > 0) sc += Math.abs(d) === 1 ? 2 : 1;
    }
  }
  return sc;
}

/** 玩家 HP<30 时，系统把牌山中最有利的一张调到摸牌口（需求 6）。 */
function maybeFeedGood(s: GameState, p: PlayerState): void {
  if (p.isAI || p.hp >= 30) return;
  const live = s.tail - s.head;
  if (live <= 1) return;
  let bestPos = s.head;
  let bestScore = -Infinity;
  for (let i = s.head; i < s.tail; i++) {
    const sc = drawGainScore(p.hand, p.melds, s.wall[i]);
    if (sc > bestScore) {
      bestScore = sc;
      bestPos = i;
    }
  }
  if (bestPos !== s.head) {
    const tmp = s.wall[s.head];
    s.wall[s.head] = s.wall[bestPos];
    s.wall[bestPos] = tmp;
  }
}

/** 从牌山顶摸 1 张（含喂好牌偏置），加入手牌并返回牌值。 */
function drawOne(s: GameState, p: PlayerState): number {
  maybeFeedGood(s, p);
  const tile = s.wall[s.head++];
  addTile(p.hand, tile);
  return tile;
}

function doDraw(s: GameState): void {
  if (wallRemaining(s) <= 0) {
    exhaustRound(s);
    return;
  }
  const p = s.players[s.turn];

  // 不对不对：若下一次摸牌不为指定花色，退回并重摸一次
  let tile = drawOne(s, p);
  const redraw = findPlayerStatus(p, 'redrawIfNotSuit');
  if (redraw) {
    removePlayerStatus(p, 'redrawIfNotSuit');
    const suit = redraw.data?.suit as Suit;
    if (suitOfIndex(tile) !== suit && wallRemaining(s) > 0) {
      removeOne(p.hand, tile);
      s.wall.splice(s.tail, 0, tile);
      s.tail++;
      tile = drawOne(s, p);
      pushEvent(s, 'card', `${p.name}【不对不对】摸牌非${suitCn(suit)}，重摸一次`, true, { player: p.id });
    }
  }

  s.justDrew = true;
  s.drawnTile = tile;
  s.phase = 'discard';

  // 对的对的：若为指定花色，则增加一次摸切（这里以“多摸 1 张选留”体现）
  let extra = false;
  const extraSuit = findPlayerStatus(p, 'extraIfSuit');
  if (extraSuit) {
    removePlayerStatus(p, 'extraIfSuit');
    if (suitOfIndex(tile) === (extraSuit.data?.suit as Suit)) {
      extra = true;
      pushEvent(s, 'card', `${p.name}【对的对的】摸到${suitCn(extraSuit.data?.suit as Suit)}，增加一次摸切`, true, { player: p.id });
    }
  }
  // 多多益善：也触发“多摸 1 选留”
  const exIdx = p.statuses.findIndex((st) => st.kind === 'extraDraw');
  if (exIdx >= 0) {
    p.statuses.splice(exIdx, 1);
    extra = true;
  }

  if (extra && wallRemaining(s) > 0) {
    const extraTile = drawOne(s, p);
    if (extraTile === tile) {
      p.hand.splice(p.hand.indexOf(extraTile), 1);
      s.wall.splice(s.tail, 0, extraTile);
      s.tail++;
    } else {
      s.pendingDraw = [tile, extraTile];
    }
  }
}

/** 结算“多摸选留”：保留 keep，另一张放牌山底部。 */
function resolveKeepDrawn(s: GameState, keep: number): void {
  const opts = s.pendingDraw ?? [];
  const p = s.players[s.turn];
  const keepT = opts.includes(keep) ? keep : opts[0];
  const drop = opts.find((t) => t !== keepT) ?? opts[0];
  const di = p.hand.indexOf(drop);
  if (di >= 0) p.hand.splice(di, 1);
  s.wall.splice(s.tail, 0, drop);
  s.tail++;
  s.drawnTile = keepT;
  s.pendingDraw = null;
  pushEvent(s, 'card', `${p.name} 保留了 ${tileName(keepT)}`, true, { player: s.turn });
}

function doKanDraw(s: GameState): void {
  if (wallRemaining(s) <= 0) {
    exhaustRound(s);
    return;
  }
  s.tail--;
  const tile = s.wall[s.tail];
  addTile(s.players[s.turn].hand, tile);
  s.justDrew = true;
  s.drawnTile = tile;
  s.phase = 'discard';
}

function exhaustRound(s: GameState): void {
  // ver2.0 §5：荒牌时清除全部安全牌标记，随后进入重洗发牌（不再逐人确认保留）。
  s.roundSafetyPending = null;
  s.phase = 'roundOver';
  pushEvent(s, 'exhaust', `牌墙摸完，本局荒牌`, true);
}

/** 推进到下一个需要输入的决策点（自动跳过无意义的阶段）。 */
export function settle(s: GameState): void {
  let guard = 0;
  while (guard++ < 2000) {
    if (s.phase === 'gameOver' || s.phase === 'roundOver' || s.phase === 'roundSafety') return;
    if (s.pending) return;
    if (s.pendingDraw) return;
    // 上贡阶段：collect 自动跳过无可用非安全牌者；exchange 等和牌者输入
    if (s.phase === 'tribute') {
      const pt = s.pendingTribute;
      if (!pt) {
        s.phase = 'start';
        continue;
      }
      if (pt.stage === 'collect') {
        // 自动跳过手牌全是安全牌（无可用非安全牌）的应上贡者
        while (true) {
          const idx = pt.offers.findIndex((o) => o.tile === null);
          if (idx < 0) {
            pt.stage = 'exchange';
            break;
          }
          const o = pt.offers[idx];
          const p = s.players[o.from];
          const safe = new Set(p.safeTiles);
          const pool = p.hand.filter((x) => !safe.has(x));
          if (pool.length === 0) {
            o.tile = -1; // 无可用，跳过
            continue;
          }
          return; // 等该玩家提交上贡牌
        }
      }
      // exchange 阶段：若无任何有效上贡牌，自动结束
      if (pt.stage === 'exchange' && pt.offers.every((o) => o.tile === null || o.tile < 0)) {
        finishTribute(s);
        continue;
      }
      return;
    }
    switch (s.phase) {
      case 'start':
        enterTurnStart(s);
        continue;
      case 'drawCard': {
        if (s.candidates.length === 0) s.candidates = engineHooks.getCardCandidates(s, s.turn);
        if (s.candidates.length === 0) {
          s.phase = 'action';
          continue;
        }
        return;
      }
      case 'action': {
        const acts = engineHooks.getSkillActions(s, s.turn);
        if (acts.length === 0 && reserveAffordable(s).length === 0) {
          s.phase = 'drawTile';
          continue;
        }
        return;
      }
      case 'drawTile': {
        const cur = s.players[s.turn];
        const skipIdx = cur.statuses.findIndex((st) => st.kind === 'skipTurn');
        if (skipIdx >= 0) {
          cur.statuses.splice(skipIdx, 1);
          pushEvent(s, 'skip', `${cur.name} 被【求你别摸】跳过了摸牌切牌`, true, { player: s.turn });
          s.turn = nextAlive(s, s.turn);
          s.phase = 'start';
          continue;
        }
        doDraw(s);
        continue;
      }
      case 'discard':
        return;
      default:
        return;
    }
  }
}

// ---------------------------------------------------------------------------
// 决策点
// ---------------------------------------------------------------------------

export interface Decision {
  actor: PlayerId;
  actions: Action[];
}

function responderOptions(s: GameState, p: PlayerId, tile: number, discarder: PlayerId): Action[] {
  const player = s.players[p];
  const acts: Action[] = [];
  if (canRonTile(player.hand, player.melds, tile) && canDeclareWin(s, p, [...player.hand, tile], false, tile)) {
    acts.push({ type: 'respondRon' });
  }
  if (canMinkan(player.hand, tile) && wallRemaining(s) > 0) {
    acts.push({ type: 'respondKan', tiles: [tile, tile, tile] });
  }
  if (canPon(player.hand, tile)) acts.push({ type: 'respondPon', tiles: [tile, tile] });
  if (nextAlive(s, discarder) === p) {
    for (const opt of chiOptions(player.hand, tile)) acts.push({ type: 'respondChi', tiles: opt });
  }
  if (acts.length > 0) acts.push({ type: 'respondPass' });
  return acts;
}

/** 安全牌仅可在自己的摸切阶段指定（ver2.0 §0.3.1）。 */
function canSetSafeTiles(s: GameState): boolean {
  return s.phase === 'discard' && s.pendingDraw === null;
}

function setSafeTiles(s: GameState, player: PlayerId, tiles: readonly number[]): void {
  const p = s.players[player];
  if (!p?.alive) return;
  const handCount = counts34(p.hand);
  const used = new Array<number>(34).fill(0);
  const result: number[] = [];
  for (const t of tiles) {
    if (result.length >= SAFE_TILE_MAX) break;
    if (t < 0 || t > 33) continue;
    if (used[t] < (handCount[t] ?? 0)) {
      result.push(t);
      used[t]++;
    }
  }
  p.safeTiles = result;
}

function discardActions(s: GameState): Action[] {
  const p = s.players[s.turn];
  const acts: Action[] = [];
  const canTsumo = s.justDrew && s.drawnTile !== null && canDeclareWin(s, s.turn, p.hand, true, s.drawnTile);
  if (canTsumo) acts.push({ type: 'declareTsumo' });
  for (const t of ankanOptions(p.hand)) {
    if (wallRemaining(s) > 0) acts.push({ type: 'ankan', tile: t });
  }
  for (const t of kakanOptions(p.hand, p.melds)) {
    if (wallRemaining(s) > 0) acts.push({ type: 'kakan', tile: t });
  }
  const seen = new Set<number>();
  for (const t of p.hand) {
    if (seen.has(t)) continue;
    seen.add(t);
    acts.push({ type: 'discard', tile: t });
  }
  return acts;
}

/** 计算当前决策点。 */
export function getDecision(s: GameState): Decision | null {
  if (s.phase === 'gameOver' || s.phase === 'roundOver') return null;
  if (s.phase === 'roundSafety') {
    const actor = s.roundSafetyPending?.[0];
    return actor === undefined ? null : { actor, actions: [{ type: 'confirmRoundSafety' }] };
  }
  if (s.pending) {
    const actor = s.pending.responders.find((r) => !(r in s.pending!.intents));
    if (actor === undefined) return null;
    return { actor, actions: responderOptions(s, actor, s.pending.tile, s.pending.discarder) };
  }
  if (s.pendingDraw && s.pendingDraw.length > 0) {
    const opts = [...new Set(s.pendingDraw)];
    return { actor: s.turn, actions: opts.map((t) => ({ type: 'keepDrawn', tile: t })) };
  }
  switch (s.phase) {
    case 'drawCard': {
      const acts: Action[] = s.candidates.map((cid) => ({ type: 'pickCard', cardId: cid }));
      acts.push({ type: 'pickCard', cardId: null });
      if (s.players[s.turn].ap > 0) acts.push({ type: 'rerollCards' });
      return { actor: s.turn, actions: acts };
    }
    case 'action': {
      const acts: Action[] = [...engineHooks.getSkillActions(s, s.turn)];
      for (const cid of reserveAffordable(s)) acts.push({ type: 'useCard', cardId: cid });
      acts.push({ type: 'endAction' });
      return { actor: s.turn, actions: acts };
    }
    case 'discard':
      return { actor: s.turn, actions: discardActions(s) };
    case 'tribute': {
      const pt = s.pendingTribute;
      if (!pt) return { actor: s.turn, actions: [] };
      if (pt.stage === 'collect') {
        // 当前待提交者：第一个 tile===null 的应上贡者
        const idx = pt.offers.findIndex((o) => o.tile === null);
        if (idx < 0) return { actor: pt.winner, actions: [{ type: 'tributeExchange' }] };
        const actor = pt.offers[idx].from;
        const p = s.players[actor];
        const safe = new Set(p.safeTiles);
        const pool = [...new Set(p.hand.filter((x) => !safe.has(x)))];
        return { actor, actions: pool.map((t) => ({ type: 'tributeOffer', tile: t })) };
      }
      // exchange：和牌者选交换（UI 构造完整 action，这里给占位）
      return { actor: pt.winner, actions: [{ type: 'tributeExchange' }] };
    }
    default:
      return { actor: s.turn, actions: [] };
  }
}

// ---------------------------------------------------------------------------
// 和牌与上贡
// ---------------------------------------------------------------------------

/** 一张牌对某手牌的价值（上贡取舍用）。 */
function handTileValue(hand: readonly number[], t: number): number {
  const counts = counts34(hand);
  let sc = counts[t] * 3;
  if (!isHonor(t)) {
    const base = t < 9 ? 0 : t < 18 ? 9 : 18;
    const rank = rankOfIndex(t);
    for (const d of [-2, -1, 1, 2]) {
      const r = rank + d;
      if (r >= 1 && r <= 9 && counts[base + (r - 1)] > 0) sc += Math.abs(d) === 1 ? 2 : 1;
    }
  }
  return sc;
}

/** 上贡交换执行：和牌者用 giveTile 换入 takeFrom 玩家提交的上贡牌。 */
function doTributeExchange(s: GameState, giveTile: number, takeFrom: PlayerId): void {
  const pt = s.pendingTribute!;
  const winner = s.players[pt.winner];
  const offer = pt.offers.find((o) => o.from === takeFrom);
  if (!offer || offer.tile === null || offer.tile < 0) return;
  const donor = s.players[takeFrom];
  const di = donor.hand.indexOf(offer.tile);
  const wi = winner.hand.indexOf(giveTile);
  if (di < 0 || wi < 0) return;
  donor.hand[di] = giveTile;
  winner.hand[wi] = offer.tile;
  donor.hand.sort((a, b) => a - b);
  winner.hand.sort((a, b) => a - b);
  // 离开手牌的安全牌失去标记；换入的不继承原安全标记
  donor.safeTiles = donor.safeTiles.filter((x) => donor.hand.includes(x));
  winner.safeTiles = winner.safeTiles.filter((x) => winner.hand.includes(x));
  pushEvent(
    s,
    'tribute',
    `【上贡】${winner.name} 用 ${tileName(giveTile)} 换取 ${donor.name} 的 ${tileName(offer.tile)}`,
    true,
    { winner: pt.winner, donor: takeFrom }
  );
}

/** 上贡流程结束：恢复行动顺序（自摸从和牌者下家；荣和从点炮者下家）。 */
function finishTribute(s: GameState): void {
  const pt = s.pendingTribute!;
  const resumeFrom = pt.isSelfDraw ? pt.winner : pt.discarder ?? pt.winner;
  s.pendingTribute = null;
  s.turn = nextAlive(s, resumeFrom);
  s.phase = 'start';
}

/** 上贡阶段处理：collect 收集各家上贡牌；exchange 和牌者选交换。 */
function stepTribute(s: GameState, action: Action): void {
  const pt = s.pendingTribute;
  if (!pt) return;
  if (pt.stage === 'collect') {
    if (action.type !== 'tributeOffer') return;
    const idx = pt.offers.findIndex((o) => o.tile === null);
    if (idx < 0) return;
    pt.offers[idx].tile = action.tile;
    return;
  }
  if (pt.stage === 'exchange' && action.type === 'tributeExchange') {
    if (action.giveTile !== undefined && action.takeFrom !== undefined) {
      doTributeExchange(s, action.giveTile, action.takeFrom);
    }
    finishTribute(s);
  }
}

function applyWin(s: GameState, snapWinners: WinnerInfo[], isSelfDraw: boolean, tile: number, discarder?: PlayerId): void {
  const oppCount = isSelfDraw
    ? Math.max(1, alivePlayers(s).filter((p) => p.id !== snapWinners[0].player).length)
    : 1;
  const withDamage: WinnerInfo[] = snapWinners.map((w) => {
    const base = fanToDamage(w.fan);
    const outSteps: DamageStep[] = [{ label: '基础伤害', op: 'base', operand: w.fan, after: base }];
    s.winFanContext = w.fan; // 供平和鸽按番数判定
    const outDamage = engineHooks.modifyOutgoingDamage(s, w.player, base, isSelfDraw, outSteps);
    const breakdown: WinBreakdown = {
      fan: w.fan,
      base,
      outSteps,
      outDamage,
      isSelfDraw,
      splitCount: isSelfDraw ? oppCount : 1,
      targets: [],
    };
    return { ...w, damage: outDamage, breakdown };
  });
  s.winFanContext = null;
  const snap = isSelfDraw
    ? buildTsumoSnapshot(s, withDamage[0].player, withDamage[0].damage!, tile, withDamage[0].fan)
    : buildRonSnapshot(discarder!, withDamage, tile);
  if (isSelfDraw) snap.winners = [withDamage[0]];
  snap.entries = snap.entries.map((e) => {
    const defSteps: DamageStep[] = [];
    const incoming = e.amount;
    const final = engineHooks.modifyIncomingDamage(s, e.target, e.amount, e.source, isSelfDraw, defSteps);
    const w = snap.winners.find((x) => x.player === e.source);
    w?.breakdown?.targets.push({ target: e.target, incoming, defSteps, final });
    return { ...e, amount: final };
  });
  engineHooks.redistributeDamage(s, snap);
  applyDamageSnapshot(s, snap);
  for (const w of snapWinners) engineHooks.onWin(s, w.player, isSelfDraw);

  // 上贡机制（ver2.0 §3.2.1）：F>0 且有应上贡者时进入 tribute 阶段，等玩家交互
  if (s.phase === 'gameOver') return;
  const w0 = snapWinners[0];
  if (w0.fan <= 0) return;
  const tributaries = isSelfDraw
    ? snap.entries.map((e) => e.target)
    : discarder !== undefined
      ? [discarder]
      : [];
  const offers = tributaries
    .filter((id) => id !== w0.player)
    .map((id) => ({ from: id, tile: null as number | null }));
  if (offers.length === 0) return;
  s.pendingTribute = {
    winner: w0.player,
    fan: w0.fan,
    isSelfDraw,
    discarder: discarder ?? null,
    offers,
    stage: 'collect',
  };
  s.phase = 'tribute';
}

/** 计算和牌的番数与番种明细。 */
function winDetail(
  s: GameState,
  player: PlayerId,
  concealed: number[],
  isTsumo: boolean,
  winningTile: number
): { fan: number; yaku: string[] } {
  const p = s.players[player];
  const r = evaluateYaku({ concealedTiles: concealed, melds: p.melds, winningTile, isTsumo });
  const bonus = engineHooks.fanBonus(s, player, concealed, isTsumo);
  if (!r) return { fan: Math.max(1, 1 + bonus), yaku: ['无番和'] };
  const yaku = r.hits.map((h) => `${h.name} ${h.fan}番`);
  if (bonus > 0) yaku.push(`英雄加成 +${bonus}番`);
  return { fan: r.fan + bonus, yaku };
}

function cloneMelds(melds: Meld[]): Meld[] {
  return melds.map((m) => ({ ...m, tiles: [...m.tiles] }));
}

function resolveTsumo(s: GameState): void {
  const winner = s.turn;
  const p = s.players[winner];
  const tile = s.drawnTile!;
  const d = winDetail(s, winner, p.hand, true, tile);
  applyWin(
    s,
    [{ player: winner, fan: d.fan, yaku: d.yaku, hand: [...p.hand], melds: cloneMelds(p.melds) }],
    true,
    tile
  );
  removeOne(p.hand, tile);
  s.justDrew = false;
  s.drawnTile = null;
  if (s.phase === 'gameOver' || s.phase === 'tribute') return;
  s.turn = nextAlive(s, winner);
  s.phase = 'start';
}

function resolveRon(s: GameState, winners: PlayerId[]): void {
  const { discarder, tile } = s.pending!;
  const infos: WinnerInfo[] = winners.map((w) => {
    const hand = [...s.players[w].hand, tile];
    const d = winDetail(s, w, hand, false, tile);
    return { player: w, fan: d.fan, yaku: d.yaku, hand, melds: cloneMelds(s.players[w].melds) };
  });
  s.pending = null;
  applyWin(s, infos, false, tile, discarder);
  if (s.phase === 'gameOver' || s.phase === 'tribute') return;
  s.turn = nextAlive(s, discarder);
  s.phase = 'start';
}

// ---------------------------------------------------------------------------
// 副露窗口
// ---------------------------------------------------------------------------

function openMeldWindow(s: GameState, discarder: PlayerId, tile: number): void {
  const responders: PlayerId[] = [];
  for (const p of s.players) {
    if (!p.alive || p.id === discarder) continue;
    if (responderOptions(s, p.id, tile, discarder).length > 0) responders.push(p.id);
  }
  if (responders.length === 0) {
    endDiscardTurn(s, discarder);
    return;
  }
  s.pending = { discarder, tile, responders, intents: {}, resume: 'nextTurn' };
  s.phase = 'awaitMeld';
}

/** 冲锋鸡：第一张幺鸡的鸣牌窗口结束后结算（claimed=是否被响应）。 */
function settleYaoji(s: GameState, claimed: boolean): void {
  if (s.pendingYaojiDiscarder === null) return;
  const disc = s.pendingYaojiDiscarder;
  s.pendingYaojiDiscarder = null;
  resolveChongfengji(s, disc, claimed);
}

function endDiscardTurn(s: GameState, discarder: PlayerId): void {
  settleYaoji(s, false);
  if (s.phase === 'gameOver') return;
  s.pending = null;
  s.turn = nextAlive(s, discarder);
  s.phase = 'start';
}

function resolveMeldWindow(s: GameState): void {
  const pending = s.pending!;
  const { discarder, tile } = pending;
  const entries = Object.entries(pending.intents) as [string, MeldIntent][];
  const rons = entries.filter(([, v]) => v.kind === 'ron').map(([k]) => Number(k));
  const kan = entries.find(([, v]) => v.kind === 'kan');
  const pon = entries.find(([, v]) => v.kind === 'pon');
  const chi = entries.find(([, v]) => v.kind === 'chi');
  const claimed = rons.length > 0 || !!kan || !!pon || !!chi;
  // 冲锋鸡先结算（被响应 → 打出者若为咯哒则自伤）
  settleYaoji(s, claimed);
  if (s.phase === 'gameOver') return;
  if (rons.length > 0) {
    resolveRon(s, rons);
    return;
  }
  if (kan) {
    applyMinkan(s, Number(kan[0]), tile, discarder);
    return;
  }
  if (pon) {
    applyClaimMeld(s, Number(pon[0]), 'pon', [tile, tile], tile, discarder);
    return;
  }
  if (chi) {
    applyClaimMeld(s, Number(chi[0]), 'chi', chi[1].tiles ?? [], tile, discarder);
    return;
  }
  endDiscardTurn(s, discarder);
}

function removeFromDiscards(s: GameState, discarder: PlayerId, tile: number): void {
  const arr = s.players[discarder].discards;
  const i = arr.lastIndexOf(tile);
  if (i >= 0) arr.splice(i, 1);
}

function applyClaimMeld(
  s: GameState,
  claimer: PlayerId,
  type: 'pon' | 'chi',
  fromHand: number[],
  tile: number,
  discarder: PlayerId
): void {
  const p = s.players[claimer];
  for (const t of fromHand) removeOne(p.hand, t);
  const tiles = [...fromHand, tile].sort((a, b) => a - b);
  p.melds.push({ type, tiles, from: discarder, claimed: tile });
  p.menzen = false;
  removeFromDiscards(s, discarder, tile);
  pushEvent(s, type, `${p.name} ${type === 'pon' ? '碰' : '吃'}了 ${s.players[discarder].name} 的 ${tileName(tile)}`, true, { claimer, discarder });
  s.pending = null;
  s.turn = claimer;
  s.justDrew = false;
  s.drawnTile = null;
  s.phase = 'discard';
  engineHooks.onAnyMeld(s, claimer, type);
}

function applyMinkan(s: GameState, claimer: PlayerId, tile: number, discarder: PlayerId): void {
  const p = s.players[claimer];
  removeN(p.hand, tile, 3);
  p.melds.push({ type: 'minkan', tiles: [tile, tile, tile, tile], from: discarder, claimed: tile });
  p.menzen = false;
  removeFromDiscards(s, discarder, tile);
  s.pending = null;
  s.turn = claimer;
  pushEvent(s, 'minkan', `${p.name} 明杠`, true, { claimer, discarder });
  engineHooks.onKan(s, claimer, 'minkan', discarder);
  engineHooks.onAnyMeld(s, claimer, 'minkan');
  if (s.phase === 'gameOver') return;
  doKanDraw(s);
}

function applyAnkan(s: GameState, tile: number): void {
  const p = s.players[s.turn];
  removeN(p.hand, tile, 4);
  p.melds.push({ type: 'ankan', tiles: [tile, tile, tile, tile], from: null, claimed: null });
  pushEvent(s, 'ankan', `${p.name} 暗杠`, true, { player: s.turn });
  engineHooks.onKan(s, s.turn, 'ankan', null);
  engineHooks.onAnyMeld(s, s.turn, 'ankan');
  if (s.phase === 'gameOver') return;
  doKanDraw(s);
}

function applyKakan(s: GameState, tile: number): void {
  const p = s.players[s.turn];
  const meld = p.melds.find((m) => m.type === 'pon' && m.tiles[0] === tile);
  if (!meld) return;
  removeOne(p.hand, tile);
  meld.type = 'kakan';
  meld.tiles = [tile, tile, tile, tile];
  pushEvent(s, 'kakan', `${p.name} 加杠`, true, { player: s.turn });
  engineHooks.onKan(s, s.turn, 'kakan', meld.from);
  engineHooks.onAnyMeld(s, s.turn, 'kakan');
  if (s.phase === 'gameOver') return;
  doKanDraw(s);
}

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

export function applyAction(prev: GameState, action: Action): GameState {
  const s = cloneState(prev);
  step(s, action);
  settle(s);
  return s;
}

function step(s: GameState, action: Action): void {
  if (action.type === 'setSafeTiles') {
    if (canSetSafeTiles(s)) setSafeTiles(s, action.player ?? s.turn, action.tiles);
    return;
  }
  if (s.pending) {
    stepMeld(s, action);
    return;
  }
  if (s.pendingDraw) {
    if (action.type === 'keepDrawn') resolveKeepDrawn(s, action.tile);
    return;
  }
  switch (s.phase) {
    case 'drawCard':
      stepDrawCard(s, action);
      return;
    case 'action':
      stepAction(s, action);
      return;
    case 'discard':
      stepDiscard(s, action);
      return;
    case 'tribute':
      stepTribute(s, action);
      return;
    case 'roundSafety':
      stepRoundSafety(s, action);
      return;
    default:
      return;
  }
}

function stepDrawCard(s: GameState, action: Action): void {
  const p = s.players[s.turn];
  if (action.type === 'rerollCards') {
    if (p.ap > 0) {
      p.ap--;
      s.candidates = engineHooks.getCardCandidates(s, s.turn);
    }
    return;
  }
  if (action.type === 'pickCard') {
    if (action.cardId) {
      if (p.reserve.length < CARD_RESERVE_MAX) p.reserve.push(action.cardId);
      else if (action.replaceIndex !== undefined) p.reserve[action.replaceIndex] = action.cardId;
    }
    s.candidates = [];
    s.phase = 'action';
  }
}

/** 技能与技能卡（合并）阶段：可任意顺序发动主动技能 / 打出技能卡，endAction 结束。 */
function stepAction(s: GameState, action: Action): void {
  const p = s.players[s.turn];
  if (action.type === 'useSkill') {
    engineHooks.resolveSkill(s, action);
    return;
  }
  if (action.type === 'useCard') {
    const cost = engineHooks.cardApCost(action.cardId);
    if (cost > p.ap) return;
    p.ap -= cost;
    const idx = p.reserve.indexOf(action.cardId);
    if (idx >= 0) p.reserve.splice(idx, 1);
    engineHooks.resolveCard(s, action);
    p.cooldown.push({ cardId: action.cardId, draws: CARD_COOLDOWN_DRAWS });
    return;
  }
  if (action.type === 'endAction') s.phase = 'drawTile';
}

function stepDiscard(s: GameState, action: Action): void {
  const p = s.players[s.turn];
  if (action.type === 'declareTsumo') {
    resolveTsumo(s);
    return;
  }
  if (action.type === 'ankan') {
    applyAnkan(s, action.tile);
    return;
  }
  if (action.type === 'kakan') {
    applyKakan(s, action.tile);
    return;
  }
  if (action.type === 'discard') {
    if (!removeOne(p.hand, action.tile)) return;
    p.discards.push(action.tile);
    p.firstDiscardDone = true;
    // 安全牌与当前手牌取交集（切掉的安全牌释放名额）
    const hc = counts34(p.hand);
    const seen = new Array<number>(34).fill(0);
    p.safeTiles = p.safeTiles.filter((t) => {
      if (seen[t] < (hc[t] ?? 0)) {
        seen[t]++;
        return true;
      }
      return false;
    });
    s.justDrew = false;
    s.drawnTile = null;
    s.lastActor = s.turn;
    // 冲锋鸡：记录本局第一张幺鸡（结算在鸣牌窗口结束后）
    if (action.tile === 18 && !s.firstYaojiDone) {
      s.firstYaojiDone = true;
      s.pendingYaojiDiscarder = s.turn;
    }
    // 光合作用 / 生生不息：按弃牌回血
    cardOnDiscard(s, s.turn, action.tile);
    engineHooks.onDiscard(s, s.turn, action.tile);
    if (s.phase === 'gameOver') return;
    openMeldWindow(s, s.turn, action.tile);
  }
}

function stepRoundSafety(s: GameState, action: Action): void {
  if (action.type !== 'confirmRoundSafety') return;
  const pending = s.roundSafetyPending;
  if (!pending || pending.length === 0) return;
  const actor = pending[0];
  if (action.tiles) setSafeTiles(s, actor, action.tiles);
  const rest = pending.slice(1);
  if (rest.length === 0) {
    s.roundSafetyPending = null;
    s.phase = 'roundOver';
  } else {
    s.roundSafetyPending = rest;
  }
}

function stepMeld(s: GameState, action: Action): void {
  const pending = s.pending!;
  const actor = pending.responders.find((r) => !(r in pending.intents));
  if (actor === undefined) return;
  let intent: MeldIntent;
  switch (action.type) {
    case 'respondRon':
      intent = { kind: 'ron' };
      break;
    case 'respondKan':
      intent = { kind: 'kan', tiles: action.tiles };
      break;
    case 'respondPon':
      intent = { kind: 'pon', tiles: action.tiles };
      break;
    case 'respondChi':
      intent = { kind: 'chi', tiles: action.tiles };
      break;
    default:
      intent = { kind: 'pass' };
  }
  pending.intents[actor] = intent;
  const allDecided = pending.responders.every((r) => r in pending.intents);
  if (allDecided) resolveMeldWindow(s);
}

function suitCn(s: Suit): string {
  return s === 'm' ? '万' : s === 'p' ? '筒' : s === 's' ? '条' : '字';
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

export function startGame(opts: InitOptions): GameState {
  const s = initGame(opts);
  settle(s);
  return s;
}

export type { Meld };
