import type { HeroLogic } from './types';
import { geda } from './geda';
import { aimage } from './aimage';
import type { HeroId } from '../state';

export const heroRegistry: Record<HeroId, HeroLogic> = {
  geda,
  aimage,
};

export { resolveChongfengji } from './geda';
export type { HeroLogic };
