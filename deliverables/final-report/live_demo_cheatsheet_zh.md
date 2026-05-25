# Island Escape 汇报手卡

用途：上台前快速扫一遍。当前策略不是一直现场玩，而是：

- PPT 讲 3-4 分钟；
- 视频放约 2 分钟；
- 最后现场打开游戏玩 1-2 分钟，证明 build 真实可跑。

## 核心一句话

> Island Escape is a playable AI negotiation game. Resources create survival
> pressure, LLM agents create social behavior, and deterministic backend code
> keeps the game fair.

中文理解：

> 这是一个可玩的 AI 谈判生存游戏。资源制造生存压力，LLM 让 NPC 有社交行为，后端确定性规则保证公平和状态正确。

## 总时间节奏

### 0:00-3:35 PPT

PPT 的任务是讲清楚设计和工程思路，不要念报告。

1. 标题和目标：survive, trade, reach 100 coins。
2. 设计动机：AI dialogue 需要真实游戏循环支撑。
3. 核心循环：labor -> trade -> AI turns -> settlement。
4. AI negotiation：LLM 负责 personality / language / intention。
5. Engineering architecture：frontend 展示，backend 验证，Zod schema 连接。
6. Polish：3D preview, boss dungeon, sound effects, validation。

过渡句：

> I will now play the short video. It shows the full intended flow more smoothly
> than waiting for every model call live.

### 3:35-5:35 视频

不要逐帧讲。只抓几个关键节点。

开头：

> The video shows the complete intended flow more smoothly than waiting for every
> model call live.

劳动阶段：

> This is the labor step. The player has to create resources before trading.

NPC 对话：

> The player can use natural language, but the backend still validates the
> actual trade.

AI 回合：

> The AI characters act under the same rule system, and the event log makes
> those actions visible.

Boss / dungeon：

> The dungeon is a risk-reward route to coins, still tied to trade slots and
> resources.

视频结束：

> The video shows the full path: survival, negotiation, AI turns, and the dungeon
> extension.

### 5:35-7:00 现场试玩

目标：证明真的能跑，不要重新演完整流程。

操作：

1. 打开游戏。
2. 点 `NEW GAME`。
3. `WASD` 走两步。
4. 靠近一个目标按 `E`。
5. 如果很顺，再发一句 NPC message。
6. 模型慢就立刻收住，不要尬等。

口播：

> I will quickly show the live build as well, just to show that this is runnable
> and not only a recorded video.

如果模型慢：

> I will not wait for the full response here because the video already showed
> the complete path. The key point is that this is the same live build.

## 必须强调

> The model creates social behavior; deterministic backend code owns fairness
> and validation.

这是最重要的工程点。可以在 PPT architecture、视频 NPC 对话、现场试玩时各提一次。

## 不要做

- 不要一直玩到超时。
- 不要现场等很久的 LLM response。
- 不要把报告内容逐段念出来。
- 不要说“PPT 和视频只是备份”，现在它们是主体流程。
- 不要承诺 exe 包；提交的是 runnable source package。

## 快速问答

为什么用 LLM？

> Because negotiation and personality are where fixed menus feel weakest.

为什么不让 LLM 控制全部？

> Because game state must be fair and testable. The LLM can propose behavior,
> but the engine validates the result.

视频展示了现场不一定展示到的什么？

> The full flow without waiting for model latency: labor, negotiation, AI turns,
> and dungeon combat.

主要技术贡献是什么？

> Separating generated social behavior from deterministic game-state validation.

Boss dungeon 的意义是什么？

> It adds a high-energy risk-reward route to coins without replacing the
> survival trading loop.

如果现场游戏卡了？

> The live server is being temperamental, so I will rely on the video for the
> full path. The submitted source package contains the runnable implementation,
> and we validated the build and API locally.
