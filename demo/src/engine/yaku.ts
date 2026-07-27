/**
 * 精选番种识别（国标子集）+ 简化互斥/复合裁定，取最高番组合。
 * 说明：本 demo 采用“精选常用番种子集”，非完整国标 81 番；番数用于映射即时伤害。
 * 覆盖：清一色/混一色/字一色/断幺/碰碰和/平和/清龙/大三元/小三元/箭刻/
 *       三暗刻·四暗刻/幺九刻/全带幺/一般高/门前清·不求人·自摸/无字/缺一门/七对/十三幺。
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
} from './tiles';
import type { Meld } from './state';

export interface YakuHit {
  name: string;
  fan: number;
}
export interface YakuResult {
  fan: number;
  hits: YakuHit[];
}
export interface YakuInput {
  /** 手内牌（含和牌张）。 */
  concealedTiles: number[];
  melds: Meld[];
  winningTile: number;
  isTsumo: boolean;
}

function isMenzen(melds: readonly Meld[]): boolean {
  // 暗杠仍算门前清；吃/碰/明杠/加杠破坏门清
  return melds.every((m) => m.type === 'ankan');
}

function allTilesOf(input: YakuInput): number[] {
  const t = [...input.concealedTiles];
  for (const m of input.melds) t.push(...m.tiles);
  return t;
}

/** 面子内包含幺九牌。 */
function setHasYaojiu(s: DecompSet): boolean {
  if (s.kind === 'pon') return isYaojiu(s.tile);
  // 顺子含幺九：仅当含 1（tile rank1）或 7（tile+2 rank9）
  const r = rankOfIndex(s.tile);
  return r === 1 || r === 7;
}

function scoreStandard(dec: Decomposition, input: YakuInput, globalFlags: GlobalFlags): YakuResult {
  const hits: YakuHit[] = [];
  const add = (name: string, fan: number) => hits.push({ name, fan });

  const pons = dec.sets.filter((s) => s.kind === 'pon');
  const chis = dec.sets.filter((s) => s.kind === 'chi');
  const allPon = pons.length === 4;
  const allChi = chis.length === 4;

  const { honorsPresent, numberSuits, allHonors, noYaojiu } = globalFlags;

  // ---- 花色相关（互斥）----
  let suitDone = false;
  if (allHonors) {
    add('字一色', 64);
    suitDone = true; // 字一色 不计 碰碰和
  } else if (numberSuits.size === 1 && !honorsPresent) {
    add('清一色', 24);
    suitDone = true;
  } else if (numberSuits.size === 1 && honorsPresent) {
    add('混一色', 6);
  }

  // ---- 刻子结构 ----
  // 暗刻计数（ron 完成的那副刻子视为明）
  let ankePon = pons.filter((s) => s.concealed).length;
  if (!input.isTsumo) {
    const idx = pons.findIndex((s) => s.concealed && s.tile === input.winningTile);
    if (idx >= 0) ankePon--;
  }

  let ponHandled = false;
  if (ankePon >= 4) {
    add('四暗刻', 64);
    ponHandled = true; // 不计 碰碰和/三暗刻
  } else if (ankePon === 3) {
    add('三暗刻', 16);
  } else if (ankePon === 2) {
    add('双暗刻', 2);
  }

  if (allPon && !ponHandled && !allHonors) {
    add('碰碰和', 6);
  }

  // ---- 箭牌/风牌刻 ----
  const dragonPon = pons.filter((s) => isDragon(s.tile)).length;
  const windPon = pons.filter((s) => isWind(s.tile)).length;
  const dragonPair = dec.pair >= 0 && isDragon(dec.pair);
  const windPair = dec.pair >= 0 && isWind(dec.pair);

  if (dragonPon === 3) add('大三元', 88);
  else if (dragonPon === 2 && dragonPair) add('小三元', 64);
  else if (dragonPon === 2) add('双箭刻', 6);
  else if (dragonPon === 1) add('箭刻', 2);

  if (windPon === 4) add('大四喜', 88);
  else if (windPon === 3 && windPair) add('小四喜', 64);
  else if (windPon === 3) add('三风刻', 12);

  // 幺九刻（老头/风刻，箭刻已单列不重复计）
  const yaojiuKe = pons.filter(
    (s) => isYaojiu(s.tile) && !isDragon(s.tile)
  ).length;
  if (yaojiuKe > 0 && dragonPon < 3 && windPon < 3) add('幺九刻', yaojiuKe);

  // ---- 顺子结构 ----
  if (allChi && dec.pair >= 0 && isSuited(dec.pair)) add('平和', 2);

  // 清龙：同花色 1/4/7 三条顺子
  for (const suit of ['m', 'p', 's'] as const) {
    const starts = chis
      .filter((s) => suitOfIndex(s.tile) === suit)
      .map((s) => rankOfIndex(s.tile));
    if (starts.includes(1) && starts.includes(4) && starts.includes(7)) {
      add('清龙', 16);
      break;
    }
  }

  // 一般高：两副完全相同的顺子
  const chiKey = new Map<string, number>();
  for (const s of chis) {
    const k = `${suitOfIndex(s.tile)}${rankOfIndex(s.tile)}`;
    chiKey.set(k, (chiKey.get(k) ?? 0) + 1);
  }
  let yibangao = 0;
  for (const v of chiKey.values()) if (v >= 2) yibangao++;
  if (yibangao > 0) add('一般高', yibangao);

  // 全带幺：所有面子与将都含幺九
  const pairYao = dec.pair >= 0 && isYaojiu(dec.pair);
  if (pairYao && dec.sets.every(setHasYaojiu)) add('全带幺', 4);

  // ---- 通用 ----
  if (noYaojiu) add('断幺', 2);
  if (!honorsPresent && !suitDone) add('无字', 1);
  if (honorsPresent && numberSuits.size > 0 && numberSuits.size < 3) add('缺一门', 1);

  addWinMethod(add, input);

  return finalize(hits);
}

function addWinMethod(add: (n: string, f: number) => void, input: YakuInput) {
  const menzen = isMenzen(input.melds);
  if (input.isTsumo && menzen) add('不求人', 4);
  else if (!input.isTsumo && menzen) add('门前清', 2);
  else if (input.isTsumo) add('自摸', 1);
}

function scoreSpecial(dec: Decomposition, input: YakuInput, g: GlobalFlags): YakuResult {
  const hits: YakuHit[] = [];
  const add = (name: string, fan: number) => hits.push({ name, fan });
  if (dec.special === 'shisan') {
    add('十三幺', 88);
    return finalize(hits);
  }
  // 七对
  add('七对', 24);
  if (g.numberSuits.size === 1 && !g.honorsPresent) add('清一色', 24);
  if (g.noYaojiu) add('断幺', 2);
  addWinMethod(add, input);
  return finalize(hits);
}

function finalize(hits: YakuHit[]): YakuResult {
  const fan = Math.max(
    1,
    hits.reduce((s, h) => s + h.fan, 0)
  );
  return { fan, hits };
}

interface GlobalFlags {
  honorsPresent: boolean;
  numberSuits: Set<string>;
  allHonors: boolean;
  noYaojiu: boolean;
}

function computeGlobalFlags(input: YakuInput): GlobalFlags {
  const tiles = allTilesOf(input);
  const numberSuits = numberSuitsUsed(tiles);
  const honorsPresent = tiles.some(isHonor);
  const allHonors = tiles.every(isHonor);
  const noYaojiu = tiles.every((t) => !isYaojiu(t));
  return { honorsPresent, numberSuits, allHonors, noYaojiu };
}

/**
 * 评估和牌番数：枚举所有分解，取最高番组合。若非和牌返回 null。
 */
export function evaluateYaku(input: YakuInput): YakuResult | null {
  const decs = allDecompositions(input.concealedTiles, input.melds);
  if (decs.length === 0) return null;
  const g = computeGlobalFlags(input);
  let best: YakuResult | null = null;
  for (const dec of decs) {
    const r = dec.special ? scoreSpecial(dec, input, g) : scoreStandard(dec, input, g);
    if (!best || r.fan > best.fan) best = r;
  }
  return best;
}
