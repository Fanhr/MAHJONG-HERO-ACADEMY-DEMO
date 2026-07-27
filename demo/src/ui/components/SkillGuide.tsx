/**
 * 角色技能一览弹层：展示全部英雄及其技能说明，便于对战中随时查阅。
 * 可高亮当前对局中在场的英雄。
 */
import { HERO_META } from '../heroData';
import type { HeroId } from '../../engine/state';

const TYPE_COLOR: Record<string, string> = {
  被动: 'bg-slate-600/70',
  主动: 'bg-sky-600/70',
  触发: 'bg-amber-600/70',
};

export default function SkillGuide({
  onClose,
  activeHeroes,
}: {
  onClose: () => void;
  activeHeroes?: HeroId[];
}) {
  const active = new Set(activeHeroes ?? []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-strong max-h-[88vh] w-full max-w-4xl overflow-y-auto scroll-slim rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-gold">角色技能一览</h3>
          <button onClick={onClose} className="rounded-lg bg-ink-700 px-3 py-1.5 text-sm text-muted hover:bg-ink-600">
            关闭
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {HERO_META.map((h) => {
            const on = active.size === 0 || active.has(h.id);
            return (
              <div
                key={h.id}
                className={`flex flex-col rounded-2xl border p-4 transition ${
                  on ? 'border-white/10' : 'border-transparent opacity-45'
                }`}
              >
                <div className={`mb-3 rounded-xl bg-gradient-to-br ${h.accent} p-3 text-center`}>
                  <div className="text-xl font-black text-white drop-shadow">{h.name}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-white/85">{h.title}</div>
                </div>
                <p className="mb-3 text-[11px] text-muted">{h.style}</p>
                <div className="flex-1 space-y-2">
                  {h.skills.map((sk) => (
                    <div key={sk.name} className="rounded-lg bg-ink-900/50 p-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${TYPE_COLOR[sk.type] ?? 'bg-ink-600'}`}>
                          {sk.type}
                        </span>
                        <span className="text-sm font-bold text-parchment">{sk.name}</span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-sky-200/90">{sk.short}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{sk.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
