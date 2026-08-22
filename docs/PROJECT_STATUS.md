# Avalon Online 项目进度

> 这是项目进度的唯一维护入口。更新代码或完成一个独立模块后，同时更新本文件的状态、验收条件和提交记录。
>
> 最后更新：2026-08-23

## 当前结论

项目已经完成从创建房间、入座开局到任务、刺杀和胜负结算的 Web 操作闭环；规则、Socket.IO、PostgreSQL 和 5–10 个隔离浏览器上下文已有分层自动化方案，但尚未完成 5–10 台真实设备的完整局域网验收。

当前阶段：**LAN MVP 开发中 / 应用数据验收已自动化，等待真实进程、数据库和 LAN 设备验收**

当前分支和提交以 `git branch --show-current`、`git log -1 --oneline` 为准；本文件不固定记录 HEAD。

已完成的基础能力：

- 5–10 人独立房间和多房间 Lobby。
- boardgame.io phases、stages、activePlayers、Socket.IO 多人同步。
- 服务端权威角色、秘密状态和 `playerView`。
- PostgreSQL 持久化、房间列表过滤和日志级联删除；空闲连接的后台网络错误会输出凭据安全的诊断摘要，不再因未处理的 Pool 事件终止 Node 进程。
- 座位绑定、浏览器 client ID 防重复占座、房间路由、凭据重连和服务端凭据会话校验。
- Web 主页将等待开局和游戏中的房间统一列入“进行中的圆桌”，卡片显示具体状态并提供分页；已结束房间单独列出。
- Web 主页会验证本机保存的全部活动房间凭据；已加入房间置顶并直接“进入”，存在活动房间时禁止从正常浏览器流程创建或加入其他房间，并同步同一浏览器的其他标签页。
- Web 游戏页沿用等待大厅的圆桌空间，中间采用实体桌游式五任务计分板；已接入角色信息、队伍提案、全员投票、任务秘密出牌、公开任务结果、刺杀和最终角色揭示，并适配桌面与短屏移动端。
- Web 主页每次创建/加入新房间前都显示名称确认弹窗；`localStorage` 仅作为默认值来源，成功入座后更新，取消或失败不覆盖，并支持名称冲突与过期座位状态的分层恢复。
- Web 主页和个人设备圆桌等待大厅已完成响应式重设计；大厅使用 `100dvh` 沉浸式固定视口，以当前玩家为底部锚点展示桌面圆桌和短屏移动端座位网格，并保留连接、重连、正式退出/解散和房主开局控制。
- 等待大厅支持玩家凭据授权的主动离座：普通玩家只释放自己的座位，房主解散整个房间；游戏开始后拒绝这两类操作，返回主页仍是保留座位的无损导航。
- 开发模式房间页控制：可删除任意状态房间、在大厅踢出占用座位；删除 ID 在进程生命周期内保持不可用，匿名 Socket.IO 同步和延迟写入都不能复活房间，被删除/踢出后会清理失效凭据并返回主页；活动房间的过期 metadata 快照也不能恢复旧名称或凭据，kick 会在旧写入之后权威落盘。
- 游戏测试使用版本化 RNG seed、统一命令 transcript 和确定性 replay；同一失败可在规则层、Socket.IO 层或浏览器层重放。
- Playwright 使用每玩家独立 browser context 自动完成创建、加入、刷新重连和整局游戏；GitHub Actions 负责 PR smoke/PostgreSQL 检查和每日 5–10 人分片矩阵，不依赖开发者电脑。

当前最大缺口：**5–10 台真实设备的完整局域网验收，以及部署环境中的 PostgreSQL 重启演练**。CI 的质量、单元/Socket.IO、数据库容器重启重连、浏览器 smoke、Nightly 10,002 局属性测试和 5–10 人浏览器矩阵均已在 GitHub 托管 runner 上通过。

## 目标与范围

### MVP 必须支持

- 局域网内 5–10 个浏览器客户端进入同一个房间。
- 多房间同时存在，房间状态互不影响。
- Merlin、Assassin、Loyal Servant of Arthur、Minion of Mordred。
- 队伍提案、全员投票、任务出牌、三次任务成功后的刺杀和胜负结算。
- 服务端权威管理秘密状态；客户端不得收到其他玩家不应看到的角色或未结算选择。
- PostgreSQL 持久化，游戏服务重启后可以使用原座位凭据重连。

### 明确不在当前 MVP

- Percival、Morgana、Mordred、Oberon、Lady of the Lake 和其他扩展。
- 账号、玩家档案、语音、聊天、AI、排行榜。
- 自动超时推进。
- 房主/管理员修改已发生游戏状态。
- 多个游戏服务进程、分布式 Socket.IO、Pub/Sub 和分布式锁。

相关决策见：

- [已确认的游戏设计](superpowers/specs/2026-08-14-avalon-boardgame-design.md)
- [真实环境人工验收手册](testing/lan-multiplayer-acceptance.md)
- [服务端权威秘密状态](adr/0001-server-authoritative-secret-state.md)
- [PostgreSQL 多房间持久化](adr/0002-postgresql-persistent-multi-room-storage.md)
- [MVP 不自动超时或管理员修改](adr/0003-no-automatic-timeout-or-admin-mutation-in-mvp.md)
- [pnpm workspace 边界](adr/0004-pnpm-workspace-package-boundaries.md)

## 里程碑状态

状态含义：✅ 已完成并有代码/测试证据；🟡 已部分完成；⬜ 未开始；⚠️ 需要专项处理。

| 里程碑 | 状态 | 当前证据与说明 |
| --- | --- | --- |
| 规则资料与领域术语 | ✅ | `docs/rules/`、`CONTEXT.md`、设计文档已建立。 |
| pnpm workspace 与包边界 | ✅ | `apps/web`、`apps/server`、`packages/game`、`infra/postgres` 已拆分。 |
| Avalon 规则核心 | ✅ | 角色分配、队伍、投票、任务、五拒绝、三任务、刺杀规则已在 `packages/game` 实现。 |
| 秘密状态与玩家视图 | ✅ | `packages/game/src/player-view.ts` 过滤 `secret`，只返回当前玩家允许看到的信息。 |
| Socket.IO 游戏服务 | ✅ | 游戏端口 8000，Lobby API 8001；支持独立 match。 |
| PostgreSQL 存储 | ✅ | `PostgresStorage`、schema、delta logs、列表过滤和 wipe 已实现；空闲连接错误由 Pool 监听器处理且不记录 Client/连接信息，本地集成测试可执行。 |
| 创建/加入/列出房间 | ✅ | Web Lobby 创建/加入流程已接入；响应式主页将 lobby/playing 合并为进行中列表并在卡片显示具体状态，finished 房间单独分页展示。主页验证本机全部活动房间凭据，已加入房间置顶并直接进入；存在活动会话时禁用创建和其他房间的加入入口。等待大厅允许非房主凭据授权释放自己的座位，房主可解散房间，playing 状态拒绝两类操作。 |
| 主页与等待大厅体验 | ✅ | 主页采用 LAN 圆桌主题；公共按钮统一使用 44px 高度、12px 圆角和一致的交互态，并用金色、青色、绿色、中性色区分创建、加入、进入和辅助操作。等待大厅使用 `100dvh` 固定视口，在桌面以当前玩家为底部锚点展示自适应圆桌，在移动端使用高度感知的座位网格，页面本身无滚动条，并保持房主开局、重连、返回主页和正式退出/解散入口；首个权威游戏状态到达前保持统一连接态，不会短暂渲染旧座位页。Playwright 使用 10 人房间在 1280×900 与 320×568 视口验证无页面溢出及开局、选队和投票可操作性；开发控制折叠层不会拦截底层操作。 |
| 玩家名称与入座入口 | ✅ | 主页不再内嵌名称表单；每次创建/加入新房间前都使用原生 `<dialog>` 确认名称，已保存名称只负责预填且自动聚焦全选。客户端和服务端共同限制 trim 后 1–24 字符，服务端在同一房间按 trim 后、不区分大小写拒绝重名；仅成功入座更新名称偏好，取消或失败不覆盖。已加入房间的进入与重连不重复询问名称。 |
| 座位绑定与重连 | ✅ | 房间路由、按房间保存凭据、client ID 防重复占座和重新连接已实现。房间首次加载与轮询通过只返回 204/403/404 的服务端端点校验私有 player credential；公开 session ID 仅作提前失效优化，不能授权会话。 |
| Debug Panel 默认收起 | ✅ | 使用 boardgame.io `debug.collapseOnLoad`，仍可手动展开。 |
| 角色与阶段展示 | ✅ | 游戏开始后保持圆桌布局；中央实体桌游式面板显示五次任务、每次队伍人数、当前任务和连续否决轨道，底部仅显示当前玩家角色、阵营和允许看到的邪恶玩家。 |
| 队伍提案 | ✅ | 队长直接点击圆桌座位选择正确人数，动作转发到服务端 `proposeTeam`。 |
| 队伍投票 | ✅ | 所有玩家可独立提交 approve/reject；中央操作区只显示自己的提交状态。 |
| 开发房间删除与踢人 | ✅ | `/dev/status` 确认启用后才显示主页 Token 面板；删除支持 lobby/playing/finished，踢人仅支持 lobby；连接中删除、匿名同步和延迟写入不会复活房间，快速复用座位即使复制旧公开数据也会由凭据校验拒绝旧会话；活动房间 metadata 使用按房间版本保护，延迟 fetch 不会被重新标记为当前版本，kick 和正式离座都会在旧写入之后权威落盘。当前 Server tests: 47 passed；Web tests: 75 passed. |
| 任务出牌 UI | ✅ | 仅任务队员可以操作；Good 只有 Success，Evil 可选 Success/Fail，提交后只向本人显示自己的牌并进入等待。 |
| 任务历史与公开结果 | ✅ | 中央任务板展示已结算任务的成功/失败状态和公开 Success/Fail 总数，不把任务牌关联到具体玩家。 |
| 刺杀 UI 与最终结算 | ✅ | 刺客从圆桌座位选择非已知邪恶目标；其他玩家等待。结算展示胜方、原因和目标，并在每个座位公开最终角色。 |
| 确定性随机与回放 | ✅ | `@avalon/test-support` 从 master seed 派生游戏/行动 seed，以统一 transcript 驱动规则层和 Socket.IO；失败 artifact 不包含凭据、Token 或秘密状态。 |
| 自动化完整局流程 | ✅ | 属性测试覆盖 5–10 人规则与可见性不变量；Socket.IO 回放与规则层权威状态对比；PR Playwright 门禁覆盖名称取消/预填/重名/并发抢座恢复、提案/投票/任务牌刷新、待结算秘密隔离、四种胜负结局和 10 人桌面/窄屏操作。Nightly 继续覆盖 5–10 人完整局矩阵，并增加 7 人第四次任务一败/两败和双活跃房间并行隔离。 |
| GitHub Actions 测试门禁 | ✅ | `main` 已启用分支保护并将质量、单元/Socket.IO、PostgreSQL 和浏览器 smoke 配置为 required checks；Nightly 每个人数 1,667 次属性测试及 5–10 人浏览器分片也已在 GitHub 托管 runner 上实际通过，可按 seed 回放。 |
| 真实环境人工验收 | ⬜ | 应用数据与模拟视口已自动化；人工只保留真实 Node 服务重启、目标 PostgreSQL 服务/volume 重启，以及手机、平板或其他电脑的实际 LAN/CORS/Socket.IO 链路。 |
| 重启后重连验收 | ⬜ | 存储、凭据和 GitHub 临时 PostgreSQL 容器重启已有自动测试，尚未完成目标部署环境的 Node 与 PostgreSQL 手工演练。 |
| 开发服务稳定运行方式 | ⚠️ | Codex 工具启动的长期进程会被环境回收；多人测试应在用户自己的两个终端中运行服务。 |

## 下一步执行顺序

### P0：完成可以打完一局的 Web 流程

- [x] **任务出牌 UI**
  - 只让当前任务队员看到出牌操作。
  - Good 只显示 Success；Evil 显示 Success/Fail。
  - 使用 `viewer.submittedQuestCard` 禁止重复操作并显示等待状态。
  - 非队员显示当前队伍和等待提示。
  - 任务完成后展示公开 Success/Fail 数量和任务结果。

- [x] **刺杀与结算 UI**
  - 只让 Assassin 选择 Good 目标。
  - 其他玩家显示等待 Assassin 的状态。
  - 展示胜者、胜利原因、目标和最终角色揭示。
  - 完成后支持回到主页，但不修改已结束房间。

### P1：自动化回归门禁

- [x] 规则层 5–10 人属性测试、版本化 seed 和 transcript replay。
- [x] 使用同一 transcript 对比规则层与真实 Socket.IO 服务端权威状态。
- [x] Playwright 使用独立浏览器上下文完成 5 人 smoke 和 5–10 人完整局矩阵。
- [x] GitHub Actions 配置 PR smoke、PostgreSQL 服务/数据库重启凭据恢复和每日深度矩阵。
- [x] GitHub Actions 的质量、单元/Socket.IO、PostgreSQL 服务重启凭据恢复和浏览器 smoke job 已实际通过。
- [x] Nightly 10,002 局属性测试和 5–10 人浏览器矩阵已在功能分支实际通过，日志无 timeout、warning 或 deprecation。
- [x] 在仓库设置中将稳定的 CI job 配置为受保护分支 required checks。

详细命令、seed 重放方法和 CI job 名称见 [自动化游戏流程测试](testing/automated-game-flow.md)。

### P2：真实环境验收

操作步骤、逐项预期结果和失败记录模板见 [LAN 多客户端人工验收手册](testing/lan-multiplayer-acceptance.md)。

- [ ] 重启 Node 服务，使用原凭据回到未结束房间。
- [ ] 安全重启 PostgreSQL 服务，确认原房间、座位凭据、进度和历史保持不变并可继续游戏。
- [ ] 使用手机、平板或其他电脑通过真实 LAN IP 完成加入、操作、断网恢复与重连，确认 CORS 和 Socket.IO 链路。

### P3：文档与运维收尾

- [x] 把稳定的多人测试启动方式和分级验收步骤写入 README/人工验收手册，明确需要用户自己的终端保持进程。
- [ ] 记录 PostgreSQL Compose 部署、备份和房间清理方式。
- [ ] 决定是否需要生产环境的反向代理、HTTPS 和更安全的会话/凭据恢复方案。
- [ ] 对 `docs/adr/` 中仍标记为 `proposed` 但已经执行的决策做状态整理。

## 当前验证基线

最近一次验证日期：2026-08-23

2026-08-23 自动化验收扩展验证：PR 浏览器门禁覆盖名称与冲突恢复、刷新与秘密提交、四种结局及 10 人响应式操作；Nightly 覆盖 5–10 人矩阵、7 人第四次任务一败/两败和双活跃房间。数据库 Pool 空闲连接错误回归仍保持 GREEN。

```text
pnpm test ✅ Game 29 passed；test-support 20 passed；Server 47 passed；Web 75 passed
pnpm build ✅ Game、Server TypeScript 与 Web TypeScript + Vite build
pnpm lint ✅ exit 0
pnpm typecheck ✅ Game、test-support、Server、Web、E2E exit 0
pnpm test:e2e ✅ 名称/冲突恢复、阶段刷新与秘密隔离、四种结局、10 人桌面/窄屏操作；9 passed / 9 nightly skipped，51.4 秒
pnpm test:e2e:matrix ✅ 5–10 人完整局、7 人第四次任务一败/两败、双活跃房间及 PR 场景；18 passed，2.7 分钟
Playwright 本地日志 ⚠️ Node 子进程提示 `NO_COLOR` 被 `FORCE_COLOR` 覆盖；测试无业务 warning/error，待 GitHub runner 验证新 workflow
PostgreSQL 本地集成测试 ✅ 5 个存储/重连用例实际连接本地 PostgreSQL 并通过；服务关闭会等待断连元数据写入完成后再关闭 pool
PostgreSQL 容器重启探针 ✅ GitHub Actions service container 中已完成存档、重启 PostgreSQL 和使用原凭据重连
GitHub Actions runner ✅ 质量、单元/Socket.IO、PostgreSQL 和浏览器 smoke 全部通过；workflow 已由 actionlint 校验，action 运行时为 Node.js 24，日志无 warning/deprecation
GitHub Actions Nightly ✅ 每个人数 1,667 次、共 10,002 局属性测试和 5–10 人浏览器矩阵全部通过；Property games 4 分 34 秒完成，完整日志无 timeout/warning/deprecation
浏览器交互复测 ✅ 已加入房间置顶并显示“进入”，创建和其他房间加入入口被锁定；“进入”直接复用凭据且不打开名称对话框
浏览器名称复测 ✅ 创建前必定显示名称确认弹窗；保存名称正确预填、自动聚焦并全选；取消不覆盖偏好；空白名称保留弹窗并显示字段错误；Console 无错误
浏览器退出复测 ✅ 普通玩家正式退出后释放座位并返回主页；房主解散后房间消失；同浏览器第二标签页在 300ms 内同步返回主页
浏览器初始化复测 ✅ Chrome 连续 5 轮刷新均捕获连接态和圆桌态；每轮 60 次高频采样中 `#root main` 最大为 1，且页面高度始终未超出视口
浏览器布局复测 ✅ 主页进行中列表标题不重复；10 人大厅在 320×568、320×844、1024×768、1440×900 下无页面滚动、横向溢出、座位裁切或重叠
游戏圆桌布局复测 ✅ 10 人游戏页在 320×568、1024×768、1440×900 下中央任务板和座位不重叠、页面无横向溢出；结束态角色改在各座位公开，中央结算板保持紧凑
游戏圆桌交互复测 ✅ 桌面 5 人队长选择 2 名队员后，中央按钮从 `提交 0/2` 正确变为 `提交 2/2` 并触发提案；透明座位层不再拦截中央操作，外围座位仍可点击
```

以上结果证明当前代码、构建、隔离浏览器自动化和 GitHub Actions/PostgreSQL 容器检查范围通过，**不等价于已经完成真实 5–10 台设备的局域网验收或部署环境的 PostgreSQL 重启演练**。

## 当前架构与运行方式

```text
浏览器 :5183
  ├── Lobby API :8001
  └── Socket.IO 游戏服务 :8000
          └── boardgame.io Server
                  └── PostgreSQL 192.168.100.13:5432
```

本机多人测试需要在两个保持打开的终端中运行：

```bash
# 终端 1：游戏服务和 Lobby API
pnpm dev:server

# 终端 2：Vite Web
pnpm dev
```

其他设备访问：

```text
http://192.168.100.117:5183/
```

服务端会从 `apps/server/.env.local` 读取 `DATABASE_URL` 和 `AVALON_ORIGINS`；当前局域网来源已配置为 `localhost:5183`、`127.0.0.1:5183`、`192.168.100.117:5183` 和 `192.168.100.118:5183`。该文件不得提交到 Git。

## 重要约束与已知问题

- `playerCredentials` 是 boardgame.io 的座位访问凭据，当前保存在浏览器 `localStorage`，用于刷新、重连和服务端会话校验；校验请求只在 Authorization header 中发送凭据，响应不返回凭据。`clientID` 仅用于防止同一浏览器在同一房间占多个座位。每次加入还会生成独立、公开且不具认证能力的 `sessionID`，它只能提前识别明显替换，不能作为授权依据。
- 已删除的 match ID 在当前服务进程生命周期内不允许复用；这是防止 boardgame.io 缺失房间按需同步复活和旧世代延迟写入污染的安全边界。正常创建继续使用随机新 ID。
- 同一浏览器配置的多个 Tab 共享 `localStorage`，因此属于同一个客户端；多人测试必须使用不同浏览器、浏览器配置或设备。
- 正常 Web 流程一次只允许同一浏览器参与现存的活动房间：所有已保存且通过凭据验证的 lobby/playing 房间显示“进入”，并阻止创建或加入新房间。该规则会同步其他标签页，但属于浏览器 UX 约束，不是可抵抗直接 API 调用的服务端授权边界。
- 等待大厅的正式离座与解散使用 boardgame.io player credential 授权并在 match queue 内重新校验状态；普通玩家只能释放自己的座位，座位 0 只能解散房间。playing 状态返回冲突并保留凭据；“返回主页”不会释放座位。
- 隐私窗口通常与普通窗口隔离，但同一隐私会话内的多个 Tab/窗口通常仍共享身份；关闭全部隐私窗口后本地凭据会消失，服务器座位不一定释放。
- 开发房间控制需要在服务端 `.env.local` 同时设置 `AVALON_DEV_TOOLS=true` 和非空 `AVALON_DEV_ADMIN_TOKEN`；本地测试时由操作者手动输入页面，Token 不得提交、嵌入 Web 配置或持久化，其他场景仍是服务器 secret。
- PostgreSQL 或 LAN 短暂不可达时，进行中的请求仍可能失败，需要在网络恢复后重试；空闲连接错误只记录错误码和消息，`pg-pool` 会移除失效连接，Node 服务不会再因缺少 Pool 错误监听器退出。
- 不配置自动超时；断线玩家可能阻塞当前阶段，这是 MVP 的明确设计选择。
- Debug Panel 是只读诊断入口，默认收起；不能绕过 `playerView` 或修改游戏状态。
- 游戏页将中央实体桌游式任务板拆为独立 `QuestBoard`，阶段操作、圆桌座位和当前玩家身份仍由 `RoomGamePanel` 统一编排；后续仅在行为继续扩展时再拆分阶段组件。

## 提交记录

最近的功能提交：

| Commit | 内容 |
| --- | --- |
| `90cff99` | 实现 Avalon 规则核心 |
| `3a022ed` | 添加 PostgreSQL storage adapter |
| `7ceeac6` | 添加 boardgame.io Socket.IO server |
| `4dc9046` | 添加 Lobby 与重连流程 |
| `59ff4db` | 防止同一 client 占用多个座位 |
| `d836eb7` | 修复无 `crypto.randomUUID` 环境下的 Web fallback |
| `b136a01` | Debug Panel 默认收起 |
| `f6e4635` | 队伍提案与投票 UI |
| `6a3fe1c` | 保存可复用玩家名称 |
| `b63ed55` | 抽取创建/加入房间流程 |
| `23afdb6` | 补充创建/加入流程回归断言 |
| `089e943` | 玩家名称原生弹窗与自动复用 |
| `2942cf1` | 开发房间管理 API 与无秘密状态目录 |
| `d79d6c8` | Web 主页浏览全部 Avalon 房间状态 |
| `f176294` | 房间页开发删除、踢人和失效会话处理 |
| `1e9c20c` | 阻止连接中删除房间被延迟断线写入复活 |
| `952c7fb` | 开发 mutation 端点 404 时保留本地会话 |
| `22190a7` | 使用每次加入 session ID 识别快速复用座位 |
| `16c723b` | 永久保留删除房间 tombstone，阻止匿名同步复活和 ID 复用 |
| `b46535b` | 添加只返回成功/未授权/不存在的服务端房间凭据校验 |
| `5bb570c` | 房间首次加载与轮询接入凭据校验，并按状态隐藏主页开发 Token 面板 |
| `93bf0a9` | 显式覆盖删除后的延迟 delta log 写入 |
| `605999c` | 为活动房间 metadata 增加 sync/async 版本保护，拒绝 kick 后的过期写入 |
| `3a61898` | 修复延迟 metadata fetch 版本绑定，并让 kick 在旧写入后权威落盘 |
| `8cbbfa6` | 重设计 LAN 房间主页 |
| `f662b24` | 补充最近房间恢复回归断言 |

每个独立模块完成后应：

1. 更新本文件的里程碑和下一步。
2. 运行与范围匹配的测试、build、lint/typecheck。
3. 记录实际验证结果，而不是只记录计划。
4. 使用一个聚焦的提交，便于后续跟踪 diff。
