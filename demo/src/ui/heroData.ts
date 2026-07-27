import type { HeroId } from '../engine/state';

export interface SkillMeta {
  name: string;
  type: '被动' | '主动' | '触发';
  short: string;
  desc: string;
}

export interface HeroMeta {
  id: HeroId;
  name: string;
  title: string;
  style: string;
  accent: string; // tailwind 渐变主色
  skills: SkillMeta[];
}

export const HERO_META: HeroMeta[] = [
  {
    id: 'geda',
    name: '咯哒',
    title: '山鸣学院 · 鸡系战术',
    style: '幺鸡与指示牌构筑的双刃流派：一手好鸡能连锁爆发，也可能反噬自身',
    accent: 'from-amber-400/80 to-yellow-600/80',
    skills: [
      {
        name: '冲锋鸡',
        type: '触发',
        short: '每局首张幺鸡：你打出且没被鸣走→全场各 3 点；否则你自己吃 6 点',
        desc: '每一局中，当第一张“幺鸡（一条）”被打出时结算：① 若由你打出、且未被任何人吃/碰/杠或荣和响应 → 你对场上其他每名存活各造成 3 点伤害；② 若不是你打出、或你打出的这张幺鸡被副露/荣和响应了 → 你自己承受 6 点伤害。',
      },
      {
        name: '鸡关枪',
        type: '被动',
        short: '造成或受到和牌伤害时，来源牌型每有 1 张幺鸡，伤害 +6',
        desc: '当你和牌造成伤害时，你的和牌牌型（手牌+副露）中每有 1 张幺鸡，本次伤害 +6；当你被他人和牌击中时，对方牌型中每有 1 张幺鸡，你承受的伤害也 +6。鸡既是矛也是靶。',
      },
      {
        name: '鸡生蛋',
        type: '被动',
        short: '对局首次和牌随机生成 1 张指示牌，此后牌型每含 1 张同名牌，伤害 +6',
        desc: '你在本对局第一次和牌时，随机生成 1 张“指示牌”（跨局延续）。从这次起，你每次和牌的牌型中每有 1 张与指示牌同名的牌，本次伤害 +6，越滚越强。',
      },
    ],
  },
  {
    id: 'aimage',
    name: '爱麻鸽',
    title: '入学测试 · 陪练对手',
    style: '稳健的鸽系陪练：善于骚扰副露、低番补伤、回购换牌',
    accent: 'from-sky-500/80 to-indigo-700/80',
    skills: [
      {
        name: '瑞雪',
        type: '触发',
        short: '场上有人副露时，可消耗 1 AP 立即对其造成 3 点',
        desc: '当场上任意玩家进行副露（吃/碰/杠）时，爱麻鸽可消耗 1 点行动点，立即对该副露者造成 3 点伤害。',
      },
      {
        name: '平和鸽',
        type: '被动',
        short: '和牌番数 ≤ 3 时，本次伤害 +6',
        desc: '若本次和牌的番数不超过 3 番，则本次造成的伤害额外 +6，鼓励快速小和。',
      },
      {
        name: '回购',
        type: '主动',
        short: '消耗 2 AP，用 1 张手牌换回自己弃牌堆里的 1 张牌',
        desc: '消耗 2 点行动点，从自己的弃牌堆中取回 1 张牌，并交出 1 张手牌到弃牌堆，手牌张数不变。',
      },
    ],
  },
];

export function heroMeta(id: HeroId): HeroMeta {
  return HERO_META.find((h) => h.id === id)!;
}
