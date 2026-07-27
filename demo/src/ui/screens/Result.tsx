import { useGame } from '../store';
import { heroMeta } from '../heroData';
import TileView from '../components/TileView';
import { HoverContext } from '../hoverContext';
import { useState } from 'react';
import type { WinRecord, DamageStep } from '../../engine/state';

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/** 单步运算的符号化文案。 */
function stepText(s: DamageStep): string {
  if (s.op === 'base') return `基础伤害（${s.operand}番）`;
  if (s.op === 'mul') return `×${s.operand}`;
  if (s.op === 'add') return `+${fmt(s.operand)}`;
  return `−${fmt(s.operand)}`;
}

function Breakdown({ rec, nameOf }: { rec: WinRecord; nameOf: (id: number) => string }) {
  const b = rec.breakdown;
  if (!b) return null;
  return (
    <div className="mt-1 space-y-0.5 rounded-lg bg-ink-900/60 p-2 text-[10px] leading-relaxed text-muted">
      <div className="font-semibold text-sky-300">伤害计算逻辑</div>

      {/* 出伤乘区 / 加区 */}
      <div className="flex flex-wrap items-center gap-x-1.5">
        <span className="text-parchment">{stepText(b.outSteps[0])}</span>
        <span className="text-gold">{fmt(b.base)}</span>
        {b.outSteps.slice(1).map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={s.op === 'mul' ? 'text-emerald-300' : 'text-amber-300'}>
              {s.label} {stepText(s)}
            </span>
            <span className="text-muted">→</span>
            <span className="text-parchment">{fmt(s.after)}</span>
          </span>
        ))}
        <span className="ml-1 rounded bg-ink-700 px-1 text-parchment">出伤 {fmt(b.outDamage)}</span>
      </div>

      {/* 自摸均分 */}
      {b.isSelfDraw && b.splitCount > 1 && (
        <div>
          自摸 · {b.splitCount} 名对手均分 → 每人 <span className="text-parchment">{fmt(b.outDamage / b.splitCount)}</span>
        </div>
      )}

      {/* 各目标防御区 → 最终 */}
      {b.targets.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-muted">→ {nameOf(t.target)}：</span>
          <span className="text-parchment">{fmt(t.incoming)}</span>
          {t.defSteps.map((d, j) => (
            <span key={j} className="flex items-center gap-1">
              <span className="text-info">{d.label} {stepText(d)}</span>
              <span className="text-muted">→</span>
            </span>
          ))}
          <span className="rounded bg-alert/70 px-1 font-bold text-white">实扣 {fmt(t.final)}</span>
        </div>
      ))}
    </div>
  );
}

function WinCard({ rec, nameOf }: { rec: WinRecord; nameOf: (id: number) => string }) {
  return (
    <div className="rounded-lg bg-ink-900/50 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-gold">
          {rec.isSelfDraw ? '自摸' : '荣和'} · {rec.fan}番
        </span>
        <span className="font-bold text-alert">造成 {fmt(rec.damage)} 伤害</span>
      </div>
      {/* 牌型（番种） */}
      <div className="mb-1 flex flex-wrap gap-1">
        {rec.yaku.length > 0 ? (
          rec.yaku.map((y, i) => (
            <span key={i} className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-parchment">
              {y}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-muted">无番和</span>
        )}
      </div>
      {/* 和牌手牌 */}
      {rec.hand.length > 0 && (
        <div className="flex flex-wrap items-end gap-0.5">
          {[...rec.hand].sort((a, b) => a - b).map((t, i) => (
            <span key={i} className="inline-block h-8 w-6">
              <TileView tile={t} size="sm" glow={t === rec.winningTile} hoverable={false} />
            </span>
          ))}
          {rec.melds.map((m, i) => (
            <span key={`m${i}`} className="ml-1 flex gap-0.5">
              {m.tiles.map((t, j) => (
                <span key={j} className="inline-block h-8 w-6">
                  <TileView tile={m.type === 'ankan' && (j === 0 || j === 3) ? -1 : t} size="sm" hoverable={false} />
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
      {/* 伤害计算逻辑 */}
      <Breakdown rec={rec} nameOf={nameOf} />
    </div>
  );
}

export default function Result() {
  const state = useGame((s) => s.state);
  const humanId = useGame((s) => s.humanId);
  const toSelect = useGame((s) => s.toSelect);
  const [hovered, setHovered] = useState<number | null>(null);
  if (!state) return null;

  const winner = state.winner;
  const human = state.players[humanId];
  const demoResult = useGame((s) => s.demoResult);
  const passed = demoResult ? demoResult === 'pass' : human.alive;
  const winName = winner !== null ? state.players[winner].name : '无';

  const recordsByPlayer = (pid: number): WinRecord[] =>
    state.winRecords.filter((r) => r.winner === pid);

  return (
    <HoverContext.Provider value={{ hovered, setHovered }}>
      <div className="min-h-full overflow-y-auto scroll-slim bg-radial-table px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 text-center">
            <div
              className={`mb-2 text-5xl font-black ${
                passed ? 'text-gold-bright drop-shadow-[0_0_16px_rgba(244,166,42,0.7)]' : 'text-muted'
              }`}
            >
              {passed ? '入学测试通过！' : '入学测试未通过'}
            </div>
            <p className="text-sm text-muted">
              {passed
                ? '你在 3 局循环内成功存活，正式成为山鸣学院的新生！'
                : `你在测试中被淘汰。最终由 ${winName} 笑到最后。`}
              　共进行 {state.roundNumber} 局，全场和牌 {state.winRecords.length} 次。
            </p>
          </div>

          {/* 每名角色的和牌牌型与伤害 */}
          <div className="grid gap-4 md:grid-cols-2">
            {state.players.map((p) => {
              const recs = recordsByPlayer(p.id);
              const total = recs.reduce((s, r) => s + r.damage, 0);
              const meta = heroMeta(p.heroId);
              return (
                <div key={p.id} className="glass-strong rounded-2xl p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded bg-gradient-to-r ${meta.accent} px-2 py-0.5 text-xs font-bold text-white`}>
                        {meta.name}
                      </span>
                      <span className="text-sm font-semibold text-parchment">{p.name}</span>
                      {!p.alive && <span className="text-[11px] text-alert">已淘汰</span>}
                    </div>
                    <span className="text-[11px] text-muted">
                      和牌 {recs.length} 次 · 累计 {total % 1 === 0 ? total : total.toFixed(1)} 伤害
                    </span>
                  </div>
                  {recs.length === 0 ? (
                    <div className="rounded-lg bg-ink-900/40 px-3 py-4 text-center text-[11px] text-muted">
                      本局未和牌
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {recs.map((r, i) => (
                        <WinCard key={i} rec={r} nameOf={(id) => state.players[id].name} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={toSelect}
              className="rounded-xl bg-gradient-to-r from-blood to-blood-light px-8 py-3 font-bold text-white shadow-neon transition active:scale-95"
            >
              再来一局
            </button>
          </div>
        </div>
      </div>
    </HoverContext.Provider>
  );
}
