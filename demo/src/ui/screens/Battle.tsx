import { useState } from 'react';
import { redactStateFor } from '../../engine/redact';
import { useGame } from '../store';
import { heroMeta } from '../heroData';
import OpponentPanel, { type OpponentData } from '../components/OpponentPanel';
import SelfPanel, { type SelfPanelData } from '../components/SelfPanel';
import TableCenter from '../components/TableCenter';
import HandBar from '../components/HandBar';
import ActionBar from '../components/ActionBar';
import TributePanel from '../components/TributePanel';
import CardPanel from '../components/CardPanel';
import CardUsePanel, { type UsePanelResult } from '../components/CardUsePanel';
import SkillGuide from '../components/SkillGuide';
import TenpaiHint from '../components/TenpaiHint';
import LogPanel from '../components/LogPanel';
import AttackLayer from '../components/AttackLayer';
import TileView from '../components/TileView';
import { HoverContext } from '../hoverContext';
import { analyzeTenpai } from '../waits';
import { cardDef } from '../../engine/cards/cardDefs';
import { cardSteps, skillSteps } from '../cardInteraction';
import type { Action } from '../../engine/actions';

const PHASE_CN: Record<string, string> = {
  start: '回合开始',
  drawCard: '抽卡（三选一）',
  action: '技能与技能卡',
  drawTile: '摸牌',
  discard: '切牌',
  awaitMeld: '鸣牌响应',
  tribute: '和牌上贡',
  roundSafety: '荒牌',
  roundOver: '本局结束',
  gameOver: '对局结束',
};

type Interactive = { kind: 'card' | 'skill'; id: string };

export default function Battle() {
  const state = useGame((s) => s.state);
  const decision = useGame((s) => s.decision);
  const humanId = useGame((s) => s.humanId);
  const floaters = useGame((s) => s.floaters);
  const attacks = useGame((s) => s.attacks);
  const busy = useGame((s) => s.busy);
  const humanAction = useGame((s) => s.humanAction);

  const [interactive, setInteractive] = useState<Interactive | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [seenInspectSeq, setSeenInspectSeq] = useState(-1);
  const [showSafeGuide, setShowSafeGuide] = useState(() => {
    try {
      return localStorage.getItem('mha_seen_safe') !== '1';
    } catch {
      return true;
    }
  });
  const dismissSafeGuide = () => {
    setShowSafeGuide(false);
    try {
      localStorage.setItem('mha_seen_safe', '1');
    } catch {
      /* ignore */
    }
  };

  if (!state) return null;

  const isHumanTurn = decision?.actor === humanId;
  const view = redactStateFor(state, humanId, isHumanTurn ? decision!.actions : []);
  const activeActor = decision?.actor ?? state.turn;
  const seatFloaters = (id: number) => floaters.filter((f) => f.seat === id);

  const oppData = (id: number): OpponentData => {
    const p = view.publicBoard.players[id];
    const meta = heroMeta(p.heroId);
    return {
      id,
      name: p.name,
      heroLabel: meta.name,
      accent: meta.accent,
      hp: p.hp,
      alive: p.alive,
      isTurn: activeActor === id,
      handCount: p.handCount,
      melds: p.melds,
      hasEgg: p.eggIndicator !== null,
      safeCount: p.safeTileCount,
      statuses: p.statuses,
      floaters: seatFloaters(id),
    };
  };

  const self = view.self;
  const selfPub = view.publicBoard.players[humanId];
  const selfMeta = heroMeta(self.heroId);
  const selfData: SelfPanelData = {
    name: self.name,
    heroLabel: selfMeta.name,
    accent: selfMeta.accent,
    hp: self.hp,
    ap: self.ap,
    apMax: self.apMax,
    alive: selfPub.alive,
    isTurn: activeActor === humanId,
    melds: self.melds,
    eggIndicator: self.eggIndicator,
    safeCount: self.safeTiles.length,
    statuses: self.statuses,
    floaters: seatFloaters(humanId),
  };

  // 切牌可选
  const discardable = new Set<number>();
  if (isHumanTurn) for (const a of decision!.actions) if (a.type === 'discard') discardable.add(a.tile);
  const drawnTile = state.turn === humanId && !state.pendingDraw ? state.drawnTile : null;

  // 安全牌：仅在自己的摸切阶段可指定（ver2.0 §0.3.1）
  const isRoundSafety = state.phase === 'roundSafety' && decision?.actor === humanId;
  const handChanging = !!interactive || !!state.pendingDraw;
  const canSetSafe =
    decision?.actor === humanId && selfPub.alive && !handChanging && state.phase === 'discard';

  // 多多益善保留选择
  const keepActs = isHumanTurn
    ? (decision!.actions.filter((a) => a.type === 'keepDrawn') as Extract<Action, { type: 'keepDrawn' }>[])
    : [];

  // 听牌提示（仅自己存活、非保留选择态时计算）
  const tenpai = selfPub.alive && keepActs.length === 0 ? analyzeTenpai(state, humanId) : [];

  const hint = !decision
    ? busy
      ? 'AI 行动中…'
      : '结算中…'
    : `【${PHASE_CN[state.phase] ?? state.phase}】 轮到你行动`;

  const opponents = view.publicBoard.players
    .filter((p) => p.id !== humanId)
    .map((p) => ({ id: p.id, name: p.name, alive: p.alive }));

  const onConfirmInteractive = (r: UsePanelResult) => {
    if (!interactive) return;
    if (interactive.kind === 'card') {
      humanAction({ type: 'useCard', cardId: interactive.id, target: r.target, payload: r.payload });
    } else {
      humanAction({ type: 'useSkill', skillId: interactive.id, target: r.target, payload: r.payload });
    }
    setInteractive(null);
  };

  const activeSteps = interactive
    ? interactive.kind === 'card'
      ? cardSteps(interactive.id)
      : skillSteps(interactive.id)
    : [];
  const activeTitle = interactive
    ? interactive.kind === 'card'
      ? `打出「${cardDef(interactive.id)?.name}」`
      : '技能 · 选择'
    : '';

  return (
    <HoverContext.Provider value={{ hovered, setHovered }}>
    <div className="relative flex min-h-full flex-col bg-radial-table px-3 py-3">
      {/* 伤害飞行动画层（来源 → 目标） */}
      <AttackLayer attacks={attacks} />
      {/* 顶栏 */}
      <div className="glass mb-2 flex items-center justify-between rounded-xl px-4 py-2 text-sm">
        <span className="font-bold text-gold">麻神力攻学院 · 入学测试</span>
        <div className="flex items-center gap-4 text-muted">
          <span>第 {state.roundNumber} 局</span>
          <span>牌墙 {view.publicBoard.wallRemaining} 张</span>
          <span className="text-parchment">行动：{state.players[activeActor].name}</span>
          <button
            onClick={() => setShowGuide(true)}
            className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-700 px-3 py-1 text-xs font-bold text-white transition active:scale-95"
          >
            技能说明
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        {/* 左：牌桌 + 手牌 + 操作 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {/* 对家（上） */}
          <div className="mx-auto w-full max-w-md">
            <OpponentPanel data={oppData(2)} />
          </div>

          {/* 左 | 中央牌河 | 右 */}
          <div className="grid min-h-[240px] flex-1 grid-cols-[150px_1fr_150px] gap-2 md:grid-cols-[180px_1fr_180px]">
            <div className="flex items-center">
              <OpponentPanel data={oppData(3)} />
            </div>
            <TableCenter
              wallRemaining={view.publicBoard.wallRemaining}
              winCount={view.publicBoard.winRecords.length}
              busy={busy}
              phaseLabel={PHASE_CN[state.phase] ?? state.phase}
              discards={{
                top: view.publicBoard.players[2].discards,
                left: view.publicBoard.players[3].discards,
                right: view.publicBoard.players[1].discards,
                bottom: view.publicBoard.players[0].discards,
              }}
            />
            <div className="flex items-center">
              <OpponentPanel data={oppData(1)} />
            </div>
          </div>

          {/* 自己信息条 */}
          <SelfPanel data={selfData} />

          {/* 多多益善：保留选择 */}
          {keepActs.length > 0 && (
            <div className="glass-strong rounded-2xl p-3">
              <div className="mb-2 text-xs font-semibold text-sky-300">【多多益善】选择保留 1 张（另一张放回牌山底部）</div>
              <div className="flex gap-2">
                {keepActs.map((a, i) => (
                  <TileView key={i} tile={a.tile} size="lg" onClick={() => humanAction({ type: 'keepDrawn', tile: a.tile })} />
                ))}
              </div>
            </div>
          )}

          {/* 荒牌流局：选择要保留至下一局的安全牌并确认 */}
          {isRoundSafety && (
            <div className="glass-strong rounded-2xl p-3">
              <div className="mb-2 text-xs font-semibold text-amber-300">
                荒牌流局 · 选择要保留至下一局的安全牌（{self.safeTiles.length}/4）
              </div>
              <div className="mb-2 text-[11px] text-muted">
                点击下方手牌加入/移出安全牌；其余牌（含牌墙、弃牌、副露）将全部重洗后重新发牌。
              </div>
              <button
                onClick={() => humanAction({ type: 'confirmRoundSafety', tiles: [...self.safeTiles] })}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-bold text-ink-900 transition active:scale-95"
              >
                确认保留并进入下一局
              </button>
            </div>
          )}

          {/* 安全牌提示（仅摸切阶段，右键手牌切换） */}
          {canSetSafe && !isRoundSafety && (
            <div className="glass-strong flex items-center justify-between rounded-xl px-3 py-2">
              <span className="text-[11px] text-muted">
                安全牌：<span className="text-amber-300">{self.safeTiles.length}/4</span> ·
                <span className="text-amber-200"> 右键手牌</span> 切换指定（免疫置换与干扰）
              </span>
            </div>
          )}

          {/* 听牌提示 */}
          {tenpai.length > 0 && <TenpaiHint data={tenpai} />}

          {/* 手牌 */}
          <HandBar
            hand={self.hand}
            discardable={discardable}
            drawnTile={drawnTile}
            onDiscard={(t) => humanAction({ type: 'discard', tile: t })}
            safeTiles={self.safeTiles}
            canSafe={canSetSafe}
            onSetSafe={(tiles) => humanAction({ type: 'setSafeTiles', tiles, player: humanId })}
          />

          {/* 操作栏 / 上贡面板 */}
          {state.phase === 'tribute' && decision?.actor === humanId && self.pendingTribute ? (
            <TributePanel
              pt={self.pendingTribute}
              selfId={humanId}
              selfHand={self.hand}
              selfSafeTiles={self.safeTiles}
              nameOf={(id) => state.players[id].name}
              onOffer={(tile) => humanAction({ type: 'tributeOffer', tile })}
              onExchange={(g, t) => humanAction({ type: 'tributeExchange', giveTile: g, takeFrom: t })}
            />
          ) : isHumanTurn && keepActs.length === 0 && !isRoundSafety ? (
            <ActionBar
              decision={decision!}
              onAction={(a) => humanAction(a)}
              onSkillInteractive={(skillId) => setInteractive({ kind: 'skill', id: skillId })}
              hint={hint}
            />
          ) : (
            keepActs.length === 0 && !isRoundSafety && <div className="glass-strong rounded-2xl p-3 text-sm text-muted">{hint}</div>
          )}
        </div>

        {/* 右：卡牌区 + 战报 */}
        <div className="flex w-full flex-col gap-2 lg:w-[340px]">
          <CardPanel
            view={view}
            decision={decision}
            isHumanTurn={!!isHumanTurn}
            onAction={(a) => humanAction(a)}
            onUseCardInteractive={(cardId) => setInteractive({ kind: 'card', id: cardId })}
          />
          <div className="min-h-[160px] flex-1">
            <LogPanel items={view.publicBoard.recentEvents} />
          </div>
        </div>
      </div>

      {/* 交互弹层 */}
      {interactive && (
        <CardUsePanel
          title={activeTitle}
          steps={activeSteps}
          hand={self.hand}
          opponents={opponents}
          onConfirm={onConfirmInteractive}
          onCancel={() => setInteractive(null)}
        />
      )}

      {/* 角色技能一览 */}
      {showGuide && (
        <SkillGuide
          onClose={() => setShowGuide(false)}
          activeHeroes={state.players.map((p) => p.heroId)}
        />
      )}

      {/* 安全牌首次摸切引导 */}
      {canSetSafe && showSafeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-md rounded-2xl p-5">
            <h3 className="mb-2 text-lg font-black text-gold">安全牌 · 摸切阶段可用</h3>
            <p className="mb-3 text-sm leading-relaxed text-parchment">
              在<span className="text-amber-300">摸切阶段</span>，你可以<span className="text-amber-300">右键点击手牌</span>将其指定为安全牌（最多 4 张）。
              被指定的牌免受一切干扰类技能卡与技能的影响（如置换、偷牌等）。
            </p>
            <ul className="mb-3 list-disc pl-5 text-[12px] text-muted">
              <li>右键已指定的牌可撤销指定</li>
              <li>左键仍照常打出牌</li>
              <li>荒牌时全部安全牌标记清除，不跨局保留</li>
            </ul>
            <div className="flex justify-end">
              <button
                onClick={dismissSafeGuide}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-sm font-bold text-ink-900 active:scale-95"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 我要验牌：仅对使用者展示对手手牌 */}
      {view.inspect && view.inspect.seq !== seenInspectSeq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-lg rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-gold">我要验牌 · {view.inspect.targetName} 的手牌</h3>
              <span className="text-xs text-muted">{view.inspect.tiles.length} 张（不含其安全牌）</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {[...view.inspect.tiles].sort((a, b) => a - b).map((t, i) => (
                <TileView key={i} tile={t} size="md" hoverable={false} />
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSeenInspectSeq(view.inspect!.seq)}
                className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-2 text-sm font-bold text-white transition active:scale-95"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </HoverContext.Provider>
  );
}
