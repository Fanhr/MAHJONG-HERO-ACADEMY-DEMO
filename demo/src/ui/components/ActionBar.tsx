import type { Action } from '../../engine/actions';
import type { Decision } from '../../engine/turnMachine';
import { tileName } from '../../engine/tiles';
import { skillSteps } from '../cardInteraction';

const SKILL_CN: Record<string, string> = { huigou: '回购·换牌' };

function label(a: Action): string {
  switch (a.type) {
    case 'useSkill':
      return SKILL_CN[a.skillId] ?? `技能 ${a.skillId}`;
    case 'endAction':
      return '结束技能阶段';
    case 'declareTsumo':
      return '自摸和牌！';
    case 'ankan':
      return `暗杠 ${tileName(a.tile)}`;
    case 'kakan':
      return `加杠 ${tileName(a.tile)}`;
    case 'respondRon':
      return '荣和！';
    case 'respondPon':
      return '碰';
    case 'respondKan':
      return '杠';
    case 'respondChi':
      return `吃 ${a.tiles.map(tileName).join('')}`;
    case 'respondPass':
      return '过';
    default:
      return a.type;
  }
}

function tone(a: Action): string {
  if (a.type === 'declareTsumo' || a.type === 'respondRon')
    return 'bg-gradient-to-r from-gold-bright to-blood text-white shadow-gold animate-pulse';
  if (a.type === 'respondPass' || a.type === 'endAction')
    return 'bg-ink-700 text-muted hover:bg-ink-600';
  if (a.type === 'useSkill') return 'bg-gradient-to-r from-sky-600 to-indigo-700 text-white';
  return 'bg-gradient-to-r from-blood to-blood-light text-white';
}

// 由卡牌区 / 点击手牌处理的动作，不在此渲染
const HIDDEN = new Set<Action['type']>([
  'discard',
  'setSafeTiles',
  'pickCard',
  'rerollCards',
  'useCard',
  'keepDrawn',
]);

export default function ActionBar({
  decision,
  onAction,
  onSkillInteractive,
  hint,
}: {
  decision: Decision;
  onAction: (a: Action) => void;
  onSkillInteractive: (skillId: string) => void;
  hint: string;
}) {
  const actions = decision.actions.filter((a) => !HIDDEN.has(a.type));
  const click = (a: Action) => {
    if (a.type === 'useSkill' && skillSteps(a.skillId).length > 0) {
      onSkillInteractive(a.skillId);
      return;
    }
    onAction(a);
  };
  if (actions.length === 0) {
    return (
      <div className="glass-strong rounded-2xl p-3 text-xs font-semibold text-gold">{hint}</div>
    );
  }
  return (
    <div className="glass-strong rounded-2xl p-3">
      <div className="mb-2 text-xs font-semibold text-gold">{hint}</div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => click(a)}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition active:scale-95 ${tone(a)}`}
          >
            {label(a)}
          </button>
        ))}
      </div>
    </div>
  );
}
