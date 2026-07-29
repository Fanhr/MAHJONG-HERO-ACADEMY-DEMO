import TileView from './TileView';
import type { Meld, StatusEffect } from '../../engine/state';
import type { Floater } from '../store';

const STATUS_LABEL: Record<string, string> = {
  inspired: '增伤+30%',
  cannon: '炮盾-50%',
  shareLink: '分担',
  protected: '安全箱',
  skipTurn: '停摸',
  extraDraw: '多摸',
  immune: '免疫',
  reborn: '向死而生',
  healOnMeld: '休养生息',
  healOnSuit: '光合作用',
  healOnTile: '生生不息',
  redrawIfNotSuit: '不对不对',
  extraIfSuit: '对的对的',
};

export interface OpponentData {
  id: number;
  name: string;
  heroLabel: string;
  accent: string;
  hp: number;
  alive: boolean;
  isTurn: boolean;
  handCount: number;
  melds: Meld[];
  hasEgg: boolean;
  gold: number;
  safeCount: number;
  statuses: StatusEffect[];
  floaters: Floater[];
}

function hpColor(hp: number): string {
  if (hp > 50) return 'from-jade to-emerald-600';
  if (hp > 25) return 'from-warn to-amber-600';
  return 'from-alert to-rose-700';
}

export default function OpponentPanel({ data, compact }: { data: OpponentData; compact?: boolean }) {
  return (
    <div
      className={`relative glass rounded-xl p-2 transition ${
        data.isTurn ? 'ring-2 ring-gold shadow-gold' : ''
      } ${!data.alive ? 'opacity-40 grayscale' : ''}`}
    >
      {/* 飘字 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center gap-2">
        {data.floaters.map((f) => (
          <span key={f.id} className="animate-damage-pop flex flex-col items-center leading-none">
            {f.label && (
              <span className="rounded bg-ink-900/70 px-1 text-[9px] font-bold text-amber-200">{f.label}</span>
            )}
            <span
              className={`text-2xl font-black ${
                f.heal
                  ? 'text-jade drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                  : 'text-alert drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]'
              }`}
            >
              {f.heal ? '+' : '-'}
              {f.amount % 1 === 0 ? f.amount : f.amount.toFixed(1)}
            </span>
          </span>
        ))}
      </div>

      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded bg-gradient-to-r ${data.accent} px-1.5 py-0.5 text-[10px] font-bold text-white`}>
            {data.heroLabel}
          </span>
          <span className="truncate text-xs font-semibold text-parchment">{data.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[10px]">
          {data.hasEgg && <span className="rounded bg-yellow-500/70 px-1 text-ink-900">蛋</span>}
          {data.gold > 0 && <span className="rounded bg-yellow-600/70 px-1 font-bold text-white">豆{data.gold}</span>}
        </div>
      </div>

      <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-ink-900">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${hpColor(data.hp)} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, data.hp))}%` }}
        />
      </div>
      <div className="mb-1 flex justify-between text-[10px] text-muted">
        <span>HP {data.hp % 1 === 0 ? data.hp : data.hp.toFixed(1)}</span>
        <span className="flex gap-2">
          {data.safeCount > 0 && <span className="text-amber-300">安全牌×{data.safeCount}</span>}
          <span>手牌 {data.handCount}</span>
        </span>
      </div>

      {data.statuses.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {data.statuses.map((s, i) => (
            <span key={i} className={`rounded px-1 text-[9px] ${s.negative ? 'bg-alert/70' : 'bg-info/60'} text-white`}>
              {STATUS_LABEL[s.kind] ?? s.kind}
            </span>
          ))}
        </div>
      )}

      {data.melds.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {data.melds.map((m, i) => (
            <div key={i} className="flex gap-0.5">
              {m.tiles.map((t, j) => (
                <TileView key={j} tile={m.type === 'ankan' && (j === 0 || j === 3) ? -1 : t} size="sm" />
              ))}
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-0.5">
          {Array.from({ length: data.handCount }).map((_, i) => (
            <TileView key={i} tile={-1} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
