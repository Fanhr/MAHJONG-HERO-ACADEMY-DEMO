import TileFace from './TileFace';
import { useHover } from '../hoverContext';

export interface TileViewProps {
  tile?: number; // 省略或 -1 表示牌背
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  dim?: boolean;
  glow?: boolean;
  locked?: boolean; // 安全牌标记
  /** 是否参与“悬停高亮同名牌”（默认参与；牌背不参与）。 */
  hoverable?: boolean;
  onClick?: () => void;
}

const SIZES = {
  sm: 'h-9 w-7 text-[13px]',
  md: 'h-14 w-10 text-lg',
  lg: 'h-16 w-12 text-xl',
};

export default function TileView({
  tile,
  size = 'md',
  selected,
  dim,
  glow,
  locked,
  hoverable = true,
  onClick,
}: TileViewProps) {
  const isBack = tile === undefined || tile < 0;
  const clickable = !!onClick;
  const { hovered, setHovered } = useHover();
  const base = `relative flex items-center justify-center rounded-md border select-none transition ${SIZES[size]}`;

  if (isBack) {
    return (
      <div
        className={`${base} border-ink-900/60 bg-gradient-to-b from-rose-900 to-ink-900 shadow-inner`}
        aria-hidden
      >
        <span className="text-[10px] text-rose-300/70">牌</span>
      </div>
    );
  }

  const highlight = hoverable && hovered !== null && hovered === tile;

  const enter = hoverable ? () => setHovered(tile!) : undefined;
  const leave = hoverable ? () => setHovered(null) : undefined;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`${base} overflow-hidden border-black/15 bg-gradient-to-b from-white to-slate-200 p-0 shadow-md
        ${clickable ? 'cursor-pointer hover:-translate-y-1.5 hover:shadow-gold' : 'cursor-default'}
        ${selected ? '-translate-y-2 ring-2 ring-gold shadow-gold' : ''}
        ${locked ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]' : ''}
        ${highlight ? 'ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)] -translate-y-0.5' : ''}
        ${dim ? 'opacity-40' : ''}
        ${glow ? 'ring-2 ring-jade shadow-neon' : ''}`}
    >
      <TileFace tile={tile!} />
      {locked && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-tight text-ink-900">
          安
        </span>
      )}
    </button>
  );
}
