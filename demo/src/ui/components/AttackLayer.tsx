import { useEffect, useState } from 'react';
import type { Attack } from '../store';

/** 各座位在战斗区中的大致锚点（容器百分比坐标）。 */
const SEAT_POS: Record<number, { x: number; y: number }> = {
  0: { x: 50, y: 72 }, // 自己（底部）
  1: { x: 88, y: 40 }, // 右
  2: { x: 50, y: 12 }, // 对面（顶部）
  3: { x: 12, y: 40 }, // 左
};

function Beam({ from, to }: { from: number; to: number }) {
  const a = SEAT_POS[from] ?? { x: 50, y: 50 };
  const b = SEAT_POS[to] ?? { x: 50, y: 50 };
  const [pos, setPos] = useState(a);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPos(b));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const len = Math.hypot(b.x - a.x, b.y - a.y);

  return (
    <>
      {/* 轨迹线（快速淡出） */}
      <div
        className="absolute h-[3px] origin-left rounded-full bg-gradient-to-r from-transparent via-alert to-yellow-300 opacity-70 animate-trace-fade"
        style={{
          left: `${a.x}%`,
          top: `${a.y}%`,
          width: `${len}%`,
          transform: `rotate(${angle}deg)`,
        }}
      />
      {/* 飞行弹体：从来源移动到目标 */}
      <div
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-200 shadow-[0_0_14px_5px_rgba(239,68,68,0.85)] transition-all ease-out [transition-duration:420ms]"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      />
    </>
  );
}

export default function AttackLayer({ attacks }: { attacks: Attack[] }) {
  if (attacks.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {attacks.map((a) => (
        <Beam key={a.id} from={a.from} to={a.to} />
      ))}
    </div>
  );
}
