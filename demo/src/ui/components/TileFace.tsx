/**
 * 真实感麻将牌面（纯 SVG，无外部图片，跨平台一致）。
 * 仅渲染牌面「图案」，白色牌底/边框/高亮等由外层 TileView 负责。
 * 坐标系 viewBox 0..100 x 0..140。
 *   万(m)：中文数字 + 萬
 *   筒(p)：圆点点阵
 *   条(s)：竹节（1 条为鸟）
 *   字(z)：東南西北中發白
 */
import { rankOfIndex, suitOfIndex } from '../../engine/tiles';

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOR = ['東', '南', '西', '北', '中', '發', '白'];

// 每个点数的“点位”布局（用于筒/条），坐标在 100x140 内。
const DOT_LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 70]],
  2: [[50, 40], [50, 100]],
  3: [[28, 36], [50, 70], [72, 104]],
  4: [[32, 42], [68, 42], [32, 98], [68, 98]],
  5: [[32, 42], [68, 42], [50, 70], [32, 98], [68, 98]],
  6: [[32, 38], [68, 38], [32, 70], [68, 70], [32, 102], [68, 102]],
  7: [[30, 30], [50, 30], [70, 30], [34, 74], [66, 74], [34, 106], [66, 106]],
  8: [[35, 28], [65, 28], [35, 56], [65, 56], [35, 84], [65, 84], [35, 112], [65, 112]],
  9: [[28, 34], [50, 34], [72, 34], [28, 70], [50, 70], [72, 70], [28, 106], [50, 106], [72, 106]],
};

const PIN_COLORS = ['#2563eb', '#dc2626', '#16a34a']; // 蓝/红/绿循环，贴近真实筒子配色

function PinDots({ rank }: { rank: number }) {
  const pts = DOT_LAYOUT[rank] ?? [];
  return (
    <>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={12.5} fill={PIN_COLORS[i % 3]} />
          <circle cx={x} cy={y} r={6.5} fill="#fff" />
          <circle cx={x} cy={y} r={3} fill={PIN_COLORS[i % 3]} />
        </g>
      ))}
    </>
  );
}

function Bamboo({ x, y }: { x: number; y: number }) {
  // 一节竹子：绿色圆角竖条 + 中部节纹
  return (
    <g>
      <rect x={x - 5} y={y - 15} width={10} height={30} rx={4} fill="#15803d" />
      <rect x={x - 5} y={y - 2} width={10} height={3} fill="#052e16" opacity={0.6} />
      <rect x={x - 3.5} y={y - 13} width={3} height={26} rx={1.5} fill="#22c55e" opacity={0.7} />
    </g>
  );
}

function Bird() {
  // 1 条：一只简化的鸟（红/绿）
  return (
    <g transform="translate(50 70)">
      <ellipse cx={0} cy={6} rx={17} ry={22} fill="#15803d" />
      <circle cx={0} cy={-16} r={11} fill="#16a34a" />
      <polygon points="0,-24 10,-34 12,-22" fill="#dc2626" />
      <circle cx={4} cy={-18} r={2.2} fill="#fff" />
      <polygon points="8,-15 22,-19 12,-9" fill="#eab308" />
      <path d="M -14 10 Q -30 4 -18 22 Z" fill="#166534" />
    </g>
  );
}

function SouSticks({ rank }: { rank: number }) {
  if (rank === 1) return <Bird />;
  const pts = DOT_LAYOUT[rank] ?? [];
  return (
    <>
      {pts.map(([x, y], i) => (
        <Bamboo key={i} x={x} y={y} />
      ))}
    </>
  );
}

const HONOR_COLOR: Record<number, string> = {
  27: '#1e3a5f', // 東
  28: '#1e3a5f', // 南
  29: '#1e3a5f', // 西
  30: '#1e3a5f', // 北
  31: '#b91c1c', // 中 红
  32: '#15803d', // 發 绿
  33: '#1d4ed8', // 白（蓝框）
};

export default function TileFace({ tile }: { tile: number }) {
  const suit = suitOfIndex(tile);
  const rank = rankOfIndex(tile);

  let content: React.ReactNode = null;
  if (suit === 'm') {
    content = (
      <>
        <text x={50} y={52} textAnchor="middle" fontSize={46} fontWeight={800} fill="#1e293b" fontFamily="serif">
          {CN_NUM[rank - 1]}
        </text>
        <text x={50} y={116} textAnchor="middle" fontSize={44} fontWeight={800} fill="#b91c1c" fontFamily="serif">
          萬
        </text>
      </>
    );
  } else if (suit === 'p') {
    content = <PinDots rank={rank} />;
  } else if (suit === 's') {
    content = <SouSticks rank={rank} />;
  } else {
    const idx = tile - 27;
    if (tile === 33) {
      // 白：蓝色空框
      content = <rect x={22} y={26} width={56} height={88} rx={6} fill="none" stroke="#1d4ed8" strokeWidth={5} />;
    } else {
      content = (
        <text
          x={50}
          y={94}
          textAnchor="middle"
          fontSize={70}
          fontWeight={800}
          fill={HONOR_COLOR[tile] ?? '#1e293b'}
          fontFamily="serif"
        >
          {HONOR[idx]}
        </text>
      );
    }
  }

  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {content}
    </svg>
  );
}
