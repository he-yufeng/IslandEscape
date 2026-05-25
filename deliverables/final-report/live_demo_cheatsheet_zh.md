# Island Escape 现场试玩手卡

用途：老师主要看你现场玩游戏，PPT/报告不是主线。这个手卡给主讲人上台前快速扫一遍。

## 一句话目标

不要讲成论文汇报。核心是边玩边说明：

> 这是一个 AI NPC 生存交易游戏。LLM 负责谈判和性格，后端状态机负责规则、公平性和资源结算。

## 上台前检查

- 所有人到场，尤其是能回答自己模块的人。
- 游戏已经打开在标题页或新游戏初始页。
- 终端不要抢屏，只保留后台运行。
- API key 已配置，LLM 能慢但不能完全没响应。
- 声音可以开一点，但不要盖过讲话。
- PPT 和视频只作为备份，不主动打开。

## 7 分钟流程

### 0:00-0:25 开场

操作：

- 展示标题页。
- 点 `NEW GAME`。

说法：

> I will present by playing the game directly.
> The goal is to survive, trade, and become the first character to collect 100 coins.
> The key idea is that negotiation is powered by LLM agents, but the game rules are deterministic.

### 0:25-1:05 解释主界面

操作：

- 指 HUD：day、fish、wheat、coins、trade slots、phase。
- 如果 tutorial 挡住就快速关掉。

说法：

> Fish and wheat keep me alive. Coins are the escape objective.
> Each day has a rhythm: labor, trade, AI turns, and settlement.
> This is why it is a game loop, not just a chatbot.

### 1:05-1:45 劳动阶段

操作：

- `WASD` 移动。
- 找最近的 fish/farm。
- `E` 互动，优先 fishing。

说法：

> Before trading, I must do labor.
> Fishing gives immediate resources, while farming is delayed.
> After labor, the game enters the trade phase.

补一句工程点：

> The UI guides the player, but the backend validates whether the action is legal.

### 1:45-3:10 NPC 谈判

操作：

- 找最近 NPC。
- `E` 打开对话。
- 发短消息，不要太长。

推荐消息：

```text
I need wheat to survive tonight. Can you help me? I can offer fish if the deal is fair.
```

说法：

> This is where the LLM matters. The NPC is not a fixed menu; it can answer with personality.
> But the LLM does not directly change resources. It proposes dialogue and intent, while the server validates the trade.

LLM 等待时说：

> The thinking state is intentional. LLM calls can be slow, so the UI shows progress instead of looking frozen.

NPC 回复后说：

> The response is generated, but the resource ledger is still deterministic.

### 3:10-3:50 trade slots / merchant

操作：

- 能到 merchant 就展示。
- 到不了就指 trade slot。

说法：

> Trade slots are the daily budget. Talking to NPCs, selling to the merchant, and entering the dungeon all compete for this limited resource.
> That makes conversation part of the economy instead of unlimited chat.

### 3:50-4:40 End Turn / AI 行动

操作：

- 点 `End Turn`。
- 看 AI 行动和 event log。

说法：

> Now the AI islanders take their turns.
> They also labor and trade under the same rules.
> The event log makes AI behavior visible instead of hidden background computation.

如果出现 daily event：

> Daily events add variation, but they are deterministic engine rules, not LLM narration.

### 4:40-5:55 Boss Dungeon

操作：

- 能进 dungeon 就进。
- 展示 20-40 秒，不要执着打完。
- 提一下键位：`WASD` 移动，`Space` 闪避，`Q` 大招。

说法：

> The dungeon is a risk-reward extension of the economy.
> It costs one trade slot. Winning gives coins; losing costs resources.
> The boss scales with the day, so entering early is safer but pays less.

如果音效明显：

> We also added combat sound feedback, so attacks and hits are easier to read live.

### 5:55-6:40 架构收束

操作：

- 保持游戏画面，不切 PPT。

说法：

> The core engineering idea is separation of responsibilities.
> The frontend renders the island, dialogue UI, 3D preview, combat, and sound.
> The backend owns state, validation, persistence, and AI calls.
> The LLM creates social behavior, but deterministic code owns fairness.

### 6:40-7:00 结束

说法：

> Island Escape is a playable AI negotiation game. Players survive through resources, compete through trade, and interact with NPCs that feel more like agents than menus.
> Thank you.

然后停，等老师问问题。

## 卡住时怎么圆

LLM 慢：

> This is expected because the NPC response comes from an external model. The important part is that the UI shows pending state and the backend keeps the state safe.

找不到 NPC：

> Interaction is spatial by design. The player has to move around the island instead of using a pure menu.

进不了 dungeon：

> Dungeon is only available in the trade phase and costs a trade slot. That restriction makes combat part of the economy.

Boss 打崩：

> Losing is also meaningful because it costs resources. The player has to decide whether the reward is worth the survival risk.

时间只剩 1 分钟：

> Labor creates resources, trade spends limited slots, LLM negotiation creates social behavior, and the backend validates the game rules.

## 队友分工回答

- He Yufeng：主讲、AI 架构、整体设计、验证和集成。
- Xu Junjie：交互流程、对话 bug、玩家体验细节。
- Yu Erfei：boss dungeon、按天数变难、音效、玩法 polish。
- Long Huzhiyuan：3D preview、渲染、左侧面板、视觉 polish。

老师问“谁做了什么”时不要长篇大论，每个人一句话即可。

## 常见问题短答

为什么用 LLM？

> Negotiation and personality are exactly where fixed menus feel weak.

为什么不让 LLM 控制全部？

> Game state must be fair and testable, so the LLM proposes behavior while the engine validates rules.

Boss 有什么意义？

> It gives a faster risk-reward path to coins without replacing the survival-trading loop.

音效有什么意义？

> It makes combat feedback easier to understand during live play.

Daily events 有什么意义？

> They make repeated days less predictable while staying deterministic and testable.

如果老师要看 PPT？

> We prepared it, but the playable build is the main presentation artifact. I can open the PPT if you want a structured summary.

如果老师要问代码包？

> The submitted source package excludes node_modules and generated materials, but includes package files, lockfile, env example, frontend, backend, and shared schemas.
