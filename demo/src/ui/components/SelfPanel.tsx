import TileView from './TileView';
import { tileName } from '../../engine/tiles';
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

export interface SelfPanelData {
  name: string;
  heroLabel: string;
  accent: string;
  hp: number;
  ap: number;
  apMax: number;
  alive: boolean;
  isTurn: boolean;
  melds: Meld[];
  eggIndicator: number | null;
  safeCount: number;
  statuses: StatusEffect[];
  floaters: Floater[];
}

function hpColor(hp: number): string {
  if (hp > 50) return 'from-jade to-emerald-600';
  if (hp > 25) return 'from-warn to-amber-600';
  return 'from-alert to-rose-700';
}

export default function SelfPanel({ data }: { data: SelfPanelData }) {
  return (
    <div
      className={`relative glass rounded-xl px-3 py-2 transition ${
        data.isTurn ? 'ring-2 ring-gold shadow-gold' : ''
      } ${!data.alive ? 'opacity-40 grayscale' : ''}`}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 flex justify-center gap-2">
        {data.floaters.map((f) => (
          <span key={f.id} className="animate-damage-pop flex flex-col items-center leading-none">
            {f.label && (
              <span className="rounded bg-ink-900/70 px-1 text-[10px] font-bold text-amber-200">{f.label}</span>
            )}
            <span
              className={`text-3xl font-black ${
                f.heal
                  ? 'text-jade drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]'
                  : 'text-alert drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]'
              }`}
            >
              {f.heal ? '+' : '-'}
              {f.amount % 1 === 0 ? f.amount : f.amount.toFixed(1)}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`rounded bg-gradient-to-r ${data.accent} px-2 py-0.5 text-xs font-bold text-white`}>
          {data.heroLabel}
        </span>
        <span className="text-sm font-semibold text-parchment">{data.name}</span>
        <span className="text-xs font-bold text-gold">AP {data.ap}/{data.apMax}</span>
        {data.eggIndicator !== null && (
          <span className="rounded bg-yellow-500/80 px-1 text-[11px] font-bold text-ink-900">指示牌 {tileName(data.eggIndicator)}</span>
        )}
        {data.safeCount > 0 && <span className="rounded bg-amber-500/80 px-1 text-[11px] font-bold text-ink-900">安全牌×{data.safeCount}</span>}
        {data.statuses.map((s, i) => (
          <span key={i} className={`rounded px-1 text-[10px] ${s.negative ? 'bg-alert/70' : 'bg-info/60'} text-white`}>
            {STATUS_LABEL[s.kind] ?? s.kind}
          </span>
        ))}

        {data.melds.length > 0 && (
          <div className="flex gap-1">
            {data.melds.map((m, i) => (
              <div key={i} className="flex gap-0.5">
                {m.tiles.map((t, j) => (
                  <TileView key={j} tile={m.type === 'ankan' && (j === 0 || j === 3) ? -1 : t} size="sm" />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-900">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${hpColor(data.hp)} transition-all duration-500`}
            style={{ width: `${Math.max(0, Math.min(100, data.hp))}%` }}
          />
        </div>
        <span className="w-14 text-right text-xs text-parchment">HP {data.hp % 1 === 0 ? data.hp : data.hp.toFixed(1)}</span>
      </div>
    </div>
  );
}
