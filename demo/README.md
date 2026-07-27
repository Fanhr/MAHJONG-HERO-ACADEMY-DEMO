# 英雄麻将 · 玩法验证 Demo

纯 Web 单机四人局麻将对战原型：**血流成河 + 即时伤害 + 英雄技能 + 技能牌**。
玩家（1 人）从 3 名英雄中选 1 位，与 3 名 AI 对手对战，验证核心玩法与规则系统。

- 技术栈：Vite + React 18 + TypeScript + Tailwind CSS + Vitest
- 跨平台：浏览器运行，Mac / Windows 通用、零安装
- 架构：**引擎（纯 TS，无 DOM，可单测）与 UI 彻底解耦**；AI 与人类共用 `redactStateFor` 投影视图，物理上杜绝上帝视角

## 运行

```bash
cd demo
npm install

# 本地开发预览（浏览器打开终端提示的地址，Mac/Windows 通用）
npm run dev

# 生产构建（产出 dist/ 静态文件，可直接部署或本地打开）
npm run build
npm run preview

# 运行引擎单元测试
npm test
```

## 目录结构

```
src/
  engine/        纯 TS 核心引擎（无 DOM 依赖，可单测）
    tiles.ts       牌定义 / 牌墙 / 计数转换
    rng.ts         可复现随机数与洗牌
    constants.ts   HP/AP 与番数→伤害映射
    state.ts       GameState 模型、初始化与发牌
    actions.ts     玩家/AI 动作联合类型
    redact.ts      防上帝视角投影入口（AI 唯一状态来源）
    winning.ts     和牌判定（标准型/七对/十三幺/听牌）
    yaku.ts        精选番种识别（含互斥简化裁定）
    damage.ts      伤害快照结算 / 直接伤害 / 淘汰终局
    turnMachine.ts 六阶段回合状态机 + 副露窗口 + 立直锁手
    meld.ts        吃/碰/杠/荣和合法性检测
    round.ts       荒牌开新局 / 多局资源延续
    hooks.ts       引擎钩子单例（技能/卡牌接入点）
    register.ts    组合 heroes+cards 注入 engineHooks
    heroes/        三英雄技能（蜀道山/立直流/捉鸡流）
    cards/         12 张技能牌 + 卡池随机抽 3
  ai/            简单 AI（仅消费投影视图，无上帝视角）
  ui/            React 表现层（英雄选择 / 对战 / 结算三屏）
    cardInteraction.ts 卡牌/技能"需玩家手动选牌/选目标"的交互规格
    components/    TileView / OpponentPanel / SelfPanel / TableCenter(牌河)
                   HandBar / ActionBar / CardView / CardPanel / CardUsePanel / LogPanel
tests/           Vitest 单测（49 用例，全绿）
```

## 交互说明

- **直观牌桌**：四名玩家环绕（上/左/右为 AI，底部为你），中央绿毡牌河展示各家弃牌与牌墙剩余，底部为你的大号可点手牌。
- **抽卡**：抽卡阶段以卡面形式展示 3 张候选（含类别、AP、完整效果描述），点击选取；右侧「卡牌区」常驻显示你已抽取的备用区卡牌。
- **换牌/交换类**（我要重开/就差这张/拿来吧你/懂你意思/都是安张/乾坤等）：除描述声称随机的部分（牌山随机、他家不可见手牌）外，均弹出交互面板由你**手动选择要换出的手牌与目标**后再执行；多多益善多摸后由你选择保留哪张。


## 核心数值（当前 demo）

- 角色 HP 统一 100（浮点）；AP 初始 2、每回合 +1、上限 5
- 番数→基础伤害（6 的倍数）：1–2→6 / 3–5→12 / 6–11→24 / 12–23→42 / 24–47→60 / 48–63→78 / 64–88→96
