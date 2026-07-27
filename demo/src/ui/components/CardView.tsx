import type { CardDef, CardCategory } from '../../engine/cards/cardDefs';

const CATEGORY_META: Record<CardCategory, { label: string; ring: string; chip: string; glow: string }> = {
  谋: { label: '谋', ring: 'border-sky-400/50', chip: 'bg-sky-600/80', glow: 'from-sky-900/40 to-ink-900/60' },
  战: { label: '战', ring: 'border-rose-500/50', chip: 'bg-rose-600/80', glow: 'from-rose-900/40 to-ink-900/60' },
  御: { label: '御', ring: 'border-emerald-400/50', chip: 'bg-emerald-600/80', glow: 'from-emerald-900/40 to-ink-900/60' },
  运: { label: '运', ring: 'border-violet-400/50', chip: 'bg-violet-600/80', glow: 'from-violet-900/40 to-ink-900/60' },
  生: { label: '生', ring: 'border-lime-400/50', chip: 'bg-lime-600/80', glow: 'from-lime-900/40 to-ink-900/60' },
};

export interface CardViewProps {
  def: CardDef;
  size?: 'sm' | 'md';
  selected?: boolean;
  disabled?: boolean;
  /** 右下角附注（如"需 3AP"）。 */
  note?: string;
  onClick?: () => void;
}

export default function CardView({ def, size = 'md', selected, disabled, note, onClick }: CardViewProps) {
  const cat = CATEGORY_META[def.category];
  const clickable = !!onClick && !disabled;
  const w = size === 'sm' ? 'w-[104px]' : 'w-[132px]';
  const minH = size === 'sm' ? 'min-h-[112px]' : 'min-h-[150px]';
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`relative flex ${w} ${minH} flex-col overflow-hidden rounded-xl border bg-gradient-to-b ${cat.glow} ${cat.ring} p-2 text-left transition
        ${clickable ? 'cursor-pointer hover:-translate-y-1.5 hover:shadow-gold' : 'cursor-default'}
        ${selected ? '-translate-y-1.5 ring-2 ring-gold shadow-gold' : ''}
        ${disabled ? 'opacity-45 grayscale' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className={`rounded ${cat.chip} px-1.5 py-0.5 text-[10px] font-bold text-white`}>{cat.label}</span>
        <span className="rounded bg-ink-900/70 px-1.5 py-0.5 text-[10px] font-bold text-gold">{def.ap}AP</span>
      </div>
      <div className={`font-black text-parchment ${size === 'sm' ? 'text-sm' : 'text-base'}`}>{def.name}</div>
      <p className={`mt-1 flex-1 leading-snug text-muted ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>
        {def.desc}
      </p>
      {note && <div className="mt-1 text-right text-[10px] font-semibold text-warn">{note}</div>}
    </button>
  );
}
