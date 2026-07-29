import { create } from 'zustand';
import { registerAll } from '../engine/register';
import { startGame, getDecision, applyAction, type Decision } from '../engine/turnMachine';
import { startNextRound } from '../engine/round';
import { aiDecide } from '../ai/simpleAI';
import type { GameState, HeroChoice, HeroId } from '../engine/state';

registerAll();

const AI_DELAY = 560; // AI 出手节奏（毫秒），便于观战
/** demo 关卡：3 局循环内存活即通关。 */
const DEMO_MAX_ROUNDS = 3;

export interface Floater {
  id: string;
  seat: number;
  amount: number;
  label?: string;
  heal?: boolean;
}

/** 一次伤害飞行动画：从来源座位指向目标座位。 */
export interface Attack {
  id: string;
  from: number;
  to: number;
}

/** 卡牌激活弹窗：直观展示“某玩家因某卡实现了某效果”。 */
export interface CardToast {
  id: string;
  playerName: string;
  cardName: string;
  desc: string;
}

interface UIStore {
  screen: 'select' | 'briefing' | 'battle' | 'result';
  state: GameState | null;
  decision: Decision | null;
  humanId: number;
  floaters: Floater[];
  attacks: Attack[];
  toasts: CardToast[];
  lastSeq: number;
  busy: boolean;
  demoResult: 'pass' | 'fail' | null;
  /** 首次获得金豆的引导浮层是否正在显示。 */
  showGoldGuide: boolean;

  newGame: (heroId?: HeroId, seed?: number) => void;
  humanAction: (action: Parameters<typeof applyAction>[1]) => void;
  toSelect: () => void;
  toBriefing: () => void;
  dismissGoldGuide: () => void;
  _advance: () => void;
  _emitFloaters: (s: GameState) => void;
  _finish: (s: GameState) => void;
}

export const useGame = create<UIStore>((set, get) => ({
  screen: 'select',
  state: null,
  decision: null,
  humanId: 0,
  floaters: [],
  attacks: [],
  toasts: [],
  lastSeq: 0,
  busy: false,
  demoResult: null,
  showGoldGuide: false,

  dismissGoldGuide: () => {
    set({ showGoldGuide: false });
    try {
      localStorage.setItem('mha_seen_gold', '1');
    } catch {
      /* ignore */
    }
  },

  toSelect: () => set({ screen: 'select', state: null, decision: null, floaters: [], attacks: [], toasts: [], demoResult: null, showGoldGuide: false }),

  newGame: (_heroId, seed = Math.floor(Math.random() * 1e9)) => {
    // 玩家固定为「咯哒」(山鸣学院)，3 名人机为「爱麻鸽1~3号」
    const heroes: HeroChoice[] = [
      { heroId: 'geda', isAI: false, name: '咯哒（你）' },
      { heroId: 'aimage', isAI: true, name: '爱麻鸽1号' },
      { heroId: 'aimage', isAI: true, name: '爱麻鸽2号' },
      { heroId: 'aimage', isAI: true, name: '爱麻鸽3号' },
    ];
    const s = startGame({ seed, heroes });
    set({ screen: 'battle', state: s, decision: null, floaters: [], attacks: [], toasts: [], lastSeq: 0, busy: false, demoResult: null, showGoldGuide: false });
    get()._advance();
  },

  toBriefing: () => set({ screen: 'briefing' }),

  humanAction: (action) => {
    const s = get().state;
    if (!s) return;
    const ns = applyAction(s, action);
    set({ state: ns, decision: null });
    get()._emitFloaters(ns);
    get()._advance();
  },

  _finish: (s) => {
    const human = s.players[get().humanId];
    set({ screen: 'result', decision: null, busy: false, demoResult: human.alive ? 'pass' : 'fail' });
  },

  _advance: () => {
    let s = get().state;
    if (!s) return;
    // 玩家阵亡即判定入学测试失败
    if (!s.players[get().humanId].alive) {
      get()._finish(s);
      return;
    }
    if (s.phase === 'gameOver') {
      get()._finish(s);
      return;
    }
    if (s.phase === 'roundOver') {
      // demo：满 3 局即结束关卡（存活=通关）
      if (s.roundNumber >= DEMO_MAX_ROUNDS) {
        get()._finish(s);
        return;
      }
      s = startNextRound(s);
      set({ state: s });
      get()._emitFloaters(s);
      // startNextRound 可能因仅剩 1 人而直接 gameOver
      if (s.phase === 'gameOver') {
        get()._finish(s);
        return;
      }
      set({ busy: true });
      setTimeout(() => get()._advance(), AI_DELAY);
      return;
    }
    const d = getDecision(s);
    if (!d) return;
    if (d.actor === get().humanId) {
      set({ decision: d, busy: false });
      return;
    }
    set({ busy: true });
    setTimeout(() => {
      const cur = get().state;
      if (!cur) return;
      const dd = getDecision(cur);
      if (!dd || dd.actor === get().humanId) {
        set({ decision: dd, busy: false });
        return;
      }
      const ns = applyAction(cur, aiDecide(cur, dd));
      set({ state: ns });
      get()._emitFloaters(ns);
      get()._advance();
    }, AI_DELAY);
  },

  _emitFloaters: (s) => {
    const last = get().lastSeq;
    const fresh = s.events.filter((e) => e.seq > last);
    const add: Floater[] = [];
    const beams: Attack[] = [];
    const toasts: CardToast[] = [];
    for (const e of fresh) {
      if (e.type === 'card-activate' && e.data) {
        const data = e.data as Record<string, unknown>;
        const player = Number(data.player);
        const cardName = typeof data.name === 'string' ? data.name : '';
        const desc = typeof data.desc === 'string' ? data.desc : '';
        if (!Number.isNaN(player) && cardName) {
          toasts.push({
            id: `t${e.seq}-${Math.random().toString(36).slice(2, 6)}`,
            playerName: s.players[player]?.name ?? `玩家${player}`,
            cardName,
            desc,
          });
        }
      } else if (e.type === 'gold' && e.data) {
        const data = e.data as Record<string, unknown>;
        const player = Number(data.player);
        const amount = Number(data.amount);
        const kind = typeof data.kind === 'string' ? data.kind : 'instant';
        if (!Number.isNaN(player) && !Number.isNaN(amount)) {
          toasts.push({
            id: `t${e.seq}-${Math.random().toString(36).slice(2, 6)}`,
            playerName: s.players[player]?.name ?? `玩家${player}`,
            cardName: kind === 'settle' ? '金豆终局奖励' : '金豆奖励',
            desc: kind === 'settle' ? `结算奖励 +${amount} 金豆` : `和牌获得 +${amount} 金豆`,
          });
          // 首次获得金豆即时奖励时弹引导
          if (kind === 'instant' && !get().showGoldGuide) {
            try {
              if (localStorage.getItem('mha_seen_gold') !== '1') set({ showGoldGuide: true });
            } catch {
              set({ showGoldGuide: true });
            }
          }
        }
      } else if ((e.type === 'damage' || e.type === 'skill-damage') && e.data) {
        const data = e.data as Record<string, unknown>;
        const seat = Number(data.target);
        const amount = Number(data.amount);
        const source = Number(data.source);
        const label = typeof data.label === 'string' ? data.label : undefined;
        if (!Number.isNaN(seat) && !Number.isNaN(amount)) {
          add.push({ id: `${e.seq}-${Math.random().toString(36).slice(2, 6)}`, seat, amount, label });
          if (!Number.isNaN(source) && source !== seat) {
            beams.push({ id: `b${e.seq}-${Math.random().toString(36).slice(2, 6)}`, from: source, to: seat });
          }
        }
      } else if (e.type === 'heal' && e.data) {
        const data = e.data as Record<string, unknown>;
        const seat = Number(data.target);
        const amount = Number(data.amount);
        const label = typeof data.label === 'string' ? data.label : undefined;
        if (!Number.isNaN(seat) && !Number.isNaN(amount)) {
          add.push({ id: `${e.seq}-${Math.random().toString(36).slice(2, 6)}`, seat, amount, label, heal: true });
        }
      }
    }
    if (beams.length) {
      set((st) => ({ attacks: [...st.attacks, ...beams] }));
      for (const b of beams) {
        setTimeout(() => set((st) => ({ attacks: st.attacks.filter((x) => x.id !== b.id) })), 700);
      }
    }
    if (toasts.length) {
      set((st) => ({ toasts: [...st.toasts, ...toasts] }));
      for (const t of toasts) {
        setTimeout(() => set((st) => ({ toasts: st.toasts.filter((x) => x.id !== t.id) })), 2800);
      }
    }
    if (add.length) {
      set((st) => ({ floaters: [...st.floaters, ...add] }));
      for (const f of add) {
        setTimeout(() => set((st) => ({ floaters: st.floaters.filter((x) => x.id !== f.id) })), 1400);
      }
    }
    set({ lastSeq: s.seqCounter });
  },
}));
