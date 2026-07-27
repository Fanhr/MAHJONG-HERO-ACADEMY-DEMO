/**
 * 卡牌区：贯穿全程显示「已抽取（备用区）」卡牌；
 * 抽卡阶段显示三选一候选（含备用区满时替换）；用卡阶段可点击备用区卡牌打出。
 */
import { useState } from 'react';
import CardView from './CardView';
import { cardDef } from '../../engine/cards/cardDefs';
import { cardSteps } from '../cardInteraction';
import type { Action } from '../../engine/actions';
import type { Decision } from '../../engine/turnMachine';
import type { RedactedView } from '../../engine/redact';

export interface CardPanelProps {
  view: RedactedView;
  decision: Decision | null;
  isHumanTurn: boolean;
  onAction: (a: Action) => void;
  onUseCardInteractive: (cardId: string) => void;
}

export default function CardPanel({ view, decision, isHumanTurn, onAction, onUseCardInteractive }: CardPanelProps) {
  const self = view.self;
  const phase = view.publicBoard.phase;
  const acts = isHumanTurn && decision ? decision.actions : [];

  const [replaceFor, setReplaceFor] = useState<string | null>(null);

  const isDrawPhase = isHumanTurn && phase === 'drawCard';
  const isUsePhase = isHumanTurn && phase === 'action';

  const candidates = acts.filter((a) => a.type === 'pickCard' && a.cardId) as Extract<Action, { type: 'pickCard' }>[];
  const canReroll = acts.some((a) => a.type === 'rerollCards');
  const reserveFull = self.reserve.length >= 3;

  const affordable = new Set(
    acts.filter((a) => a.type === 'useCard').map((a) => (a as Extract<Action, { type: 'useCard' }>).cardId)
  );

  const pick = (cardId: string) => {
    if (reserveFull) {
      setReplaceFor(cardId); // 需选择替换哪张备用卡
    } else {
      onAction({ type: 'pickCard', cardId });
    }
  };
  const doReplace = (index: number) => {
    if (replaceFor) {
      onAction({ type: 'pickCard', cardId: replaceFor, replaceIndex: index });
      setReplaceFor(null);
    }
  };
  const playCard = (cardId: string) => {
    if (cardSteps(cardId).length > 0) onUseCardInteractive(cardId);
    else onAction({ type: 'useCard', cardId });
  };

  return (
    <div className="glass-strong flex flex-col gap-3 rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gold">卡牌区</span>
        <span className="text-[11px] text-muted">
          行动点 <span className="font-bold text-gold">{self.ap}</span>/{self.apMax}
        </span>
      </div>

      {/* 抽卡三选一 */}
      {isDrawPhase && (
        <div className="rounded-xl bg-ink-900/40 p-2">
          <div className="mb-2 text-[11px] font-semibold text-sky-300">
            抽卡 · 三选一{reserveFull && !replaceFor ? '（备用区已满，选卡后需替换一张）' : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {candidates.map((a, i) => (
              <CardView key={i} def={cardDef(a.cardId!)!} size="sm" onClick={() => pick(a.cardId!)} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onAction({ type: 'pickCard', cardId: null })}
              className="rounded-lg bg-ink-700 px-3 py-1.5 text-xs text-muted hover:bg-ink-600"
            >
              不选
            </button>
            {canReroll && (
              <button
                onClick={() => onAction({ type: 'rerollCards' })}
                className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                重抽 (1AP)
              </button>
            )}
          </div>
          {replaceFor && (
            <div className="mt-2 text-[11px] text-warn">点击下方备用区中要替换掉的卡（选「{cardDef(replaceFor)?.name}」）</div>
          )}
        </div>
      )}

      {/* 已抽取 · 备用区 */}
      <div>
        <div className="mb-2 text-[11px] font-semibold text-parchment">
          已抽取 · 备用区 {self.reserve.length}/3
        </div>
        {self.reserve.length === 0 ? (
          <div className="rounded-lg bg-ink-900/40 px-3 py-4 text-center text-[11px] text-muted">
            暂无卡牌，抽卡阶段获取
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {self.reserve.map((cid, i) => {
              const def = cardDef(cid)!;
              if (replaceFor) {
                return <CardView key={i} def={def} size="sm" onClick={() => doReplace(i)} note="点此替换" />;
              }
              if (isUsePhase) {
                const ok = affordable.has(cid);
                return (
                  <CardView
                    key={i}
                    def={def}
                    size="sm"
                    disabled={!ok}
                    note={ok ? '点击打出' : `需 ${def.ap}AP`}
                    onClick={ok ? () => playCard(cid) : undefined}
                  />
                );
              }
              return <CardView key={i} def={def} size="sm" />;
            })}
          </div>
        )}
      </div>

      {/* 用卡阶段结束按钮 */}
      {isUsePhase && !replaceFor && (
        <button
          onClick={() => onAction({ type: 'endAction' })}
          className="rounded-lg bg-ink-700 px-3 py-2 text-xs font-semibold text-muted hover:bg-ink-600"
        >
          结束技能与技能卡阶段
        </button>
      )}
    </div>
  );
}
