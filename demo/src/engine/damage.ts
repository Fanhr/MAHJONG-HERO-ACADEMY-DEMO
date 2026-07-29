/**
 * 即时伤害快照结算：先锁定快照（和牌者/伤害/目标）→ 同步扣血 → 统一判定淘汰 →
 * （反弹/亡语类后置，留待技能层扩展）。牌型与番数保密，对外事件仅含伤害数值。
 */
import { baseDamage, TSUMO_MUL } from './constants';
import { DEFAULT_HP } from './constants';
import {
  alivePlayers,
  pushEvent,
  type GameState,
  type Meld,
  type PlayerId,
  type PlayerState,
  type WinRecord,
  type WinBreakdown,
} from './state';

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * 玩家结算（被淘汰或获胜）时发放金豆终局结算奖励（ver3.0 §7.4）。
 * 奖励 = 结算时点的场上和牌总伤害 × 比例（向上取整）。
 * 4 人局比例序列 0%/10%/20%/30%，按结算顺序从第 1 位（最先淘汰）到第 4 位（获胜者）。
 */
function grantSettleGold(state: GameState, pid: PlayerId): void {
  if (state.settleOrder.includes(pid)) return; // 已结算过
  state.settleOrder.push(pid);
  const i = state.settleOrder.length;
  const ratio = (i - 1) * 0.1; // 第1位0%，第2位10%...第4位30%
  const reward = Math.ceil(state.totalDamageDealt * ratio);
  if (reward > 0) {
    state.players[pid].gold += reward;
    pushEvent(
      state,
      'gold',
      `${state.players[pid].name} 获得金豆终局结算奖励 ${reward}（第${i}位结算，比例 ${Math.round(ratio * 100)}%）`,
      true,
      { player: pid, amount: reward, kind: 'settle' }
    );
  }
}

/**
 * 玩家（非 AI）掉血保底：生命每累计下降 30 点，标记下次抽卡必得一张“生”类技能卡（见需求 5）。
 */
function notePlayerDamage(p: PlayerState): void {
  if (p.isAI) return;
  while (p.hp <= DEFAULT_HP - 30 * (p.healPityGranted + 1)) {
    p.healPityGranted++;
    p.healPityDue = true;
  }
}

export interface WinnerInfo {
  player: PlayerId;
  fan: number;
  /** 牌型役满个数（双倍按 2 计；0 表示非役满）。 */
  yakumanCount?: number;
  /** 该和牌者的基础伤害（已含出伤加成）；缺省则由 fan/yakuman 映射。 */
  damage?: number;
  /** 番种明细（结束后揭示用）。 */
  yaku?: string[];
  /** 和牌时手内牌（含和牌张）。 */
  hand?: number[];
  /** 和牌时副露。 */
  melds?: Meld[];
  /** 伤害计算明细（乘区/防御区），供结算页揭示。 */
  breakdown?: WinBreakdown;
}

export interface DamageEntry {
  target: PlayerId;
  amount: number;
  source: PlayerId;
  /** 伤害来源标签（自摸/荣和/技能名/分担等），供浮字与日志展示。 */
  label?: string;
}

export interface DamageSnapshot {
  winners: WinnerInfo[];
  isSelfDraw: boolean;
  winningTile: number;
  entries: DamageEntry[];
}

/** 荣和快照：每位荣和者各自对点炮者造成一份伤害（一炮多响分别计入）。 */
export function buildRonSnapshot(
  discarder: PlayerId,
  winners: WinnerInfo[],
  winningTile: number
): DamageSnapshot {
  const entries: DamageEntry[] = winners.map((w) => ({
    target: discarder,
    amount: w.damage ?? baseDamage(w.fan, w.yakumanCount ?? 0),
    source: w.player,
    label: '荣和',
  }));
  return { winners, isSelfDraw: false, winningTile, entries };
}

/** 自摸快照：1.5 倍口径——每名对手受 baseDamage×1.5/n，总输出为单体 1.5 倍。 */
export function buildTsumoSnapshot(
  state: GameState,
  winner: PlayerId,
  baseDamageVal: number,
  winningTile: number,
  fan: number
): DamageSnapshot {
  const opponents = alivePlayers(state)
    .map((p) => p.id)
    .filter((id) => id !== winner);
  const per = opponents.length > 0 ? (baseDamageVal * TSUMO_MUL) / opponents.length : 0;
  const entries: DamageEntry[] = opponents.map((id) => ({
    target: id,
    amount: per,
    source: winner,
    label: '自摸',
  }));
  return { winners: [{ player: winner, fan, damage: baseDamageVal }], isSelfDraw: true, winningTile, entries };
}

/**
 * 应用伤害快照：同步扣血 → 统一判定淘汰 → 记录和牌 → 检查终局。
 * 原地修改（调用方应在克隆状态上操作）。
 */
export function applyDamageSnapshot(state: GameState, snap: DamageSnapshot): void {
  // 1) 同步扣血
  for (const e of snap.entries) {
    const target = state.players[e.target];
    target.hp = Math.round((target.hp - e.amount) * 1e6) / 1e6; // 抑制浮点误差
    notePlayerDamage(target);
    pushEvent(
      state,
      'damage',
      `${state.players[e.source].name} 造成 ${formatAmt(e.amount)} 点伤害 → ${target.name}（剩余 HP ${formatAmt(target.hp)}）`,
      true,
      { source: e.source, target: e.target, amount: e.amount, label: e.label ?? '' }
    );
  }

  // 1.5) 向死而生·吸血：造成和牌伤害者若持有 reborn，回复其造成总量的 50%（封顶 DEFAULT_HP）
  const dealtBySource = new Map<PlayerId, number>();
  for (const e of snap.entries) dealtBySource.set(e.source, (dealtBySource.get(e.source) ?? 0) + e.amount);
  for (const [src, total] of dealtBySource) {
    const p = state.players[src];
    if (total > 0 && p.alive && p.statuses.some((st) => st.kind === 'reborn')) {
      const heal = r1(total * 0.5);
      const before = p.hp;
      p.hp = Math.min(DEFAULT_HP, r1(p.hp + heal));
      const gained = r1(p.hp - before);
      if (gained > 0)
        pushEvent(state, 'heal', `${p.name}【向死而生】吸取 ${gained} 点生命（HP ${p.hp}）`, true, {
          target: src,
          amount: gained,
          label: '向死而生',
        });
    }
  }

  // 1.6) 累计场上和牌总伤害（ver3.0 §0.5，金豆终局奖励基准）
  state.totalDamageDealt = r1(state.totalDamageDealt + snap.entries.reduce((s, e) => s + e.amount, 0));

  // 2) 统一判定淘汰（HP 可为负）
  for (const p of state.players) {
    if (p.alive && p.hp <= 0) {
      p.alive = false;
      grantSettleGold(state, p.id);
      pushEvent(state, 'eliminate', `${p.name} 被淘汰`, true, { player: p.id });
    }
  }

  // 3) 和牌记录（自摸背面朝上、荣和正面朝上）
  for (const w of snap.winners) {
    const rec: WinRecord = {
      winner: w.player,
      isSelfDraw: snap.isSelfDraw,
      winningTile: snap.winningTile,
      hiddenFace: snap.isSelfDraw,
      damage: snap.entries
        .filter((e) => e.source === w.player)
        .reduce((s, e) => s + e.amount, 0),
      fan: w.fan,
      seq: state.seqCounter,
      yaku: w.yaku ?? [],
      hand: w.hand ?? [],
      melds: w.melds ?? [],
      breakdown: w.breakdown,
    };
    state.winRecords.push(rec);
  }

  // 4) 终局判定
  checkGameOver(state);
}

/** 直接伤害（技能触发，非和牌）：如阴阳杠伤害、冲锋鸡 AoE。同步扣血、淘汰、终局判定。 */
export function applyDirectDamage(
  state: GameState,
  source: PlayerId,
  targets: { target: PlayerId; amount: number }[],
  label: string
): void {
  for (const e of targets) {
    const t = state.players[e.target];
    if (!t.alive) continue;
    t.hp = Math.round((t.hp - e.amount) * 1e6) / 1e6;
    notePlayerDamage(t);
    pushEvent(
      state,
      'skill-damage',
      `${state.players[source].name} 的${label}对 ${t.name} 造成 ${formatAmt(e.amount)} 点伤害（剩余 HP ${formatAmt(t.hp)}）`,
      true,
      { source, target: e.target, amount: e.amount, label }
    );
  }
  for (const p of state.players) {
    if (p.alive && p.hp <= 0) {
      p.alive = false;
      grantSettleGold(state, p.id);
      pushEvent(state, 'eliminate', `${p.name} 被淘汰`, true, { player: p.id });
    }
  }
  checkGameOver(state);
}

/** 终局判定：仅剩 1 名（或 0 名）存活玩家时对局结束。 */
export function checkGameOver(state: GameState): boolean {
  const alive = alivePlayers(state);
  if (alive.length === 1) {
    state.winner = alive[0].id;
    state.phase = 'gameOver';
    grantSettleGold(state, state.winner); // 获胜者按最后一位结算（30%）
    pushEvent(state, 'game-over', `对局结束，${state.players[state.winner].name} 获胜！`, true, {
      winner: state.winner,
    });
    return true;
  }
  if (alive.length === 0) {
    // 同一次结算里最后的存活者被同时淘汰：判残余生命最高（最接近存活）者获胜，平手取座次靠前者
    let best = state.players[0];
    for (const p of state.players) if (p.hp > best.hp) best = p;
    state.winner = best.id;
    state.phase = 'gameOver';
    if (!state.settleOrder.includes(best.id)) grantSettleGold(state, best.id);
    pushEvent(state, 'game-over', `对局结束，${best.name} 以最高残余生命获胜！`, true, { winner: best.id });
    return true;
  }
  return false;
}

function formatAmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
