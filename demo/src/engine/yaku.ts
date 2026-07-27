/**
 * 番种识别（对齐《番种精选子集与伤害计算公式》）。
 * 不立起和番：满足和牌结构即可和牌，0 番为基础 6 点。
 * 役满压倒普通番：含牌型役满时普通番不计，只按役满个数结算；累计役满（普通番≥13）封顶 1 役满。
 * 双倍役满每个按 2 个役满计。
 */
import {
  allDecompositions,
  numberSuitsUsed,
  type DecompSet,
  type Decomposition,
} from './winning';
import {
  isDragon,
  isHonor,
  isSuited,
  isWind,
  isYaojiu,
  rankOfIndex,
  suitOfIndex,
  type Suit,
} from './tiles';
import type { Meld } from './state';

export interface YakuHit {
  name: string;
  fan: number;
}
export interface YakuResult {
  /** 普通番合计（役满时为 0）。 */
  fan: number;
  /** 牌型役满个数（双倍役满每个按 2 计；0 表示非役满）。 */
  yakumanCount: number;
  hits: YakuHit[];
}
export interface YakuInput {
  concealedTiles: number[];
  melds: Meld[];
  winningTile: number;
  isTsumo: boolean;
}

function isMenzen(melds: readonly Meld[]): boolean {
  return melds.every((m) => m.type === 'ankan');
}
function allTilesOf(input: YakuInput): number[] {
  const t = [...input.concealedTiles];
  for (const m of input.melds) t.push(...m.tiles);
  return t;
}
function setHasYaojiu(s: DecompSet): boolean {
  if (s.kind === 'pon') return isYaojiu(s.tile);
  const r = rankOfIndex(s.tile);
  return r === 1 || r === 7;
}
/** 杠子副露数（明/暗/加杠均可）。 */
function kanCount(melds: readonly Meld[]): number {
  return melds.filter((m) => m.type === 'minkan' || m.type === 'ankan' || m.type === 'kakan').length;
}

interface GlobalFlags {
  honorsPresent: boolean;
  numberSuits: Set<string>;
  allHonors: boolean;
  noYaojiu: boolean;
  allYaojiu: boolean;
}
function computeGlobalFlags(input: YakuInput): GlobalFlags {
  const tiles = allTilesOf(input);
  return {
    honorsPresent: tiles.some(isHonor),
    numberSuits: numberSuitsUsed(tiles),
    allHonors: tiles.every(isHonor),
    noYaojiu: tiles.every((t) => !isYaojiu(t)),
    allYaojiu: tiles.every((t) => isYaojiu(t)),
  };
}

// ---------------- 役满判定 ----------------

const KOKUSHI_TYPES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; // 13 种幺九
const GREEN_TILES = new Set([20, 21, 22, 24, 26, 33]); // 条 2,3,4,6,8 + 发

function yakumanOf(dec: Decomposition, input: YakuInput, g: GlobalFlags): { names: string[]; count: number } {
  const names: string[] = [];
  const pons = dec.sets.filter((s) => s.kind === 'pon');
  const tiles = allTilesOf(input);
  const menzen = isMenzen(input.melds);

  // 字一色
  if (g.allHonors) names.push('字一色');
  // 清老头（全 1/9 数牌）
  if (tiles.every((t) => isSuited(t) && (rankOfIndex(t) === 1 || rankOfIndex(t) === 9)) && !g.honorsPresent) names.push('清老头');
  // 绿一色
  if (tiles.every((t) => GREEN_TILES.has(t))) names.push('绿一色');
  // 大三元
  if ([31, 32, 33].every((d) => pons.some((s) => s.tile === d))) names.push('大三元');
  // 大四喜 / 小四喜
  const windPons = [27, 28, 29, 30].filter((w) => pons.some((s) => s.tile === w));
  if (windPons.length === 4) names.push('大四喜');
  else if (windPons.length === 3 && dec.pair >= 0 && isWind(dec.pair) && !windPons.includes(dec.pair)) names.push('小四喜');
  // 四暗刻（4 副暗刻；荣和完成的那副计明）
  let anke = pons.filter((s) => s.concealed).length;
  if (!input.isTsumo) {
    const idx = pons.findIndex((s) => s.concealed && s.tile === input.winningTile);
    if (idx >= 0) anke--;
  }
  if (anke >= 4) {
    // 四暗刻单骑：4 副暗刻已定 + 单骑雀头听牌（荣和雀头）
    if (!input.isTsumo && dec.pair === input.winningTile) names.push('四暗刻单骑');
    else names.push('四暗刻');
  }
  // 四杠子
  if (kanCount(input.melds) >= 4) names.push('四杠子');
  // 九莲宝灯（门前，同花色 1112345678999 + 该花色任意 1 张）
  if (menzen && input.melds.length === 0 && dec.pair >= 0) {
    for (const suit of ['m', 'p', 's'] as const) {
      if (isKyuuren(input.concealedTiles, suit)) {
        // 纯正九莲宝灯：恰好 1112345678999 纯 13 张
        if (isPureKyuuren(input.concealedTiles, suit)) names.push('纯正九莲宝灯');
        else names.push('九莲宝灯');
        break;
      }
    }
  }
  // 国士无双 / 十三面
  if (dec.special === 'shisan') {
    const counts = new Map<number, number>();
    for (const t of input.concealedTiles) counts.set(t, (counts.get(t) ?? 0) + 1);
    const allOne = KOKUSHI_TYPES.every((t) => (counts.get(t) ?? 0) >= 1);
    const extra = input.concealedTiles.length - 13;
    if (allOne && extra === 1 && KOKUSHI_TYPES.some((t) => (counts.get(t) ?? 0) === 2)) names.push('国士无双十三面待');
    else names.push('国士无双');
  }

  // 双倍役满每个按 2 计
  const double = new Set(['大四喜', '国士无双十三面待', '纯正九莲宝灯', '四暗刻单骑']);
  const count = names.reduce((s, n) => s + (double.has(n) ? 2 : 1), 0);
  return { names, count };
}

function isKyuuren(hand: number[], suit: Suit): boolean {
  const base = suit === 'm' ? 0 : suit === 'p' ? 9 : 18;
  const pattern = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9]; // 1112345678999
  const need = pattern.map((r) => base + (r - 1));
  const counts = new Map<number, number>();
  for (const t of hand) counts.set(t, (counts.get(t) ?? 0) + 1);
  // 13 张需匹配 need 多重集 + 1 张同花色任意
  if (hand.length !== 14) return false;
  if (!hand.every((t) => suitOfIndex(t) === suit)) return false;
  const needCounts = new Map<number, number>();
  for (const t of need) needCounts.set(t, (needCounts.get(t) ?? 0) + 1);
  // 减去 need，剩 1 张同花色
  const rest = new Map(counts);
  for (const [t, c] of needCounts) rest.set(t, (rest.get(t) ?? 0) - c);
  let extra = 0;
  for (const c of rest.values()) if (c > 0) extra += c;
  return extra === 1 && [...rest.values()].every((c) => c >= 0);
}
function isPureKyuuren(hand: number[], suit: Suit): boolean {
  const base = suit === 'm' ? 0 : suit === 'p' ? 9 : 18;
  const counts = new Map<number, number>();
  for (const t of hand) counts.set(t, (counts.get(t) ?? 0) + 1);
  // 纯正：1112345678999 各 1 + 同花色任意 1，且 13 面听（任意一张都和）
  // 简化：手牌为 1112345678999 + 同花色任意一张
  const pattern = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9];
  const needCounts = new Map<number, number>();
  for (const r of pattern) {
    const t = base + (r - 1);
    needCounts.set(t, (needCounts.get(t) ?? 0) + 1);
  }
  for (const [t, c] of needCounts) {
    if ((counts.get(t) ?? 0) < c) return false;
  }
  return true;
}

// ---------------- 普通番判定 ----------------

function scoreStandard(dec: Decomposition, input: YakuInput, g: GlobalFlags): YakuResult {
  const hits: YakuHit[] = [];
  const add = (name: string, fan: number) => hits.push({ name, fan });
  const pons = dec.sets.filter((s) => s.kind === 'pon');
  const chis = dec.sets.filter((s) => s.kind === 'chi');
  const menzen = isMenzen(input.melds);

  // 断幺（1 番）
  if (g.noYaojiu) add('断幺', 1);

  // 平和（门前，1 番）：4 顺子 + 非役牌数牌雀头
  if (menzen && chis.length === 4 && dec.pair >= 0 && isSuited(dec.pair) && !isYaojiu(dec.pair)) add('平和', 1);

  // 役牌（每组 1 番，叠加）：中/发/白刻 + 1/9 数牌刻
  for (const d of [31, 32, 33]) if (pons.some((s) => s.tile === d)) add(d === 31 ? '中' : d === 32 ? '发' : '白', 1);
  for (const s of pons) {
    if (isSuited(s.tile) && (rankOfIndex(s.tile) === 1 || rankOfIndex(s.tile) === 9)) add(`${tileCn(s.tile)}刻`, 1);
  }

  // 对对和（2 番）
  if (pons.length === 4) add('对对和', 2);

  // 三色同顺（2 番，鸣牌降 1）
  {
    const bySuit: Record<string, number[]> = { m: [], p: [], s: [] };
    for (const s of chis) bySuit[suitOfIndex(s.tile)].push(rankOfIndex(s.tile));
    const common = bySuit.m.filter((r) => bySuit.p.includes(r) && bySuit.s.includes(r));
    if (common.length > 0) add('三色同顺', menzen ? 2 : 1);
  }
  // 三色同刻（2 番）
  {
    const bySuit: Record<string, number[]> = { m: [], p: [], s: [] };
    for (const s of pons) if (isSuited(s.tile)) bySuit[suitOfIndex(s.tile)].push(rankOfIndex(s.tile));
    const common = bySuit.m.filter((r) => bySuit.p.includes(r) && bySuit.s.includes(r));
    if (common.length > 0) add('三色同刻', 2);
  }
  // 一气通贯（2 番，鸣牌降 1）
  for (const suit of ['m', 'p', 's'] as const) {
    const starts = chis.filter((s) => suitOfIndex(s.tile) === suit).map((s) => rankOfIndex(s.tile));
    if (starts.includes(1) && starts.includes(4) && starts.includes(7)) {
      add('一气通贯', menzen ? 2 : 1);
      break;
    }
  }
  // 全带幺（2 番，鸣牌降 1）
  if (dec.pair >= 0 && isYaojiu(dec.pair) && dec.sets.every(setHasYaojiu)) add('全带幺', menzen ? 2 : 1);
  // 混老头（2 番）：全部幺九牌
  if (g.allYaojiu && !g.allHonors) add('混老头', 2);

  // 小三元（2 番）：两副箭牌刻 + 另一箭牌雀头
  {
    const dragonPons = [31, 32, 33].filter((d) => pons.some((s) => s.tile === d));
    if (dragonPons.length === 2 && dec.pair >= 0 && isDragon(dec.pair) && !dragonPons.includes(dec.pair)) add('小三元', 2);
  }
  // 三暗刻（2 番）
  {
    let anke = pons.filter((s) => s.concealed).length;
    if (!input.isTsumo) {
      const idx = pons.findIndex((s) => s.concealed && s.tile === input.winningTile);
      if (idx >= 0) anke--;
    }
    if (anke === 3) add('三暗刻', 2);
  }
  // 三杠子（2 番）
  if (kanCount(input.melds) === 3) add('三杠子', 2);

  // 混一色（3 番，鸣牌降 2）
  if (g.numberSuits.size === 1 && g.honorsPresent) add('混一色', menzen ? 3 : 2);
  // 清一色（6 番，鸣牌降 5）
  if (g.numberSuits.size === 1 && !g.honorsPresent) add('清一色', menzen ? 6 : 5);

  // 二杯口（门前，3 番）：两组同花色同数字成对顺子
  if (menzen && chis.length === 4) {
    const key = new Map<string, number>();
    for (const s of chis) {
      const k = `${suitOfIndex(s.tile)}${rankOfIndex(s.tile)}`;
      key.set(k, (key.get(k) ?? 0) + 1);
    }
    const pairs = [...key.values()].filter((v) => v >= 2).length;
    if (pairs === 2) add('二杯口', 3);
  }

  // 门前清自摸（1 番）
  if (menzen && input.isTsumo) add('门前清自摸', 1);

  return finalize(hits, 0);
}

function scoreSpecial(dec: Decomposition, input: YakuInput, g: GlobalFlags): YakuResult {
  const hits: YakuHit[] = [];
  const add = (name: string, fan: number) => hits.push({ name, fan });
  if (dec.special === 'shisan') {
    // 国士无双由役满判定处理，这里返回 0 番（会被役满覆盖）
    return finalize([], 0);
  }
  // 七对子（门前，2 番）
  add('七对子', 2);
  if (g.numberSuits.size === 1 && !g.honorsPresent) add('清一色', isMenzen(input.melds) ? 6 : 5);
  if (g.noYaojiu) add('断幺', 1);
  if (g.allYaojiu && !g.allHonors) add('混老头', 2);
  if (isMenzen(input.melds) && input.isTsumo) add('门前清自摸', 1);
  return finalize(hits, 0);
}

function finalize(hits: YakuHit[], yakumanCount: number): YakuResult {
  const fan = hits.reduce((s, h) => s + h.fan, 0);
  return { fan, yakumanCount, hits };
}

function tileCn(t: number): string {
  const suit = suitOfIndex(t);
  const r = rankOfIndex(t);
  return `${r}${suit === 'm' ? '万' : suit === 'p' ? '筒' : '条'}`;
}

/**
 * 评估和牌番数：枚举所有分解，取最优（役满优先，否则最高番）。
 * - 含牌型役满时，普通番不计，yakumanCount = 役满个数（双倍按 2）。
 * - 无牌型役满但普通番 ≥ 13 时，按累计役满封顶（yakumanCount = 1）。
 */
export function evaluateYaku(input: YakuInput): YakuResult | null {
  const decs = allDecompositions(input.concealedTiles, input.melds);
  if (decs.length === 0) return null;
  const g = computeGlobalFlags(input);
  let best: YakuResult | null = null;
  for (const dec of decs) {
    const yk = yakumanOf(dec, input, g);
    let r: YakuResult;
    if (yk.count > 0) {
      r = { fan: 0, yakumanCount: yk.count, hits: yk.names.map((n) => ({ name: n, fan: 0 })) };
    } else {
      r = dec.special ? scoreSpecial(dec, input, g) : scoreStandard(dec, input, g);
      // 累计役满：普通番 ≥ 13 封顶 1 役满
      if (r.fan >= 13) r = { fan: 0, yakumanCount: 1, hits: [{ name: '累计役满', fan: 0 }] };
    }
    if (!best || better(r, best)) best = r;
  }
  return best;
}

function better(a: YakuResult, b: YakuResult): boolean {
  if (a.yakumanCount !== b.yakumanCount) return a.yakumanCount > b.yakumanCount;
  return a.fan > b.fan;
}
