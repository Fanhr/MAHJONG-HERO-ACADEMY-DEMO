/**
 * 卡牌/技能的“需要玩家手动选择”的交互规格。
 *
 * 规则：换牌/交换类效果，除描述明确声称随机（如牌山随机、顺序随机、他家不可见的手牌）外，
 * 凡是从「自己手牌」中取出的牌都必须由玩家手动选择；指定目标同理由玩家点选。
 * 未在此登记的卡牌/技能没有交互步骤，点击后直接结算（AI 走引擎内的合理默认）。
 */
export type InteractKind = 'target' | 'handTiles' | 'wantTiles' | 'pickSuit';

export interface InteractStep {
  kind: InteractKind;
  /** 需要选择的数量（handTiles / wantTiles）。 */
  count?: number;
  /** 选择结果写入 payload 的字段（handTiles / wantTiles）。 */
  field?: 'tiles' | 'give';
  /** 面板提示语。 */
  prompt: string;
  /** handTiles：是否要求所选手牌为同一花色（乾坤）。 */
  sameSuit?: boolean;
}

/** 卡牌交互步骤。key 为 cardId；缺省表示无需交互。 */
export const CARD_STEPS: Record<string, InteractStep[]> = {
  // 我要重开：从手牌选 3 张换出（换回牌山随机 3 张——随机部分无需选择）
  chongkai: [
    { kind: 'handTiles', count: 3, field: 'tiles', prompt: '选择 3 张要换出的手牌（换回牌山随机 3 张）' },
  ],
  // 就差这张：选 1 张已有牌召唤同名，再选 1 张换出
  jiucha: [
    { kind: 'handTiles', count: 1, field: 'tiles', prompt: '选择要召唤同名的手牌' },
    { kind: 'handTiles', count: 1, field: 'give', prompt: '选择用来置换的 1 张手牌' },
  ],
  // 拿来吧你：选 2 张想要的牌 + 选 2 张换出的手牌（置换顺序随机）
  nalai: [
    { kind: 'wantTiles', count: 2, field: 'tiles', prompt: '选择 2 张想要的牌（可重复）' },
    { kind: 'handTiles', count: 2, field: 'give', prompt: '选择 2 张换出的手牌' },
  ],
  // 懂你意思：指定对手 + 选自己换出的 1 张（对方选哪张由对方决定——他家不可见）
  dongni: [
    { kind: 'target', prompt: '指定 1 名对手交换手牌' },
    { kind: 'handTiles', count: 1, field: 'give', prompt: '选择你要交换出去的 1 张手牌' },
  ],
  // 求你别摸：指定对手
  qiubiemo: [{ kind: 'target', prompt: '指定 1 名对手，跳过其下次摸切' }],
  // 我要验牌：指定对手
  yanpai: [{ kind: 'target', prompt: '选择要查看手牌的对手' }],
  // 都是安张 / 有安全箱：选 3 张要保护的手牌
  anzhang: [{ kind: 'handTiles', count: 3, field: 'tiles', prompt: '选择 3 张要保护的手牌' }],
  // 跟你爆了：指定对手
  genibao: [{ kind: 'target', prompt: '指定 1 名对手分担你受到的伤害' }],
  // —— 运 ——
  buduibudui: [{ kind: 'pickSuit', prompt: '指定一种花色：下次摸牌不为该花色则重摸一次' }],
  duidedui: [{ kind: 'pickSuit', prompt: '指定一种花色：下次摸牌为该花色则增加一次摸切' }],
  yanguang: [{ kind: 'target', prompt: '指定 1 名角色，免疫其对你造成的一次伤害' }],
  // —— 生 ——
  guanghe: [{ kind: 'pickSuit', prompt: '指定一种花色：场上每打出 1 张该花色牌，你回复 3 点生命' }],
  shengsheng: [{ kind: 'handTiles', count: 1, field: 'tiles', prompt: '从手牌指定一种牌：场上每打出 1 张同名牌，你回复 10 点生命' }],
};

/** 技能交互步骤。key 为 skillId。 */
export const SKILL_STEPS: Record<string, InteractStep[]> = {
  // 乾坤：指定对手 + 选 3 张同色手牌给对方。换回的牌由对方自选「同一类型(万/筒/条/字)」，施放者无法指定花色。
  qiankun: [
    { kind: 'target', prompt: '指定要交换的对手' },
    { kind: 'handTiles', count: 3, field: 'tiles', prompt: '选择 3 张同色手牌给对方（对方会交回同一类型的 3 张牌，你无法指定花色）', sameSuit: true },
  ],
};

export function cardSteps(cardId: string): InteractStep[] {
  return CARD_STEPS[cardId] ?? [];
}
export function skillSteps(skillId: string): InteractStep[] {
  return SKILL_STEPS[skillId] ?? [];
}
