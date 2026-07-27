/**
 * 全局数值常量（对齐《番种精选子集与伤害计算公式》）：
 *  - 所有 demo 角色 HP 统一 100（浮点）
 *  - AP：初始 2，每回合 +1，上限默认 5
 *  - 和牌基础伤害：0 番 = 6，每番 +6；役满 78×n；累计役满（普通番≥13）封顶 78
 */

export const DEFAULT_HP = 100;
export const DEFAULT_AP_INIT = 2;
export const DEFAULT_AP_MAX = 5;
export const AP_REGEN_PER_TURN = 1;

export const HAND_SIZE = 13;
export const PLAYER_COUNT = 4;

export const SAFE_TILE_MAX = 4;
export const CARD_RESERVE_MAX = 3;
export const CARD_DRAW_CANDIDATES = 3; // 每次抽卡揭示 3 张
export const CARD_COOLDOWN_DRAWS = 3; // 使用后第 3 个后续抽卡阶段回池
export const MELD_RESPONSE_MS = 4000; // 4 秒鸣牌响应窗口（UI 用）

/** 单倍役满基础伤害（与累计役满衔接）。 */
export const YAKUMAN_BASE = 78;
/** 自摸 1.5 倍奖励口径系数。 */
export const TSUMO_MUL = 1.5;

/**
 * 由普通番数与役满个数计算基础伤害 D_base（对齐文档公式）：
 *   n ≥ 1（牌型役满）   → 78 × n
 *   n = 0 且 f ≥ 13     → 78（累计役满封顶）
 *   其余                → 6 × (1 + f)
 * 0 番即 f = 0 → 6（基础）。
 */
export function baseDamage(fan: number, yakumanCount = 0): number {
  if (yakumanCount >= 1) return YAKUMAN_BASE * yakumanCount;
  if (fan >= 13) return YAKUMAN_BASE;
  return 6 * (1 + Math.max(0, fan));
}

/** 兼容旧调用：仅按番数映射（非役满档）。 */
export function fanToDamage(fan: number): number {
  return baseDamage(fan, 0);
}
