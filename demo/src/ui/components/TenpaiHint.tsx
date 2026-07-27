import TileView from './TileView';
import type { DiscardWait } from '../waits';

function WaitRow({ waits }: { waits: DiscardWait['waits'] }) {
  const shown = waits.slice(0, 8);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {shown.map((w) => (
        <span key={w.tile} className="flex items-center gap-1">
          <span className="inline-block h-8 w-6">
            <TileView tile={w.tile} size="sm" hoverable={false} />
          </span>
          <span className="text-[11px] text-alert">≈{w.damage}</span>
          {w.tsumoOnly && <span className="text-[10px] text-amber-300">(限自摸)</span>}
        </span>
      ))}
      {waits.length > shown.length && <span className="text-[11px] text-muted">等 {waits.length} 种</span>}
    </div>
  );
}

export default function TenpaiHint({ data }: { data: DiscardWait[] }) {
  if (data.length === 0) return null;
  const single = data.length === 1 && data[0].discard === null;

  return (
    <div className="glass-strong rounded-2xl p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-gradient-to-r from-jade to-emerald-600 px-2 py-0.5 text-[11px] font-bold text-ink-900">
          听牌
        </span>
        <span className="text-[11px] text-muted">
          {single ? '可和以下牌（≈为预估伤害，实际受自摸均分/减伤影响）' : '切出下列牌可保持听牌'}
        </span>
      </div>
      {single ? (
        <WaitRow waits={data[0].waits} />
      ) : (
        <div className="flex max-h-28 flex-col gap-1.5 overflow-y-auto scroll-slim">
          {data.slice(0, 6).map((dw) => (
            <div key={dw.discard} className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                切
                <span className="inline-block h-8 w-6">
                  <TileView tile={dw.discard!} size="sm" hoverable={false} />
                </span>
                →
              </span>
              <WaitRow waits={dw.waits} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
