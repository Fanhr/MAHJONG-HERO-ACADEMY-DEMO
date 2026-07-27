#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
英雄麻将 —— 番种评估 + 伤害公式
================================
严格对齐 `数值/番种精选子集与伤害计算公式.md`：
  1番: 门前清自摸/平和/断幺/役牌(可叠加)/岭上开花/枪杠/海底摸月/河底捞鱼
  2番: 七对子/对对和/三色同顺(鸣1)/三色同刻/一气通贯(鸣1)/全带幺(鸣1)/混老头/小三元/三暗刻/三杠子
  3番: 混一色(鸣2)/二杯口
  6番: 清一色(鸣5)
  役满(78,可叠加): 天和/地和/国士/大三元/小四喜/字一色/四暗刻/清老头/绿一色/四杠子/九莲
  双役满(n=2): 大四喜/国士十三面/纯正九莲/四暗刻单骑
伤害：D_base = 78*n [役满n个,不封顶] / 78 [数え≥13番] / 6*(1+f) [普通]
      普通档=基础6(和牌即有)+每番6：0番6/1番12/2番18/…/12番78(与数え役满无缝)
"""

import hj_core as C

DRAGONS = set(C.DRAGONS)
WINDS = set(C.WINDS)
TERM_NUM = {0, 8, 9, 17, 18, 26}


class WinCtx:
    def __init__(self, concealed, melds, win_tile, is_tsumo, is_menzen,
                 seat_wind, round_wind, rinshan=False, chankan=False,
                 haitei=False, houtei=False, tenhou=False, chiihou=False):
        self.concealed = concealed          # counts34（含和牌张）
        self.melds = melds                    # 副露列表
        self.win_tile = win_tile
        self.is_tsumo = is_tsumo
        self.is_menzen = is_menzen            # 无 chi/pon/minkan/kakan（ankan 仍算门清）
        self.seat_wind = seat_wind
        self.round_wind = round_wind
        self.rinshan = rinshan
        self.chankan = chankan
        self.haitei = haitei
        self.houtei = houtei
        self.tenhou = tenhou
        self.chiihou = chiihou


def _all_tiles_counts(ctx):
    """含副露的全部 14(+杠) 张的 34 数组，用于花色/幺九类判断。"""
    return C.full_counts_with_melds(ctx.concealed, ctx.melds)


def _suit_usage(counts):
    suits = set()
    honor = False
    for t in range(34):
        if counts[t] == 0:
            continue
        if t < 27:
            suits.add(t // 9)
        else:
            honor = True
    return suits, honor


def _meld_sets(ctx):
    """副露 → (kind, tile, concealed, is_kan) 列表。"""
    out = []
    for m in ctx.melds:
        t = m['tiles'][0]
        if m['type'] == 'chi':
            out.append(('shun', min(m['tiles']), False, False))
        elif m['type'] == 'pon':
            out.append(('kou', t, False, False))
        elif m['type'] == 'ankan':
            out.append(('kou', t, True, True))
        else:  # minkan / kakan
            out.append(('kou', t, False, True))
    return out


def _yakuhai_fan(tile, ctx):
    f = 0
    if tile in DRAGONS:
        f += 1
    if tile == ctx.seat_wind:
        f += 1
    if tile == ctx.round_wind:
        f += 1
    if tile in TERM_NUM:
        f += 1
    return f


def _score_standard(ctx, sets, pair):
    """给定一个标准分解（门内 sets + pair），并入副露后计算 (fan, yakuman)。"""
    meld_sets = _meld_sets(ctx)
    # 门内 sets 标注：concealed=True；由荣和完成的那副刻子降为明刻
    concealed_sets = []
    ron_kou_tile = None
    if not ctx.is_tsumo:
        ron_kou_tile = ctx.win_tile
    used_ron = False
    for (kind, t) in sets:
        conc = True
        if kind == 'kou' and (not ctx.is_tsumo) and t == ctx.win_tile and not used_ron:
            conc = False   # 荣和完成的刻子算明刻
            used_ron = True
        concealed_sets.append((kind, t, conc, False))
    all_sets = concealed_sets + meld_sets

    all_counts = _all_tiles_counts(ctx)
    suits, honor = _suit_usage(all_counts)
    num_suits = len(suits)

    kou_list = [s for s in all_sets if s[0] == 'kou']
    shun_list = [s for s in all_sets if s[0] == 'shun']
    n_kou = len(kou_list)
    n_shun = len(shun_list)
    n_kan = sum(1 for s in all_sets if s[3])
    n_ankou = sum(1 for s in all_sets if s[0] == 'kou' and s[2])

    # ---------- 役满判定 ----------
    yakuman = 0
    ym_hits = []

    # 大三元 / 小四喜 / 大四喜
    dragon_kou = sum(1 for s in kou_list if s[1] in DRAGONS)
    wind_kou = sum(1 for s in kou_list if s[1] in WINDS)
    if dragon_kou == 3:
        yakuman += 1; ym_hits.append('大三元')
    if wind_kou == 4:
        yakuman += 2; ym_hits.append('大四喜')
    elif wind_kou == 3 and pair in WINDS:
        yakuman += 1; ym_hits.append('小四喜')

    # 字一色
    if all(t >= 27 for t in range(34) if all_counts[t] > 0):
        yakuman += 1; ym_hits.append('字一色')
    # 清老头（全部 1/9 数牌）
    if all(t in TERM_NUM for t in range(34) if all_counts[t] > 0):
        yakuman += 1; ym_hits.append('清老头')
    # 绿一色
    if all(t in C.GREEN for t in range(34) if all_counts[t] > 0):
        yakuman += 1; ym_hits.append('绿一色')
    # 四暗刻（含单骑双役满）
    if n_ankou == 4:
        is_tanki = (ctx.concealed[pair] == 2 and ctx.win_tile == pair)
        if is_tanki:
            yakuman += 2; ym_hits.append('四暗刻单骑')
        else:
            yakuman += 1; ym_hits.append('四暗刻')
    # 四杠子
    if n_kan == 4:
        yakuman += 1; ym_hits.append('四杠子')
    # 九莲宝灯（门清清一色特定形态）
    if ctx.is_menzen and num_suits == 1 and not honor:
        s = list(suits)[0] * 9
        base = [3, 1, 1, 1, 1, 1, 1, 1, 3]
        rel = [all_counts[s + i] for i in range(9)]
        diff = [rel[i] - base[i] for i in range(9)]
        if all(d >= 0 for d in diff) and sum(diff) == 1:
            extra = diff.index(1)
            # 纯正：和牌前恰为 1112345678999（9 面听）
            pre = list(rel); pre[extra] -= 1
            if pre == base:
                yakuman += 2; ym_hits.append('纯正九莲')
            else:
                yakuman += 1; ym_hits.append('九莲宝灯')

    # 天和/地和
    if ctx.tenhou:
        yakuman += 1; ym_hits.append('天和')
    if ctx.chiihou:
        yakuman += 1; ym_hits.append('地和')

    if yakuman > 0:
        return 0, yakuman, ym_hits

    # ---------- 普通番 ----------
    fan = 0
    hits = []

    def add(name, f):
        nonlocal fan
        fan += f
        hits.append((name, f))

    if ctx.is_tsumo and ctx.is_menzen:
        add('门前清自摸', 1)
    if ctx.rinshan:
        add('岭上开花', 1)
    if ctx.chankan:
        add('枪杠', 1)
    if ctx.haitei:
        add('海底摸月', 1)
    if ctx.houtei:
        add('河底捞鱼', 1)

    # 断幺
    if all((t not in C.YAOCHU) for t in range(34) if all_counts[t] > 0):
        add('断幺', 1)

    # 役牌（每副刻子/杠）
    yh = 0
    for s in kou_list:
        yh += _yakuhai_fan(s[1], ctx)
    if yh:
        add('役牌', yh)

    # 平和：门清 + 全顺 + 数牌雀头（非役牌）
    if ctx.is_menzen and n_shun == 4 and pair < 27:
        add('平和', 1)

    # 对对和 / 混老头
    if n_kou == 4:
        add('对对和', 2)
        if all(t in C.YAOCHU for t in range(34) if all_counts[t] > 0):
            add('混老头', 2)
    else:
        # 全带幺（含至少一顺，且每面子与雀头都含幺九）
        if n_shun >= 1:
            def has_yao_set(kind, t):
                if kind == 'kou':
                    return t in C.YAOCHU
                return t in TERM_NUM or (t % 9 == 6)  # 顺子含1(123)或含9(789)
            ok = all(has_yao_set(s[0], s[1]) for s in all_sets) and (pair in C.YAOCHU)
            if ok:
                add('全带幺', 1 if not ctx.is_menzen else 2)

    # 小三元
    if dragon_kou == 2 and pair in DRAGONS:
        add('小三元', 2)

    # 三暗刻 / 三杠子
    if n_ankou == 3:
        add('三暗刻', 2)
    if n_kan == 3:
        add('三杠子', 2)

    # 三色同刻
    kou_ranks = {}
    for s in kou_list:
        if s[1] < 27:
            kou_ranks.setdefault(s[1] % 9, set()).add(s[1] // 9)
    if any(len(v) == 3 for v in kou_ranks.values()):
        add('三色同刻', 2)

    # 三色同顺
    shun_starts = {}
    for s in shun_list:
        shun_starts.setdefault(s[1] % 9, set()).add(s[1] // 9)
    if any(len(v) == 3 for v in shun_starts.values()):
        add('三色同顺', 1 if not ctx.is_menzen else 2)

    # 一气通贯
    for suit in range(3):
        base = suit * 9
        starts = set(s[1] for s in shun_list if s[1] // 9 == suit)
        if {base + 0, base + 3, base + 6}.issubset(starts):
            add('一气通贯', 1 if not ctx.is_menzen else 2)
            break

    # 二杯口（门清，两组相同顺子对）
    if ctx.is_menzen and n_shun == 4:
        from collections import Counter
        cnt = Counter(s[1] for s in shun_list)
        if len([v for v in cnt.values() if v >= 2]) == 2 and all(v == 2 for v in cnt.values()):
            add('二杯口', 3)

    # 混一色 / 清一色
    if num_suits == 1:
        if honor:
            add('混一色', 2 if not ctx.is_menzen else 3)
        else:
            add('清一色', 5 if not ctx.is_menzen else 6)

    # 七对子（在 _score_chiitoi 处理；此处标准型不含）
    return fan, 0, hits


def _score_chiitoi(ctx):
    all_counts = _all_tiles_counts(ctx)
    if not C.is_chiitoitsu(all_counts):
        return None
    # 役满优先：字一色 / 清老头（七对形态）
    yakuman = 0
    ym = []
    present = [t for t in range(34) if all_counts[t] > 0]
    if all(t >= 27 for t in present):
        yakuman += 1; ym.append('字一色')
    if all(t in TERM_NUM for t in present):
        yakuman += 1; ym.append('清老头')
    if all(t in C.GREEN for t in present):
        yakuman += 1; ym.append('绿一色')
    if yakuman:
        return 0, yakuman, ym

    fan = 0
    hits = [('七对子', 2)]
    fan += 2
    if ctx.is_tsumo and ctx.is_menzen:
        fan += 1; hits.append(('门前清自摸', 1))
    if ctx.haitei:
        fan += 1; hits.append(('海底摸月', 1))
    if ctx.houtei:
        fan += 1; hits.append(('河底捞鱼', 1))
    if all(t not in C.YAOCHU for t in present):
        fan += 1; hits.append(('断幺', 1))
    if all(t in C.YAOCHU for t in present):
        fan += 2; hits.append(('混老头', 2))
    suits, honor = _suit_usage(all_counts)
    if len(suits) == 1:
        if honor:
            fan += 3; hits.append(('混一色', 3))
        else:
            fan += 6; hits.append(('清一色', 6))
    return fan, 0, hits


def _score_kokushi(ctx):
    all_counts = _all_tiles_counts(ctx)
    ok, _ = C.is_kokushi(all_counts)
    if not ok:
        return None
    # 十三面待：和牌前 13 种各 1 张（即和牌张所在种类 count==2 且它是“听 13 面”的形态）
    # 近似：若去掉和牌张后 13 种幺九各 1 张 → 十三面
    pre = list(all_counts)
    pre[ctx.win_tile] -= 1
    is_13 = all(pre[t] == 1 for t in C.YAOCHU)
    return (0, 2, ['国士十三面']) if is_13 else (0, 1, ['国士无双'])


def evaluate(ctx):
    """返回 dict(fan, yakuman, hits, dbase)。所有分解口径统一 (fan, yakuman, hits)，取 D_base 最大者。"""
    cands = []

    sp = _score_chiitoi(ctx)
    if sp:
        cands.append(sp)
    kk = _score_kokushi(ctx)
    if kk:
        cands.append(kk)

    need = 4 - len(ctx.melds)
    for sets, pair in C.decompose_standard(ctx.concealed, need):
        cands.append(_score_standard(ctx, sets, pair))

    if not cands:
        cands.append((0, 0, []))  # 保底（is_winning 已保证不至于此）

    best = max(cands, key=lambda c: _dbase(c[0], c[1]))
    fan, yakuman, hits = best
    return {
        'fan': fan,
        'yakuman': yakuman,
        'hits': hits,
        'dbase': _dbase(fan, yakuman),
    }


def _dbase(fan, yakuman):
    if yakuman > 0:
        return float(78 * yakuman)
    if fan >= 13:
        return 78.0
    # 基础伤害 6（只要和牌即有），再按番数叠加，每番 +6：
    #   0番=6 / 1番=12 / 2番=18 / … / 12番=78（与数え役满 78 无缝衔接）
    return 6.0 * (1 + fan)


# ------------------------------------------------------------------
# 伤害分配（多种自摸口径可切换）
# ------------------------------------------------------------------

def distribute_damage(dbase, is_tsumo, alive_opponents, tsumo_mode='split_1.5x'):
    """返回 {opponent_index_placeholder: amount}，这里只按“每名对手承受多少”返回列表。
    - 荣和：全额 dbase 给点炮者一人（由调用方指定目标）。
    - 自摸：
        'avg'        每名对手 dbase / n   （总量 = dbase，当前流程稿口径）
        'split_1.5x' 每名对手 1.5*dbase/n （总量 = 1.5*dbase，新提案）
        'full'       每名对手 dbase       （总量 = n*dbase）
    返回：('ron', full) 或 ('tsumo', per_each)
    """
    n = max(1, alive_opponents)
    if not is_tsumo:
        return dbase  # 荣和：单体全额
    if tsumo_mode == 'avg':
        return dbase / n
    if tsumo_mode == 'full':
        return dbase
    # split_1.5x
    return 1.5 * dbase / n
