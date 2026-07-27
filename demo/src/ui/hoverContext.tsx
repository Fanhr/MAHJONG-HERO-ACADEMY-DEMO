import { createContext, useContext } from 'react';

/** 悬停高亮：当前鼠标预选的牌值（用于高亮全场同名牌）。默认无操作。 */
export interface HoverCtx {
  hovered: number | null;
  setHovered: (t: number | null) => void;
}

export const HoverContext = createContext<HoverCtx>({ hovered: null, setHovered: () => {} });

export function useHover(): HoverCtx {
  return useContext(HoverContext);
}
