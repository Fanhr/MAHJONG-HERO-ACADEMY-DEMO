# 英雄麻将 · Demo 配置文档（入学测试关卡）

> 本目录记录 demo 当前实现的**真值配置**，供后续维护与数值平衡。所有内容以 `src/` 代码为准。
> 最近同步：2026-07-27（demo 重整：学院选择 / 咯哒·爱麻鸽 / 20 张技能卡 / 流程对齐 ver2.0 / 3 局通关）。

## 关卡概述（入学测试）
- 玩家固定为**山鸣学院**代表「**咯哒**」；其余烈焰/观澜/静水学院在选择页灰显（未解锁）。
- 3 名人机为「**爱麻鸽 1~3 号**」。
- **通关条件**：玩家在 **3 局循环**内存活即宣告「**入学测试通过**」；玩家阵亡则「未通过」。
- 全局 HP 100（浮点，回血封顶 100）；AP 初始 2、每回合 +1、上限 5。

## 文档索引
| 文件 | 内容 |
| --- | --- |
| `英雄技能.md` | 咯哒（冲锋鸡/鸡关枪/鸡生蛋）、爱麻鸽（瑞雪/平和鸽/回购） |
| `技能卡.md` | 20 张技能卡（谋/战/御/运/生 五类）总览与实现要点 |
| `数值与结算.md` | 伤害曲线、结算/上贡、掉血保底与低血保护、荒牌重洗、回合流程 |

## 代码对应关系
| 系统 | 主要源文件 |
| --- | --- |
| 回合流程/阶段 | `src/engine/turnMachine.ts`（开始→抽卡→技能与技能卡→摸牌→切牌） |
| 英雄逻辑 | `src/engine/heroes/geda.ts`、`aimage.ts`、`index.ts` |
| 技能卡 | `src/engine/cards/cardDefs.ts`、`cardEffects.ts` |
| 伤害/结算/上贡 | `src/engine/damage.ts`、`turnMachine.ts`（resolveTribute） |
| 荒牌重洗 | `src/engine/round.ts` |
| AI | `src/ai/simpleAI.ts` |
| 学院选择页 | `src/ui/screens/HeroSelect.tsx` + `public/assets/`（title.png / geda.png） |
| 数值常量 | `src/engine/constants.ts` |
