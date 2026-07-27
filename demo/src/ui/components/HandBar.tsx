import TileView from './TileView';

const MAX_SAFE = 4;

export default function HandBar({
  hand,
  discardable,
  drawnTile,
  onDiscard,
  safeTiles,
  canSafe,
  onSetSafe,
}: {
  hand: number[];
  discardable: Set<number>;
  drawnTile: number | null;
  onDiscard: (tile: number) => void;
  safeTiles: number[]; // 安全牌多重集（物理张数）
  /** 是否处于摸切阶段且可指定安全牌（右键切换）。 */
  canSafe: boolean;
  onSetSafe: (tiles: number[]) => void;
}) {
  const canDiscard = discardable.size > 0;

  // 每种牌的安全张数
  const safeCount = new Map<number, number>();
  for (const t of safeTiles) safeCount.set(t, (safeCount.get(t) ?? 0) + 1);

  // 逐张渲染时，第 o 张（o 从 0 计）在 o < 该种安全张数时视为安全牌
  const occ = new Map<number, number>();

  const toggle = (t: number, isSafe: boolean) => {
    const cur = safeCount.get(t) ?? 0;
    let next: number;
    if (isSafe) {
      next = cur - 1; // 释放一个名额
    } else {
      if (safeTiles.length >= MAX_SAFE) return; // 物理张数封顶
      next = cur + 1;
    }
    const m = new Map(safeCount);
    m.set(t, next);
    const list: number[] = [];
    for (const [val, c] of m) for (let i = 0; i < c; i++) list.push(val);
    onSetSafe(list);
  };

  return (
    <div className="glass-strong rounded-2xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gold">你的手牌</span>
        {canSafe ? (
          <span className="text-[11px] text-amber-300">
            右键手牌切换安全牌（{safeTiles.length}/{MAX_SAFE}）· 左键打出
          </span>
        ) : (
          canDiscard && <span className="text-[11px] text-muted">点击一张牌打出</span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-1.5">
        {hand.map((t, i) => {
          const o = occ.get(t) ?? 0;
          occ.set(t, o + 1);
          const isSafe = o < (safeCount.get(t) ?? 0);
          const ok = discardable.has(t);
          const ctx = (e: React.MouseEvent) => {
            e.preventDefault();
            if (canSafe) toggle(t, isSafe);
          };
          return (
            <TileView
              key={i}
              tile={t}
              size="lg"
              glow={drawnTile !== null && t === drawnTile && i === hand.length - 1}
              dim={canDiscard && !ok}
              locked={isSafe}
              onClick={ok ? () => onDiscard(t) : undefined}
              onContextMenu={ctx}
            />
          );
        })}
      </div>
    </div>
  );
}
