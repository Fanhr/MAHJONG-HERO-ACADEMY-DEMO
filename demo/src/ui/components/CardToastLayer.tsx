import type { CardToast } from '../store';

/** 卡牌激活弹窗层：每张技能卡效果激活时弹出，直观展示“谁因哪张卡实现了什么效果”。 */
export default function CardToastLayer({ toasts }: { toasts: CardToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast-in glass-strong max-w-md rounded-xl border-l-4 border-gold px-4 py-2 shadow-gold"
        >
          <div className="text-sm font-black text-gold">
            {t.playerName} <span className="text-parchment">触发了</span>【{t.cardName}】
          </div>
          {t.desc && <div className="mt-0.5 text-[11px] leading-snug text-muted">{t.desc}</div>}
        </div>
      ))}
    </div>
  );
}
