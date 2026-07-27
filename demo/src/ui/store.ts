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

interface UIStore {
  screen: 'select' | 'briefing' | 'battle' | 'result';
  state: GameState | null;
  decision: Decision | null;
  humanId: number;
  floaters: Floater[];
  attacks: Attack[];
  lastSeq: number;
  busy: boolean;
  demoResult: 'pass' | 'fail' | null;

  newGame: (heroId?: HeroId, seed?: number) => void;
  humanAction: (action: Parameters<typeof applyAction>[1]) => void;
  toSelect: () => void;
  toBriefing: () => void;
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
  lastSeq: 0,
  busy: false,
  demoResult: null,

  toSelect: () => set({ screen: 'select', state: null, decision: null, floaters: [], attacks: [], demoResult: null }),

  newGame: (_heroId, seed = Math.floor(Math.random() * 1e9)) => {
    // 玩家固定为「咯哒」(山鸣学院)，3 名人机为「爱麻鸽1~3号」
    const heroes: HeroChoice[] = [
      { heroId: 'geda', isAI: false, name: '咯哒（你）' },
      { heroId: 'aimage', isAI: true, name: '爱麻鸽1号' },
      { heroId: 'aimage', isAI: true, name: '爱麻鸽2号' },
      { heroId: 'aimage', isAI: true, name: '爱麻鸽3号' },
    ];
    const s = startGame({ seed, heroes });
    set({ screen: 'battle', state: s, decision: null, floaters: [], attacks: [], lastSeq: 0, busy: false, demoResult: null });
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
    for (const e of fresh) {
      if ((e.type === 'damage' || e.type === 'skill-damage') && e.data) {
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
    if (add.length) {
      set((st) => ({ floaters: [...st.floaters, ...add] }));
      for (const f of add) {
        setTimeout(() => set((st) => ({ floaters: st.floaters.filter((x) => x.id !== f.id) })), 1400);
      }
    }
    set({ lastSeq: s.seqCounter });
  },
}));
