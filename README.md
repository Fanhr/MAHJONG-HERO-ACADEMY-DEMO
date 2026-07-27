# 开战！麻神力攻学院 · Demo

《英雄麻将》玩法验证 Demo —— 一款把各地麻将流派封装为「英雄/技能卡」、把和牌做成即时伤害战斗的竞技麻将。

本仓库为「**入学测试关卡**」演示：玩家扮演山鸣学院代表「咯哒」，对阵 3 名「爱麻鸽」陪练，在 3 局循环内存活即通过。

## 在线试玩

部署在 GitHub Pages：

👉 **https://fanhr.github.io/MAHJONG-HERO-ACADEMY-DEMO/**

（首次部署需等待 GitHub Actions 构建完成，约 1~2 分钟。）

## 本地运行

```bash
cd demo
npm install
npm run dev      # 开发预览 http://localhost:5173
npm run build    # 生产构建到 demo/dist
npm test         # 运行单元测试
```

## 项目结构

```
.
├── demo/                    # Vite + React + TS 单机 Demo
│   ├── public/assets/       # 标题图、咯哒立绘
│   ├── src/engine/          # 纯 TS 引擎（状态机 / 番种 / 伤害 / 英雄 / 技能卡）
│   ├── src/ui/              # React 界面
│   ├── tests/               # Vitest 单元测试
│   └── config-doc/          # 配置文档（英雄/卡牌/数值真值）
├── .github/workflows/deploy.yml   # GitHub Pages 自动部署
└── 数值/ 局内游戏流程*.md 等      # 设计文档
```

## 部署机制

- 推送到 `main`/`master` 分支会自动触发 GitHub Actions：
  1. 在 `demo/` 下 `npm ci` + `npm run build`（构建时 `base` 设为 `/MAHJONG-HERO-ACADEMY-DEMO/`）。
  2. 把 `demo/dist` 上传为 Pages 产物并部署。
- 仓库 **Settings → Pages → Source** 需选择 **GitHub Actions**（首次部署前设置一次即可）。

## 玩法要点

- 阶段流程（对齐《局内游戏流程 ver2.0》）：开始 → 抽卡 → 技能与技能卡 → 摸牌 → 切牌。
- 玩家「咯哒」三技能：冲锋鸡 / 鸡关枪 / 鸡生蛋（均围绕幺鸡与指示牌）。
- 对手「爱麻鸽」三技能：瑞雪 / 平和鸽 / 回购。
- 通关条件：3 局循环内玩家存活即「入学测试通过」。
- 完整配置见 `demo/config-doc/`。
