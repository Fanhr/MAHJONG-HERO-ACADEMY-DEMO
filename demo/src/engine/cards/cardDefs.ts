/**
 * 技能卡全集（对齐《初始卡牌设计》——共 20 张，分「谋 / 战 / 御 / 运 / 生」五类）。
 * 每次抽卡从该全集随机抽 3 种、选 1 张（有放回）。
 */
export type CardCategory = '谋' | '战' | '御' | '运' | '生';

export interface CardDef {
  id: string;
  name: string;
  ap: number;
  category: CardCategory;
  desc: string;
}

export const CARD_DEFS: CardDef[] = [
  // —— 谋 ——
  { id: 'duoduo', name: '多多益善', ap: 1, category: '谋', desc: '下次摸牌改为多摸 1 张，从中选 1 张留手，另一张放牌山底部。' },
  { id: 'chongkai', name: '我要重开', ap: 2, category: '谋', desc: '从手牌选 ≤3 张，置换牌山中随机的等量麻将牌。' },
  { id: 'jiucha', name: '就差这张', ap: 3, category: '谋', desc: '选 1 张手中已有的牌，召唤牌山中同名牌并用 1 张手牌置换；牌山无则返还 1 AP。' },
  { id: 'nalai', name: '拿来吧你', ap: 4, category: '谋', desc: '选 ≤2 张任意牌，用手牌等量置换牌山或他人手牌中存在的牌，顺序随机、优先牌山。' },
  // —— 战 ——
  { id: 'dongni', name: '懂你意思', ap: 1, category: '战', desc: '指定 1 名角色，各选 1 张手牌互相交换。' },
  { id: 'qiubiemo', name: '求你别摸', ap: 2, category: '战', desc: '指定 1 名角色，跳过其下一次摸牌切牌阶段。' },
  { id: 'yougan', name: '有感觉了', ap: 3, category: '战', desc: '此后 3 个回合内，自身因鸣牌（吃/碰/杠/和牌）造成的伤害 +30%。' },
  { id: 'yanpai', name: '我要验牌', ap: 4, category: '战', desc: '查看指定角色除安全牌外的所有手牌。' },
  // —— 御 ——
  { id: 'buchi', name: '不吃压力', ap: 1, category: '御', desc: '移除自身当前 1 个负面状态。' },
  { id: 'anzhang', name: '有安全箱', ap: 2, category: '御', desc: '指定手牌中 3 张，接下来 2 巡内不受置换效果影响。' },
  { id: 'genibao', name: '跟你爆了', ap: 3, category: '御', desc: '指定 1 名角色，3 个回合内其分担你受到伤害的 30%。' },
  { id: 'yidalipao', name: '向我开炮', ap: 4, category: '御', desc: '此后 3 个回合内，因自己放炮受到的伤害减少 50%。' },
  // —— 运 ——
  { id: 'buduibudui', name: '不对不对', ap: 1, category: '运', desc: '指定一种花色，若下一次摸牌不为该花色，则重新执行一次摸切。' },
  { id: 'duidedui', name: '对的对的', ap: 2, category: '运', desc: '指定一种花色，若下一次摸牌为该花色，则增加一次摸切（多摸多打）。' },
  { id: 'ruguo', name: '如果可以', ap: 3, category: '运', desc: '从自身弃牌区选 1 张，置换 1 张手牌。' },
  { id: 'yanguang', name: '我有眼光', ap: 4, category: '运', desc: '指定 1 名角色，此后 3 个回合内免疫其对你造成的 1 次伤害。' },
  // —— 生 ——
  { id: 'guanghe', name: '光合作用', ap: 1, category: '生', desc: '指定一种花色，直到你下一回合前，场上每打出 1 张该花色牌，你回复 3 点生命（不溢出）。' },
  { id: 'shengsheng', name: '生生不息', ap: 2, category: '生', desc: '指定一种牌，直到你下一回合前，场上每打出 1 张同名牌，你回复 10 点生命。' },
  { id: 'xiuyang', name: '休养生息', ap: 3, category: '生', desc: '此后 3 个回合内，场上每发生 1 次鸣牌事件，你立即回复 10 点生命。' },
  { id: 'xiangsi', name: '向死而生', ap: 4, category: '生', desc: '生命值降至 1 点，此后 5 个回合内免疫 3 次伤害，且你每次造成伤害时回复其 50% 的生命。' },
];

const BY_ID = new Map(CARD_DEFS.map((d) => [d.id, d]));

export const CARD_POOL_IDS = CARD_DEFS.map((d) => d.id);
/** “生”类（生命相关）技能卡 id，用于玩家掉血保底抽卡。 */
export const LIFE_CARD_IDS = CARD_DEFS.filter((d) => d.category === '生').map((d) => d.id);

export function cardDef(id: string): CardDef | undefined {
  return BY_ID.get(id);
}
