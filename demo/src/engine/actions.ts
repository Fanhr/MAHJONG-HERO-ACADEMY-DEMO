/**
 * 玩家/AI 可执行的动作（Action）联合类型。
 * 引擎的 reducer 接收 Action 并返回新状态；AI 的 decide() 只能基于投影视图产出 Action。
 */
import type { PlayerId } from './state';
import type { Suit } from './tiles';

export type Action =
  | { type: 'useSkill'; skillId: string; target?: PlayerId; payload?: Record<string, unknown> }
  | { type: 'pickCard'; cardId: string | null; replaceIndex?: number } // 抽卡阶段抽 3 选 1
  | { type: 'rerollCards' } // 花 1AP 重抽
  | { type: 'useCard'; cardId: string; target?: PlayerId; payload?: Record<string, unknown> }
  | { type: 'endAction' } // 结束“技能与技能卡”阶段
  | { type: 'drawTile' }
  | { type: 'keepDrawn'; tile: number } // 多多益善：保留多摸中的一张（另一张放牌山底部）
  | { type: 'declareTsumo' } // 自摸和牌
  | { type: 'ankan'; tile: number } // 自家暗杠
  | { type: 'kakan'; tile: number } // 自家加杠
  | { type: 'setSafeTiles'; tiles: number[]; player?: PlayerId } // 摸切阶段指定自己的安全牌
  | { type: 'confirmRoundSafety'; tiles?: number[] } // 荒牌后确认本局要保留至下一局的安全牌
  | { type: 'discard'; tile: number }
  // 副露响应
  | { type: 'respondRon' }
  | { type: 'respondKan'; tiles: number[] }
  | { type: 'respondPon'; tiles: number[] }
  | { type: 'respondChi'; tiles: number[] }
  | { type: 'respondPass' };

export type ActionType = Action['type'];
export type { Suit };
