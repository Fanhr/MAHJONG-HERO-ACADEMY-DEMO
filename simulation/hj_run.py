#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
英雄麻将 —— 批量对局模拟 + 统计分析（对局 = 最多 5 局）
========================================================
【对局定义（本版核心）】
  - 一场“对局(match)”由最多 5 个“局(round)”组成。
  - 一个“局(round)”= 一个牌山（84 张可摸）打到摸完（荒牌）为止；期间可多次和牌。
  - 牌山摸完不终止对局：手牌重新洗牌发牌进入下一局，但每名角色的 **累计承伤/HP 继续沿用**。
  - 对局在“打满 5 局”或“只剩 1 名存活者(淘汰模式)”时结束。

用强理性启发式 AI（向听最小化 + 进张最大化，仅公开信息，无上帝视角）四人对局，
按《数值/番种精选子集与伤害计算公式.md》的番→伤害曲线结算，产出：
  1. 番种出现频率（每种役 / 役满在全部和牌中的占比）
  2. 每次和牌的番数分布、伤害(D_base)分布（含分位数）
  3. 荣和 vs 自摸 占比
  4. 每局(round)的和牌事件数、摸牌数；每场(match)局数
  5. 按“对局内累计摸牌次数”分桶的人均累计承伤曲线（跨最多 5 局）
  6. 一场对局(5局)结束时，每名玩家累计承伤分布 → 反推 HP 可行域
  7. 给定候选 HP 的淘汰赛实测：几局分胜负 / 首淘汰局 / 收敛率

两套自摸口径对比：
  - 'avg'        自摸总量 = D，每名对手 D/n
  - 'split_1.5x' 自摸总量 = 1.5D，每名对手 1.5D/n （新提案：奖励自摸、役满不团灭）

注意：AI 为“强理性启发式”而非理论最优贝叶斯，且 v1 不实现杠；结论用于数值区间参考。
"""

import sys
import random
from collections import Counter, defaultdict

import hj_game as G
from hj_game import Player, play_hand, SEAT_WINDS

MAX_ROUNDS = 5   # 每场对局最多局数


# ------------------------------------------------------------------
# 无 numpy 的统计工具
# ------------------------------------------------------------------

def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def pct(sorted_xs, q):
    if not sorted_xs:
        return 0.0
    if len(sorted_xs) == 1:
        return sorted_xs[0]
    k = (len(sorted_xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(sorted_xs) - 1)
    if f == c:
        return sorted_xs[f]
    return sorted_xs[f] * (c - k) + sorted_xs[c] * (k - f)


def stdev(xs):
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return (sum((x - m) ** 2 for x in xs) / (len(xs) - 1)) ** 0.5


def hist_lines(counter, total, top=None, width=30):
    items = counter.most_common(top) if top else sorted(counter.items(),
                                                         key=lambda kv: -kv[1])
    lines = []
    for name, c in items:
        frac = c / total if total else 0
        bar = '#' * int(round(frac * width))
        lines.append(f"  {str(name):<14} {c:>7}  {frac*100:5.1f}%  {bar}")
    return "\n".join(lines)


def normalize_hits(hits):
    out = []
    for h in hits:
        if isinstance(h, (tuple, list)):
            out.append(h[0])
        else:
            out.append(h)
    return out


# ------------------------------------------------------------------
# per-win / per-round 级别的通用统计（与对局无关，跨所有和牌汇总）
# ------------------------------------------------------------------

class WinStats:
    def __init__(self):
        self.rounds = 0            # 局(round)数
        self.wins = 0
        self.tsumo = 0
        self.ron = 0
        self.yaku_counter = Counter()
        self.fan_list = []
        self.dbase_list = []
        self.dbase_tsumo = []
        self.dbase_ron = []
        self.yakuman_mult = Counter()
        self.per_hit_damage = []
        self.wins_per_round = []
        self.draws_per_round = []
        self.ryuukyoku_mangan = 0
        self.swaps = 0             # 揭露交换成功总次数

    def record_round(self, res):
        self.rounds += 1
        self.swaps += res.swap_count
        self.wins_per_round.append(len(res.win_events))
        self.draws_per_round.append(res.total_draws)
        if res.mangan_players:
            self.ryuukyoku_mangan += 1
        for ev in res.win_events:
            self.wins += 1
            if ev['is_tsumo']:
                self.tsumo += 1
                self.dbase_tsumo.append(ev['dbase'])
            else:
                self.ron += 1
                self.dbase_ron.append(ev['dbase'])
            self.dbase_list.append(ev['dbase'])
            if ev['yakuman'] > 0:
                self.yakuman_mult[ev['yakuman']] += 1
            else:
                self.fan_list.append(ev['fan'])
            for nm in normalize_hits(ev['hits']):
                self.yaku_counter[nm] += 1
            for (_, a) in ev['targets']:
                self.per_hit_damage.append(a)


# ------------------------------------------------------------------
# 模式一：自然分布（HP 极大、不淘汰）；对局固定打满 5 局，累计承伤
# ------------------------------------------------------------------

def run_matches_natural(n_matches, tsumo_mode, seed, max_rounds=MAX_ROUNDS,
                        reveal_swap=True):
    rng = random.Random(seed)
    BIG = 10 ** 9
    players = [Player(i, SEAT_WINDS[i], hp=BIG) for i in range(4)]
    st = WinStats()

    match_player_cum = []       # 展平：每场贡献 4 个（每名玩家 5 局后的累计承伤）
    match_team_cum = []         # 每场团队总承伤
    # round_cum[rd] = [ [p0,p1,p2,p3], ... ] 对齐 match 顺序：第 rd 局结束时各玩家累计承伤
    round_cum = {rd: [] for rd in range(1, max_rounds + 1)}
    dmg_by_matchdraw = defaultdict(float)   # 对局内累计摸牌位置 -> 该位置造成的总伤害
    max_matchdraw = 0

    for m in range(n_matches):
        for p in players:
            p.alive = True
            p.hp = BIG
        cum = [0.0, 0.0, 0.0, 0.0]
        draw_offset = 0
        dealer = m % 4
        for rd in range(max_rounds):
            res = play_hand(players, dealer, tsumo_mode=tsumo_mode,
                            eliminate=False, defend=False, rng=rng,
                            reveal_swap=reveal_swap)
            st.record_round(res)
            for ev in res.win_events:
                pos = draw_offset + ev['draw_idx']
                seg = sum(a for (_, a) in ev['targets'])
                dmg_by_matchdraw[pos] += seg
                if pos > max_matchdraw:
                    max_matchdraw = pos
                for (tid, a) in ev['targets']:
                    cum[tid] += a
            draw_offset += res.total_draws
            round_cum[rd + 1].append(list(cum))
            dealer = (dealer + 1) % 4
        for i in range(4):
            match_player_cum.append(cum[i])
        match_team_cum.append(sum(cum))

    return st, {
        'match_player_cum': match_player_cum,
        'match_team_cum': match_team_cum,
        'round_cum': round_cum,
        'dmg_by_matchdraw': dmg_by_matchdraw,
        'max_matchdraw': max_matchdraw,
        'n_matches': n_matches,
        'max_rounds': max_rounds,
    }


# ------------------------------------------------------------------
# 模式二：淘汰赛（给定 HP）；对局最多 5 局，只剩 1 人则提前结束
# ------------------------------------------------------------------

def run_matches_elim(n_matches, hp, tsumo_mode, seed, max_rounds=MAX_ROUNDS,
                     defend=True, defend_hp_frac=0.25, reveal_swap=True):
    rng = random.Random(seed)
    G.INIT_HP = {i: hp for i in range(4)}
    rounds_used = []
    finished = 0                # 5 局内收敛到 <=1 人存活
    first_elim_round = []
    first_elim_draw = []
    survivors_at_end = []
    for _ in range(n_matches):
        players = [Player(i, SEAT_WINDS[i], hp=float(hp)) for i in range(4)]
        dealer = 0
        rounds = 0
        cum_draws = 0
        fe_round = None
        fe_draw = None
        for rd in range(max_rounds):
            res = play_hand(players, dealer, tsumo_mode=tsumo_mode, eliminate=True,
                            defend=defend, defend_hp_frac=defend_hp_frac, rng=rng,
                            reveal_swap=reveal_swap)
            rounds += 1
            if fe_round is None:
                dead = sum(1 for p in players if not p.alive)
                if dead >= 1:
                    fe_round = rounds
                    fe_draw = cum_draws + res.total_draws
            cum_draws += res.total_draws
            dealer = G._next_alive(dealer, players)
            if res.game_over:
                break
        alive = sum(1 for p in players if p.alive)
        rounds_used.append(rounds)
        survivors_at_end.append(alive)
        if alive <= 1:
            finished += 1
        if fe_round is not None:
            first_elim_round.append(fe_round)
            first_elim_draw.append(fe_draw)
    return {
        'hp': hp,
        'tsumo_mode': tsumo_mode,
        'n': n_matches,
        'rounds_used': rounds_used,
        'finished': finished,
        'first_elim_round': first_elim_round,
        'first_elim_draw': first_elim_draw,
        'survivors_at_end': survivors_at_end,
    }


# ------------------------------------------------------------------
# HP 可行域反推（用自然分布的 per-player 累计承伤轨迹，近似、不含淘汰动态）
# ------------------------------------------------------------------

def hp_feasibility(extra, hp_list):
    round_cum = extra['round_cum']
    max_rounds = extra['max_rounds']
    n = extra['n_matches']
    final = round_cum[max_rounds]
    rows = []
    for hp in hp_list:
        broken_players = 0
        total_players = n * 4
        first_break_rounds = []
        decided_matches = 0     # >=3 名玩家被击破（分出唯一胜者）
        any_break_matches = 0   # 至少 1 人被击破
        for mi in range(n):
            broken_in_match = 0
            for pi in range(4):
                fb = None
                for rd in range(1, max_rounds + 1):
                    if round_cum[rd][mi][pi] >= hp:
                        fb = rd
                        break
                if fb is not None:
                    broken_players += 1
                    first_break_rounds.append(fb)
                    broken_in_match += 1
            if broken_in_match >= 1:
                any_break_matches += 1
            if broken_in_match >= 3:
                decided_matches += 1
        rows.append({
            'hp': hp,
            'broken_rate': broken_players / total_players,
            'first_break_mean': mean(first_break_rounds) if first_break_rounds else None,
            'first_break_p50': pct(sorted(first_break_rounds), 0.5) if first_break_rounds else None,
            'decided_rate': decided_matches / n,
            'any_break_rate': any_break_matches / n,
        })
    return rows


# ------------------------------------------------------------------
# 报告
# ------------------------------------------------------------------

def fmt_natural(st, extra, tsumo_mode):
    L = []
    nm = extra['n_matches']
    mr = extra['max_rounds']
    L.append(f"### 自摸口径 = `{tsumo_mode}`（{nm} 场对局 × 每场固定 {mr} 局 = {st.rounds} 局，HP 极大不淘汰）\n")
    L.append(f"- 总和牌事件：**{st.wins}**（平均每局 {mean(st.wins_per_round):.2f} 次，"
             f"中位 {pct(sorted(st.wins_per_round),0.5):.0f}）")
    L.append(f"- 每局摸牌数：均 {mean(st.draws_per_round):.1f}，"
             f"p10/p50/p90 = {pct(sorted(st.draws_per_round),0.1):.0f}/"
             f"{pct(sorted(st.draws_per_round),0.5):.0f}/"
             f"{pct(sorted(st.draws_per_round),0.9):.0f}（牌山上限 84）")
    if st.wins:
        L.append(f"- 自摸 vs 荣和：自摸 {st.tsumo}（{st.tsumo/st.wins*100:.1f}%），"
                 f"荣和 {st.ron}（{st.ron/st.wins*100:.1f}%）")
    L.append(f"- 荒牌满贯（全幺九弃牌）出现局数：{st.ryuukyoku_mangan}"
             f"（{st.ryuukyoku_mangan/max(1,st.rounds)*100:.1f}%）")
    L.append(f"- 揭露交换成功：{st.swaps} 次（平均每局 {st.swaps/max(1,st.rounds):.2f} 次）")

    # 番数分布
    fan_ct = Counter(st.fan_list)
    L.append("\n**番数分布（非役满和牌，共 %d 次）：**" % len(st.fan_list))
    L.append("```")
    L.append(hist_lines(fan_ct, len(st.fan_list)))
    if st.yakuman_mult:
        L.append("  --- 役满 ---")
        L.append(hist_lines(Counter({f"{k}倍役满": v for k, v in st.yakuman_mult.items()}),
                            st.wins))
    L.append("```")

    # 伤害分布
    ds = sorted(st.dbase_list)
    L.append("\n**单次和牌 D_base（基础伤害）分布：**")
    L.append(f"- 均值 {mean(ds):.1f}，标准差 {stdev(ds):.1f}，"
             f"min {ds[0]:.0f} / p25 {pct(ds,0.25):.0f} / p50 {pct(ds,0.5):.0f} / "
             f"p75 {pct(ds,0.75):.0f} / p90 {pct(ds,0.9):.0f} / p99 {pct(ds,0.99):.0f} / "
             f"max {ds[-1]:.0f}")
    if st.dbase_tsumo:
        dt = sorted(st.dbase_tsumo)
        L.append(f"  - 自摸 D_base：均 {mean(dt):.1f}，p50 {pct(dt,0.5):.0f}，p90 {pct(dt,0.9):.0f}")
    if st.dbase_ron:
        dr = sorted(st.dbase_ron)
        L.append(f"  - 荣和 D_base：均 {mean(dr):.1f}，p50 {pct(dr,0.5):.0f}，p90 {pct(dr,0.9):.0f}")
    ph = sorted(st.per_hit_damage)
    L.append(f"- **单个目标实际承伤**（经自摸分摊后）：均 {mean(ph):.1f}，"
             f"p50 {pct(ph,0.5):.1f}，p90 {pct(ph,0.9):.1f}，max {ph[-1]:.1f}")

    # 番种频率
    L.append("\n**番种出现频率（每种役在全部 %d 次和牌中出现的次数占比）：**" % st.wins)
    L.append("```")
    L.append(hist_lines(st.yaku_counter, st.wins, top=25))
    L.append("```")

    # 每场对局(5局)累计承伤分布
    mpc = sorted(extra['match_player_cum'])
    mtc = sorted(extra['match_team_cum'])
    L.append(f"\n**一场对局（{mr} 局）结束时，每名玩家累计承伤分布：**")
    L.append(f"- 人均 {mean(mpc):.1f}，标准差 {stdev(mpc):.1f}，"
             f"p10/p25/p50/p75/p90/p99 = "
             f"{pct(mpc,0.1):.0f}/{pct(mpc,0.25):.0f}/{pct(mpc,0.5):.0f}/"
             f"{pct(mpc,0.75):.0f}/{pct(mpc,0.9):.0f}/{pct(mpc,0.99):.0f}，max {mpc[-1]:.0f}")
    L.append(f"- 每场团队总承伤：均 {mean(mtc):.1f}，p50 {pct(mtc,0.5):.0f}，p90 {pct(mtc,0.9):.0f}")

    # 逐局累计承伤（人均）
    L.append(f"\n**人均累计承伤随“第几局”增长（对局固定打满 {mr} 局）：**")
    L.append("```")
    L.append("  局(round)   人均累计承伤   本局新增")
    rc = extra['round_cum']
    prev = 0.0
    for rd in range(1, mr + 1):
        vals = [v for row in rc[rd] for v in row]
        cur = mean(vals)
        L.append(f"    第{rd}局      {cur:8.2f}     {cur-prev:8.2f}")
        prev = cur
    L.append("```")

    # 时间曲线：按对局内累计摸牌数分桶
    L.append("\n**伤害随“对局内累计摸牌次数”的累积（跨最多 5 局，人均累计承伤）：**")
    L.append("```")
    L.append("  累计摸牌进度     本桶总伤害/场    人均累计承伤")
    bucket = 30
    cum_team = 0.0
    max_b = extra['max_matchdraw']
    dmg = extra['dmg_by_matchdraw']
    b = 0
    while b < max_b:
        lo, hi = b + 1, b + bucket
        seg = sum(v for d, v in dmg.items() if lo <= d <= hi)
        per_match = seg / nm
        cum_team += per_match
        L.append(f"  第{lo:>3}-{hi:<3}摸   {per_match:9.2f}      {cum_team/4:9.2f}")
        b += bucket
    L.append(f"  —— 全对局人均累计承伤 ≈ {cum_team/4:.1f}（团队总 {cum_team:.1f}）")
    L.append("```")
    return "\n".join(L)


def fmt_compare(st_b, ex_b, st_n, ex_n, mr):
    """基线(无揭露交换) vs 揭露交换 的关键指标对比（同种子、同伤害公式）。"""
    def zero_rate(st):
        return st.fan_list.count(0) / max(1, st.wins) * 100
    L = []
    L.append("### 基线（无交换） vs 揭露交换（新机制） 对比\n")
    L.append("> 同随机种子、同伤害公式 `D=6+6×fan`，唯一差异 = 是否启用“按番数揭露对手手牌并择优交换”。"
             "split_1.5x 口径、自然分布。\n")
    L.append("| 指标 | 基线(无交换) | 揭露交换 | 变化 |")
    L.append("|---|---|---|---|")
    def row(label, b, n, fmt="{:.1f}", pct_delta=True):
        d = n - b
        if pct_delta and b:
            dtxt = f"{d:+.1f} ({d/b*100:+.0f}%)"
        else:
            dtxt = f"{d:+.2f}"
        return f"| {label} | {fmt.format(b)} | {fmt.format(n)} | {dtxt} |"
    L.append(row("0 番和牌占比(%)", zero_rate(st_b), zero_rate(st_n)))
    L.append(row("平均番数(非役满)", mean(st_b.fan_list), mean(st_n.fan_list), "{:.2f}"))
    L.append(row("单次 D_base 均值", mean(st_b.dbase_list), mean(st_n.dbase_list)))
    L.append(row("单次 D_base p90", pct(sorted(st_b.dbase_list), 0.9),
                 pct(sorted(st_n.dbase_list), 0.9), "{:.0f}"))
    L.append(row("单次 D_base p99", pct(sorted(st_b.dbase_list), 0.99),
                 pct(sorted(st_n.dbase_list), 0.99), "{:.0f}"))
    L.append(row("每局和牌次数", mean(st_b.wins_per_round), mean(st_n.wins_per_round), "{:.2f}"))
    L.append(row(f"一场({mr}局)人均累计承伤",
                 mean(ex_b['match_player_cum']), mean(ex_n['match_player_cum'])))
    L.append(row("自摸占比(%)", st_b.tsumo/max(1,st_b.wins)*100,
                 st_n.tsumo/max(1,st_n.wins)*100))
    return "\n".join(L)


def fmt_hp_feasibility(rows, mr):
    L = []
    L.append(f"### HP 可行域反推（自然分布轨迹，对局 = {mr} 局，split_1.5x 口径）\n")
    L.append("> 近似口径：用“HP 极大、不淘汰”的每名玩家累计承伤轨迹，判断给定 HP 下"
             "何时被击破。未含淘汰后目标减少/防守修正，偏保守（实际淘汰赛见下节）。\n")
    L.append("| HP | 玩家被击破率 | 首破局(均/p50) | 至少1人出局的对局占比 | 5局内分出唯一胜者占比 |")
    L.append("|---|---|---|---|---|")
    for r in rows:
        fbm = f"{r['first_break_mean']:.1f}" if r['first_break_mean'] is not None else "—"
        fbp = f"{r['first_break_p50']:.0f}" if r['first_break_p50'] is not None else "—"
        L.append(f"| {r['hp']} | {r['broken_rate']*100:.0f}% | {fbm}/{fbp} | "
                 f"{r['any_break_rate']*100:.0f}% | {r['decided_rate']*100:.0f}% |")
    return "\n".join(L)


def fmt_elim(results_list, mr):
    L = []
    L.append(f"### 淘汰赛实测：对局 = 最多 {mr} 局，只剩 1 人则提前结束\n")
    L.append("| 自摸口径 | HP | 实际局数(均/p50/max) | 首淘汰局(均) | 5局末存活人数(均) | 5局内分出胜负占比 |")
    L.append("|---|---|---|---|---|---|")
    for r in results_list:
        ru = sorted(r['rounds_used'])
        fer = sorted(r['first_elim_round'])
        sv = sorted(r['survivors_at_end'])
        fe_txt = f"{mean(fer):.1f}" if fer else "—"
        L.append(f"| {r['tsumo_mode']} | {r['hp']} | "
                 f"{mean(ru):.1f} / {pct(ru,0.5):.0f} / {ru[-1]:.0f} | "
                 f"{fe_txt} | {mean(sv):.2f} | "
                 f"{r['finished']/r['n']*100:.0f}% |")
    return "\n".join(L)


def main():
    n_nat = int(sys.argv[1]) if len(sys.argv) > 1 else 700     # 自然分布对局场数/口径
    n_elim = int(sys.argv[2]) if len(sys.argv) > 2 else 500    # 淘汰赛对局场数/HP
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 20260724
    mr = int(sys.argv[4]) if len(sys.argv) > 4 else MAX_ROUNDS

    print(f"[run] natural: {n_nat} matches x{mr} rounds x2 modes; "
          f"elim: {n_elim} matches/HP; max_rounds={mr}", file=sys.stderr)

    st_15, ex_15 = run_matches_natural(n_nat, 'split_1.5x', seed, mr)
    print("[run] natural split_1.5x (reveal_swap) done", file=sys.stderr)
    st_avg, ex_avg = run_matches_natural(n_nat, 'avg', seed, mr)
    print("[run] natural avg (reveal_swap) done", file=sys.stderr)
    st_base, ex_base = run_matches_natural(n_nat, 'split_1.5x', seed, mr, reveal_swap=False)
    print("[run] natural split_1.5x baseline(no swap) done", file=sys.stderr)

    ref_per_match = mean(ex_15['match_player_cum'])

    hp_candidates = [30, 45, 60, 90, 120, 150, 180, 240]
    feas = hp_feasibility(ex_15, hp_candidates)

    elim_results = []
    for hp in hp_candidates:
        elim_results.append(run_matches_elim(n_elim, hp, 'split_1.5x', seed, mr))
        print(f"[run] elim split_1.5x HP={hp} done", file=sys.stderr)
    for hp in [90, 150]:
        elim_results.append(run_matches_elim(n_elim, hp, 'avg', seed, mr))
        print(f"[run] elim avg HP={hp} done", file=sys.stderr)

    report = []
    report.append("# 英雄麻将 · 理性 AI 对局模拟报告（对局 = 最多 5 局）\n")
    report.append(f"> 对局定义：一场对局最多 **{mr}** 局(round)，每局=一个牌山(84 摸)打到摸完；"
                  f"牌山摸完不终止，重洗手牌进入下一局，**累计承伤/HP 跨局沿用**；"
                  f"打满 {mr} 局或只剩 1 人时结束。\n")
    report.append(f"> 样本：自然分布每口径 **{n_nat}** 场；淘汰赛每 HP **{n_elim}** 场。随机种子 {seed}。\n")
    report.append("> AI：强理性启发式（向听最小化+进张最大化，公开信息，无上帝视角）；"
                  "v1 未实现杠。数值口径见《数值/番种精选子集与伤害计算公式.md》。\n")

    report.append("---\n## 一、自然分布（不淘汰，测原始节奏与累计承伤）\n")
    report.append(fmt_natural(st_15, ex_15, 'split_1.5x'))
    report.append("\n---\n")
    report.append(fmt_natural(st_avg, ex_avg, 'avg'))

    report.append("\n---\n## 一·补充：机制对比（基线 vs 揭露交换）\n")
    report.append(fmt_compare(st_base, ex_base, st_15, ex_15, mr))

    report.append("\n---\n## 二、HP 可行域\n")
    report.append(f"参考：split_1.5x 口径下，一场 {mr} 局对局每名玩家累计承伤 ≈ **{ref_per_match:.1f}**。\n")
    report.append(fmt_hp_feasibility(feas, mr))
    report.append("\n")
    report.append(fmt_elim(elim_results, mr))
    report.append("\n")

    text = "\n".join(report)
    out = "英雄麻将_对局模拟报告.md"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(text)
    print(text)
    print(f"\n[done] 报告已写入 simulation/{out}", file=sys.stderr)


if __name__ == '__main__':
    main()
