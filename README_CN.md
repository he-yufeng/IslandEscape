<div align="center">

<img src="docs/banner.png" alt="IslandEscape — 2D 像素风生存游戏，四个 LLM AI 角色竞相逃离荒岛" width="100%">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

[**快速开始**](#安装) · [**怎么玩**](#怎么玩) · [**AI 角色**](#ai-角色性格) · [English](README.md)

</div>

<p align="center"><img src="docs/architecture.png" alt="IslandEscape 架构图" width="720"></p>

一款 2D 像素风生存交易游戏，每个 NPC 角色都由大语言模型驱动。

你困在一座岛上，身边还有四个 AI 角色。捕鱼、种田、交易、谈判，率先凑够 100 枚金币就能搭船逃离——但其他人也在抢着出岛。

## 游戏特色

- **2D 像素风岛屿** — 俯视角地图，WASD 移动，PixiJS 渲染
- **LLM 驱动的 AI 角色** — 每个 NPC 都有独特性格，通过 DeepSeek/OpenAI API 用自然语言谈判交易
- **劳动 + 交易系统** — 每天所有角色必须先劳动（捕鱼或种田），再用最多 2 个交易槽跟其他岛民或商船交易
- **涌现式社交动态** — AI 角色会结盟、坚守价格，当你快要逃离时甚至会拒绝跟你交易
- **友情也是资产** — 成功交易积累好感度，好感度影响报价、交易意愿和结盟关系

## 截图

### 标题界面

![Island Escape 标题界面](docs/screenshots/title-screen.png)

### 游戏画面

![Island Escape 游戏画面](docs/screenshots/gameplay.png)

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS v4 |
| 游戏渲染 | PixiJS（HTML5 Canvas，程序化像素艺术） |
| 后端 | Fastify + Zod + Drizzle ORM + SQLite |
| AI | OpenAI 兼容 API（通过 OpenRouter 使用 DeepSeek） |
| 共享 | Zod Schema，前端/服务端类型安全契约 |

## 项目结构

```
.
├── apps/
│   ├── web/                 # Vue 3 前端 + PixiJS 游戏画布
│   │   ├── src/game/        # PixiJS：地图、角色、输入、世界
│   │   ├── src/components/  # Vue：HUD、行动菜单、对话面板、事件日志
│   │   ├── src/stores/      # Pinia 游戏状态 + SSE 管理
│   │   └── src/composables/ # API 辅助函数
│   └── server/              # Fastify 后端
│       ├── src/engine/      # 游戏状态机（纯函数）
│       ├── src/agents/      # LLM 集成：决策、谈判、角色性格
│       ├── src/routes/      # REST + SSE 端点
│       └── src/db/          # Drizzle + SQLite 持久化
└── packages/
    └── shared/              # 前后端共用的 Zod Schema
```

## 游戏规则

### 每日流程

1. **白天开始** — 商船到来，带来今日随机收购价格；田里等待收割的小麦会自动收取
2. **玩家劳动**（必须） — 选择捕鱼（立即 +3 条鱼）或种田（3 天后 +8 单位小麦）
3. **玩家交易**（2 个槽） — 向商船卖货换金币，或跟 NPC 谈判以物换物
4. **AI 行动** — 每个 AI 角色依次劳动，再自主决定最多 2 次交易（由 LLM 决策）
5. **结算** — 所有人消耗 1 条鱼 + 1 单位小麦；资源耗尽则被淘汰
6. **胜利** — 率先凑够 100 金币即可登船逃离

### 交易方式

- **商船**：以今日随机价格卖出鱼 / 小麦换金币（获得金币的唯一途径）
- **NPC 谈判**：走到 NPC 旁边发起对话（最多 5 轮），用模板或自由文本提出交换方案
- 每次对话消耗 1 个交易槽，无论是否成交

### AI 角色性格

| 角色 | 性格 | 策略风格 |
|------|------|----------|
| **Tom** | 谨慎的渔夫 | 囤积资源，对朋友忠诚，交易不轻易让步 |
| **Sam** | 激进的商人 | 赚差价，嘴上很甜但不可靠 |
| **Lily** | 合作的农民 | 主动结盟，对朋友慷慨，不愿冲突 |
| **Jack** | 狡猾的机会主义者 | 趁人之危，表面友好实则别有用心 |

## 安装

```bash
corepack enable pnpm
corepack use pnpm@latest-10
git clone https://github.com/he-yufeng/IslandEscape.git
cd IslandEscape
pnpm install
```

## 配置

```bash
cp .env.example .env
```

编辑 `.env`，填入 OpenAI 兼容的 API Key（推荐通过 OpenRouter 使用 DeepSeek，价格更低）：

```
OPENAI_API_KEY=<你的 openrouter 或 openai key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=deepseek/deepseek-chat
DB_FILE_NAME=file:local.db
LOG_LEVEL=info
```

NPC 对话较慢时，说明正在等待外部模型 API 响应，这是正常现象。

## 运行

```bash
pnpm dev
```

启动后：
- **前端**：http://localhost:5173
- **后端**：http://localhost:8787

生产模式单进程运行：

```bash
pnpm build
pnpm start
```

公网部署时设置 `HOST=0.0.0.0` 和 `PORT=<端口号>`，Fastify 同时服务 `/api/*` 和构建后的前端。

## 怎么玩

1. 打开 http://localhost:5173，点击 **NEW GAME**
2. **WASD** 在岛上移动
3. **E** 互动 — 走近捕鱼点、农田、NPC 或商船
4. **先劳动**：捕鱼或种田（每天必须）
5. **再交易**：跟 NPC 谈判或向商船卖货
6. 点击 **End Turn**，观看 AI 角色的行动
7. 撑过每晚的资源消耗，率先凑齐 100 金币即可逃离！

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/games` | 创建新游戏 |
| GET | `/api/games/:id` | 获取当前游戏状态 |
| POST | `/api/games/:id/action` | 提交玩家行动 |
| GET | `/api/games/:id/stream` | SSE 实时推送 AI 回合更新 |

## 后续规划

核心循环——每日回合、交易、LLM 驱动的 NPC——已经能完整玩通，接下来想做深度和广度：

- **存档与续玩**：保存一局进度，让玩家能离开后再回来，而不是每次重开。
- **更多 NPC 原型**：增加性格各异、交易行为不同的 AI 角色，让小岛在多次游玩间不那么重复。
- **难度曲线**：把价格、事件和逃离目标按前期 / 后期调校，让一局比平铺直叙的刷量更有节奏。
- **本地模型模式**：让 NPC 对话能跑在本地模型（Ollama）上，没有云端 API key 也能玩。

## 参考文献

- [Generative Agents (Park et al., 2023)](https://arxiv.org/abs/2304.03442) — LLM Agent 基础架构
- [Project Sid (2024)](https://arxiv.org/abs/2411.00114) — 多 Agent 模拟中的涌现经济
- [AI Town (a16z)](https://github.com/a16z-infra/ai-town) — 开源 LLM Agent 模拟

## License

MIT
