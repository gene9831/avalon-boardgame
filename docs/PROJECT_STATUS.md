# Avalon Online 项目进度

> 这是项目进度的唯一维护入口。更新代码或完成一个独立模块后，同时更新本文件的状态、验收条件和提交记录。
>
> 最后更新：2026-08-20

## 当前结论

项目已经完成“可连接、可入座、可开始、可进行队伍提案和全员投票”的第一条垂直切片，但还不能从网页完整打完一局阿瓦隆。

当前阶段：**LAN MVP 开发中 / 游戏流程 UI 未闭环**

当前分支和提交以 `git branch --show-current`、`git log -1 --oneline` 为准；本文件不固定记录 HEAD。

已完成的基础能力：

- 5–10 人独立房间和多房间 Lobby。
- boardgame.io phases、stages、activePlayers、Socket.IO 多人同步。
- 服务端权威角色、秘密状态和 `playerView`。
- PostgreSQL 持久化、房间列表过滤和日志级联删除。
- 座位绑定、浏览器 client ID 防重复占座、房间路由和凭据重连。
- Web 端角色信息、队伍提案和全员队伍投票。
- Web 主页创建/加入房间入口、原生玩家名称弹窗、名称 localStorage 自动复用和失败重试。
- 开发模式房间页控制：可删除任意状态房间、在大厅踢出占用座位；被删除/踢出后会清理当前房间凭据并返回主页。

当前最大缺口：**任务出牌、刺杀、结算展示和 5–10 个真实浏览器的完整局域网验收**。

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
| PostgreSQL 存储 | ✅ | `PostgresStorage`、schema、delta logs、列表过滤和 wipe 已实现；本地集成测试可执行。 |
| 创建/加入/列出房间 | ✅ | Web Lobby 和 boardgame.io Lobby 流程已接入。 |
| 玩家名称与入座入口 | ✅ | 主页不再内嵌名称表单；创建/加入前使用原生 `<dialog>` 收集名称，保存后自动复用，确认前不创建房间或占座。 |
| 座位绑定与重连 | ✅ | 房间路由、按房间保存凭据、client ID 防重复占座、重新连接和清除本机凭据已实现。 |
| Debug Panel 默认收起 | ✅ | 使用 boardgame.io `debug.collapseOnLoad`，仍可手动展开。 |
| 角色与阶段展示 | ✅ | 当前房间页显示自己的角色、阵营和可见邪恶玩家。 |
| 队伍提案 | ✅ | 队长可选择正确人数，动作转发到服务端 `proposeTeam`。 |
| 队伍投票 | ✅ | 所有玩家可独立提交 approve/reject；只显示自己的提交状态。 |
| 开发房间删除与踢人 | ✅ | 房间页开发控制默认收起；删除支持 lobby/playing/finished，踢人仅支持 lobby；轮询发现房间或当前座位失效时清理会话并返回主页。 focused Web tests: 26 passed. |
| 任务出牌 UI | ⬜ | 服务端规则已完成，Web 端尚未提供 Success/Fail 操作。 |
| 任务历史与公开结果 | ⬜ | `questHistory` 已在游戏状态，Web 端尚未展示。 |
| 刺杀 UI 与最终结算 | ⬜ | 服务端 `assassinate` 已完成，Web 端尚未提供目标选择和结果页。 |
| 5–10 客户端人工验收 | ⬜ | 需要使用多个浏览器配置/设备实际走完流程。 |
| 重启后重连验收 | ⬜ | 存储与凭据机制已有测试，尚未完成部署环境手工演练。 |
| 开发服务稳定运行方式 | ⚠️ | Codex 工具启动的长期进程会被环境回收；多人测试应在用户自己的两个终端中运行服务。 |

## 下一步执行顺序

### P0：完成可以打完一局的 Web 流程

- [ ] **任务出牌 UI**
  - 只让当前任务队员看到出牌操作。
  - Good 只显示 Success；Evil 显示 Success/Fail。
  - 使用 `viewer.submittedQuestCard` 禁止重复操作并显示等待状态。
  - 非队员显示当前队伍和等待提示。
  - 任务完成后展示公开 Success/Fail 数量和任务结果。

- [ ] **刺杀与结算 UI**
  - 只让 Assassin 选择 Good 目标。
  - 其他玩家显示等待 Assassin 的状态。
  - 展示胜者、胜利原因、目标和最终角色揭示。
  - 完成后支持回到主页，但不修改已结束房间。

### P1：真实多人验收

- [ ] 创建 5 人房间，使用 5 个独立浏览器配置/设备进入同一房间。
- [ ] 验证不同客户端都能看到正确的角色视图，不泄露完整 `secret`。
- [ ] 验证队伍提案、投票和任务出牌可以同时提交。
- [ ] 验证重复点击、刷新、断线重连不会重复提交或改变已结算事件。
- [ ] 验证拒绝五次、三次任务失败、三次任务成功后刺杀三种结束路径。
- [ ] 创建第二个房间并并行操作，确认房间状态隔离。
- [ ] 重启 Node 服务，使用原凭据回到未结束房间。

### P2：文档与运维收尾

- [ ] 把稳定的多人测试启动方式写入 README，明确需要用户自己的终端保持进程。
- [ ] 记录 PostgreSQL Compose 部署、备份和房间清理方式。
- [ ] 决定是否需要生产环境的反向代理、HTTPS 和更安全的会话/凭据恢复方案。
- [ ] 对 `docs/adr/` 中仍标记为 `proposed` 但已经执行的决策做状态整理。

## 当前验证基线

最近一次验证日期：2026-08-20

```text
pnpm test       ✅ packages/game 28 tests, apps/server 13 tests, apps/web 18 tests
pnpm build      ✅ game typecheck + server typecheck + web TypeScript/Vite build
pnpm lint       ✅ oxlint
pnpm typecheck  ✅ game + server + web TypeScript checks
```

这些命令证明代码级规则、类型和打包通过，**不等价于已经完成真实 5–10 浏览器的局域网验收**。

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

- `playerCredentials` 是 boardgame.io 的座位访问凭据，当前保存在浏览器 `localStorage`，用于刷新和重连；`clientID` 仅用于防止同一浏览器在同一房间占多个座位。
- 同一浏览器配置的多个 Tab 共享 `localStorage`，因此属于同一个客户端；多人测试必须使用不同浏览器、浏览器配置或设备。
- 隐私窗口通常与普通窗口隔离，但同一隐私会话内的多个 Tab/窗口通常仍共享身份；关闭全部隐私窗口后本地凭据会消失，服务器座位不一定释放。
- 不配置自动超时；断线玩家可能阻塞当前阶段，这是 MVP 的明确设计选择。
- Debug Panel 是只读诊断入口，默认收起；不能绕过 `playerView` 或修改游戏状态。
- 当前 Web 组件以一个房间页文件和阶段面板为主，任务/刺杀完成后再评估是否需要进一步拆分。

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

每个独立模块完成后应：

1. 更新本文件的里程碑和下一步。
2. 运行与范围匹配的测试、build、lint/typecheck。
3. 记录实际验证结果，而不是只记录计划。
4. 使用一个聚焦的提交，便于后续跟踪 diff。
