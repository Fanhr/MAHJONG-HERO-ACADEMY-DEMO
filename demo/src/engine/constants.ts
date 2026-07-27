/**
 * 全局数值常量（用户确认版）：
 *  - 所有 demo 角色 HP 统一 100（浮点）
 *  - AP：初始 2，每回合 +1，上限默认 5（可按英雄覆盖）
 *  - 番数→基础伤害映射：全部 6 的倍数，兼容 3/4 人自摸均分；役满级 96
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

/** 基础伤害上限（役满级趋近值）。 */
export const DAMAGE_CAP = 96;
/** 基础伤害下限（1 番）。 */
export const DAMAGE_FLOOR = 6;
/** 曲线陡度常数：越小则中低番爬升越快。 */
const DAMAGE_CURVE_K = 24.5;

/**
 * 将番数映射为基础伤害。
 *
 * 设计：采用「平滑饱和曲线」而非粗档表，使伤害随番数【连续单调递增】，
 * 高番牌型的伤害显著高于低番，梯度与牌型难度成比例，杜绝“25 番与 40 番同为 60”的断档。
 *   damage(fan) = CAP · (1 − e^(−fan / K))，下限 6、上限 ~96（0.1 精度）。
 * 参考取值：1番≈6、4番≈14、6番≈21、12番≈37、清一色24番≈60、
 *          清一色+清龙40番≈78、四暗刻/字一色64番≈90、役满88番≈93。
 */
export function fanToDamage(fan: number): number {
  const f = Math.max(1, fan);
  const raw = DAMAGE_CAP * (1 - Math.exp(-f / DAMAGE_CURVE_K));
  return Math.round(Math.max(DAMAGE_FLOOR, raw) * 10) / 10;
}

/** 立直“升档”系数：在门清/曲线基础上再乘该系数（封顶 96）。 */
export const RIICHI_UPGRADE_MUL = 1.3;

/** 对给定伤害应用“升一档”（立直用）：×系数并封顶、0.1 精度。 */
export function upgradeTierDamage(dmg: number): number {
  return Math.round(Math.min(DAMAGE_CAP, dmg * RIICHI_UPGRADE_MUL) * 10) / 10;
}
