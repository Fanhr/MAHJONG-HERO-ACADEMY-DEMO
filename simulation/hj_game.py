#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
英雄麻将 —— 4 人对局引擎 + 理性 AI
====================================
严格实现 `局内游戏流程.md` 的两条关键规则：
  1) 和牌不终局：一局打到牌山（84 张）摸完为止；期间可多次和牌。
     - 自摸：摸到的和牌张移入和牌记录区，手牌回到 13 张听牌形态，玩家仍听牌、可继续和牌。
     - 荣和：点炮牌移出弃牌区（记录），点炮者本回合切牌视为完成，行动照常轮转；和牌者手牌不变、仍听牌。
     - 一炮多响：同一张牌多家荣和，各自全额结算。
  2) 无死墙：136 张全部参与，起手 4×13=52，牌山可摸 84 张；荒牌 = 牌山摸完。

简化（v1，报告中说明）：不实现杠（明杠/暗杠/加杠）。因此三杠子/四杠子/岭上开花/
枪杠 频率为 0，三暗刻/四暗刻仅经门内暗刻成立（略偏低）。其余常见番种完整。

AI（强理性启发式，非理论最优）：
  - 进攻：向听数最小化 + 进张(ukeire)最大化（仅用公开信息 + 自己手牌估算未见张，无上帝视角）。
  - 听牌后：默认摸切保持听牌（machine-gun），能和必和。
  - 副露：吃/碰能降低向听即鸣（无起和条件 → 任何和牌都造成伤害，鸣牌抢速度理性）。
  - 防守：可选。HP 低于阈值时优先打“现物”安全牌（他家弃牌区出现过的牌）。
"""

import random
from collections import deque, Counter

import hj_core as C
import hj_score as S

ROUND_WIND = 27  # 东场
SEAT_WINDS = [27, 28, 29, 30]  # 起家=东，逆时针 南/西/北


class Player:
    __slots__ = ('idx', 'hand', 'melds', 'discards', 'menzen', 'seat_wind',
                 'alive', 'hp', 'all_disc_yao', 'disc_called', 'first_turn')

    def __init__(self, idx, seat_wind, hp):
        self.idx = idx
        self.hand = [0] * 34
        self.melds = []
        self.discards = []
        self.menzen = True
        self.seat_wind = seat_wind
        self.alive = True
        self.hp = hp
        self.all_disc_yao = True   # 流局满贯：本局所有弃牌是否全为幺九
        self.disc_called = False   # 是否有弃牌被吃/碰/荣和
        self.first_turn = True


def _seen_public(players):
    seen = [0] * 34
    for p in players:
        for t in p.discards:
            seen[t] += 1
        for m in p.melds:
            if m['type'] in ('minkan', 'ankan', 'kakan'):
                seen[m['tiles'][0]] += 4
            else:
                for t in m['tiles'][:3]:
                    seen[t] += 1
    return seen


def _unseen_for(player, players):
    seen = _seen_public(players)
    unseen = [0] * 34
    for t in range(34):
        unseen[t] = 4 - seen[t] - player.hand[t]
        if unseen[t] < 0:
            unseen[t] = 0
    return unseen


# ------------------------------------------------------------------
# AI 决策
# ------------------------------------------------------------------

def ai_choose_discard(player, players, defend=False):
    """从 14 张手牌里选一张打出。返回 tile。"""
    hand = player.hand
    distinct = [t for t in range(34) if hand[t] > 0]
    base_sh = C.shanten_of(hand, player.melds)

    # 逐张试打，记录 (shanten, ukeire) —— ukeire 仅在接近听牌时精算
    unseen = _unseen_for(player, players) if base_sh <= 1 else None
    best = []
    min_sh = 99
    for t in distinct:
        hand[t] -= 1
        sh = C.shanten_of(hand, player.melds)
        hand[t] += 1
        if sh < min_sh:
            min_sh = sh
            best = [t]
        elif sh == min_sh:
            best.append(t)

    if len(best) == 1 and not defend:
        return best[0]

    # 防守：在候选里优先打“现物”安全牌（任一他家弃牌区出现过）
    if defend:
        pond = set()
        for op in players:
            if op is not player and op.alive:
                pond.update(op.discards)
        safe = [t for t in best if t in pond]
        pool = safe if safe else best
        # 安全牌里优先幺九/字牌
        pool.sort(key=lambda t: (t not in C.YAOCHU, t))
        return pool[0]

    # 进攻：min_sh<=1 时按 ukeire 决胜；否则打最孤立的牌
    if min_sh <= 1 and unseen is not None:
        best_uke = -1
        pick = best[0]
        for t in best:
            hand[t] -= 1
            k, tiles, _ = C.ukeire(hand, player.melds, unseen)
            hand[t] += 1
            if tiles > best_uke:
                best_uke = tiles
                pick = t
        return pick

    # 远离听牌：打最孤立/幺九优先（简单启发）
    def isolation(t):
        # 越孤立分越高：字牌/幺九更该打
        score = 0
        if t in C.YAOCHU:
            score += 2
        if t < 27:
            r = t % 9
            base = (t // 9) * 9
            neigh = sum(hand[base + rr] for rr in range(max(0, r - 2), min(9, r + 3)) if base + rr != t)
            score += (3 - min(3, neigh))
        return score
    best.sort(key=lambda t: -isolation(t))
    return best[0]


def ai_want_call(player, players, tile, call_kind, unseen):
    """是否鸣牌（chi/pon）。较理性的收敛规则：
    仅当鸣牌能直接听牌(new_sh==0)，或为役牌碰（快速取番），才鸣；否则保持门清发展。
    已听牌(sh==0)不鸣（保持当前听牌形态）。"""
    base_sh = C.shanten_of(player.hand, player.melds)
    if base_sh <= 0:
        return None
    hand = list(player.hand)
    is_yakuhai = False
    if call_kind == 'pon':
        if hand[tile] < 2:
            return None
        hand[tile] -= 2
        meld = {'type': 'pon', 'tiles': [tile, tile, tile], 'concealed': False}
        if tile in S.DRAGONS or tile == player.seat_wind or tile == ROUND_WIND or tile in S.TERM_NUM:
            is_yakuhai = True
    else:  # chi
        combo = _chi_combo(hand, tile)
        if combo is None:
            return None
        a, b = combo
        hand[a] -= 1
        hand[b] -= 1
        meld = {'type': 'chi', 'tiles': sorted([a, b, tile]), 'concealed': False}
    new_sh = C.shanten_of(hand, player.melds + [meld])
    if new_sh >= base_sh:
        return None
    if new_sh == 0 or is_yakuhai:
        return meld
    return None


def _chi_combo(hand, tile):
    """返回可与 tile 组成顺子的两张手牌 (a,b)，否则 None。仅数牌。"""
    if tile >= 27:
        return None
    r = tile % 9
    base = (tile // 9) * 9
    # 三种形态：tile 作为最小/中间/最大
    opts = []
    if r <= 6 and hand[tile + 1] > 0 and hand[tile + 2] > 0:
        opts.append((tile + 1, tile + 2))
    if 1 <= r <= 7 and hand[tile - 1] > 0 and hand[tile + 1] > 0:
        opts.append((tile - 1, tile + 1))
    if r >= 2 and hand[tile - 2] > 0 and hand[tile - 1] > 0:
        opts.append((tile - 2, tile - 1))
    return opts[0] if opts else None


# ------------------------------------------------------------------
# 对局引擎
# ------------------------------------------------------------------

class HandResult:
    def __init__(self):
        self.win_events = []   # dict(winner,is_tsumo,fan,yakuman,dbase,hits,targets,draw_idx)
        self.ryuukyoku = False
        self.mangan_players = []
        self.game_over = False
        self.winner = None
        self.total_draws = 0   # 本局总摸牌次数（到荒牌/终局为止）
        self.swap_count = 0    # 本局发生的“揭露交换”成功次数


def _next_alive(i, players):
    for step in range(1, 5):
        j = (i + step) % 4
        if players[j].alive:
            return j
    return i


def play_hand(players, dealer, tsumo_mode='split_1.5x', eliminate=True,
              defend=True, defend_hp_frac=0.25, rng=random, reveal_swap=True):
    """打一局（到荒牌为止）。原地修改 players 的 hp/alive。返回 HandResult。
    reveal_swap=True 时启用“揭露交换”机制：每次和牌后，和牌者按本次番数 n
    随机揭露被和牌者手牌 n 张，可择优取 1 张与自己手牌交换（详见 _reveal_and_swap）。"""
    res = HandResult()
    alive_idx = [p.idx for p in players if p.alive]
    n_alive = len(alive_idx)

    # 洗牌发牌
    wall = []
    for t in range(34):
        wall += [t] * 4
    rng.shuffle(wall)
    wall = deque(wall)
    for p in players:
        p.hand = [0] * 34
        p.melds = []
        p.discards = []
        p.menzen = True
        p.all_disc_yao = True
        p.disc_called = False
        p.first_turn = True
        if p.alive:
            for _ in range(13):
                p.hand[wall.popleft()] += 1

    draws_used = 0
    current = dealer
    action = 'draw'
    any_call_happened = False

    def hp_frac(p):
        return p.hp / max(1e-9, INIT_HP.get(p.idx, 100))

    while True:
        p = players[current]
        if not p.alive:
            current = _next_alive(current, players)
            continue

        drawn_tile = None
        rinshan = False
        if action == 'draw':
            if not wall:
                break  # 荒牌
            drawn_tile = wall.popleft()
            draws_used += 1
            p.hand[drawn_tile] += 1
            haitei = (len(wall) == 0)
            # 自摸判定
            if C.is_winning(p.hand, p.melds):
                if _ai_want_win(p):
                    tenhou = (p.idx == dealer and p.first_turn and not any_call_happened)
                    chiihou = (p.idx != dealer and p.first_turn and not any_call_happened)
                    _resolve_win(res, players, p, drawn_tile, True, tsumo_mode,
                                 eliminate, draws_used, haitei=haitei,
                                 tenhou=tenhou, chiihou=chiihou,
                                 rng=rng, reveal_swap=reveal_swap)
                    p.hand[drawn_tile] -= 1  # 和牌张入记录区，手牌回 13
                    p.first_turn = False
                    if res.game_over:
                        res.total_draws = draws_used
                        return res
                    current = _next_alive(current, players)
                    action = 'draw'
                    continue
        # meld_discard: 无摸牌，直接切
        p.first_turn = False

        # 选择切牌
        need_defend = defend and hp_frac(p) < defend_hp_frac
        # 若已听牌且本次是摸牌：默认摸切（保持听牌）
        sh_now = C.shanten_of([h for h in p.hand], p.melds)
        if action == 'draw' and drawn_tile is not None and sh_now == 0 and not need_defend:
            # 打出摸到的牌若仍听牌则摸切；否则正常选
            p.hand[drawn_tile] -= 1
            if C.shanten_of(p.hand, p.melds) == 0:
                disc = drawn_tile
                p.hand[drawn_tile] += 1
            else:
                p.hand[drawn_tile] += 1
                disc = ai_choose_discard(p, players, defend=need_defend)
        else:
            disc = ai_choose_discard(p, players, defend=need_defend)

        p.hand[disc] -= 1
        p.discards.append(disc)
        if disc not in C.YAOCHU:
            p.all_disc_yao = False
        houtei = (len(wall) == 0)

        # 鸣牌响应窗口：荣和 > 碰 > 吃
        ron_winners = []
        for j in range(4):
            op = players[j]
            if op is p or not op.alive:
                continue
            op.hand[disc] += 1
            win = C.is_winning(op.hand, op.melds)
            op.hand[disc] -= 1
            if win and _ai_want_win(op):
                ron_winners.append(op)
        if ron_winners:
            p.disc_called = True
            p.discards.pop()  # 点炮牌移出弃牌区（入记录区）
            for w in ron_winners:
                _resolve_win(res, players, w, disc, False, tsumo_mode, eliminate,
                             draws_used, ron_target=p, houtei=houtei,
                             rng=rng, reveal_swap=reveal_swap)
                if res.game_over:
                    res.total_draws = draws_used
                    return res
            current = _next_alive(current, players)
            action = 'draw'
            continue

        # 碰 / 吃（降低向听才鸣）
        caller = None
        caller_meld = None
        # 碰：从下家起按座次找
        order = [(current + k) % 4 for k in range(1, 4)]
        for j in order:
            op = players[j]
            if not op.alive or op is p:
                continue
            un = _unseen_for(op, players)
            m = ai_want_call(op, players, disc, 'pon', un)
            if m:
                caller, caller_meld = op, m
                break
        if caller is None:
            # 吃：仅下家(current 的 next alive)
            nj = _next_alive(current, players)
            op = players[nj]
            un = _unseen_for(op, players)
            m = ai_want_call(op, players, disc, 'chi', un)
            if m:
                caller, caller_meld = op, m

        if caller is not None:
            p.disc_called = True
            # 从手牌移出组成副露的两张（保留被鸣的那张 disc 来自弃牌）
            to_remove = list(caller_meld['tiles'])
            to_remove.remove(disc)
            for t in to_remove:
                caller.hand[t] -= 1
            caller.melds.append(caller_meld)
            caller.menzen = False
            any_call_happened = True
            current = caller.idx
            action = 'meld_discard'
            continue

        current = _next_alive(current, players)
        action = 'draw'

    # 荒牌
    res.total_draws = draws_used
    res.ryuukyoku = True
    # 流局满贯
    for p in players:
        if p.alive and p.all_disc_yao and not p.disc_called and len(p.discards) > 0:
            res.mangan_players.append(p.idx)
    if res.mangan_players and eliminate:
        for src in res.mangan_players:
            for op in players:
                if op.alive and op.idx != src:
                    _apply_damage(op, 30.0, players, res)
        if _check_over(players, res):
            return res
    return res


def _ai_want_win(p):
    return True  # 无起和条件，任何和牌都造成伤害 → 能和必和（理性）


def _resolve_win(res, players, winner, win_tile, is_tsumo, tsumo_mode, eliminate,
                 draws_used, ron_target=None, haitei=False, houtei=False,
                 tenhou=False, chiihou=False, rng=None, reveal_swap=False):
    winner.hand[win_tile] += 1  # 临时补上和牌张评估
    ctx = S.WinCtx(list(winner.hand), winner.melds, win_tile, is_tsumo,
                   winner.menzen, winner.seat_wind, ROUND_WIND,
                   haitei=haitei, houtei=houtei, tenhou=tenhou, chiihou=chiihou)
    ev = S.evaluate(ctx)
    winner.hand[win_tile] -= 1

    alive_ops = [op for op in players if op.alive and op is not winner]
    targets = []
    if is_tsumo:
        per = S.distribute_damage(ev['dbase'], True, len(alive_ops), tsumo_mode)
        for op in alive_ops:
            targets.append((op.idx, per))
            if eliminate:
                _apply_damage(op, per, players, res)
    else:
        amt = ev['dbase']
        targets.append((ron_target.idx, amt))
        if eliminate:
            _apply_damage(ron_target, amt, players, res)

    res.win_events.append({
        'winner': winner.idx,
        'is_tsumo': is_tsumo,
        'fan': ev['fan'],
        'yakuman': ev['yakuman'],
        'dbase': ev['dbase'],
        'hits': ev['hits'],
        'targets': targets,
        'draw_idx': draws_used,
    })
    if eliminate:
        _check_over(players, res)

    # 揭露交换：按本次番数 n（役满 13×倍）揭露被和牌者手牌若干张，择优 1 张与自己交换。
    if reveal_swap and rng is not None:
        n_rev = _reveal_count(ev['fan'], ev['yakuman'])
        if n_rev > 0 and winner.alive:
            if is_tsumo:
                # 自摸：向伤害快照中每名（存活）对手各揭露 n 张，合并后择优选 1 张
                tgts = [op for op in players if op.alive and op is not winner]
            else:
                tgts = [ron_target] if (ron_target is not None and ron_target.alive) else []
            if tgts and _reveal_and_swap(winner, tgts, n_rev, rng):
                res.swap_count += 1


def _apply_damage(target, amount, players, res):
    target.hp -= amount
    if target.hp <= 0 and target.alive:
        target.alive = False


def _check_over(players, res):
    alive = [p for p in players if p.alive]
    if len(alive) <= 1:
        res.game_over = True
        res.winner = alive[0].idx if alive else None
        return True
    return False


def _reveal_count(fan, yakuman):
    """揭露张数：普通牌=番数（0 番→0，不触发→鼓励做番）；役满=13×倍数（会被手牌张数截断）。"""
    if yakuman > 0:
        return 13 * yakuman
    return fan


def _hand_potential(hand, melds, seat_wind):
    """听牌手牌的“潜在最大伤害”：遍历所有能和成的牌，取 D_base 最大者；不听牌返回 -1。
    用于衡量“做大牌”潜力——交换应朝提升该值的方向进行。"""
    menzen = not any(m['type'] in ('chi', 'pon', 'minkan', 'kakan') for m in melds)
    best = -1.0
    for t in range(34):
        if hand[t] >= 4:
            continue
        hand[t] += 1
        if C.is_winning(hand, melds):
            ctx = S.WinCtx(list(hand), melds, t, False, menzen, seat_wind, ROUND_WIND)
            d = S.evaluate(ctx)['dbase']
            if d > best:
                best = d
        hand[t] -= 1
    return best


def _reveal_and_swap(winner, targets, n, rng):
    """从每个 target 手牌各随机揭露 min(n, 手牌数) 张（自摸=全部存活对手，荣和=点炮者），
    合并候选池；在“换后仍听牌”前提下，若某张能提升 winner 手牌的潜在最大伤害(做更大牌型)，
    则取该张、打出 winner 一张牌，与该张的原持有者完成 1↔1 实体交换。
    和牌者结算后处于听牌态，故判据是“潜在番/伤害提升”而非降向听。返回是否发生交换。"""
    pool = []  # [(tile, owner), ...]
    for tg in targets:
        tiles = []
        for t in range(34):
            tiles += [t] * tg.hand[t]
        if not tiles:
            continue
        for tile in rng.sample(tiles, min(n, len(tiles))):
            pool.append((tile, tg))
    if not pool:
        return False
    base_pot = _hand_potential(winner.hand, winner.melds, winner.seat_wind)
    best = None
    best_pot = base_pot
    seen = set()
    for take, owner in pool:
        key = (take, id(owner))
        if key in seen or winner.hand[take] >= 4:
            continue
        seen.add(key)
        winner.hand[take] += 1
        for give in range(34):
            if winner.hand[give] == 0 or give == take:
                continue
            winner.hand[give] -= 1
            if C.shanten_of(winner.hand, winner.melds) == 0:
                pot = _hand_potential(winner.hand, winner.melds, winner.seat_wind)
                if pot > best_pot:
                    best_pot = pot
                    best = (take, give, owner)
            winner.hand[give] += 1
        winner.hand[take] -= 1
    if best is None:
        return False
    take, give, owner = best
    winner.hand[take] += 1
    winner.hand[give] -= 1
    owner.hand[take] -= 1
    owner.hand[give] += 1
    return True


INIT_HP = {}  # 由 run 层填充，用于防守阈值
