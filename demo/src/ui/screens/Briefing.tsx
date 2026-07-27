import { useGame } from '../store';
import { heroMeta } from '../heroData';

const BASE = import.meta.env.BASE_URL;

const TYPE_BADGE: Record<string, string> = {
  被动: 'bg-slate-600 text-slate-100',
  主动: 'bg-sky-600 text-white',
  触发: 'bg-amber-600 text-ink-900',
};

function SkillCard({ idx, name, type, short, desc, accent }: { idx: number; name: string; type: string; short: string; desc: string; accent: string }) {
  return (
    <div className={`rounded-lg border-l-4 bg-ink-900/60 p-3 ${accent}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold text-gold">技能 {idx}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TYPE_BADGE[type] ?? 'bg-ink-600'}`}>{type}</span>
        <span className="text-sm font-black text-parchment">{name}</span>
      </div>
      <p className="text-[12px] font-semibold leading-snug text-amber-200/90">{short}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
    </div>
  );
}

export default function Briefing() {
  const newGame = useGame((s) => s.newGame);
  const toSelect = useGame((s) => s.toSelect);
  const geda = heroMeta('geda');
  const aimage = heroMeta('aimage');

  return (
    <div className="min-h-full overflow-y-auto scroll-slim bg-gradient-to-b from-[#0f2417] via-[#132b1c] to-ink-900 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        {/* 标题 */}
        <header className="mb-5 text-center">
          <h1 className="bg-gradient-to-r from-gold-bright via-yellow-300 to-gold-bright bg-clip-text text-3xl font-black tracking-wide text-transparent drop-shadow md:text-4xl">
            参战简报
          </h1>
          <p className="mt-1 text-xs tracking-[0.3em] text-emerald-200/80">COMBAT BRIEFING · 入学测试</p>
          <p className="mt-2 text-sm text-muted">了解你与对手的技能，准备好后即可开战</p>
        </header>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          {/* 玩家：咯哒 */}
          <section className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded bg-gradient-to-r from-emerald-500 to-green-700 px-2 py-0.5 text-[11px] font-bold text-white">你</span>
              <div>
                <div className="text-lg font-black text-gold">{geda.name}</div>
                <div className="text-[11px] text-emerald-200/80">{geda.title}</div>
              </div>
            </div>
            <div className="mb-3 overflow-hidden rounded-xl bg-gradient-to-b from-amber-500/15 to-ink-900">
              <img
                src={`${BASE}assets/geda.png`}
                alt="咯哒"
                className="max-h-[280px] w-full object-contain object-top"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <p className="mb-2 text-[12px] text-parchment">{geda.style}</p>
            <div className="space-y-2">
              {geda.skills.map((sk, i) => (
                <SkillCard key={sk.name} idx={i + 1} {...sk} accent="border-emerald-500" />
              ))}
            </div>
          </section>

          {/* VS */}
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-bright to-orange-600 text-2xl font-black text-ink-900 shadow-gold md:h-20 md:w-20 md:text-3xl">
              VS
            </div>
          </div>

          {/* 对手：爱麻鸽 */}
          <section className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded bg-gradient-to-r from-sky-500 to-indigo-700 px-2 py-0.5 text-[11px] font-bold text-white">对手 ×3</span>
              <div>
                <div className="text-lg font-black text-sky-300">{aimage.name}1~3 号</div>
                <div className="text-[11px] text-sky-200/80">{aimage.title}</div>
              </div>
            </div>
            <div className="mb-3 flex h-[280px] items-center justify-center rounded-xl bg-gradient-to-b from-sky-500/15 to-ink-900">
              <div className="text-center">
                <div className="text-7xl">🕊️</div>
                <div className="mt-2 text-xs text-sky-200/70">爱麻鸽 · 鸽系陪练</div>
              </div>
            </div>
            <p className="mb-2 text-[12px] text-parchment">{aimage.style}</p>
            <div className="space-y-2">
              {aimage.skills.map((sk, i) => (
                <SkillCard key={sk.name} idx={i + 1} {...sk} accent="border-sky-500" />
              ))}
            </div>
          </section>
        </div>

        {/* 规则提示 + 开始按钮 */}
        <div className="mt-6 rounded-xl bg-ink-900/60 p-4 text-center">
          <p className="mb-1 text-sm text-parchment">
            <span className="font-bold text-gold">通关条件：</span>3 局循环内玩家存活即「入学测试通过」
          </p>
          <p className="text-[11px] text-muted">
            HP 归零淘汰；满 3 局未死即通过。生命值低时系统会暗中照顾，但人机也会放水——放手去打吧。
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => toSelect()}
            className="rounded-xl bg-ink-700 px-5 py-3 text-sm font-bold text-muted hover:bg-ink-600"
          >
            返回选择
          </button>
          <button
            onClick={() => newGame('geda')}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-base font-black text-ink-900 shadow-gold transition active:scale-95"
          >
            开始入学测试
          </button>
        </div>
      </div>
    </div>
  );
}
