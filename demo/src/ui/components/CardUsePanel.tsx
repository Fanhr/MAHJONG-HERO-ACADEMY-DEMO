/**
 * 卡牌/技能的交互选择弹层：按 InteractStep 依次收集「目标 / 手牌 / 想要的牌」，
 * 产出 { target, payload } 供上层派发 useCard / useSkill。
 */
import { useMemo, useState } from 'react';
import TileView from './TileView';
import type { InteractStep } from '../cardInteraction';
import { suitOfIndex } from '../../engine/tiles';

export interface UsePanelResult {
  target?: number;
  payload: { tiles?: number[]; give?: number[]; recvSuit?: string };
}

export interface CardUsePanelProps {
  title: string;
  steps: InteractStep[];
  hand: number[]; // 自己的手牌（牌索引）
  opponents: { id: number; name: string; alive: boolean }[];
  onConfirm: (r: UsePanelResult) => void;
  onCancel: () => void;
}

const ALL34 = Array.from({ length: 34 }, (_, i) => i);

export default function CardUsePanel({ title, steps, hand, opponents, onConfirm, onCancel }: CardUsePanelProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [target, setTarget] = useState<number | undefined>(undefined);
  // handTiles：记录已选手牌的“位置索引”（支持重复牌）
  const [handSel, setHandSel] = useState<Record<number, number[]>>({}); // stepIdx -> hand positions
  // wantTiles：记录选中的牌索引列表（可重复）
  const [wantSel, setWantSel] = useState<Record<number, number[]>>({});
  // pickSuit：记录每一步选中的花色
  const [suitSel, setSuitSel] = useState<Record<number, string>>({});

  const step = steps[stepIdx];

  const result = useMemo<UsePanelResult>(() => {
    const payload: { tiles?: number[]; give?: number[]; recvSuit?: string } = {};
    steps.forEach((st, i) => {
      if (st.kind === 'handTiles' && st.field) {
        payload[st.field] = (handSel[i] ?? []).map((pos) => hand[pos]);
      } else if (st.kind === 'wantTiles' && st.field) {
        payload[st.field] = wantSel[i] ?? [];
      } else if (st.kind === 'pickSuit') {
        if (suitSel[i]) payload.recvSuit = suitSel[i];
      }
    });
    return { target, payload };
  }, [steps, handSel, wantSel, suitSel, hand, target]);

  if (!step) return null;

  const goNext = () => {
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
    else onConfirm(result);
  };
  const goBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else onCancel();
  };

  // 当前步骤是否已满足
  let ready = false;
  if (step.kind === 'target') ready = target !== undefined;
  else if (step.kind === 'handTiles') ready = (handSel[stepIdx]?.length ?? 0) === (step.count ?? 1);
  else if (step.kind === 'wantTiles') ready = (wantSel[stepIdx]?.length ?? 0) === (step.count ?? 1);
  else if (step.kind === 'pickSuit') ready = !!suitSel[stepIdx];

  // 同色约束（乾坤）：已选的第一张决定花色
  const lockedSuit =
    step.kind === 'handTiles' && step.sameSuit && (handSel[stepIdx]?.length ?? 0) > 0
      ? suitOfIndex(hand[handSel[stepIdx][0]])
      : null;

  const toggleHand = (pos: number) => {
    if (step.kind !== 'handTiles') return;
    const cur = handSel[stepIdx] ?? [];
    const count = step.count ?? 1;
    if (cur.includes(pos)) {
      setHandSel({ ...handSel, [stepIdx]: cur.filter((p) => p !== pos) });
      return;
    }
    if (step.sameSuit && cur.length > 0 && suitOfIndex(hand[pos]) !== suitOfIndex(hand[cur[0]])) return;
    if (cur.length >= count) return;
    setHandSel({ ...handSel, [stepIdx]: [...cur, pos] });
  };

  const addWant = (tile: number) => {
    if (step.kind !== 'wantTiles') return;
    const cur = wantSel[stepIdx] ?? [];
    if (cur.length >= (step.count ?? 1)) return;
    setWantSel({ ...wantSel, [stepIdx]: [...cur, tile] });
  };
  const clearWant = () => setWantSel({ ...wantSel, [stepIdx]: [] });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-2xl rounded-2xl p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-black text-gold">{title}</h3>
          <span className="text-xs text-muted">
            步骤 {stepIdx + 1}/{steps.length}
          </span>
        </div>
        <p className="mb-4 text-sm text-parchment">{step.prompt}</p>

        {/* 目标选择 */}
        {step.kind === 'target' && (
          <div className="flex flex-wrap gap-2">
            {opponents
              .filter((o) => o.alive)
              .map((o) => (
                <button
                  key={o.id}
                  onClick={() => setTarget(o.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition active:scale-95 ${
                    target === o.id
                      ? 'bg-gradient-to-r from-gold-bright to-blood text-white shadow-gold'
                      : 'bg-ink-700 text-parchment hover:bg-ink-600'
                  }`}
                >
                  {o.name}
                </button>
              ))}
          </div>
        )}

        {/* 手牌选择 */}
        {step.kind === 'handTiles' && (
          <div>
            {step.sameSuit && (
              <div className="mb-2 text-[11px] text-muted">
                需同一花色{lockedSuit ? `（已锁定 ${suitCn(lockedSuit)}）` : ''}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {hand.map((t, pos) => {
                const sel = (handSel[stepIdx] ?? []).includes(pos);
                const blocked =
                  !!lockedSuit && !sel && suitOfIndex(t) !== lockedSuit;
                return (
                  <TileView
                    key={pos}
                    tile={t}
                    size="md"
                    selected={sel}
                    dim={blocked}
                    onClick={blocked ? undefined : () => toggleHand(pos)}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-xs text-muted">
              已选 {(handSel[stepIdx]?.length ?? 0)} / {step.count}
            </div>
          </div>
        )}

        {/* 想要的牌（34 全牌，可重复） */}
        {step.kind === 'wantTiles' && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted">
              <span>
                已选 {(wantSel[stepIdx]?.length ?? 0)} / {step.count}
              </span>
              <button onClick={clearWant} className="rounded bg-ink-700 px-2 py-0.5 text-[11px] hover:bg-ink-600">
                清空
              </button>
              <span className="flex gap-1">
                {(wantSel[stepIdx] ?? []).map((t, i) => (
                  <TileView key={i} tile={t} size="sm" />
                ))}
              </span>
            </div>
            <div className="max-h-[240px] overflow-y-auto scroll-slim">
              <div className="flex flex-wrap gap-1">
                {ALL34.map((t) => (
                  <TileView key={t} tile={t} size="sm" onClick={() => addWant(t)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 花色选择（换回花色） */}
        {step.kind === 'pickSuit' && (
          <div className="flex gap-2">
            {(['m', 'p', 's'] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setSuitSel({ ...suitSel, [stepIdx]: sc })}
                className={`rounded-lg px-6 py-3 text-base font-bold transition active:scale-95 ${
                  suitSel[stepIdx] === sc
                    ? 'bg-gradient-to-r from-gold-bright to-blood text-white shadow-gold'
                    : 'bg-ink-700 text-parchment hover:bg-ink-600'
                }`}
              >
                {suitCn(sc)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <button onClick={goBack} className="rounded-lg bg-ink-700 px-4 py-2 text-sm text-muted hover:bg-ink-600">
            {stepIdx > 0 ? '上一步' : '取消'}
          </button>
          <button
            onClick={goNext}
            disabled={!ready}
            className={`rounded-lg px-5 py-2 text-sm font-bold transition active:scale-95 ${
              ready
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white'
                : 'cursor-not-allowed bg-ink-700 text-muted'
            }`}
          >
            {stepIdx < steps.length - 1 ? '下一步' : '确认使用'}
          </button>
        </div>
      </div>
    </div>
  );
}

function suitCn(s: string): string {
  return s === 'm' ? '万' : s === 'p' ? '筒' : s === 's' ? '条' : '字';
}
