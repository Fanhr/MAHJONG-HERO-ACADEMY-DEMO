import TileView from './TileView';

interface RiverProps {
  discards: number[];
  className?: string;
  max?: number;
}

function River({ discards, className, max = 24 }: RiverProps) {
  const shown = discards.slice(-max);
  return (
    <div className={`flex flex-wrap content-start gap-0.5 ${className ?? ''}`}>
      {shown.map((t, i) => (
        <TileView key={i} tile={t} size="sm" />
      ))}
    </div>
  );
}

export interface TableCenterProps {
  wallRemaining: number;
  winCount: number;
  busy: boolean;
  phaseLabel: string;
  discards: {
    top: number[]; // id 2
    left: number[]; // id 3
    right: number[]; // id 1
    bottom: number[]; // id 0
  };
}

export default function TableCenter({ wallRemaining, winCount, busy, phaseLabel, discards }: TableCenterProps) {
  return (
    <div className="relative flex flex-1 items-stretch justify-center rounded-3xl border border-gold/15 bg-[radial-gradient(ellipse_at_center,#1c5c46_0%,#123a2e_55%,#0d211a_100%)] p-2 shadow-inner">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] grid-rows-[1fr_auto_1fr] gap-1">
        {/* 上 */}
        <div className="col-start-2 row-start-1 flex justify-center">
          <River discards={discards.top} className="max-w-[280px] justify-center" />
        </div>
        {/* 左 */}
        <div className="col-start-1 row-start-2 flex items-center justify-end">
          <River discards={discards.left} className="max-w-[130px] justify-end" />
        </div>
        {/* 中心信息 */}
        <div className="col-start-2 row-start-2 flex flex-col items-center justify-center rounded-2xl bg-ink-900/50 px-5 py-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">牌墙剩余</div>
          <div className="my-0.5 text-4xl font-black text-gold drop-shadow">{wallRemaining}</div>
          <div className="text-[10px] text-emerald-100/70">和牌 {winCount} 次</div>
          <div className="mt-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-parchment">{phaseLabel}</div>
          {busy && <div className="mt-1 animate-pulse text-[10px] text-sky-300">AI 行动中…</div>}
        </div>
        {/* 右 */}
        <div className="col-start-3 row-start-2 flex items-center justify-start">
          <River discards={discards.right} className="max-w-[130px] justify-start" />
        </div>
        {/* 下 */}
        <div className="col-start-2 row-start-3 flex justify-center">
          <River discards={discards.bottom} className="max-w-[280px] justify-center" />
        </div>
      </div>
    </div>
  );
}
