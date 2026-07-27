#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《英雄麻将》核心数值验证模拟脚本
================================

用途：在"任一玩家都不使用技能/卡牌效果"（即纯净局立直麻将物理规则，
门清摸打、不吃碰杠，只考虑手牌本身的向听效率）的假设下，回答策划方案中
需要用真实数据支撑的三个问题：

  (1) 四人麻将的摸牌节奏：一整局（荒牌为止）平均每人能摸几次牌？
  (2) 假设所有玩家都以"最快听牌/胡牌"为目标进行贪心打法（向听数最小化 +
      进张数最大化），第一个玩家胡牌时，牌墙的期望剩余张数是多少？
  (3) 结合(1)(2)与"技能卡：每2巡抽3张、选1张保留"的新抽卡节奏，反推卡池
      容量 M：
      - 使用"整局"（(1)中一整局的摸牌次数换算成的等效抽卡次数）累计抽到
        稀有卡（SSR英雄专属牌，带入2张 / 或高费卡，K张）的概率 < 80%；
      - 同时保证到(2)的期望剩余牌数这个"典型终局点"时，累计抽到概率
        ≈ 50%。

依赖：pip install mahjong  （MahjongRepository/mahjong，提供标准型/七对子/
国士无双三种和牌形态综合最小向听数计算）

运行：python3 mahjong_balance_sim.py
"""

import math
import random
import time
from mahjong.shanten import Shanten

shanten_calc = Shanten()

TOTAL_TILE_TYPES = 34          # 9万+9筒+9索+7字 = 34种
COPIES_PER_TYPE = 4            # 每种4张
TOTAL_TILES = TOTAL_TILE_TYPES * COPIES_PER_TYPE  # 136
DEAD_WALL = 14                 # 王牌（岭上/宝牌指示牌区），不参与摸牌
PLAYERS = 4


# ------------------------------------------------------------------
# 基础工具
# ------------------------------------------------------------------

def new_shuffled_wall():
    wall = []
    for t in range(TOTAL_TILE_TYPES):
        wall.extend([t] * COPIES_PER_TYPE)
    random.shuffle(wall)
    return wall


def hand_to_34(hand):
    arr = [0] * TOTAL_TILE_TYPES
    for t in hand:
        arr[t] += 1
    return arr


def relevant_candidates(arr):
    """
    只挑选"有可能让向听数下降"的候选摸牌种类，而非全部34种，
    大幅减少ukeire计算量：
      - 已有该种类的牌（凑刻子/对子）
      - 同花色内，与已有牌"距离<=2"的牌（凑顺子/嵌张/边张）
      - 已有的字牌（凑刻子）
    """
    cands = set()
    for t in range(TOTAL_TILE_TYPES):
        if arr[t] == 0:
            continue
        if arr[t] >= COPIES_PER_TYPE:
            continue
        cands.add(t)
        if t < 27:  # 数牌（万/筒/索），每9个一组
            suit_base = (t // 9) * 9
            rank = t % 9
            for d in (-2, -1, 1, 2):
                r2 = rank + d
                if 0 <= r2 <= 8:
                    cands.add(suit_base + r2)
    return [c for c in cands if arr[c] < COPIES_PER_TYPE]


def best_discard(hand14):
    """
    给定14张牌，选择打出后向听数最小的打法；如有并列，
    在"接近听牌"时用进张数(ukeire)决胜，否则随机决胜（早期打法精细度影响很小，
    这样做可以大幅降低模拟耗时）。
    返回：(打出的牌, 打出后的13张手牌, 该手牌的向听数)
    """
    types_in_hand = sorted(set(hand14))
    info = {}
    for t in types_in_hand:
        remaining = hand14.copy()
        remaining.remove(t)
        arr = hand_to_34(remaining)
        sh = shanten_calc.calculate_shanten(arr)
        info[t] = (sh, arr, remaining)

    min_sh = min(v[0] for v in info.values())
    tied = [(t, v[1], v[2]) for t, v in info.items() if v[0] == min_sh]

    if len(tied) == 1 or min_sh > 2:
        # 早期阶段（离听牌还远）打法细节对整体节奏影响很小，随机决胜以节省算力
        t, arr, remaining = random.choice(tied)
        return t, remaining, min_sh

    # 接近听牌（min_sh <= 2）时，用进张数精确决胜，模拟"最快听牌"打法
    best_ukeire = -1
    best_choice = tied[0]
    for t, arr, remaining in tied:
        ukeire = 0
        for cand in relevant_candidates(arr):
            if arr[cand] >= COPIES_PER_TYPE:
                continue
            arr[cand] += 1
            sh2 = shanten_calc.calculate_shanten(arr)
            arr[cand] -= 1
            if sh2 < min_sh:
                ukeire += 1
        if ukeire > best_ukeire:
            best_ukeire = ukeire
            best_choice = (t, arr, remaining)
    t, arr, remaining = best_choice
    return t, remaining, min_sh


# ------------------------------------------------------------------
# (1) 摸牌节奏：纯粹的牌墙算术（荒牌为止，无人和牌的极限情形）
# ------------------------------------------------------------------

def compute_draw_rhythm():
    dealt = 14 + 13 * 3  # 庄家14张，其余13张 = 53
    live_wall = TOTAL_TILES - dealt - DEAD_WALL  # 136-53-14=69
    avg_per_player = live_wall / PLAYERS
    # 69张按 庄家discard后 玩家1,2,3,庄家 循环摸，69=4*17+1，
    # 多出的1张给第一个摸牌的玩家（庄家的下家）
    base = live_wall // PLAYERS
    extra = live_wall % PLAYERS
    counts = [base] * PLAYERS
    for i in range(extra):
        counts[i] += 1
    return live_wall, avg_per_player, counts


# ------------------------------------------------------------------
# (2) 期望剩余牌数：全员贪心求最快胡牌，模拟到第一个玩家和牌为止
# ------------------------------------------------------------------

def simulate_one_hand():
    wall = new_shuffled_wall()
    idx = 0
    hands = []
    for p in range(PLAYERS):
        n = 14 if p == 0 else 13
        hands.append(wall[idx: idx + n])
        idx += n
    live_wall = wall[idx: idx + 69]

    # 庄家起手14张，先打出一张（不计入"摸牌"次数）
    _, hands[0], _ = best_discard(hands[0])

    turn_seq = [1, 2, 3, 0]  # 庄家下家开始摸牌，循环 1,2,3,0
    own_turns = [0, 0, 0, 0]

    for i, tile in enumerate(live_wall):
        p = turn_seq[i % PLAYERS]
        own_turns[p] += 1
        hands[p].append(tile)
        arr = hand_to_34(hands[p])
        sh = shanten_calc.calculate_shanten(arr)
        if sh == -1:
            remaining = len(live_wall) - (i + 1)
            return {
                "winner": p,
                "remaining_tiles": remaining,
                "elapsed_draws": i + 1,
                "own_turns": own_turns,
                "exhaustive_draw": False,
            }
        _, hands[p], _ = best_discard(hands[p])

    return {
        "winner": None,
        "remaining_tiles": 0,
        "elapsed_draws": len(live_wall),
        "own_turns": own_turns,
        "exhaustive_draw": True,
    }


def _simulate_batch(args):
    n, seed = args
    random.seed(seed)
    results = []
    for _ in range(n):
        results.append(simulate_one_hand())
    return results


def run_part2_simulation(n_trials, seed=None, n_workers=None):
    import multiprocessing as mp

    if n_workers is None:
        n_workers = max(1, mp.cpu_count() - 1)
    n_workers = min(n_workers, n_trials)

    base_seed = seed if seed is not None else random.randint(0, 10**9)
    # 按核心数切分任务，每个子进程独立的随机种子
    chunk = n_trials // n_workers
    rem = n_trials % n_workers
    tasks = []
    for i in range(n_workers):
        cnt = chunk + (1 if i < rem else 0)
        if cnt > 0:
            tasks.append((cnt, base_seed + i * 7919 + 1))

    t0 = time.time()
    all_results = []
    if n_workers > 1:
        with mp.Pool(processes=n_workers) as pool:
            for batch in pool.map(_simulate_batch, tasks):
                all_results.extend(batch)
    else:
        for t in tasks:
            all_results.extend(_simulate_batch(t))
    t1 = time.time()

    remaining_list = []
    elapsed_list = []
    winner_own_turns_list = []
    exhaustive_count = 0
    winner_pos_count = [0, 0, 0, 0]

    for r in all_results:
        if r["exhaustive_draw"]:
            exhaustive_count += 1
            continue
        remaining_list.append(r["remaining_tiles"])
        elapsed_list.append(r["elapsed_draws"])
        winner_own_turns_list.append(r["own_turns"][r["winner"]])
        winner_pos_count[r["winner"]] += 1

    n_win = len(remaining_list)
    avg_remaining = sum(remaining_list) / n_win if n_win else None
    variance = (
        sum((x - avg_remaining) ** 2 for x in remaining_list) / (n_win - 1)
        if n_win > 1 else 0.0
    )
    std_remaining = math.sqrt(variance)
    se_remaining = std_remaining / math.sqrt(n_win) if n_win else None
    avg_elapsed = sum(elapsed_list) / n_win if n_win else None
    sorted_remaining = sorted(remaining_list)
    median_remaining = (
        sorted_remaining[n_win // 2] if n_win else None
    )

    return {
        "n_trials": n_trials,
        "n_win": n_win,
        "n_exhaustive": exhaustive_count,
        "avg_remaining_tiles": avg_remaining,
        "std_remaining_tiles": std_remaining,
        "se_remaining_tiles": se_remaining,
        "median_remaining_tiles": median_remaining,
        "avg_elapsed_draws": avg_elapsed,
        "avg_winner_own_turns": sum(winner_own_turns_list) / n_win if n_win else None,
        "winner_position_distribution": winner_pos_count,
        "time_seconds": t1 - t0,
    }


# ------------------------------------------------------------------
# (3) 抽卡池容量反推：超几何分布 P(至少抽到一次目标稀有卡)
# ------------------------------------------------------------------

def comb(n, k):
    if k < 0 or k > n:
        return 0
    return math.comb(n, k)


def prob_at_least_one_hit(pool_size, target_copies, n_draws):
    """
    从容量为 pool_size 的卡池中（含 target_copies 张目标稀有卡），
    不放回地抽 n_draws 次，至少抽到 1 张目标卡的概率。
    P = 1 - C(pool_size - target_copies, n_draws) / C(pool_size, n_draws)
    """
    if n_draws <= 0:
        return 0.0
    if n_draws > pool_size:
        return 1.0
    total = comb(pool_size, n_draws)
    miss = comb(pool_size - target_copies, n_draws)
    if total == 0:
        return 1.0
    return 1 - miss / total


def find_pool_size(target_copies, n_total_draws, n_early_draws,
                    cap_prob=0.80, target_prob=0.50,
                    pool_min=None, pool_max=2000):
    """
    在 [pool_min, pool_max] 范围内枚举卡池容量 M，
    寻找同时满足：
      P(hit | n_total_draws, M)  < cap_prob
      P(hit | n_early_draws,  M) 最接近 target_prob
    的 M，并返回候选区间与推荐值。
    """
    if pool_min is None:
        pool_min = target_copies + n_total_draws  # 至少要能装下这些抽取次数

    results = []
    for M in range(pool_min, pool_max + 1):
        p_total = prob_at_least_one_hit(M, target_copies, n_total_draws)
        p_early = prob_at_least_one_hit(M, target_copies, n_early_draws)
        results.append((M, p_total, p_early))

    # 满足80%上限的M集合
    satisfy_cap = [r for r in results if r[1] < cap_prob]
    # 在满足80%上限的前提下，找 p_early 最接近 50% 的M
    best = None
    for r in satisfy_cap:
        M, p_total, p_early = r
        diff = abs(p_early - target_prob)
        if best is None or diff < best[3]:
            best = (M, p_total, p_early, diff)

    return best, satisfy_cap


def prob_at_least_one_hit_thinned(pool_size, target_copies, n_draw_events, p_route=0.3):
    """
    整合4.2节"卡池30%/70%分流"设计：每次抽卡事件只有 p_route 的概率
    真正落到该稀有卡所在的子池（如英雄专属牌私有池），其余情况抽到别的子池，不计入。
    先用二项分布枚举"n_draw_events次事件中，有多少次真正落入该子池"，
    再对每种情况套用超几何分布计算命中概率，最终加权求和。
    """
    total = 0.0
    for k in range(0, n_draw_events + 1):
        b = (
            math.comb(n_draw_events, k)
            * (p_route ** k)
            * ((1 - p_route) ** (n_draw_events - k))
        )
        total += b * prob_at_least_one_hit(pool_size, target_copies, k)
    return total


def acquisition_effective_draws(own_turns, turns_per_event, cards_per_event):
    """
    技能卡获取节奏 → 等效"不放回抽取次数"。

    规则：每 turns_per_event 巡（自己的摸牌次数）触发一次抽卡事件，
    每次事件从卡池中揭示 cards_per_event 张牌供玩家选择保留其中1张——
    其余未选中的牌视为从"本局可抽范围"中移除（不放回、不洗回）。

    对"是否曾经遇到目标稀有卡"这个问题而言，只要目标卡在某次事件中被
    揭示，玩家一定会选择保留它，因此等效于从卡池中不放回地连续抽取
    n_events * cards_per_event 张牌，检验目标卡是否在其中——
    "选1张"这个动作不改变"是否遇到过"的概率，只影响未选中的牌的去向。
    """
    n_events = math.floor(own_turns / turns_per_event)
    return n_events, n_events * cards_per_event


def prob_at_least_one_hit_thinned_v2(pool_size, target_copies, n_events,
                                      cards_per_event, p_route=0.3):
    """
    thinned模型的"每次事件揭示cards_per_event张"版本：
    n_events次抽卡事件中，每次事件先按 p_route 概率决定是否落入目标卡
    所在的子池（如英雄专属牌私有池），若落入则从该子池揭示
    cards_per_event张（不放回、跨事件累计）。
    """
    total = 0.0
    for k in range(0, n_events + 1):
        b = (
            math.comb(n_events, k)
            * (p_route ** k)
            * ((1 - p_route) ** (n_events - k))
        )
        n_draws_in_subpool = k * cards_per_event
        total += b * prob_at_least_one_hit(pool_size, target_copies, n_draws_in_subpool)
    return total


# ------------------------------------------------------------------
# 主流程
# ------------------------------------------------------------------

def main():
    print("=" * 70)
    print("(1) 摸牌节奏（荒牌为止，四人平均摸牌次数）")
    print("=" * 70)
    live_wall, avg_per_player, counts = compute_draw_rhythm()
    print(f"活牌墙可摸张数：136 - 53(起手) - 14(死墙) = {live_wall}")
    print(f"平均每人摸牌次数：{live_wall}/4 = {avg_per_player:.2f} 次")
    print(f"实际分配（庄家下家…循环）：{counts}（多出1张给庄家的下家）")

    print()
    print("=" * 70)
    print("(2) 全员最快听牌打法下，第一个玩家和牌时的期望剩余牌数")
    print("=" * 70)
    N_TRIALS = 6000
    res2 = run_part2_simulation(N_TRIALS, seed=42)
    print(f"模拟局数：{res2['n_trials']}，耗时 {res2['time_seconds']:.1f}s（多进程并行）")
    print(f"其中出现有人和牌的局数：{res2['n_win']}"
          f"（荒牌无人和牌局数：{res2['n_exhaustive']}，"
          f"占比 {res2['n_exhaustive']/res2['n_trials']*100:.2f}%）")
    print(f"首位和牌时，牌墙期望剩余张数：{res2['avg_remaining_tiles']:.2f} "
          f"（标准差 {res2['std_remaining_tiles']:.2f}，95%置信区间 ±{1.96*res2['se_remaining_tiles']:.2f}）")
    print(f"首位和牌时，牌墙剩余张数中位数：{res2['median_remaining_tiles']}")
    print(f"首位和牌时，已耗费的总摸牌次数（全桌）期望：{res2['avg_elapsed_draws']:.2f}")
    print(f"首位和牌者自己摸牌次数期望：{res2['avg_winner_own_turns']:.2f}")
    print(f"和牌者座位分布（庄家/下家/对家/上家）：{res2['winner_position_distribution']}")

    E_remaining = res2['avg_remaining_tiles']
    E_elapsed_total = res2['avg_elapsed_draws']

    print()
    print("=" * 70)
    print("(3) 抽卡池容量反推 —— 新规则：每2巡抽3张、选1张保留")
    print("=" * 70)

    # 换算：整局(荒牌为止)一个通用玩家的"自己摸牌次数" = 69/4
    own_turns_full = live_wall / PLAYERS
    # (2)节点上，一个通用玩家的"自己摸牌次数" ≈ 已耗费总摸牌次数/4
    own_turns_at_checkpoint = E_elapsed_total / PLAYERS

    TURNS_PER_EVENT = 2   # 新规则：每2巡触发一次抽卡事件
    CARDS_PER_EVENT = 3   # 每次事件揭示3张，选1张保留（其余2张视为移出可抽范围）

    n_events_total, n_total_draws = acquisition_effective_draws(
        own_turns_full, TURNS_PER_EVENT, CARDS_PER_EVENT)
    n_events_early, n_early_draws = acquisition_effective_draws(
        own_turns_at_checkpoint, TURNS_PER_EVENT, CARDS_PER_EVENT)

    # 旧规则(每4巡抽1张)数据，用于前后对比
    old_n_total = math.floor(own_turns_full / 4)
    old_n_early = math.floor(own_turns_at_checkpoint / 4)

    print(f"整局(荒牌为止)通用玩家自身摸牌次数 ≈ {own_turns_full:.2f} 次")
    print(f"  旧规则(每4巡抽1张)：整局抽卡次数 n_total = {old_n_total}")
    print(f"  新规则(每2巡抽3选1)：整局触发事件 {n_events_total} 次 × {CARDS_PER_EVENT}张/次 "
          f"→ 等效不放回揭示张数 n_total = {n_total_draws}")
    print(f"(2)检查点处通用玩家自身摸牌次数 ≈ {own_turns_at_checkpoint:.2f} 次")
    print(f"  旧规则：检查点抽卡次数 n_early = {old_n_early}")
    print(f"  新规则：检查点触发事件 {n_events_early} 次 × {CARDS_PER_EVENT}张/次 "
          f"→ 等效不放回揭示张数 n_early = {n_early_draws}")
    print("  （'选1保留'不改变'是否曾遇到目标卡'的概率，等效于把揭示的3张"
          "全部视为一次不放回抽取，见 acquisition_effective_draws() 说明）")

    for target_copies in (2, 3, 4):
        print()
        print(f"--- 目标稀有卡副本数 K = {target_copies} "
              f"（K=2对应纯SSR英雄专属牌；K=3/4示意SSR叠加高费卡的组合场景）---")
        best, satisfy_cap = find_pool_size(
            target_copies, n_total_draws, n_early_draws,
            cap_prob=0.80, target_prob=0.50, pool_max=3000,
        )
        if best is None:
            print("  未在搜索范围内找到同时满足两个条件的卡池容量，需扩大搜索上限。")
            continue
        M, p_total, p_early, diff = best
        print(f"  推荐卡池容量 M ≈ {M} 张")
        print(f"  该容量下：整局累计命中概率 P(n_total={n_total_draws}) = {p_total*100:.1f}%  (要求 <80%)")
        print(f"           检查点累计命中概率 P(n_early={n_early_draws}) = {p_early*100:.1f}%  (目标 ≈50%)")
        if satisfy_cap:
            m_lo = satisfy_cap[0][0]
            m_hi = satisfy_cap[-1][0]
            print(f"  满足'整局<80%'条件的容量区间：[{m_lo}, {m_hi}]（越小越容易抽到，越大越保底安全）")
        # 对比旧规则同容量M下的命中率，直观展示"选3抽1"对概率曲线的抬升幅度
        old_p_total = prob_at_least_one_hit(M, target_copies, old_n_total)
        old_p_early = prob_at_least_one_hit(M, target_copies, old_n_early)
        print(f"  【对比】若仍用旧规则(每4巡抽1张)、容量同为{M}张："
              f"整局命中率会降到 {old_p_total*100:.1f}%，检查点命中率降到 {old_p_early*100:.1f}%")

    print()
    print("-" * 70)
    print("附：若考虑4.2节'30%概率抽私有子池/70%抽公共池'的分流设计，")
    print("   目标卡若位于私有子池（如英雄专属牌），实际命中概率会被显著稀释：")
    print("-" * 70)
    for M in (3, 6, 8, 11, 16, 20, 30, 40):
        pt = prob_at_least_one_hit_thinned_v2(
            M, 2, n_events_total, CARDS_PER_EVENT, p_route=0.3)
        pe = prob_at_least_one_hit_thinned_v2(
            M, 2, n_events_early, CARDS_PER_EVENT, p_route=0.3)
        print(f"  子池容量M={M:>3} → 整局命中率 {pt*100:5.1f}%  / 检查点命中率 {pe*100:5.1f}%")
    print("  （对比：旧规则'每4巡抽1张'分流版本下，M=6~8时检查点命中率约20%~28%；")
    print("   新规则'每2巡抽3选1'由于单次事件揭示3张、且事件更频繁，")
    print("   命中率显著抬升，同一M下更容易达到甚至超过50%目标，设计空间更充裕。）")


if __name__ == "__main__":
    main()
