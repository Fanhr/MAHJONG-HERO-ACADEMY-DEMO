import { useState } from 'react';
import { useGame } from '../store';
import TileView from '../components/TileView';

/** 一组用于图示的牌例。 */
function TileRow({ tiles, label }: { tiles: number[]; label?: string }) {
  return (
    <div className="flex items-center gap-1">
      {tiles.map((t, i) => (
        <TileView key={i} tile={t} size="sm" hoverable={false} />
      ))}
      {label && <span className="ml-1 text-[11px] text-muted">{label}</span>}
    </div>
  );
}

function RuleBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-ink-900/50 p-3">
      <h3 className="mb-2 text-sm font-black text-gold">{title}</h3>
      <div className="space-y-2 text-[12px] leading-relaxed text-parchment">{children}</div>
    </div>
  );
}

export default function Intro() {
  const toSelect = useGame((s) => s.toSelect);
  const [stage, setStage] = useState<'ask' | 'rules'>('ask');

  if (stage === 'ask') {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-[#0f2417] via-[#132b1c] to-ink-900 px-4 py-8">
        <div className="glass-strong w-full max-w-lg rounded-2xl p-6 text-center">
          <h1 className="mb-3 bg-gradient-to-r from-gold-bright to-yellow-300 bg-clip-text text-3xl font-black text-transparent">
            欢迎来到麻神力攻学院
          </h1>
          <p className="mb-6 text-sm text-muted">
            在开始入学测试前，我们先了解一下你的麻将基础——这会决定是否为你讲解基础规则。
          </p>
          <div className="mb-4 text-base font-bold text-parchment">你了解麻将的基础规则吗？</div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => toSelect()}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-700 py-3 text-base font-black text-white shadow-gold transition active:scale-95"
            >
              我已了解，直接开始
            </button>
            <button
              onClick={() => setStage('rules')}
              className="rounded-xl bg-ink-700 py-3 text-base font-bold text-parchment hover:bg-ink-600"
            >
              不太熟，先学一下基础规则
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 规则介绍
  return (
    <div className="min-h-full overflow-y-auto scroll-slim bg-gradient-to-b from-[#0f2417] via-[#132b1c] to-ink-900 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 text-center">
          <h1 className="bg-gradient-to-r from-gold-bright to-yellow-300 bg-clip-text text-3xl font-black text-transparent">
            麻将基础规则速览
          </h1>
          <p className="mt-1 text-xs text-muted">结合牌面图示，几分钟看懂和牌怎么做</p>
        </header>

        <div className="space-y-3">
          <RuleBlock title="① 麻将牌的种类">
            <p>共 34 种牌，每种 4 张（136 张）。分三类花色与字牌：</p>
            <div className="space-y-1.5">
              <TileRow tiles={[0, 1, 2, 3, 4, 5, 6, 7, 8]} label="万子（一萬~九萬）" />
              <TileRow tiles={[9, 10, 11, 12, 13, 14, 15, 16, 17]} label="筒子（一筒~九筒）" />
              <TileRow tiles={[18, 19, 20, 21, 22, 23, 24, 25, 26]} label="条子（一条~九条，一条即“幺鸡”）" />
              <TileRow tiles={[27, 28, 29, 30, 31, 32, 33]} label="字牌（东南西北 中发白）" />
            </div>
            <p className="text-muted">其中「1、9 数牌」与全部字牌称为<b>幺九牌</b>，「2~8 数牌」称为<b>中张牌</b>。</p>
          </RuleBlock>

          <RuleBlock title="② 面子与雀头">
            <p>和牌由 <b>4 组面子 + 1 组雀头</b> 共 14 张组成。面子有三种：</p>
            <div className="space-y-1.5">
              <TileRow tiles={[0, 1, 2]} label="顺子：同花色连续 3 张（如 一二三万）" />
              <TileRow tiles={[31, 31, 31]} label="刻子：3 张相同的牌（如 中中中）" />
              <TileRow tiles={[4, 4, 4, 4]} label="杠子：4 张相同的牌（如 五五五五万）" />
              <TileRow tiles={[13, 13]} label="雀头：2 张相同的牌（如 五筒五筒）" />
            </div>
          </RuleBlock>

          <RuleBlock title="③ 怎样算和牌">
            <p>把手牌凑成 <b>4 面子 + 1 雀头 = 14 张</b> 即可和牌。例如：</p>
            <div className="space-y-1.5">
              <TileRow
                tiles={[0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 13, 13, 31, 31]}
                label="一二三万 + 四五六万 + 七八九万 + 五筒刻 + 中中雀头 = 和牌"
              />
            </div>
            <p className="text-muted">每人初始 13 张手牌，凑齐只差 1 张时叫「听牌」，等最后那张「和牌张」到来即可和牌。</p>
          </RuleBlock>

          <RuleBlock title="④ 自摸与荣和">
            <p><b className="text-emerald-300">自摸</b>：你自己摸到和牌张，对全场对手各造成伤害。</p>
            <p><b className="text-amber-300">荣和</b>：对手打出的牌正好是你听的张，你「点和」，仅对点炮者造成伤害（但点炮者需上贡）。</p>
          </RuleBlock>

          <RuleBlock title="⑤ 番种与伤害（简介）">
            <p>和牌的牌型越精巧，<b>番数</b>越高，造成的<b>伤害</b>越大。基础番种举例：</p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li><b className="text-parchment">断幺</b>（1番）：全用 2~8 中张，无幺九字牌</li>
              <li><b className="text-parchment">平和</b>（1番）：门前清，4 顺子 + 数牌雀头</li>
              <li><b className="text-parchment">对对和</b>（2番）：4 刻子 + 雀头，无顺子</li>
              <li><b className="text-parchment">清一色</b>（6番）：只用一种花色的数牌</li>
              <li><b className="text-gold">役满</b>（如字一色、大三元、四暗刻）：极难牌型，伤害封顶 78</li>
            </ul>
            <p className="text-muted">公式：伤害 = 6 ×（1 + 番数）；役满 = 78；自摸按 1.5 倍口径对全场结算。</p>
          </RuleBlock>

          <RuleBlock title="⑥ 一局怎么走">
            <p>每个回合五步：<b>开始 → 抽卡 → 技能与技能卡 → 摸牌 → 切牌</b>。</p>
            <p>切牌后其他人可<b>吃/碰/杠</b>（副露）抢用这张牌；若你听的张被打出即可<b>荣和</b>。</p>
            <p className="text-muted">本作中和牌 = 对对手造成伤害，把对手 HP 打到 0 即淘汰；你只要在 3 局内存活即「入学测试通过」。</p>
          </RuleBlock>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => toSelect()}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-base font-black text-ink-900 shadow-gold transition active:scale-95"
          >
            我学会了，进入学院选择
          </button>
        </div>
      </div>
    </div>
  );
}
