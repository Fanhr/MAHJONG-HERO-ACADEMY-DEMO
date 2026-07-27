/**
 * 技能卡逻辑：卡池抽 3、AP 消耗、20 张卡效果结算、状态时间轴（增伤/减伤/分担/保护/免疫/回血）。
 * 结算支持 UI 传入 payload（目标/选牌）；缺省时采用合理的自动默认，保证 AI 也能使用。
 * 说明：置换类效果保持“手牌张数净不变”，不破坏回合结构不变量。
 */
import { makeRng } from '../rng';
import { tileName, suitOfIndex, type Suit } from '../tiles';
import { DEFAULT_HP } from '../constants';
import {
  pushEvent,
  type GameState,
  type PlayerId,
  type PlayerState,
  type StatusEffect,
} from '../state';
import type { Action } from '../actions';
import type { DamageSnapshot } from '../damage';
import { CARD_POOL_IDS, LIFE_CARD_IDS, cardDef } from './cardDefs';
import type { CardLogic } from './cardLogicType';

// ------------------------------ 工具 ------------------------------

function addStatus(p: PlayerState, st: StatusEffect): void {
  p.statuses.push(st);
}
function findStatus(p: PlayerState, kind: string): StatusEffect | undefined {
  return p.statuses.find((s) => s.kind === kind);
}
const r1 = (x: number) => Math.round(x * 10) / 10;

/** 回复生命（封顶 DEFAULT_HP，不溢出）。 */
export function healPlayer(s: GameState, pid: PlayerId, amount: number, label: string): void {
  const p = s.players[pid];
  if (!p.alive || amount <= 0) return;
  const before = p.hp;
  p.hp = Math.min(DEFAULT_HP, r1(p.hp + amount));
  const gained = r1(p.hp - before);
  if (gained > 0) {
    pushEvent(s, 'heal', `${p.name} 通过【${label}】回复 ${gained} 点生命（HP ${p.hp}）`, true, {
      target: pid,
      amount: gained,
      label,
    });
  }
}

function removeMultiset(arr: readonly number[], sub: readonly number[]): number[] {
  const r = [...arr];
  for (const t of sub) {
    const i = r.indexOf(t);
    if (i >= 0) r.splice(i, 1);
  }
  return r;
}
function protectedTiles(p: PlayerState): number[] {
  const st = findStatus(p, 'protected');
  return (st?.data?.tiles as number[] | undefined) ?? [];
}
function ownSwappable(p: PlayerState): number[] {
  return removeMultiset(p.hand, protectedTiles(p));
}
function foeTakeable(p: PlayerState): number[] {
  return removeMultiset(removeMultiset(p.hand, protectedTiles(p)), p.safeTiles);
}
function wallLiveCount(s: GameState): number {
  return s.tail - s.head;
}
function swapWithWall(s: GameState, rngInt: (n: number) => number, p: PlayerState, giveTile: number): void {
  const live = wallLiveCount(s);
  if (live <= 0) return;
  const gi = p.hand.indexOf(giveTile);
  if (gi < 0) return;
  const wpos = s.head + rngInt(live);
  const wtile = s.wall[wpos];
  s.wall[wpos] = giveTile;
  p.hand[gi] = wtile;
  p.hand.sort((a, b) => a - b);
}
function swapNamedFromWall(s: GameState, p: PlayerState, named: number, giveTile: number): boolean {
  for (let i = s.head; i < s.tail; i++) {
    if (s.wall[i] === named) {
      const gi = p.hand.indexOf(giveTile);
      if (gi < 0) return false;
      s.wall[i] = giveTile;
      p.hand[gi] = named;
      p.hand.sort((a, b) => a - b);
      return true;
    }
  }
  return false;
}
function fetchNamed(
  s: GameState,
  _rngInt: (n: number) => number,
  me: PlayerState,
  named: number,
  giveTile: number
): boolean {
  if (swapNamedFromWall(s, me, named, giveTile)) return true;
  for (const foe of s.players) {
    if (foe.id === me.id || !foe.alive) continue;
    if (!foeTakeable(foe).includes(named)) continue;
    const gi = me.hand.indexOf(giveTile);
    const fi = foe.hand.indexOf(named);
    if (gi < 0 || fi < 0) continue;
    me.hand[gi] = named;
    foe.hand[fi] = giveTile;
    me.hand.sort((a, b) => a - b);
    foe.hand.sort((a, b) => a - b);
    return true;
  }
  return false;
}
function randomOpponent(s: GameState, rngInt: (n: number) => number, self: PlayerId): PlayerId {
  const opp = s.players.filter((p) => p.alive && p.id !== self).map((p) => p.id);
  return opp[rngInt(opp.length)];
}

// ------------------------------ CardLogic ------------------------------

export const cardLogic: CardLogic = {
  candidates(s, pid) {
    const p = s.players[pid];
    const rng = makeRng(s.rngState);
    const pool = [...CARD_POOL_IDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let pick = pool.slice(0, 3);
    // 掉血保底：玩家生命下降到阈值后，下次抽卡必含一张“生”类技能卡
    if (p.healPityDue) {
      if (!pick.some((id) => LIFE_CARD_IDS.includes(id))) {
        const life = LIFE_CARD_IDS[rng.int(LIFE_CARD_IDS.length)];
        pick = [life, pick[0], pick[1]];
      }
      p.healPityDue = false;
      // 隐藏机制：掉血保底不写入公开状态日志（publicInfo=false）
      pushEvent(s, 'card', `${p.name} 生命告急，本次抽卡必得一张“生”类技能卡`, false, { player: pid });
    }
    s.rngState = rng.state();
    return pick;
  },

  apCost(id) {
    return cardDef(id)?.ap ?? 0;
  },

  resolve(s, action) {
    if (action.type !== 'useCard') return false;
    const me = s.players[s.turn];
    const rng = makeRng(s.rngState);
    const ri = (n: number) => rng.int(n);
    const payload = (action.payload ?? {}) as { tiles?: number[]; give?: number[]; recvSuit?: string };
    const target = (action.target as PlayerId | undefined) ?? -1;
    const def = cardDef(action.cardId);
    const label = def?.name ?? action.cardId;
    let handled = true;
    let loggedDetail = false;
    const foeId = () => (target >= 0 && s.players[target]?.alive ? target : randomOpponent(s, ri, me.id));

    switch (action.cardId) {
      // —— 谋 ——
      case 'duoduo':
        addStatus(me, { id: 'extraDraw', kind: 'extraDraw', remaining: 1 });
        break;
      case 'chongkai': {
        const picks = (payload.tiles ?? ownSwappable(me).slice(0, 3)).slice(0, 3);
        for (const t of picks) swapWithWall(s, ri, me, t);
        pushEvent(s, 'card', `${me.name}【我要重开】用 ${picks.map(tileName).join('、')} 置换了牌山随机 ${picks.length} 张`, true, { player: me.id });
        loggedDetail = true;
        break;
      }
      case 'jiucha': {
        const named = payload.tiles?.[0] ?? me.hand[0];
        const give = payload.give?.[0] ?? me.hand.find((t) => t !== named) ?? me.hand[0];
        const ok = swapNamedFromWall(s, me, named, give);
        if (!ok) me.ap += 1;
        pushEvent(
          s,
          'card',
          ok
            ? `${me.name}【就差这张】用 ${tileName(give)} 从牌山召唤了 ${tileName(named)}`
            : `${me.name}【就差这张】牌山已无 ${tileName(named)}，返还 1 点行动点`,
          true,
          { player: me.id }
        );
        loggedDetail = true;
        break;
      }
      case 'nalai': {
        const wants = (payload.tiles ?? [ri(34), ri(34)]).slice(0, 2);
        const gives = (payload.give ?? ownSwappable(me).slice(0, 2)).slice(0, 2);
        const order = ri(2) === 0 ? [0, 1] : [1, 0];
        const got: number[] = [];
        const gave: number[] = [];
        for (const k of order) {
          if (wants[k] === undefined || gives[k] === undefined) continue;
          if (fetchNamed(s, ri, me, wants[k], gives[k])) {
            got.push(wants[k]);
            gave.push(gives[k]);
          }
        }
        pushEvent(
          s,
          'card',
          got.length > 0
            ? `${me.name}【拿来吧你】交出 ${gave.map(tileName).join('、')}，换得 ${got.map(tileName).join('、')}`
            : `${me.name}【拿来吧你】未能换到目标牌`,
          true,
          { player: me.id }
        );
        loggedDetail = true;
        break;
      }
      // —— 战 ——
      case 'dongni': {
        const fid = foeId();
        const foe = s.players[fid];
        const foeTiles = foeTakeable(foe);
        let done = false;
        let giveT = -1;
        let takeT = -1;
        if (foeTiles.length > 0) {
          takeT = foeTiles[ri(foeTiles.length)];
          giveT = payload.give?.[0] ?? ownSwappable(me)[0];
          const gi = me.hand.indexOf(giveT);
          const fi = foe.hand.indexOf(takeT);
          if (gi >= 0 && fi >= 0) {
            me.hand[gi] = takeT;
            foe.hand[fi] = giveT;
            me.hand.sort((a, b) => a - b);
            foe.hand.sort((a, b) => a - b);
            done = true;
          }
        }
        pushEvent(
          s,
          'card',
          done
            ? `${me.name}【懂你意思】与 ${foe.name} 交换：交出 ${tileName(giveT)}，换得 ${tileName(takeT)}`
            : `${me.name}【懂你意思】未能与 ${foe.name} 完成交换`,
          true,
          { player: me.id, target: fid }
        );
        loggedDetail = true;
        break;
      }
      case 'qiubiemo':
        addStatus(s.players[foeId()], { id: 'skipTurn', kind: 'skipTurn', remaining: 1, negative: true });
        break;
      case 'yougan':
        addStatus(me, { id: 'inspired', kind: 'inspired', remaining: 3, data: { ticks: true } });
        break;
      case 'yanpai': {
        const fid = foeId();
        const foe = s.players[fid];
        const safe = new Set(foe.safeTiles);
        const revealed = foe.hand.filter((t) => !safe.has(t));
        pushEvent(s, 'inspect', `${me.name} 查看了 ${foe.name} 的手牌`, false, { viewer: me.id, target: fid, tiles: revealed });
        break;
      }
      // —— 御 ——
      case 'buchi': {
        const idx = me.statuses.findIndex((st) => st.negative);
        if (idx >= 0) me.statuses.splice(idx, 1);
        break;
      }
      case 'anzhang': {
        const picks = (payload.tiles ?? me.hand.slice(0, 3)).slice(0, 3);
        addStatus(me, { id: 'protected', kind: 'protected', remaining: 2, data: { ticks: true, tiles: picks } });
        break;
      }
      case 'genibao':
        addStatus(me, { id: 'shareLink', kind: 'shareLink', remaining: 3, data: { ticks: true, with: foeId() } });
        break;
      case 'yidalipao':
        addStatus(me, { id: 'cannon', kind: 'cannon', remaining: 3, data: { ticks: true } });
        break;
      // —— 运 ——
      case 'buduibudui': {
        const suit = (payload.recvSuit as Suit) ?? 'm';
        addStatus(me, { id: 'redrawIfNotSuit', kind: 'redrawIfNotSuit', remaining: 1, data: { suit } });
        break;
      }
      case 'duidedui': {
        const suit = (payload.recvSuit as Suit) ?? 'm';
        addStatus(me, { id: 'extraIfSuit', kind: 'extraIfSuit', remaining: 1, data: { suit } });
        break;
      }
      case 'ruguo': {
        // 如果可以：从自身弃牌区取 1 张，置换 1 张手牌（缺省自动：取最近弃牌，换出首张非保护手牌）
        if (me.discards.length === 0) {
          me.ap += 3; // 无弃牌可取，返还
          pushEvent(s, 'card', `${me.name}【如果可以】弃牌区为空，返还行动点`, true, { player: me.id });
          loggedDetail = true;
          break;
        }
        const take = payload.tiles?.[0] ?? me.discards[me.discards.length - 1];
        const give = payload.give?.[0] ?? ownSwappable(me)[0] ?? me.hand[0];
        const di = me.discards.lastIndexOf(take);
        const gi = me.hand.indexOf(give);
        if (di >= 0 && gi >= 0) {
          me.discards.splice(di, 1);
          me.hand[gi] = take;
          me.discards.push(give);
          me.hand.sort((a, b) => a - b);
          pushEvent(s, 'card', `${me.name}【如果可以】用 ${tileName(give)} 换回弃牌 ${tileName(take)}`, true, { player: me.id });
        } else {
          me.ap += 3;
          pushEvent(s, 'card', `${me.name}【如果可以】置换失败，返还行动点`, true, { player: me.id });
        }
        loggedDetail = true;
        break;
      }
      case 'yanguang':
        addStatus(me, { id: 'immune', kind: 'immune', remaining: 3, data: { ticks: true, from: foeId() } });
        break;
      // —— 生 ——
      case 'guanghe': {
        const suit = (payload.recvSuit as Suit) ?? 'm';
        addStatus(me, { id: 'healOnSuit', kind: 'healOnSuit', remaining: 1, data: { ticks: true, suit } });
        break;
      }
      case 'shengsheng': {
        const tile = payload.tiles?.[0] ?? me.hand[0] ?? 0;
        addStatus(me, { id: 'healOnTile', kind: 'healOnTile', remaining: 1, data: { ticks: true, tile } });
        break;
      }
      case 'xiuyang':
        addStatus(me, { id: 'healOnMeld', kind: 'healOnMeld', remaining: 3, data: { ticks: true } });
        break;
      case 'xiangsi': {
        me.hp = 1;
        addStatus(me, { id: 'reborn', kind: 'reborn', remaining: 5, data: { ticks: true, shields: 3 } });
        pushEvent(s, 'card', `${me.name}【向死而生】生命降至 1，获得免疫护盾与吸血`, true, { player: me.id });
        loggedDetail = true;
        break;
      }
      default:
        handled = false;
    }

    s.rngState = rng.state();
    if (handled) {
      // 卡牌效果激活：向全场公布（弹窗用，publicInfo=false 避免与详情日志重复）
      pushEvent(s, 'card-activate', `${me.name} 触发了【${label}】`, false, {
        player: me.id,
        cardId: action.cardId,
        name: label,
        desc: def?.desc ?? '',
        target: target >= 0 ? target : undefined,
      });
      if (!loggedDetail)
        pushEvent(s, 'card', `${me.name} 使用了【${label}】`, true, { player: me.id, cardId: action.cardId });
    }
    return handled;
  },

  outgoing(s, pid, base, _isSelfDraw, trace) {
    if (!findStatus(s.players[pid], 'inspired')) return base;
    const after = r1(base * 1.3); // 有感觉了 +30%
    trace?.push({ label: '有感觉了', op: 'mul', operand: 1.3, after });
    return after;
  },

  incoming(s, target, amount, source, isSelfDraw, trace) {
    const p = s.players[target];
    // 我有眼光：免疫指定来源的一次伤害
    const immIdx = p.statuses.findIndex((st) => st.kind === 'immune' && st.data?.from === source);
    if (immIdx >= 0 && amount > 0) {
      p.statuses.splice(immIdx, 1);
      trace?.push({ label: '我有眼光·免疫', op: 'mul', operand: 0, after: 0 });
      return 0;
    }
    // 向死而生：免疫护盾
    const reborn = findStatus(p, 'reborn');
    if (reborn && amount > 0 && (reborn.data?.shields as number) > 0) {
      reborn.data!.shields = (reborn.data!.shields as number) - 1;
      trace?.push({ label: '向死而生·免疫', op: 'mul', operand: 0, after: 0 });
      return 0;
    }
    // 向我开炮：因放炮（荣和）承伤减半
    if (!isSelfDraw && findStatus(p, 'cannon')) {
      const after = r1(amount * 0.5);
      trace?.push({ label: '向我开炮', op: 'mul', operand: 0.5, after });
      return after;
    }
    return amount;
  },

  redistribute(s, snap) {
    const extra: { target: PlayerId; amount: number; source: PlayerId; label?: string }[] = [];
    for (const e of snap.entries) {
      const link = findStatus(s.players[e.target], 'shareLink');
      if (!link) continue;
      const withId = link.data?.with as number | undefined;
      if (withId === undefined || !s.players[withId]?.alive || withId === e.target) continue;
      const share = Math.round(e.amount * 0.3 * 1e6) / 1e6; // 分担 30%
      e.amount -= share;
      extra.push({ target: withId, amount: share, source: e.source, label: '跟你爆了·分担' });
      pushEvent(s, 'card', `【跟你爆了】令 ${s.players[withId].name} 分担了 ${s.players[e.target].name} 的伤害`, true);
    }
    snap.entries.push(...extra);
  },

  onTurnStart(s, pid) {
    const p = s.players[pid];
    for (const st of p.statuses) {
      if (st.data?.ticks) st.remaining--;
    }
    p.statuses = p.statuses.filter((st) => !(st.data?.ticks && st.remaining <= 0));
  },

  onAnyMeld(s, melder, _type) {
    // 休养生息：持有该状态者，在场上每次副露时回复 10 点
    void melder;
    for (const p of s.players) {
      if (!p.alive) continue;
      if (findStatus(p, 'healOnMeld')) healPlayer(s, p.id, 10, '休养生息');
    }
  },
};

/** 切牌广播：光合作用/生生不息按弃牌回血（供 turnMachine 在每次弃牌后调用）。 */
export function cardOnDiscard(s: GameState, _discarder: PlayerId, tile: number): void {
  for (const p of s.players) {
    if (!p.alive) continue;
    const suitSt = findStatus(p, 'healOnSuit');
    if (suitSt && suitOfIndex(tile) === (suitSt.data?.suit as Suit)) healPlayer(s, p.id, 3, '光合作用');
    const tileSt = findStatus(p, 'healOnTile');
    if (tileSt && tile === (tileSt.data?.tile as number)) healPlayer(s, p.id, 10, '生生不息');
  }
}

/** 供 turnMachine 读取“运”类摸牌状态。 */
export function findPlayerStatus(p: PlayerState, kind: string): StatusEffect | undefined {
  return findStatus(p, kind);
}
export function removePlayerStatus(p: PlayerState, kind: string): void {
  const i = p.statuses.findIndex((st) => st.kind === kind);
  if (i >= 0) p.statuses.splice(i, 1);
}

export type { DamageSnapshot };
