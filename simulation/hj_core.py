#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
英雄麻将 —— 核心牌张 / 手牌分解 / 向听 / 和牌判定模块
======================================================
牌编码（与 mahjong 库 34 数组一致）：
  0-8   : 万 1-9
  9-17  : 筒 1-9
  18-26 : 条(索) 1-9
  27-33 : 字牌  东(27) 南(28) 西(29) 北(30) 白(31) 發(32) 中(33)

约定：
- counts34：长度 34 的列表，counts[t] = 该牌张数。
- 面子表示：('kou', t) 刻子 / ('shun', t) 顺子(t 为最小牌) / ('kan', t) 杠。
- 副露 Meld：dict(type=..., tiles=[...], concealed=bool)
    type ∈ {'chi','pon','minkan','ankan','kakan'}
    concealed：是否算门前清（仅 ankan=True，其余 False）
"""

from mahjong.shanten import Shanten
from mahjong.agari import Agari

_SHANTEN = Shanten()
_AGARI = Agari()

# ---- 牌类别辅助 ----
MAN = range(0, 9)
PIN = range(9, 18)
SOU = range(18, 27)
HONOR = range(27, 34)
WINDS = (27, 28, 29, 30)          # 东南西北
DRAGONS = (31, 32, 33)            # 白發中
TERMINALS = (0, 8, 9, 17, 18, 26)  # 数牌 1/9
YAOCHU = set(TERMINALS) | set(HONOR)  # 幺九牌 = 数牌1/9 + 字牌
GREEN = {19, 20, 21, 23, 25, 32}  # 绿一色：条2/3/4/6/8 + 發(32)


def is_honor(t):
    return t >= 27


def is_terminal_num(t):
    return t in (0, 8, 9, 17, 18, 26)


def is_yaochu(t):
    return t in YAOCHU


def suit_of(t):
    if t < 9:
        return 0
    if t < 18:
        return 1
    if t < 27:
        return 2
    return 3  # honor


def rank_of(t):
    """数牌返回 1..9，字牌返回 0。"""
    if t < 27:
        return (t % 9) + 1
    return 0


def tiles_to_counts(tiles):
    c = [0] * 34
    for t in tiles:
        c[t] += 1
    return c


def counts_to_tiles(counts):
    out = []
    for t, n in enumerate(counts):
        out.extend([t] * n)
    return out


# ------------------------------------------------------------------
# 标准型分解：把 counts 分解为 need_sets 个面子 + 1 个雀头
# 返回所有分解： [ (sets, pair_tile), ... ]，sets 为 [('kou'|'shun', t), ...]
# 仅处理"门内(concealed)"部分；副露的面子在算番时单独并入。
# ------------------------------------------------------------------

def _sets_decomp(counts, need):
    if need == 0:
        return [[]] if sum(counts) == 0 else []
    # 找最小的有牌 index
    i = -1
    for k in range(34):
        if counts[k] > 0:
            i = k
            break
    if i == -1:
        return []
    res = []
    # 刻子
    if counts[i] >= 3:
        counts[i] -= 3
        for rest in _sets_decomp(counts, need - 1):
            res.append([('kou', i)] + rest)
        counts[i] += 3
    # 顺子（仅数牌，且 i 为该花色 1..7）
    if i < 27:
        r = i % 9
        if r <= 6 and counts[i + 1] > 0 and counts[i + 2] > 0:
            counts[i] -= 1
            counts[i + 1] -= 1
            counts[i + 2] -= 1
            for rest in _sets_decomp(counts, need - 1):
                res.append([('shun', i)] + rest)
            counts[i] += 1
            counts[i + 1] += 1
            counts[i + 2] += 1
    return res


def decompose_standard(counts, need_sets):
    """返回所有 (sets, pair_tile) 标准型分解。"""
    results = []
    c = list(counts)
    for pair in range(34):
        if c[pair] >= 2:
            c[pair] -= 2
            for sets in _sets_decomp(c, need_sets):
                results.append((sets, pair))
            c[pair] += 2
    return results


def is_chiitoitsu(counts):
    """七对子：恰好 7 个不同的对子（4 张相同不可拆两对）。"""
    pairs = 0
    for n in counts:
        if n == 2:
            pairs += 1
        elif n != 0:
            return False
    return pairs == 7


def is_kokushi(counts):
    """国士无双：13 种幺九各≥1 且其中一种为 2，其余全 0。返回 (bool, is_13_wait)。"""
    for t in range(34):
        if t not in YAOCHU and counts[t] != 0:
            return False, False
    have = [counts[t] for t in sorted(YAOCHU)]
    if any(v == 0 for v in have):
        return False, False
    # 13 面：13 种各 1 张（和牌张使某一种成 2）；十三面待形态判断在和牌上下文里做
    pairs = sum(1 for v in have if v == 2)
    ones = sum(1 for v in have if v == 1)
    if pairs == 1 and ones == 12:
        return True, False
    return False, False


# ------------------------------------------------------------------
# 和牌判定 / 向听 / 进张（借助 mahjong 库）
# ------------------------------------------------------------------

def is_winning(concealed_counts, melds):
    """concealed_counts 含和牌张；melds 为副露列表。返回是否和牌。
    做法：把副露牌并回成完整 14 张后判定（副露本身即合法面子）。"""
    full = full_counts_with_melds(concealed_counts, melds)
    if sum(full) % 3 != 2:
        return False
    return _AGARI.is_agari(full)


def full_counts_with_melds(concealed_counts, melds):
    """把副露牌并回 34 数组（杠按 3 张计），用于近似向听计算。"""
    c = list(concealed_counts)
    for m in melds:
        if m['type'] in ('minkan', 'ankan', 'kakan'):
            c[m['tiles'][0]] += 3
        else:
            for t in m['tiles'][:3]:
                c[t] += 1
    return c


def shanten_of(concealed_counts, melds):
    """近似向听：把副露牌并回后用库计算（副露为完整面子，库会自然利用）。"""
    full = full_counts_with_melds(concealed_counts, melds)
    return _SHANTEN.calculate_shanten(full)


def ukeire(concealed_counts, melds, unseen_counts):
    """进张：能让向听下降的牌种数（按剩余未见张数加权返回 (种类数, 张数)）。
    concealed_counts 为打牌后的 13 张形态（不含即将摸的牌）。"""
    base = shanten_of(concealed_counts, melds)
    kinds = 0
    tiles = 0
    for t in range(34):
        if unseen_counts[t] <= 0:
            continue
        concealed_counts[t] += 1
        sh = shanten_of(concealed_counts, melds)
        concealed_counts[t] -= 1
        if sh < base:
            kinds += 1
            tiles += unseen_counts[t]
    return kinds, tiles, base
