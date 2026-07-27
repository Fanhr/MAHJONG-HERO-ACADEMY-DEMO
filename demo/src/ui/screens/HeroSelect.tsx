import { useState } from 'react';
import { heroMeta } from '../heroData';
import { useGame } from '../store';

interface Academy {
  id: string;
  name: string;
  en: string;
  desc: string;
  accent: string;
  unlocked: boolean;
}

const ACADEMIES: Academy[] = [
  { id: 'shanming', name: '山鸣学院', en: 'SHAN MING', desc: '鸡系战术 · 幺鸡流派', accent: 'from-emerald-500 to-green-700', unlocked: true },
  { id: 'lieyan', name: '烈焰学院', en: 'LIE YAN', desc: '进攻爆发（未解锁）', accent: 'from-rose-500 to-red-700', unlocked: false },
  { id: 'guanlan', name: '观澜学院', en: 'GUAN LAN', desc: '牌效速攻（未解锁）', accent: 'from-sky-500 to-indigo-700', unlocked: false },
  { id: 'jingshui', name: '静水学院', en: 'JING SHUI', desc: '防守反击（未解锁）', accent: 'from-slate-400 to-slate-700', unlocked: false },
];

const BASE = import.meta.env.BASE_URL;

export default function HeroSelect() {
  const toBriefing = useGame((s) => s.toBriefing);
  const [selected, setSelected] = useState<string | null>('shanming');
  const geda = heroMeta('geda');

  return (
    <div className="min-h-full overflow-y-auto scroll-slim bg-gradient-to-b from-[#0f2417] via-[#132b1c] to-ink-900 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        {/* 标题横幅 */}
        <header className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-700/40 shadow-gold">
          <img
            src={`${BASE}assets/title.jpg`}
            alt="开战！麻神力攻学院"
            className="h-44 w-full object-cover md:h-56"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/70 via-black/20 to-transparent">
            <h1 className="bg-gradient-to-r from-gold-bright via-yellow-300 to-gold-bright bg-clip-text text-4xl font-black tracking-wide text-transparent drop-shadow md:text-5xl">
              开战！麻神力攻学院
            </h1>
            <p className="mt-1 text-sm font-semibold tracking-[0.3em] text-emerald-200/90">MAHJONG HERO ACADEMY</p>
            <p className="mt-2 rounded-full bg-black/40 px-4 py-1 text-xs text-parchment">新生入学测试 · 3 局循环内存活即可通过</p>
          </div>
        </header>

        {/* 学院选择 */}
        <h2 className="mb-2 text-center text-lg font-black text-parchment">选择你的学院</h2>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {ACADEMIES.map((a) => {
            const active = selected === a.id;
            return (
              <button
                key={a.id}
                disabled={!a.unlocked}
                onClick={() => a.unlocked && setSelected(a.id)}
                className={`relative rounded-2xl border p-4 text-left transition ${
                  a.unlocked
                    ? active
                      ? 'border-gold shadow-gold ring-2 ring-gold'
                      : 'border-emerald-700/40 hover:-translate-y-1 hover:shadow-neon'
                    : 'cursor-not-allowed border-ink-700 opacity-45 grayscale'
                }`}
              >
                <div className={`mb-2 rounded-xl bg-gradient-to-br ${a.accent} px-3 py-4 text-center`}>
                  <div className="text-lg font-black text-white drop-shadow">{a.name}</div>
                  <div className="text-[10px] font-semibold tracking-widest text-white/80">{a.en}</div>
                </div>
                <p className="text-[11px] text-muted">{a.desc}</p>
                {!a.unlocked && (
                  <span className="absolute right-2 top-2 rounded-full bg-ink-900/80 px-2 py-0.5 text-[10px] text-muted">🔒 未解锁</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 山鸣学院详情：咯哒学姐 + 技能展示 */}
        {selected === 'shanming' && (
          <div className="glass-strong grid gap-5 rounded-2xl p-5 md:grid-cols-[300px_1fr]">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-amber-500/20 to-ink-900">
              <img
                src={`${BASE}assets/geda.png`}
                alt="咯哒"
                className="h-full max-h-[420px] w-full object-cover object-top"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = 'none';
                  el.parentElement?.classList.add('min-h-[280px]');
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="text-xl font-black text-gold">咯哒 学姐</div>
                <div className="text-xs text-emerald-200/90">山鸣学院 · 你的引路人</div>
              </div>
            </div>

            <div className="flex flex-col">
              <p className="mb-3 text-sm text-parchment">
                「欢迎来到山鸣学院！我是咯哒。让我用我的<span className="text-gold font-bold">鸡系战术</span>带你熟悉入学测试——
                幺鸡既是你的武器，也可能反噬你，用好它就能过关喔～」
              </p>
              <div className="flex-1 space-y-2">
                {geda.skills.map((sk, i) => (
                  <div key={sk.name} className="rounded-lg bg-ink-900/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-600/80 px-1.5 py-0.5 text-[10px] font-bold text-ink-900">技能{i + 1}</span>
                      <span className="rounded bg-ink-600 px-1.5 py-0.5 text-[10px] text-gold">{sk.type}</span>
                      <span className="text-sm font-black text-parchment">{sk.name}</span>
                    </div>
                    <p className="mt-1 text-[12px] font-semibold leading-snug text-amber-200/90">{sk.short}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{sk.desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => toBriefing()}
                className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-base font-black text-ink-900 shadow-gold transition active:scale-95"
              >
                下一步：参战简报
              </button>
              <p className="mt-2 text-center text-[11px] text-muted">
                对手为 3 名「爱麻鸽」陪练。HP 归零淘汰；只要你在 3 局内存活，即宣告「入学测试通过」。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
