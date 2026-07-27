import { useState } from 'react';
import TileView from './TileView';
import { tileName } from '../../engine/tiles';
import type { PendingTribute, PlayerId } from '../../engine/state';

const SEEN_KEY = 'mha_seen_tribute';

function hasSeenTribute(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeenTribute(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function TributePanel({
  pt,
  selfId,
  selfHand,
  selfSafeTiles,
  nameOf,
  onOffer,
  onExchange,
}: {
  pt: PendingTribute;
  selfId: PlayerId;
  selfHand: number[];
  selfSafeTiles: number[];
  nameOf: (id: PlayerId) => string;
  onOffer: (tile: number) => void;
  onExchange: (giveTile: number | undefined, takeFrom: PlayerId | undefined) => void;
}) {
  const [firstTime] = useState(() => !hasSeenTribute());
  const [takeFrom, setTakeFrom] = useState<PlayerId | undefined>(undefined);
  const [giveTile, setGiveTile] = useState<number | undefined>(undefined);

  const winnerName = nameOf(pt.winner);
  const safe = new Set(selfSafeTiles);

  // collect 阶段：人类是上贡者，选1张非安全手牌上贡
  if (pt.stage === 'collect') {
    const pool = [...new Set(selfHand.filter((t) => !safe.has(t)))];
    return (
      <div className="glass-strong rounded-2xl p-4">
        {firstTime && (
          <div className="mb-3 rounded-lg bg-amber-900/40 p-2 text-[11px] leading-relaxed text-amber-100">
            <span className="font-bold text-gold">上贡机制（首次触发）：</span>
            有人和牌且番数大于 0 时，每位应上贡玩家需从手牌中交出 1 张牌给和牌者看；和牌者可选择用自己的 1 张牌与其中 1 张上贡牌交换。安全牌不能作为上贡牌。
          </div>
        )}
        <div className="mb-2 text-sm font-bold text-gold">
          上贡 · 选择 1 张手牌上贡给 <span className="text-amber-300">{winnerName}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pool.map((t, i) => (
            <TileView
              key={i}
              tile={t}
              size="lg"
              hoverable={false}
              onClick={() => { markSeenTribute(); onOffer(t); }}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">安全牌已锁定，不能上贡。点击一张牌即提交。</p>
      </div>
    );
  }

  // exchange 阶段：人类是和牌者，查看上贡牌并选交换
  const validOffers = pt.offers.filter((o) => o.tile !== null && o.tile >= 0);
  return (
    <div className="glass-strong rounded-2xl p-4">
      {firstTime && (
        <div className="mb-3 rounded-lg bg-amber-900/40 p-2 text-[11px] leading-relaxed text-amber-100">
          <span className="font-bold text-gold">上贡机制（首次触发）：</span>
          你和牌了！上贡者各交出 1 张牌给你看，你可以选择用自己的 1 张牌换入其中 1 张，或放弃交换。
        </div>
      )}
      <div className="mb-2 text-sm font-bold text-gold">上贡 · 你是和牌者，选择是否交换</div>

      <div className="mb-2">
        <div className="mb-1 text-[11px] text-muted">上贡牌（点选要换入的 1 张）：</div>
        <div className="flex flex-wrap gap-2">
          {validOffers.map((o) => (
            <div
              key={o.from}
              onClick={() => setTakeFrom(o.from)}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-1 transition ${
                takeFrom === o.from ? 'border-gold bg-gold/10' : 'border-transparent hover:border-amber-400/50'
              }`}
            >
              <TileView tile={o.tile!} size="md" hoverable={false} selected={takeFrom === o.from} />
              <span className="text-[10px] text-muted">{nameOf(o.from)}</span>
            </div>
          ))}
          {validOffers.length === 0 && <span className="text-[11px] text-muted">无可用上贡牌</span>}
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[11px] text-muted">你的手牌（点选要交出的 1 张）：</div>
        <div className="flex flex-wrap gap-1.5">
          {selfHand.map((t, i) => (
            <TileView
              key={i}
              tile={t}
              size="md"
              hoverable={false}
              selected={giveTile === t}
              onClick={() => setGiveTile(t)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { markSeenTribute(); onExchange(undefined, undefined); }}
          className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-bold text-muted hover:bg-ink-600"
        >
          不交换
        </button>
        <button
          disabled={takeFrom === undefined || giveTile === undefined}
          onClick={() => { markSeenTribute(); onExchange(giveTile, takeFrom); }}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-black text-ink-900 transition active:scale-95 disabled:opacity-40"
        >
          确认交换（{giveTile !== undefined ? tileName(giveTile) : '?'} ↔ {takeFrom !== undefined ? nameOf(takeFrom) : '?'}）
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">交换后双方手牌数不变；离开手牌的安全牌会失去标记。</p>
    </div>
  );
}
