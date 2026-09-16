# Avalon Online 项目进度

> 这是项目进度的唯一维护入口。更新代码或完成一个独立模块后，同时更新本文件的状态、验收条件和提交记录。
>
> 最后更新：2026-09-16

## 当前结论

项目已经完成从创建房间、入座开局到任务、刺杀和胜负结算的 Web 操作闭环；规则、Socket.IO、PostgreSQL 和 5–10 个隔离浏览器上下文已有分层自动化方案，但尚未完成 5–10 台真实设备的完整局域网验收。

当前阶段：**LAN MVP 开发中 / Docker Compose 部署链路已验证，等待真实 LAN 设备和宿主机反向代理验收**

当前分支和提交以 `git branch --show-current`、`git log -1 --oneline` 为准；本文件不固定记录 HEAD。

已完成的基础能力：

- 5–10 人独立房间和多房间 Lobby。
- boardgame.io phases、stages、activePlayers、Socket.IO 多人同步。
- 服务端权威角色、秘密状态和 `playerView`。
- PostgreSQL 持久化、房间列表过滤和日志级联删除；空闲连接的 Pool 错误和活动查询从 boardgame.io Socket.IO 事件逸出的错误都会输出凭据安全的诊断摘要，不再以未处理事件或 Promise rejection 终止 Node 进程。
- 座位绑定、浏览器 client ID 防重复占座、房间路由、凭据重连和服务端凭据会话校验。
- 创建房间会原子创建并让创建者以房间拥有者身份进入；普通加入由服务端按提交时的最低空座位自动分配，等待房间允许凭据授权换到任一空座位，拥有者身份和权限跟随玩家而不是固定在 0 号座位。
- Web 主页将等待开局和游戏中的房间统一列入“进行中的圆桌”，卡片显示具体状态并提供分页；已结束房间单独列出。
- Web 主页会验证本机保存的全部活动房间凭据；已加入房间置顶并直接“进入”，存在活动房间时禁止从正常浏览器流程创建或加入其他房间，并同步同一浏览器的其他标签页。
- Web 的加载、等待大厅、身份辨认、队伍提案、全员投票、任务秘密出牌、刺杀和最终结算共用单一 `RoomScreen`；PC、平板和移动端都由业务外壳测量最终舞台内容盒并调用共享圆桌求解器，当前玩家固定在底部、其他玩家顺时针排布。五次任务进度常驻外壳，桌心只显示当前公开摘要，真实操作统一位于阶段面板。
- 房间场景重构已完成：控制器只产出已过滤的 `RoomScene`/对应 actions，座位与任务进度展示归入 `room-presentation.ts`，删除旧模型、中心/阶段内容、叠层和兼容入口。真实房间的角色牌使用 `identityConfirmation`，授权线索使用 `identityRecognition`；线索场景保持圆桌可见，只在本人主动查看时显示私密座位标记，旧 observer 幕布和无额外线索确认场景已删除。
- 新房间默认成对启用 Percival 与 Morgana，也可在创建时关闭并使用基础角色。开局身份辨认包含两个全局串行阶段：全员先独立确认自己的身份，服务器在最后一人确认后才统一释放线索；随后邪恶玩家、Merlin 和启用的 Percival 并行完成各自线索辨认，无线索角色等待。公共状态只显示当前阶段及匿名完成数，最后一名线索参与者完成后才原子进入首次组队；无倒计时、自动跳过、房主或管理员代办。旧状态结构不再兼容，部署新版本前必须显式删除既有房间。
- Web 使用仅保存在浏览器的随机默认名称与八款装饰头像；主页 Header 用户中心在存在活动房间座位时保持锁定，等待房间内可点击自己的原姓名牌复用同一弹窗修改名称和头像，正式开局后立即锁定。创建/加入直接使用当前资料，不再弹出名称确认；同一房间允许同名并以座位号区分。
- 创建房间先打开配置弹窗，当前支持 5–10 人选择、阵营/任务人数摘要与 Percival/Morgana 成对配置。
- Web 提供统一“帮助说明”：主页桌面端使用文字入口、移动端收为 44px 图标，等待大厅和游戏页使用图标入口；弹窗分为“游戏基础规则”和“角色说明”两个 Tab。创建配置中的角色问号会直接打开角色说明，将帕西维尔与莫甘娜前置并短暂脉冲高亮；Merlin、Percival、Loyal Servant、Assassin、Morgana、Minion 六个 MVP 角色均使用响应式角色立绘，宽屏 4:3 区域使用同图模糊背景填充并在上层完整显示清晰原图。
- Web 角色立绘已建立显式素材转换流程：无损 PNG 母版保存在 `images/source/roles/`，`apps/web` 使用 Sharp 按原比例生成 `320w`、`480w` 与各母版原生宽度的 WebP，并保留透明通道、验证输出后原子替换派生文件；以下划线开头的保留母版不参与转换。当前 674px 与 752px 两类母版均保留各自原生最大候选，帮助说明按角色元数据输出对应的固有宽高和原生 `srcset`；游戏圆桌仍使用既有方形角色头像。
- Assassin、Loyal Servant、Merlin、Minion、Mordred、Morgana、Oberon 与 Percival 的角色头像使用独立于角色说明立绘的 AI 横向扩图母版；原始高度为 1051/1010/1127 px，方形不透明 sRGB PNG 母版保存在 `images/source/role-avatars/`。Web 使用质量 90 的 256×256 不透明 WebP 衍生图；当前六个 MVP 角色的身份卡和圆桌通过 CSS 圆形蒙版显示，Mordred 与 Oberon 仅预先生成头像资产，未加入当前规则或 UI。
- `images/source/` 下 17 个 PNG 母版由 Git LFS 管理；每个 clone 运行一次 `pnpm assets:setup` 后，共享 `.git/lfs` 只保留一份母版缓存，普通 worktree 默认检出指针。立绘、头像或全部母版可分别通过 `pnpm assets:pull:roles`、`pnpm assets:pull:avatars`、`pnpm assets:pull` 按需展开；常规测试和构建只依赖已提交 WebP，`pnpm assets:verify` 显式验证已展开母版、转换器和部署头像。素材相关路径另有独立 CI；`main` 中 18 个历史 PNG 版本也已迁移为 LFS 指针并完成远端历史切换，迁移前恢复包保存在仓库外。
- 系统通知统一使用最多三条的顶部 Toast；主页不提供通知历史入口。换座成功、稳定失败和结果不确定分别使用明确的成功、错误和确认中通知。房间 Header 提供无未读徽标的操作日志，记录当前客户端观察到的公开加入/退出，以及开局、提案、结算投票、匿名任务结果、刺杀和胜负。
- Web 房间页已完成统一响应式重写；大厅与游戏复用同一套座位、舞台和三段式阶段面板。空座只在圆心显示自然座位号，圆形本身是唯一换座控件；换座期间保留原桌面并只在目标空座显示 spinner。房主开局位于阶段操作槽，退出/解散进入房间工具；健康连接不显示状态，连续断线 8 秒后才提供手动重连。当前最低验收对为 375×667 与旋转后的 667×375；横向舞台不可行时只显示舞台不可用，不切回竖版。
- 等待大厅支持玩家凭据授权的主动离座：普通玩家只释放自己的座位，房主解散整个房间；游戏开始后拒绝这两类操作，返回主页仍是保留座位的无损导航。
- 开发模式房间页控制：可删除任意状态房间、在大厅踢出占用座位；删除 ID 在进程生命周期内保持不可用，匿名 Socket.IO 同步和延迟写入都不能复活房间，被删除/踢出后会清理失效凭据并返回主页；活动房间的过期 metadata 快照也不能恢复旧名称或凭据，kick 会在旧写入之后权威落盘。
- 游戏测试使用版本化 RNG seed、统一命令 transcript 和确定性 replay；同一失败可在规则层、Socket.IO 层或浏览器层重放。
- Playwright 使用每玩家独立 browser context 自动完成创建、加入、刷新重连和整局游戏；GitHub Actions 负责快速 PR smoke、两片浏览器回归、PostgreSQL 检查和每日 5–10 人分片矩阵，不依赖开发者电脑。
- 根目录提供一体化生产部署 `compose.yml`：单一网关端口承载静态 Web、Lobby API 与 Socket.IO，Node 和 PostgreSQL 仅在 Compose 内网可达；数据既可使用 Docker named volume，也可通过同一环境变量切换为宿主机目录挂载。

当前最大缺口：**5–10 台真实设备的完整局域网验收，以及实际域名、TLS 和子路径下的宿主机 Nginx 联调**。隔离 Docker 主机上的 Node 重启、PostgreSQL 重启、整栈停止后重建、named volume 与 bind mount 持久化均已验证；CI 的既有质量、单元/Socket.IO、数据库容器重启重连、浏览器 smoke、Nightly 10,002 局属性测试和 5–10 人浏览器矩阵已在 GitHub 托管 runner 上通过，但本次新增的 Compose smoke workflow 尚未在 GitHub Actions 上运行。

## 目标与范围

### MVP 必须支持

- 局域网内 5–10 个浏览器客户端进入同一个房间。
- 多房间同时存在，房间状态互不影响。
- Merlin、Assassin、Loyal Servant of Arthur、Minion of Mordred、Percival、Morgana。
- 首次组队前两段串行、段内并行的线上身份辨认仪式与角色视野。
- 队伍提案、全员投票、任务出牌、三次任务成功后的刺杀和胜负结算。
- 服务端权威管理秘密状态；客户端不得收到其他玩家不应看到的角色或未结算选择。
- PostgreSQL 持久化，游戏服务重启后可以使用原座位凭据重连。

### 明确不在当前 MVP

- Mordred、Oberon、Lady of the Lake 和其他扩展。
- 账号、服务端持久玩家档案、语音、聊天、AI、排行榜。浏览器本地装饰资料不属于账号系统。
- 队伍提案、投票、任务牌或刺杀等战略阶段的自动超时推进。
- 房主/管理员修改已发生游戏状态。
- 多个游戏服务进程、分布式 Socket.IO、Pub/Sub 和分布式锁。

相关决策见：

- [已确认的游戏设计](superpowers/specs/2026-08-14-avalon-boardgame-design.md)
- [真实环境人工验收手册](testing/lan-multiplayer-acceptance.md)
- [服务端权威秘密状态](adr/0001-server-authoritative-secret-state.md)
- [PostgreSQL 多房间持久化](adr/0002-postgresql-persistent-multi-room-storage.md)
- [MVP 不自动超时或管理员修改](adr/0003-no-automatic-timeout-or-admin-mutation-in-mvp.md)
- [两段串行、段内并行的服务端权威身份辨认](adr/0013-independent-identity-recognition.md)（取代 [旧截止线方案](adr/0006-server-authoritative-identity-recognition-deadlines.md)）
- [收紧 boardgame.io 协议面](adr/0007-restrict-boardgame-protocol-surface.md)
- [保留已持久化房间的角色配置](adr/0008-preserve-persisted-room-role-configuration.md)
- [房间拥有者独立于 0 号座位](adr/0009-seat-independent-room-ownership.md)
- [开发与部署 Compose 分离](adr/0010-separate-development-and-deployment-compose.md)
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
| PostgreSQL 存储 | ✅ | `PostgresStorage`、schema、delta logs、列表过滤和 wipe 已实现；空闲连接错误由 Pool 监听器处理，活动查询错误在 boardgame.io Socket.IO 请求边界处理，两类日志都不记录 Client、连接信息或请求参数，本地集成测试可执行。 |
| Docker Compose 部署 | ✅ | 根目录 `compose.yml`、多阶段 `Dockerfile` 与轻量 Nginx 网关组成一体化部署；只发布一个可配置端口，内部服务有健康检查和依赖顺序，支持 Docker named volume 与宿主机 bind mount。隔离 Docker 主机已验证构建、健康启动、根路径/子路径、Socket.IO、API、故障响应和两类持久化。 |
| 创建/加入/列出房间 | ✅ | 创建与创建者入座由一个服务端操作原子完成；普通加入不接受客户端选择座位，而是在 match queue 内分配提交时的最低空座位。`@avalon/game` 使用共享 Zod schema 定义严格请求和公开房间目录，Server 通过推导类型构造允许列表，Web 在接收边界原子拒绝无效或重复数据并保留上一次有效限制状态。响应式主页将 lobby/playing 合并为进行中列表，满房显示“已满”，finished 房间单独分页展示。主页验证本机全部活动房间凭据，已加入房间置顶并直接进入；存在活动会话时禁用创建和其他房间的加入入口。等待大厅允许普通玩家凭据授权释放自己的座位，房间拥有者可解散房间，playing 状态拒绝两类操作。 |
| 主页与等待大厅体验 | ✅ | 主页、创建配置、房间列表和等待提示使用面向普通玩家的中文产品文案；公共按钮统一使用至少 44px 的触控尺寸和一致交互态。创建配置与退出/解散房间的业务弹窗共用原生 `ModalDialog`。等待大厅不再拥有独立布局：它通过统一 `RoomScreen` 显示真实空座位、房主、连接状态、五次任务要求、阶段操作和房间工具；当前玩家固定在底部，空位可凭据授权换座，开始游戏后同一结构直接进入身份辨认。房间根使用 `100dvh`、安全区和三模式外壳，主页仍按内容滚动。 |
| 游戏与角色帮助 | ✅ | 统一宽版弹窗提供“游戏基础规则”和“角色说明”语义化 Tab；基础规则包含阵营目标、回合流程、关键规则及 5–10 人配置表，房间内会标出当前人数。角色说明覆盖 Merlin、Percival、Loyal Servant、Assassin、Morgana、Minion 的阵营、能力、目标与提示。创建配置中的问号支持 hover/focus tooltip 和 click/touch 深入说明；上下文打开时帕西维尔与莫甘娜前置并以较平缓的节奏脉冲两次，`prefers-reduced-motion` 下关闭动画。移动端角色说明使用横向列表项，左侧保留 88px 宽原比例立绘、右侧显示完整说明；`sm` 及以上保持三列纵向卡片和 4:3 图片区域，清晰前景完整显示，同图模糊背景负责填满剩余区域。主页在移动端只显示 44×44 问号图标，`sm` 及以上显示“帮助说明”文字；等待大厅和游戏页继续使用图标入口。所有入口复用同一弹窗，支持方向键切换 Tab、Escape 关闭及焦点恢复。 |
| 玩家名称与入座入口 | ✅ | 浏览器首次使用从 24 个中世纪奇幻意象与 24 个身份词中组合随机中文名称（576 种组合），并随机选择八款装饰头像，一并保存在 `localStorage`；主页 Header 用户中心支持名称校验、头像选择和重新随机，跨标签页同步。只要本机仍保存并验证出活动房间座位，主页资料仍只读；但游戏保持 lobby 时，玩家可点击圆桌上自己的原姓名牌复用同一用户中心弹窗，凭 seat credential 原子更新公开名称与头像、游戏玩家名、当前房间会话和浏览器资料，并实时同步同房间客户端。服务端队列以实际处理顺序裁决资料保存与开局竞争；开局后拒绝修改并关闭未提交草稿，断线期间可保留草稿但不能保存。创建和加入直接使用当前资料，不再询问名称；客户端和服务端共同限制 NFC/trim 后 1–24 字符。同一房间允许同名，所有公开日志使用名称加座位号区分；client ID 仍防止同一浏览器重复占座。头像采用 ImperialOctopus/avalon-printable 的八款角色图标并按 CC BY 4.0 署名，但仅作为装饰，不表达隐藏角色；用户中心的“素材与许可”可用键盘展开与折叠，折叠时不暴露许可链接。 |
| 通知与房间操作日志 | ✅ | 系统通知统一显示为顶部 Toast：桌面右上、移动端顶部居中，普通/成功默认 4 秒、错误默认 8 秒，最多保留三条且可手动关闭；调用方可为明确交互指定时长，换座成功使用 3 秒、失败和网络确认中使用 8 秒。主页不显示铃铛或通知历史。房间 Header 使用日志图标且不显示未读圆点/数量，桌面为右侧抽屉、移动端为底部抽屉；日志按旧到新记录公开玩家操作，不含时间戳、清空或分页。等待房间只记录当前客户端实际观察到的加入/退出；开局后可从公开状态重建开局、提案、已结算的逐人投票、匿名成功/失败牌总数、刺杀目标和胜负，不读取 viewer 私密信息。 |
| 座位绑定与重连 | ✅ | 房间路由、按房间保存凭据、client ID 防重复占座和自动重新连接已实现。等待房间可使用当前 seat credential 换到空座位，credential 和房间拥有者身份一起重绑到目标；请求期间使用可续租的浏览器全局 transition marker 暂停其他标签页的过期源座位失效处理。换座开始后冻结当前大厅快照，仅目标空座显示 spinner；成功响应以目标凭据重建 boardgame.io Socket.IO 客户端，只有目标连接建立且 `matchData` 确认目标座位后才原子切换桌面。Socket.IO 的玩家元数据与 `G.lobby.ownerPlayerID` 同步玩家列表和房主座位，不再依赖 2.5 秒房间轮询。丢失、超时或瞬态响应转为 uncertain 后立即精确重放原 match/source/credential/target，并在后续 Socket.IO 连接或元数据变化时去重重试；稳定拒绝恢复原空座，遗留 requesting marker 只在租约到期时执行一次恢复。旧标签页只能更新或清理仍与相同 opaque transition ID 及精确源会话匹配的状态。健康连接不占用界面；断线时顶部先显示自动恢复状态，连续失败 8 秒后才出现手动重连。房间首次加载与按需恢复通过只返回 204/403/404 的服务端端点校验私有 seat credential；公开 session ID 仅作提前失效优化，不能授权会话。 |
| Debug Panel 默认关闭 | ✅ | boardgame.io 内置 Debug Panel 显式设为 `false`；生产默认配置下不显示内置调试入口，也不显示自定义开发控制入口。 |
| 响应式房间布局模型 | ✅ | Browser-safe `@avalon/ui-layout` 拥有纯圆桌求解器、`room-layout.css` 容器查询结构样式与详细 `/diagnostics` 子路径。生产 Web 由 `RoomScreen`/`RoomLayout` 组合，CSS Container Query 选择竖版、紧凑横版或普通横版；舞台区域可大于求解器边界，但其中居中的实测舞台内容盒固定不超过 744×800，`ResizeObserver` 只测量该内容盒并调用 `solveRoundTableStageLayout`。旧 `room-shell.css`/`ROOM_SHELL_CLASSES` 仅保留给既有 Layout Lab，待单独批准迁移。横屏不可行只替换舞台提示；开发诊断显示实际视口、安全区、画布、舞台、人数、头像和形态，不读取秘密。 |
| 角色与阶段展示 | ✅ | 游戏开始后使用统一求解圆桌；固定 128px 桌心只显示当前任务、阶段提示和连续否决状态，唯一五轮任务进度由业务外壳在竖屏/普通横屏顶栏或紧凑横屏左侧任务轨道呈现，阶段操作常驻外壳而不进入桌心。当前任务队伍在桌心统一使用 112px 宽的“座位号 + 单行姓名”竖向列表，与外围姓名牌的最大宽度一致，不再复用难以区分的装饰头像；长名称截断但座位号始终可见，十人第五任务的五名队员仍可放入桌心。进行中的姓名牌不常驻显示本人角色；身份开关只替换本人的装饰头像并显示 `playerView` 授权的知识，开关值继续跨刷新、房间、阶段和同浏览器标签页同步。角色牌仅在本人主动查看时覆盖舞台；线索辨认与完成等待都保留正常圆桌，对局结束公开角色的既有行为保持不变。 |
| 开局身份辨认 | ✅ | `startGame` 为每名玩家建立私有、单调的个人阶段，并用公开 `stage` 串行身份确认与线索辨认。全员确认身份前不释放任何座位线索；最后一人确认后，邪恶玩家、Merlin 与启用的 Percival 并行进入线索辨认，其余角色等待。公共状态只含当前阶段及匿名 `completedCount / participantCount`，`playerView` 只返回当前玩家的个人阶段和当前阶段已授权线索。线索默认隐藏标记，可主动查看或暂时隐藏；完成者回到正常桌面，眼睛开关可恢复本人身份及已知座位。Socket.IO、刷新与服务重启恢复全局和个人阶段，重复提交不重复计数，最后一名线索参与者原子触发首次组队。旧角色组队列、deadline、observer 幕布、无线索确认和兼容分支均已删除。 |
| 队伍提案 | ✅ | 队长直接点击圆桌座位选择正确人数，动作转发到服务端 `proposeTeam`。预览队伍在桌心使用金色虚线姓名行，可通过行尾 `×` 取消；圆桌上的入选玩家使用金色头像环和头像底边水平居中的 `任务` 标签，并只执行一次约 180ms 的强调动画。 |
| 队伍投票 | ✅ | 所有玩家可独立提交 approve/reject；投票进行中公开提交者座位和 `x/n 已投票` 进度，但每张赞成/反对选择在全部提交前仍只向本人可见。进行中的 `已投票 n/m` 位于任务队伍列表上方；确认后的任务队伍在桌心使用金色实线只读姓名行，并移除仅供预览取消按钮使用的尾部空列。16px 编号圆圈使用 10px 无衬线数字并保留明确内边距，队员姓名也统一使用界面无衬线字体，圆桌上的队员继续显示金色头像环与完整单行的 `任务` 标签。提交状态以无边框、透明背景的中性 Lucide `BadgeCheck` 显示在座位左下角，结算后原位替换为绿色赞成勾或红色反对叉；图标不参与布局、不占用姓名牌内容宽度，也不会移动头像或姓名牌。座位号保持左上角、队长皇冠保持顶部、任务标签保持头像底边居中，避免四种标记互相遮挡；`prefers-reduced-motion` 下关闭任务队伍强调动画。中央区域同时显示通过/否决及赞成、反对总数；通过结果保留到该任务全部队员提交任务牌，否决结果保留到下一次投票开始，连续第五次否决的结果保留在最终结算。图标的完整文字含义也包含在座位可访问名称中，不只依赖颜色。 |
| 开发房间删除与踢人 | ✅ | `/dev/status` 确认启用后，主页与房间统一显示右下角 Lucide `Bug` 悬浮入口；桌面使用悬浮面板，移动端使用最大 70dvh 的底部抽屉，Token 仅保存在当前路由内存中。面板支持遮罩、再次点击、Escape、焦点循环和安全区避让，操作错误通过触发器圆点和面板详情反馈；状态接口关闭或失败时不暴露入口。主页删除仍保留在对应房间卡片，房间内删除支持 lobby/playing/finished，踢人仅支持 lobby；连接中删除、匿名同步和延迟写入不会复活房间，快速复用座位即使复制旧公开数据也会由凭据校验拒绝旧会话；活动房间 metadata 使用按房间版本保护，延迟 fetch 不会被重新标记为当前版本，kick 和正式离座都会在旧写入之后权威落盘。 |
| 任务出牌 UI | ✅ | 仅任务队员可以操作；正义阵营只能让任务成功，邪恶阵营可以让任务成功或失败，提交后只向本人显示自己的牌并进入等待。 |
| 任务历史与公开结果 | ✅ | 中央任务板展示已结算任务的成功/失败状态和公开成功/失败牌总数，不把任务牌关联到具体玩家。 |
| 刺杀 UI 与最终结算 | ✅ | 刺客从圆桌座位选择非已知邪恶目标；其他玩家等待。结算展示胜方、原因和目标，并在每个座位公开最终角色。 |
| 确定性随机与回放 | ✅ | `@avalon/test-support` 从 master seed 派生游戏/行动 seed，以统一 transcript 驱动规则层和 Socket.IO；失败 artifact 不包含凭据、Token 或秘密状态。 |
| 自动化完整局流程 | ✅ | 属性测试覆盖 5–10 人基础/成对角色规则与可见性不变量，test-support 以完整权威 occupancy 启动回放；Socket.IO 回放与规则层权威状态对比。Playwright 快速 smoke 覆盖原子创建入座、自动最低空座加入、并发加入、拥有者换座、0 号座位复用及完整五拒绝游戏；其余两片浏览器回归覆盖满房文案、换座期间不进入全局加载、Socket.IO 成功确认、成功后断线恢复、精确占座失败 Toast、瞬态响应与同浏览器旧标签页恢复、刷新、完整 44px 指针点击区与键盘操作、Percival 私密视野、提案/投票/任务牌秘密隔离、四种胜负结局和 5/7/10 人目标视口。Nightly 继续覆盖 5–10 人完整局矩阵、7 人第四次任务阈值和双活跃房间并行隔离。 |
| GitHub Actions 测试门禁 | ✅ | `main` 已启用分支保护；质量、单元/Socket.IO、PostgreSQL 与兼容既有 context 名称的浏览器聚合检查保持 required，浏览器聚合仅在快速 smoke execution 和两片 regression 全部成功后通过。普通 CI 使用 pnpm 11 原生 setup action，避免旧 action 的 npm self-installer 抖动；普通 PR 与 `main` 的属性测试固定使用 fast-check seed `424242`、输出脱敏进度并为每个人数保留 15 秒 runner 抖动余量，Nightly 每个人数 1,667 次属性测试及 5–10 人浏览器分片继续使用每日可回放 seed。本分支新增不发布镜像的 Docker Compose smoke job，等待本 PR 的 GitHub Actions 结果。 |
| 真实环境人工验收 | 🟡 | 隔离 Docker 主机已完成 Node、PostgreSQL 和整栈重启及原凭据重连；仍需手机、平板或其他电脑的实际 LAN/CORS/Socket.IO 链路，以及宿主机 Nginx 的域名、TLS 和子路径联调。 |
| 重启后重连验收 | ✅ | 隔离 Docker 主机已分别验证 Node 重启、PostgreSQL 重启和 `down` 后保留数据卷再 `up`，原座位凭据均可继续访问同一房间；named volume 与 bind mount 均通过。 |
| 开发服务稳定运行方式 | ⚠️ | Codex 工具启动的长期进程会被环境回收；多人测试应在用户自己的两个终端中运行服务。 |

## 下一步执行顺序

### P0：完成可以打完一局的 Web 流程

- [x] **任务出牌 UI**
  - 只让当前任务队员看到出牌操作。
  - 正义阵营只显示“让任务成功”；邪恶阵营显示“让任务成功”与“让任务失败”。
  - 使用 `viewer.submittedQuestCard` 禁止重复操作并显示等待状态。
  - 非队员显示当前队伍和等待提示。
  - 任务完成后展示公开成功/失败牌数量和任务结果。

- [x] **刺杀与结算 UI**
  - 只让刺客选择正义阵营目标。
  - 其他玩家显示等待刺客行动的状态。
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

- [x] 在隔离 Docker 部署中重启 Node 服务，使用原凭据回到未结束房间。
- [x] 在隔离 Docker 部署中重启 PostgreSQL 服务并重建整栈，确认原房间、座位凭据和持久化状态仍可访问。
- [ ] 使用手机、平板或其他电脑通过真实 LAN IP 完成加入、操作、断网恢复与重连，确认 CORS 和 Socket.IO 链路。
- [ ] 使用实际域名、TLS 与目标子路径联调宿主机 Nginx；容器仍只接收剥离子路径后的请求和 `X-Forwarded-Prefix`。

### P3：文档与运维收尾

- [x] 把稳定的多人测试启动方式和分级验收步骤写入 README/人工验收手册，明确需要用户自己的终端保持进程。
- [x] 记录 PostgreSQL Compose 部署、更新、备份、恢复和数据卷切换方式。
- [x] 明确反向代理边界：宿主机 Nginx 负责域名、TLS、子路径剥离与前缀头，容器网关只负责应用内部路由和前缀化页面。
- [ ] 决定是否需要更安全的跨设备会话/凭据恢复方案。
- [ ] 对 `docs/adr/` 中仍标记为 `proposed` 但已经执行的决策做状态整理。

### 工程规范渐进整改

- [x] 使用共享 Zod schema 统一房间目录契约，并在 Web 接收边界拒绝无效或重复数据。
- [ ] 按四阶段完成其余外部输入边界整改；客户端输入继续由服务端验证，每个接收方在自己的边界解析一次：
  - [x] **阶段 1：服务端协议面与入口加固** — HTTP 允许列表、strict create/join、最小 Room detail、安全 5xx、仅对已存在房间开放合法 Seat sync、禁用 chat、统一秘密比较、载荷上限和固定 boardgame.io。
  - [ ] **阶段 2：Web 网络与实时接收边界** — 解析 create/join/getMatch 响应、`AvalonPlayerView` 和 `matchData`，并提供可恢复的契约错误状态。
  - [ ] **阶段 3：浏览器存储 v1** — 为 RoomSession/Profile 建立 v1 Schema，拒绝 legacy，并仅在检测到不兼容数据时提供临时清理入口。
  - [ ] **阶段 4：服务端配置边界** — 统一 Zod 配置，校验 Origin、数据库 URL、开发 Token 和不受支持的 `API_SECRET`。
- [ ] 保留 PostgreSQL 事务原始错误上下文，并为持久化数据增加损坏/版本边界处理。
- [ ] 改善 Storage API 同步/异步类型表达，收紧其余第三方适配层中的 `any` 与宽泛断言。
- [ ] 拆分 `App.tsx` 的 Lobby、Room、连接、会话和日志职责。
- [ ] 删除无引用资源和启动断言技术债，完成最终文档与验证收口。
- [ ] 输入边界整改期间仅在检测到不兼容浏览器存储时提供临时清理入口；所有开发设备完成清理后、真实 LAN 人工验收前删除该入口，保留永久的 v1 Schema 与损坏数据安全处理。

## 当前验证基线

最近一次验证日期：2026-09-16

2026-09-16 等待房间资料编辑：新增严格共享资料更新契约和凭 seat credential 授权的房间端点；服务端在每房间队列内同时更新 lobby metadata、`G.players` 和持久化时间戳，只向同房间 Socket.IO 客户端广播去除 credential 的 `matchData`。Web 在等待房间把当前玩家原姓名牌变为语义按钮，不添加可见提示或改变既有 class、data、style；点击后复用主页用户中心弹窗并一次提交名称与头像。成功结果同步当前房间会话、浏览器资料和后续创建/加入资料；断线时保留可编辑草稿但禁用保存，普通失败保留草稿并显示行内错误，开局先被服务端序列化时关闭弹窗并显示明确通知，阶段离开 lobby 也立即丢弃未提交草稿。保存期间锁定关闭、输入、头像和随机按钮；主页已有活动房间时的锁定行为保持不变。永久回归覆盖严格请求/响应、认证和原子更新、playing 拒绝、凭据不泄漏、同房间实时广播、会话并发保护、姓名牌语义与外观契约、弹窗异步状态、断线和开局竞争。根级 `pnpm test` 为 Game 86、UI Layout 80、Web 460、Test Support 25、UI Layout Lab 67、Server 92 passed / 6 PostgreSQL tests skipped，共 **810 passed / 6 skipped**；`pnpm build`、`pnpm lint`、`pnpm typecheck`、Web 最小字号检查与 `git diff --check` 均 exit 0。Web build 仅保留 617.45 kB minified / 184.29 kB gzip chunk 超过 500 kB 的既有建议性警告，Server build 仅有约 2.4 MB 体积提示。未执行 Playwright、真实 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 重启或凭据重连验收。

2026-09-16 任务队伍辨识优化：桌心在队伍预览、确认、投票和任务阶段统一改为紧凑的“座位号 + 姓名”竖向列表，移除容易与真实玩家混淆的重复装饰头像；列表宽度由 152px 收敛到与外围姓名牌最大宽度一致的 112px，确认态移除预览取消按钮对应的尾部空列。预览行使用金色虚线并提供可访问的行尾取消按钮，确认后改为金色实线只读行，空缺名额显示明确占位。圆桌外围的入选队员统一增加金色头像环和头像底边水平居中的完整单行 `任务` 标签，投票标记移至左下角，确保与左上角座位号、顶部队长皇冠互不遮挡；任务队伍强调只执行一次约 180ms，减少动态偏好下完全关闭。桌心编号圆圈缩至 16px，数字使用 10px 无衬线粗体并增加与行边框的留白，队员姓名同步使用界面无衬线字体；进行中的 `已投票 n/m` 移至队员列表上方，结算票数仍保留在列表下方。永久回归覆盖姓名/座位号、长名截断、预览取消、确认只读、占位、信息顺序、外围标记及真实渲染几何；Web **63 files / 447 tests passed**，build、lint、typecheck 与 `git diff --check` 均 exit 0。相关 Playwright **5/5 passed**，覆盖 5/7/10 人统一房间外壳、任务标签居中且单行完整显示、编号直径/字体/留白、姓名字体及 112px 列表宽度与确认态尾部留白；PR 首轮 CI 暴露旧投票标记几何回归会在 180ms 任务队员动画中途取基线，现改为等待目标头像的真实 Web Animation 完成后再测量，未放宽容差或删除动画；原失败用例本地 **1/1 passed**，CI 同款 Browser regression 2/2 shard **14/14 passed**。应用内浏览器人工确认真实五人投票房间，以及十人第五任务的五名队员与长名称预览，未见桌心溢出或标记碰撞。Web build 仅保留 614.64 kB minified / 183.41 kB gzip chunk 超过 500 kB 的既有建议性警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。本轮未改动服务端、规则、隐藏信息或持久化，未执行真实 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 重启或凭据重连验收。

2026-09-16 随机子路径角色立绘修复：公网部署使用宿主机 nginx 随机前缀时，角色帮助与身份确认曾生成站点根路径 `/images/roles/...`，绕过 `<base href>` 和私密前缀并返回 404；现由 `role-artwork` 统一生成 `./images/roles/...`，`src` 与全部响应式 `srcset` 会复用 gateway 根据 `X-Forwarded-Prefix` 注入的文档 base path，根路径图片仍保持不可访问。永久回归完成 RED→GREEN，Web **63 files / 448 tests passed**；`@avalon/web` build、lint、typecheck 与 `git diff --check` 均 exit 0，build 仅保留 614.03 kB minified / 183.38 kB gzip chunk 超过 500 kB 的既有建议性警告。PR #34 的修复已部署到 gateway；服务器构建使用只含 Git 跟踪文件的临时上下文，未包含 `.env`、PostgreSQL `data/` 或未跟踪文件。公网验收确认域名根目录角色图片 404、随机前缀角色图片 200、健康检查 200、Socket.IO WebSocket 101；无头 Chromium 打开实际邀请页后，角色帮助中的 12 个前景/背景立绘元素全部通过部署 base path 完成加载。本轮只重建 gateway，PostgreSQL 与 server 未重建；未执行真实 5–10 台设备、多房间人工隔离、PostgreSQL 重启或凭据重连验收。

2026-09-15 PR #32 CI 稳定性修复：身份辨认 Playwright 不再查找已由统一座位表现移除的 `data-known-player-info` 图标，改为同时验证 Merlin 回看知识时存在 2 个 `known-evil` 头像边框和 2 个“邪恶”文本标签。UI Layout Lab 的确认视口正确性用例继续执行真实圆桌求解，仅将该组 CPU 密集型用例的局部超时从 Vitest 默认 5 秒提高到 15 秒；生产求解器与全局测试配置不变。身份专项 Playwright **1/1 passed**，UI Layout Lab **2 files / 67 tests passed**，完整 `pnpm test` 共 **798 passed**；`pnpm build`、`pnpm lint`、`pnpm typecheck` 与 `git diff --check` 均 exit 0。Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告，Web build 仅保留 614.06 kB minified / 183.38 kB gzip chunk 超过 500 kB 的建议性警告；测试生成的 `test-results` 已删除。

2026-09-15 Web 最小字号整改：完整审计首页、主要弹窗、真实五玩家身份视角、房间日志与开发诊断，并遍历大厅、身份确认、线索辨认、组队、投票、任务、刺杀和结算代表场景。玩家姓名、“掉线”、帮助页“可选角色”、日志分组标题和开发诊断统一提升到至少 12px；仅由阿拉伯数字组成的独立编号允许最低 10px，头像与任务队伍共用的座位号通过 `data-numeric-text` 显式进入例外并保持 14×14px 徽章。工程规范记录了普通文本 12px、纯数字编号 10px 的强制边界；`check-minimum-font-size.mjs` 会扫描所有 TS/TSX 任意字号与被引用的本地 CSS，并由永久 Vitest 回归覆盖。聚焦 Web 测试 **6 files / 43 tests passed**；完整 `pnpm test` 为 Game 85、UI Layout 80、Web 448、Test Support 25、UI Layout Lab 67、Server 93，共 **798 passed**。首次整仓并行测试仅因 UI Layout 10 人布局用例超过 10 秒上限而退出；该文件单独复跑 **21/21 passed**，随后未改代码的完整重跑全部通过。`@avalon/web` typography check、build、lint、typecheck 与 `git diff --check` 均 exit 0。Web build 仅保留 614.06 kB minified / 183.38 kB gzip chunk 超过 500 kB 的既有建议性警告。应用内浏览器确认真实五人局、角色帮助和房间日志中除显式纯数字编号外没有低于 12px 的可见文本；头像与任务队伍编号均为 10px/14×14px，十人身份辨认代表场景无页面溢出，长名称继续使用既有受控宽度。本轮没有执行 Playwright、真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连验收。

2026-09-15 身份辨认回看优化：身份确认和线索确认在权威个人阶段推进后不再显示多余的成功 Toast，失败通知与提交 pending 恢复保持不变。进行中的线索辨认现在也保留眼睛开关，可随时显示或隐藏本人角色；线索仍由当前场景的“查看线索 / 暂时隐藏”独立控制。线索参与者完成后及后续对局中，眼睛开关继续同时恢复本人角色和 `playerView` 已授权的邪恶座位或 Merlin 候选座位。无线索角色等待线索参与者时删除了割裂的辅助句，只保留阶段标题和匿名进度；线索视图底部固定的本人座位也不再重复显示“你”标签，其他授权目标标签保持不变。Web 测试为 **62 files / 435 tests passed**；`@avalon/web` build、lint、`@avalon/e2e` typecheck 与 `git diff --check` 均 exit 0。身份专项 Playwright 为 **1/1 passed**，覆盖无成功 Toast、无线索等待文案、线索阶段身份开关、完成后恢复身份与授权线索及最终进入组队；仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。Web build 保留 612.83 kB minified / 183.13 kB gzip chunk 超过 500 kB 的建议性警告。应用内浏览器另在当前真实房间复核无线索等待态与 Percival 线索态，确认多余文案已消失，线索阶段眼睛开关可隐藏并恢复本人角色；开发预览另确认本人不再显示“你”，候选人标签仍正常。本次未改动后端、规则或持久化；未执行真实 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 进程重启或真实设备断网恢复验收。

2026-09-15 身份辨认两段式纠正：开局仪式改为全局串行的 `identityConfirmation → clueRecognition`，每个阶段内部仍允许参与者独立并行确认。全员确认身份前，已确认玩家进入 `waitingForClueRecognition`，只能通过眼睛复查自己的角色，服务端不会释放任何座位线索；最后一人确认后，公共匿名进度切换并重置为线索参与者集合，邪恶玩家、Merlin 与启用的 Percival 同时辨认各自线索，无线索角色等待。`playerView` 继续作为知识边界，重复或跨阶段提交无效；Socket.IO 重启测试覆盖全局阶段、个人阶段和匿名进度恢复。Web 为两个等待阶段显示不同文案，移除当前头像右下角无含义的勾号；线索参与者完成后，眼睛开关会同时恢复本人角色和已授权座位标记，等待态不再错误清空这些标记。本轮同步更新术语、角色视野规则、ADR-0013、接受设计与浏览器回归。根级 `pnpm test` 为 **784 tests passed**（Game 85、UI Layout 80、Web 434、UI Layout Lab 67、Test Support 25、Server 93），`@avalon/ui-layout` 继续使用 `--no-file-parallelism`；`pnpm build`、`pnpm lint`、`pnpm typecheck` 与 `git diff --check` 均 exit 0。身份专项 Playwright 为 **1/1 passed**，覆盖 5 名玩家的身份阶段屏障、线索并行、刷新重新隐藏、完成后眼睛恢复本人角色与 Merlin 已知邪恶座位、无旧幕布及最终进入组队；仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。Web build 保留 613.31 kB minified / 183.25 kB gzip chunk 超过 500 kB 的建议性警告。已通过开发管理接口显式删除不兼容的现有房间；更新后的开发后端运行于 8000/8001，Vite 运行于 5183，应用内浏览器全新访问旧房间 URL 会回到房间目录且目录为空。本次未执行真实 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 进程重启或真实设备断网恢复验收。

2026-09-15 独立身份辨认迁移：服务端将旧的全局 `roleReveal → evilRecognition → merlinRecognition → percivalRecognition` 队列替换为每名玩家私有且单调的 `identityConfirmation → clueRecognition → complete` 流程；邪恶玩家、Merlin 与启用的 Percival 在确认角色牌后各自查看线索，其余角色直接完成，不同玩家互不阻塞。公共状态只保留匿名 `completedCount / participantCount`，`playerView` 只返回当前玩家阶段与已授权知识；重复确认不重复计数，最后完成者原子进入首次组队，Socket.IO 重连和服务重启保持精确个人阶段。Web 真实房间完全使用 `RoomScreen` 的身份确认、线索和完成等待场景：移除旧 observer 幕布与无线索确认旁路，线索默认隐藏标记并可“暂时隐藏”，完成者回到正常圆桌且可只读查看身份知识；提交 pending 仅锁定当前按钮，权威阶段推进后显示成功 Toast，切换房间不会误报成功。本轮不保留旧状态适配、截止线、自动跳过或管理员代确认；部署前已通过开发管理接口显式删除唯一旧房间，更新后的开发后端在 8000/8001 运行，5183 首页人工确认可正常加载且房间目录为空。最终根级 `pnpm test` 为 **782 tests passed**（Game 85、UI Layout 80、Web 432、UI Layout Lab 67、Test Support 25、Server 93），`@avalon/ui-layout` 继续使用 `--no-file-parallelism`；`pnpm build`、`pnpm lint`、`pnpm typecheck` 与 `git diff --check` 均 exit 0。并发身份专项 Playwright 为 **1/1 passed**，覆盖五名玩家同时处于角色牌、线索、完成等待，线索暂时隐藏、刷新恢复、成功通知、无旧幕布及最终进入组队；仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。Web build 保留 612.64 kB minified / 183.11 kB gzip chunk 超过 500 kB 的建议性警告。未执行真实 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 进程重启或真实设备断网恢复验收。

2026-09-15 空座与换座反馈优化：空座取消左上角共享座位徽标和加号，只在圆心显示自然座位号；只有圆形本身可点击和键盘操作，完整最小点击区保持 44px。换座期间冻结原大厅座位快照，原座位保持可见、目标空座显示 spinner 与“换座中”，其余空座不可操作；路由凭据和可见会话分离，目标凭据的 boardgame.io Socket.IO 连接建立且 `matchData` 确认目标后才原子切换桌面，玩家列表和房主座位均从 WS 权威状态合并。确认完成后恢复正常 Socket.IO 断线与失效座位处理；另一标签页观察到确定失败并保留源会话时也会结束 pending。成功显示约 3 秒的 `已换到 N 号位`；稳定占座冲突恢复空座并显示约 8 秒的精确错误；网络、5xx 或无效响应保留 pending 并显示确认中通知，立即执行一次恢复，后续只由 Socket.IO 状态变化触发去重重试；原 2.5 秒房间轮询已删除，遗留 requesting marker 仅在租约到期时进行一次恢复。根级 `pnpm test` 为 **793 tests passed**（Game 88、UI Layout 80、Web 440、UI Layout Lab 67、Test Support 25、Server 93），`@avalon/ui-layout` 继续使用 `--no-file-parallelism`；`pnpm build`、`pnpm lint`、`pnpm typecheck` 与 `git diff --check` 均 exit 0。相关 Playwright 为 **9/9 passed**，覆盖响应式、瞬态恢复/隐私和 smoke；应用内浏览器另人工复核当前真实房间，确认空座编号居中、无外置空座徽标且桌面未偏移。Web build 仅保留 616.78 kB minified / 184.06 kB gzip chunk 超过 500 kB 的既有建议性警告。未执行真实 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 重启/凭据重连或真实设备断网恢复验收。

2026-09-14 真实房间身份场景迁移：先审计 `RoomRoute → RoomView → useRoomScreenController → ObservedRoomScreen → RoomScreen` 生产链路，确认大厅、组队、投票、任务、刺杀、各类公开结算和终局已经使用既定场景体系，本轮没有重复迁移；缺口集中在首次角色揭示仍旁路复用 `identityRecognition`，以及后续私密线索默认立即公开。生产控制器现将服务端 `identityRecognition.roleReveal` 映射为既有 `identityConfirmation` 场景，支持本地隐藏、揭示动画、再次隐藏、提交中、确认等待和确认后复查；后续邪恶同伴、梅林视野和帕西维尔候选线索也从不透明遮罩开始，只有主动揭示后才显示获授权标记，无额外线索的玩家仍直接确认，非参与者和缺失角色视图始终使用无私密数据的闭幕观察态。私密呈现按房间、辨认 step 和当前角色隔离，并在断线时复位，避免切房、换视角或重连复用已揭示状态；身份确认期间隐藏普通工具栏身份入口。原 `RoomIdentityRecognitionPresentation.roleReveal` 类型与重复渲染分支已删除；服务端 phase、step、协议、确认 move 和 `playerView` 安全边界均未改变。永久回归完成 RED→GREEN，并覆盖身份确认完整本地生命周期、线索揭示与提交、房间/角色切换及断线重连复位。最终根级 `pnpm test` 为 **790 tests passed**（Game 88、UI Layout 80、Web 437、UI Layout Lab 67、Test Support 25、Server 93）；`pnpm build`、`pnpm lint`、`pnpm typecheck` 与 `git diff --check` 均 exit 0，`@avalon/ui-layout` 继续按文件串行。Web build 仅保留单个 613.66 kB minified / 183.28 kB gzip JavaScript chunk 超过 500 kB 的既有建议性警告。真实身份流程 Playwright 为 2/2 passed，覆盖 5/10 人及 375×667、390×844、667×375、1339×786 视口；应用内浏览器另人工复核 375×667 与 667×375 的身份确认和邪恶同伴线索，确认隐藏态无角色立绘/私密标记、揭示后才出现，且页面无外层滚动。最终 Sol 整分支复审无可执行发现。未执行真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启/凭据重连或真实设备断线重连人工验收。

2026-09-14 房间场景复审收口：共享圆桌现在以明确的 1-based 座位号区分玩家，组队队长在桌心使用仅显示头像与编号的本地预选槽位，投票阶段沿用已提交队伍；非队长组队时只显示“等待队长提议队伍”和所需人数，不接收未提交选择。桌心与外围头像统一使用左上座位号徽章，空座中央显示 `＋`，任务队员以桌心令牌和外围青色强调对应，不再重复显示下方人物角标。投票、任务与刺杀结算改为浏览器标签页内的公开结算队列：首次快照只建立基线，新事件按顺序逐条呈现，继续按钮仅关闭本地结算而不发送服务端 move；历史回放会截断到对应任务进度，投票/任务结算不会提前显示后续任务结果或终局全员身份，刺杀结算只揭示目标，真正的对局结果才揭示全部角色。进行中的结算仍支持查看本人身份及 `playerView` 已授权线索。合入前整分支 Sol 复审发现并修复了终局结算与断线同批到达时可能提前展示全部角色的问题；最终 Terra 复评无 P0–P3。同期清理了仅供开发预览使用的生产 CSS 引用、重复渲染分支和 8 个不保护生产契约的冗余测试，并将端到端测试迁移到当前场景控件契约。实际自动化验证为根级 **788 tests passed**（Web 62 files / 435 tests）、`pnpm typecheck`、`pnpm lint`、`pnpm build` 与 `git diff --check` 全部 exit 0；受影响的端到端场景 18/18 通过。Vite 仅保留单个 614.34 kB minified / 183.42 kB gzip JavaScript chunk 超过 500 kB 的建议性警告。应用内浏览器人工复核覆盖 5、7、10 人竖屏及紧凑横屏的组队、投票、任务、刺杀和终局代表场景，并针对最新编号方案检查大厅、组队、投票、刺杀、终局及 36–56px 头像层级，未发现页面或内部滚动溢出。`dev/room-layout` 基础方案现视为完成；真实游戏房间的统一视觉替换不纳入本轮合入，留待后续集中实施。本次仍未执行真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连人工验收。

2026-09-13 房间场景重构清理：先完成遗留 consumer 搜索，再删除无消费者的旧入口、模型、中心、阶段内容、overlay 和仅覆盖其内部结构的测试；保留并继续运行 scene controller 的隐藏信息与请求状态回归。新增 loading preview 的测试先因模块缺失 RED，随后实现 development-only `/dev/room-layout/loading` 路由和索引入口后 GREEN。最终复审将正式身份辨认 scene 的私密呈现收敛为 `roleReveal`、`clue`、`observer` 判别联合：获授权的第一幕参与者始终看到完整 `RoleCard`，确认等待期间也保留角色资料；非参与者不携带私密内容并保持静态闭幕。控制器在连接丢失时清除身份、提案、投票、任务和刺杀五类本地 pending，同时保留队伍、投票、任务牌和刺杀目标选择，允许同阶段重连后重试。实际自动化验证：聚焦 4 files / 59 tests 通过；`pnpm --filter @avalon/web test` 为 **59 files / 391 passed**；`pnpm --filter @avalon/web exec tsc -p tsconfig.app.json --noEmit`、`pnpm --filter @avalon/web build`、`pnpm --filter @avalon/web lint` 与 `git diff --check` 均 exit 0。Vite 保留单个 603.20 kB minified / 181.31 kB gzip JavaScript chunk 超过 500 kB 的建议性警告。Chromium 本地预览已完成 390×844 竖屏、844×390 紧凑横屏、1280×720 标准横屏三视口矩阵：10 条顶层场景代表路由共 30 个组合通过，控制台为 0 error / 0 warning；该检查早于最终复审修复，且仅覆盖本地 preview 和 5 人代表场景，未覆盖 6–10 人密度、Firefox、Safari/iOS 安全区、浏览器缩放或系统文字缩放。真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连验收仍未执行。

2026-09-12 组建队伍与全员投票 RoomLayout 原型 checkpoint：开发预览索引现集中提供基础布局、五个等待大厅场景、队长/队员组队场景和全员投票场景。投票阶段桌心仅显示当前任务、等待全员投票与可选连续否决进度；阶段区固定为“表决任务队伍”标题、同意/反对两项和底部确认按钮。投票采用先选择再确认的两步交互，覆盖未选择、已选择、正在确认、提交失败恢复以及已确认锁定；公开提交进度仅通过玩家头像的低调标记呈现，不显示票型，任务队员使用与顶栏任务人数相同的 `UserRound` 图标。应用内浏览器已在 465×813 竖屏检查默认、选择、提交中和已确认反对状态，中间区可容纳两个 44px 选项且未出现滚动条；任务队员、队长、房主、掉线和已投票标记可以并存。

同一 checkpoint 继续加入执行任务原型：索引直达正义任务队员、邪恶任务队员和非任务队员三个场景，不增加阶段子索引。公共桌心显示通过队伍的赞成/反对总数与匿名任务牌提交数量；`playerView` 只增加匿名计数，本人的已提交牌仍只在自己的 viewer 中可见。正义任务队员固定提交成功牌，邪恶任务队员先选择成功/失败再确认，非任务队员仅看到等待说明；预览控制覆盖提交中、失败重试、本人已提交、表决明细三秒展示、任务结算三秒展示及自动进入下一次组队。任务结果继续以第几次任务为主信息，成功/失败和牌数为次要信息；7 人以上第 4 次任务显示“任务失败需满 2 张失败牌”。应用内浏览器已在 496×817 竖屏检查三种默认视角。

同一 checkpoint 继续加入刺杀原型：索引直达刺客、邪恶同伴和正义玩家三个场景。刺杀阶段隐藏上一轮的队长、任务队员和投票角标，五次任务轨道保留历史结果但不再标记当前任务。刺客本地选择只在自己的模型中显示；邪恶同伴与正义玩家分别看到协助和等待说明，不接收本地目标。确认期间锁定选择，失败后保留目标并允许重试；掉线的正义玩家仍可作为目标。预览控制可模拟命中或未命中，先用三秒结算态只突出并揭示目标玩家，再进入公开全部角色的最终结果。应用内浏览器已在 496×817 竖屏检查三种默认视角。

本 checkpoint 实际验证：新增行为测试按 RED→GREEN 运行；共享刺杀模型聚焦 Web 测试 **47 passed**，刺杀入口与索引聚焦测试 **9 passed**，完整 `pnpm --filter @avalon/web test` 为 **348 passed**，完整 `pnpm --filter @avalon/game test` 为 **88 passed**；`pnpm --filter @avalon/web exec tsc --noEmit`、`pnpm --filter @avalon/web build`、`pnpm --filter @avalon/web lint` 与 `git diff --check` 均 exit 0。Web build 仅保留 Vite 单个 581.82 kB minified / 176.91 kB gzip JavaScript chunk 超过 500 kB 的建议性警告。本轮未执行新阶段横屏人工检查、真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连验收。

同一 checkpoint 完成对局结果原型：终局桌心固定显示胜方、决定性原因和最终任务比分；阶段区只保留“对局结束”与查看记录提示，不提供状态变更按钮。所有座位使用服务端公开的 `revealedRoles` 切换为真实角色头像，姓名牌下方显示短角色名并以低饱和青/玫红边框区分阵营；辅助描述仍保留完整角色名。终局会清除房主、掉线、队长、任务队员、投票、刺杀目标和知识角标，身份揭示使用约 300ms 淡入且在 `prefers-reduced-motion` 下关闭。工具栏隐藏身份入口，保留帮助、记录与更多操作。统一索引新增四个互斥的直属结果场景：正义刺杀未命中、邪恶刺杀命中、邪恶三次任务失败、邪恶连续否决五支队伍；每页可切换 5–10 人和帕西维尔/莫甘娜配对角色。应用内浏览器已在约 496×817 竖屏检查四个默认场景，并额外检查 10 人、关闭配对角色的布局和任务门槛信息。

终局 checkpoint 实际验证：行为与入口测试按 RED→GREEN 运行；完整 `pnpm --filter @avalon/game test` 为 **88 passed**，完整 `pnpm --filter @avalon/web test` 为 **361 passed**；`pnpm --filter @avalon/web lint`、`pnpm --filter @avalon/web exec tsc -b`、`pnpm --filter @avalon/web build` 与 `git diff --check` 均 exit 0。Web build 仅保留 Vite 单个 582.73 kB minified / 177.18 kB gzip JavaScript chunk 超过 500 kB 的建议性警告。本轮未执行终局横屏人工检查、真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连验收。

同一 checkpoint 完成首次身份确认原型：开发预览新增未揭示、已揭示、正在确认和等待其他玩家四个直属场景，继续复用真实 `RoomScreen` / `RoomLayout`，但暂不接入真实游戏控制器。首次进入时舞台只显示可主动揭示的牌背；揭示后显示完整竖版角色立绘、阵营、目标、能力和行动提示，不提前释放后续身份辨认知识。主动揭示使用同一张双面牌完成 180° 翻转和向上让位，横屏同时向左展开说明；反向隐藏回到中央牌背，阶段文案与按钮在动画完成前保持原状态并锁定操作。直接打开揭示态和再次查看只做短淡入，减少动态效果偏好下近乎立即完成。身份确认场景不再重复显示“仅你可见”；身份牌始终固定且完整可见，只有说明面板在内容超出剩余空间时独立滚动。身份场景蒙层使用 38% 深色遮罩、3px 轻模糊和 82% 背景亮度，使圆桌轮廓与座位分布保持可辨认，同时维持身份牌的视觉焦点。确认请求期间保持身份可见并禁用操作；失败使用统一错误 Toast 后恢复“我已记住身份”，成功后返回圆桌，只公开聚合确认进度并在本人座位显示确认标记。等待态不再叠加悬浮层，确认人数、“玩家已确认身份”和“等待其他玩家确认”直接使用桌心；阶段操作区继续提供再次查看，并以“收起身份”返回，不重复确认。应用内浏览器已检查 1280×720 普通横屏、390×844 与 375×667 竖屏和 844×390 紧凑横屏，额外覆盖 10 人等待态和长角色名；375×667 的角色牌固定完整，说明面板为 123px 可视高度 / 272px 滚动内容，页面本身无滚动，紧凑横屏双按钮不换行或越界。等待态另以 5 人和 10 人组合复核竖屏与横屏，桌心文案没有悬浮底板、座位重叠或页面溢出。

首次身份确认 checkpoint 实际验证：聚焦 Web 测试 **25 passed**，完整 `pnpm --filter @avalon/web test` 为 **374 passed**；`pnpm --filter @avalon/web exec tsc -b`、`pnpm --filter @avalon/web build`、`pnpm --filter @avalon/web lint` 与 `git diff --check` 均 exit 0。蒙层细化后额外运行身份确认聚焦测试 **11 passed**、Web build、Web lint 与 `git diff --check`，均 exit 0；应用内浏览器复核默认 496×817 竖屏和 844×390 紧凑横屏的未揭示/已揭示状态，页面无溢出。Web build 仅保留 Vite 单个 588.81 kB minified / 178.55 kB gzip JavaScript chunk 超过 500 kB 的建议性警告。本轮未执行真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连验收。

同一 checkpoint 完成身份辨认原型：开发预览把邪恶同伴、Merlin 邪恶视野、Percival 候选人与无额外线索四种视角收束为同一套同时辨认流程，并提供四条直属场景路由。圆桌本身承担私密信息展示：桌心只显示当前线索语义，目标玩家保留普通头像并使用双环与“同伴”“邪恶”或完全同形的“候选人”短标；本人和非目标座位分级压暗，房主、掉线、队长、任务队员和投票等过程角标在本阶段隐藏。夜幕只降低桌面亮度和饱和度并加轻量暗角，不使用内容悬浮层或模糊圆桌；揭示时以桌心波纹和目标座位短淡入完成过渡。状态机精简为未查看、揭示中、已显示、确认中和等待；已显示时只保留“我已辨认”或“我已了解”，不提供暂时隐藏、再次查看或收起线索。确认请求期间保持线索可见并锁定唯一按钮，失败以统一 Toast 返回已显示状态；成功后清除所有私密标记，把聚合 `x / n` 进度、“玩家已完成辨认”和“等待其他玩家”放入桌心，等待态不再提供操作。预览模型只接收场景类型和目标玩家 ID，不携带目标角色；真实服务端现有分步身份辨认与 `playerView` 边界没有改动，未来接入同时流程前仍需单独批准并同步规则、控制器和相关文档。

身份辨认 checkpoint 实际验证：聚焦 Web 测试 **37 passed**，完整 `pnpm --filter @avalon/web test` 为 **387 passed**；`pnpm --filter @avalon/web exec tsc -b`、`pnpm --filter @avalon/web build` 与 `pnpm --filter @avalon/web lint` 均 exit 0。应用内浏览器逐项复核四种视角、确认中保留线索、失败 Toast 和成功等待；最新精简复核确认已显示态只有一个确认按钮，确认中只有禁用的“正在确认…”，等待态没有操作按钮。390×844 竖屏、844×390 紧凑横屏及 10 人候选人场景均无页面或座位越界，候选人双环计算样式一致，控制台无 warning/error。Web build 仅保留 Vite 单个 593.46 kB minified / 179.49 kB gzip JavaScript chunk 超过 500 kB 的建议性警告。本轮未执行真实业务接入、真实 5–10 台设备 LAN、多房间隔离、PostgreSQL 重启或凭据重连验收。

2026-09-11 等待大厅 RoomLayout 验收 checkpoint：真实 `RoomScreen` 已通过 `RoomLayout` 与 `@avalon/ui-layout/room-layout.css` 的 CSS Container Query 组合；不再由 `ROOM_SHELL_CLASSES` 或 JavaScript 选择三种业务形状。等待大厅已确认桌心、座位、帮助/更多工具栏、heading/middle/action 阶段槽与八秒延迟手动重连表现；开发入口提供五个场景（玩家/房主 × 未满员/满员、当前玩家掉线），每页可切换 5–10 人。真实浏览器已加载 70 个组合（五场景 × 5/10 人 × 375×667、390×844、667×375、844×390、600×515、900×515、1024×768）：全部 ready，座位与可见产品控件均未越界；600×515 保持紧凑三列，900×515 和 1024×768 为普通横向。10 人满员样本为 375×667 359×427 stadium、600×515 336×499 stadium、900×515 588×435 circle、1024×768 704×680 circle。诊断只含 viewport/safe/canvas/stage/player/avatar/shape，位于 stage 右上；浏览器 console 为 0 errors / 0 warnings。交互已复核精确目标换座待决、房主/玩家开局状态、手动重连的一次 Toast、当前座位连接恢复、5/10 人帮助、记录抽屉、More 的 Escape/外点关闭与回焦，以及恢复期禁用房间变更。折叠开发触发器不再带悬空 `aria-controls`，并上移至 phase action 槽上方；More 的外点关闭改在 document `click`（浏览器原生 mousedown 焦点处理后）回焦，不阻止外点本身操作。

本 checkpoint 实际验证：`pnpm --filter @avalon/web exec vitest run` 指定的 18 个 RoomLayout/大厅文件 **142 passed**；`pnpm --filter @avalon/web build`、`pnpm --filter @avalon/web lint`、`pnpm --filter @avalon/ui-layout test`（78 passed）、`pnpm --filter @avalon/ui-layout typecheck` 与 `git diff --check` 均 exit 0。Web build 仍仅有 Vite 单个 573.55 kB minified / 174.50 kB gzip chunk 超过 500 kB 的建议性警告。完整 `pnpm --filter @avalon/web test` 为 **302 passed / 3 failed**；仅有既有 `tests/LobbyView.test.tsx` 的三个短房间号断言失败（finished、current、ownerless），没有新增失败。本轮没有运行真实 5–10 台设备 LAN、多房间人工隔离、目标 PostgreSQL 重启或原凭据重连验收。

下一步：先复核身份辨认原型；暂不将首次身份确认或身份辨认原型整体替换到真实业务游戏流程。

2026-09-11 完整房间生命周期统一布局验证（迁移前历史记录）：当时 `@avalon/ui-layout` 的 `room-shell.css`/三模式外壳曾被 Lab 与 Web 共用；该生产 Web 结构已由后续 waiting-lobby checkpoint 迁移为 `RoomLayout` + `room-layout.css` CSS Container Query，旧 `room-shell.css` 现在仅供 Layout Lab 使用。该次验证还记录：Web 删除旧 `RoomLobbyPanel`、`RoomGameShell`、`RoundTable`、`SolvedRoundTableStage` 和 `RoundTableQuestSummary`，加载、大厅、身份辨认、组队、投票、任务、刺杀与结算全部通过一个 `RoomScreen`；`ResizeObserver` 测量最终舞台内容盒；横屏不可行只替换舞台提示；房间标题只显示 ID 前七位；玩家指针命中只覆盖头像与名称；五个 44px 任务节点在自身矩形底部以至少 12px 的 `UsersRound`/`CircleX` 信息显示人数和失败阈值；固定 152px 桌心只显示公开摘要。本人已提交的投票/任务牌仍在阶段面板私下反馈，其他玩家只看到公共提交进度；身份知识偏好继续跨刷新和同浏览器标签页同步。开发模式支持关闭、尺寸和完整边界三档真实 Web 诊断，读取实际视口、安全区、画布、舞台、人数、头像尺寸、形态及同一次求解的几何，不读取凭据或隐藏游戏状态。

本轮 `pnpm test` 为 Game 88、UI Layout 78、test-support 25、UI Layout Lab 67、Server 93、Web 256，共 607 passed；`pnpm build`、`pnpm lint`、`pnpm typecheck` 与 `git diff --check` 均 exit 0。Lab Playwright 为 26 passed；正式 Web 的响应式、刷新/隐私和身份辨认三组 Playwright 为 8 passed，覆盖 5/7/10 人、375×667、667×375、390×844、844×390、1024×768、旋转选择保持、舞台诊断、身份幕布、重连和待决秘密。Web build 的单个 JavaScript chunk 为 568.37kB minified / 173.35kB gzip，仍仅触发既有 500kB 建议警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。未执行真实 iOS/Android 刘海安全区和触控、5–10 台真实 LAN 设备、多房间人工隔离、目标 PostgreSQL 重启或原凭据重连演练，因此未声称这些人工验收通过。

2026-09-10 三模式业务外壳验收矩阵验证：`apps/ui-layout-lab` 的业务外壳以完整画布宽高选择竖版、紧凑横版或普通横版，圆桌数学则只以实际分配的舞台宽高独立选择方向。稳定矩阵覆盖 `375×667`、旋转后的 `667×375`、`390×844`、`844×390`、`430×932`、`932×430`、`768×1024` 与 `1024×768`；每个画布对 5–10 人直接调用公开 `solveRoundTableStageLayout`，共 48 个真实求解，全部返回 `ready`，并确认桌面、桌心、座位、头像和姓名矩形均处于业务外壳交付的硬舞台边界内。最终收尾确认头像与玩家边界圆在 X/Y 双轴同心，姓名允许超出圆边界但仍计入舞台完整包络；`375×667` 的 10 人结果因此恢复为更大的 40px 跑道。业务根布局使用 `safe-area-inset-left/right/bottom` 避让设备安全区。迁移期旧矩形求解器及其专用测试、类型和几何函数已经删除；横屏规范与 SVG 仍由现行业务外壳使用而保留。Playwright 保留代表性竖版、紧凑/普通横版、向上信息、控制面板和旋转状态覆盖。本轮包级 Vitest 为 5 files / 138 tests passed；`typecheck`、`lint`、双入口 `build` 和 `git diff --check` 均 exit 0；Playwright 为 26 passed，仅有既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告。模拟画布人工检查已完成：`667×375` 紧凑横版和 `1024×768` 普通横版均确认布局被包含、画布没有溢出、向上信息可见，且在检查处设置可用。真实设备安全区、正式 `apps/web` 迁移、真实 LAN 与 PostgreSQL 验收均未执行。

2026-09-10 宽舞台统一圆桌算法验证：`solveRoundTableStageLayout` 与独立 `solveStadiumPlayerLayout` 均不新增方向参数，直接由 `maxStageWidth` 与 `maxStageHeight` 推导舞台方向；宽度大于高度时，中心线宽度限制为舞台短边，继续使用与竖屏相同的竖直轴对称算法并把完整结果水平居中，正方形沿用同一路径。玩家 0 仍位于六点钟，座位顺序和头像档位不因横屏旋转；原 `wide-stage-strategy-pending` 结果已移除，真实空间不足统一返回 `no-fitting-stage-layout`。业务 Lab 以产生 744×390 舞台的模拟页面验证 10 个座位、完整几何包含和设置面板可用；独立 Lab 追加 482×386、5 人、40px 头像回归，并在应用内浏览器确认输出居中的圆形布局。当时旧独立横向圆桌与横向胶囊算法只保留为已废弃的设计历史；随后 Lab 已完成三模式业务外壳，现仅正式 `apps/web` 迁移和真实设备验收待做。包级 Vitest 6 files / 116 tests passed，`lint`、类型检查与双入口 `build`、`git diff --check` 均 exit 0；本次快速修复未重跑 Playwright，修复前同分支的完整 Playwright 为 24 passed 且仅有既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。未执行真实横屏设备、正式 Web 迁移、真实 LAN 或 PostgreSQL 验收。

2026-09-10 业务布局圆形模型接入验证：`solveRoundTableStageLayout` 的高舞台策略改为复用 `solveStadiumPlayerLayout`，玩家碰撞边界统一为半径等于头像直径的圆；公共座位结果新增 `playerBoundaryCircle`，`playerSeatBounds` 只保留为头像、姓名和皇冠顶部预留的定位方框。桌心面板固定为 152px，业务求解器把桌心内容与边界合并为固定 80px 半径保护圆并直接传给数学模型，详细诊断返回同一个 `centerProtectionCircle`，渲染器不再从面板尺寸二次计算。业务诊断的玩家边界与 gap 线同步改为圆形几何。386×482、`gap=4`、默认 8px 头像步长下，5–10 人头像结果为 `[56, 56, 56, 56, 48, 48]`。按原型节奏执行直接相关验证：业务布局 Vitest 2 files / 32 tests passed，相关 Playwright 8 passed，`typecheck`、`lint`、双入口 `build` 与应用内浏览器视觉检查通过；未重新运行完整包级 Vitest、完整 Playwright、真实移动设备或正式 Web 迁移验收。

2026-09-10 独立跑道玩家圆形模型验证：`solveStadiumPlayerLayout` 不再委托矩形核心，新增圆形玩家边界、默认关闭的 `centerProtectionRadius`、公开圆心候选搜索、圆形优先与最短纵向跑道，以及量化后的舞台包含、全部玩家对、保护圆、中心线、锚点、顺序和竖轴对称复验。成功结果只暴露 `playerCircles`，不再暴露 `playerRects` 或重复的 `playerCenters`；迁移完成后，旧 `solveStadiumRectangleLayout` 及其专用测试、类型和几何函数已删除。模型另返回向下量化的 `maximumCenterProtectionRadius`，独立 Lab 在诊断层以浅色虚线圆直接显示当前布局的最大可用同心保护区，不在页面重复计算。数学 Lab 同时提供配置保护半径输入、URL 状态、保护圆与真实 clearance 诊断，并把玩家碰撞边界改画为圆。永久回归确认 386×482 下 5–8 人使用 56px、9–10 人使用 48px 可行，保护半径 88 下 5/6 人使用 56px 可行，代表性跑道缩短 0.01px 后不可行。包级 Vitest 6 files / 115 tests passed；Playwright 24 passed，覆盖独立 Lab 与业务 Lab 回归；`typecheck`、`lint`、双入口 `build` 与 `git diff --check` 均 exit 0。Playwright 仅有既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。未执行真实移动设备、手工浏览器视觉复核、正式 Web 迁移、真实 LAN 或 PostgreSQL 验收。

2026-09-09 圆桌严格集成收尾验证：公共业务求解器拒绝小于 4 的 `avatarSizeStep`，实验室 URL 对这类值恢复默认 8，设置输入使用 `min=4` / `step=4`。设置 `<dialog>` 使用非模态 `show()`，不会将焦点移到表单控件，仍可命中下方舞台信息按钮，并支持 Escape 与面板外 pointer 关闭。严格矩形核心对小数请求边长向上包络至最小偶数 centipixel（0.02px），重新验证包含和全部两两 gap；公开坐标、矩形和诊断数值保持 0.01px 网格，且包络不小于请求值。诊断 gap 线不再把正 subpixel 长度夸大为 1px。包级 Vitest 5 files / 79 tests passed；Playwright 22 passed；`typecheck`、`lint`、`build` 与 `git diff --check` 均 exit 0。Playwright 保留既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。代表性 Node/Vite SSR 单次求解（386×482、10 人、gap 4、最大 56、`avatarSizeStep=4`）为 457.839ms；该冷路径信息性测量不是性能契约。未执行完整 workspace 测试、真实 iOS、正式 Web 迁移、真实 LAN 或 PostgreSQL 验收。

2026-09-09 独立跑道玩家矩形模型验证：新增 DOM-free 的 `solveStadiumPlayerLayout({ maxStageWidth, maxStageHeight, playerCount, avatarSize, minimumGap })`，玩家矩形边长固定为头像直径的两倍；求解器使用轴对齐矩形的欧氏最短边界距离，固定最大中心线宽度，圆形可行时立即返回，否则寻找最短纵向跑道。座位 0 固定六点钟，偶数人数另固定十二点钟，奇数人数不设顶部锚点，其余座位按视觉顺时针排序并关于竖直轴镜像；最终公开坐标和间距量化到 0.01px，并在 0.001px 容差下重新验证中心线、舞台包含、全部两两间距及无内部重叠。独立 `/stadium-layout-lab.html` 支持五项输入、5–10 人快捷按钮、URL 恢复与规范化、暂时无效输入保留上一帧、无可行布局恢复、诊断图层，以及无蒙层且不锁定背景的非模态设置面板；超大舞台缩放时使用反向字号补偿保持座位和 gap 标注可读。两个实验入口的数字输入和下拉框均使用至少 16px 的计算字号，避免 iOS Safari 聚焦编辑时自动放大，同时不禁用用户主动缩放。跑道设置面板打开时只聚焦关闭按钮，不自动聚焦输入框；点击面板外关闭但不抢回焦点，关闭按钮、Escape 和悬浮按钮关闭时仍恢复触发按钮焦点。该实验第一阶段不替换现有 `solveRoundTableStageLayout`。包级 Vitest 5 files / 70 tests passed；其中新模型聚焦 32 passed。Playwright 15 passed，覆盖新页面 9 条与原页面 6 条回归；typecheck、lint、双入口 build 和 `git diff --check` 均 exit 0，build 产出 `dist/index.html` 与 `dist/stadium-layout-lab.html`。Playwright 仅有既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。信息性 Node/Vitest 基准使用 `240×900`、头像 56、gap 4、每个人数 100 次：5–10 人分别为 8.76、1.61、14.55、1.71、15.29、2.04ms/次；该数据不是稳定性能契约。应用内浏览器已人工检查默认画布和窄屏非模态设置面板，确认无背景蒙层、诊断线和座位可读；真实移动设备触控、正式 Web 接入、完整 workspace 测试、真实 LAN 与 PostgreSQL 验收未执行。

2026-09-09 布局算法与实验页面复审整改：独立审查未发现 Critical，但复现了两个公开入口接受超大有限舞台时的同步搜索卡死或长时间阻塞。舞台契约现统一使用 CSS 逻辑像素，宽度范围 `(0, 4096]`、高度范围 `(0, 800]`；房间实验页的模拟视口单独允许到 `4096×1024`，覆盖全部现有预设并确保扣除业务外壳后的最大 744×776 舞台仍合法。纯函数、URL 恢复和数字输入三层使用同一上限；超限 URL 回退默认值，超限草稿保留上一帧。复审进一步发现 1024×1366 真实设备视口会生成约 1000×1118 的超限舞台；业务外壳现改为在更大的舞台区域中居中一个最大 744×800 的求解盒，多余空间保留为舞台背景。TDD 已确认旧实现对边界用例返回可用布局、恢复超限 URL，且高设备视口返回 `invalid-input`；整改后聚焦单元测试 3 files / 50 tests passed，高设备视口 Playwright 回归 1 passed。最终包级 Vitest 5 files / 72 tests passed，Playwright 16 passed，typecheck、lint、双入口 build 和 `git diff --check` 均 exit 0；Playwright 仅有既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。临时边界基准与实现计划已删除；真实 iOS Safari 与正式 Web 接入仍未执行。

2026-09-09 圆桌舞台 API 职责拆分与高舞台验证：独立实验室的唯一公共函数为 `solveRoundTableStageLayout({ maxStageWidth, maxStageHeight, playerCount, gap?, maxAvatarSize?, avatarSizeStep? })`，成功结果只含 `shape`、`tabletop`、`centerPanel` 以及每个座位的 `playerSeatBounds`、`avatarRect`、`nameRect` 和 `avatarTopClearance`；顶栏、底栏、安全区与舞台外边距由业务外壳承担。`gap` 统一约束任意两个玩家座位边界的最小间距，默认 8；头像默认从 56 开始按 8 递减，36 是不可突破的最终候选，非锚点尺寸线性插值其他座位参数。三项参数都可在设置面板调整并保存到 URL；非法参数返回 `invalid-input`。返回坐标以舞台左上角为原点，完整桌面与座位包络在硬边界内居中；内部 `placementGuide`、基准框和间距诊断不从公共入口导出。高舞台跑道改为竖直轴对称安全带：偶数人数固定上下中轴锚点，奇数人数固定底部中轴锚点，其余座位按相邻 `playerSeatBounds` 间距的整数极差与偏差确定性优化；4px 粗搜索后使用 1px 局部细化，离散搜索未保留合法解时回退到严格引导线合法解。10 人默认参数回归对应 359×435 的 40px 跑道、366×596 的 48px 跑道、406×684 的 56px 跑道和 744×776 的 56px 圆形；386×482 在 `gap = 8` 时为 40px 跑道，在 `gap = 6` 时为 48px 跑道，`avatarSizeStep = 20` 时从 56 直接回落到 36；同一舞台使用 `gap = 4`、`maxAvatarSize = 56`、`avatarSizeStep = 4` 时，5/6 人选择 56px、7/8 人选择 52px、9/10 人选择 48px 跑道，头像尺寸随人数增加保持不增。宽舞台暂时返回 `wide-stage-strategy-pending`。竖向业务外壳底栏内容统一为 `48 + 56 + 56 = 160`，另加 `max(8px, safe-area-inset-bottom)` 底部留白；模拟画布边框不占尺寸，设置面板 backdrop 透明且无模糊。设备模式使用 `100dvw × 100dvh` 跟随 Safari 工具栏收放，并以 `100vw × 100vh` 兼容旧浏览器。包级 Vitest 32 passed、Playwright 6 passed，build/typecheck/lint 和 `git diff --check` 均 exit 0；Playwright 仅有既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。402×714 的 5、6、10 人参数化模拟预览已人工检查；动态工具栏变化仍需在真实 iOS Safari 复验，未执行全 workspace 测试、正式 Web 布局迁移、真实 LAN 或 PostgreSQL 验收。

2026-09-08 响应式房间布局模型验证：统一交互原型的 10 人竖向求解器改为按 `PlayerSeatBounds` 边界间距放置跑道座位，并为所有座位固定预留皇冠和最大状态标记空间；普通相邻间距保持目标值，两处桌心通道左右对称且留白中点与桌面中心对齐。代表结果为 375×667 的 40px 跑道、390×844 的 48px 跑道、430×932 的 56px 跑道和 768×1024 的 56px 圆形。聚焦 Playwright 回归 2 passed，E2E TypeScript typecheck 与 `git diff --check` 均 exit 0；390×844 开启几何诊断的无头浏览器截图已人工检查。Playwright 仅出现既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告。本次只修改目标布局规范、术语、原型及其回归测试，未迁移正式 Web UI，也未执行真实设备 LAN、PostgreSQL 或完整应用测试。

2026-09-05 PNG 母版 Git LFS 历史迁移验证：以仓库外 48 MiB Git bundle 和 49 行提交映射作为恢复点，将远端 `main` 从 `34714f7d0ff9043841c79af8bc2a8a60f8f7a731` 改写为 `6f7851057dee7ff3aa8ee4efaaed245cc127bd23`；新旧 tip tree 均为 `3a02d6b603db98c5d222265425951672682e1592`，因此当前项目内容未改变。历史中的 18 个 `images/source/**/*.png` 版本均改为 LFS 指针，全部对象已上传 GitHub，并通过暂存分支的新鲜 bare fetch、仅历史存在的旧 Loyal Servant 对象回读、`git lfs fsck --pointers` 和 `git fsck --full`。pointer-only 新克隆的 Git pack 从迁移前 29.88 MiB 降至 6.76 MiB；主 checkout 在保留 13 条 Codex 应用内部 refs 和 22 MiB 共享 LFS 缓存的前提下执行 reflog expire 与 GC，`.git` 从切换后的 131 MiB 降至 71 MiB。清理了切换时仍存在的 15 条已合并远端功能分支、1 条迁移暂存分支、10 条本地功能分支，以及两个始终干净的 linked worktree，后者合计约 553 MiB；`backup/pre-squash-20260821`、全部 `refs/codex/**` 和未跟踪的 `images/evil-faction-icon.png` 均保留。切换使用旧 SHA 精确 lease；GitHub `main` 的管理员强制保护、禁止 force-push 和原四项 required checks 已恢复。隔离新克隆常规测试为 Game 88、test-support 25、Web 255、Server 87 passed / 6 PostgreSQL 环境用例 skipped，共 455 passed / 6 skipped；素材套件 26 passed，`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0。改写后的 `main` push CI run 33975254111 全部通过，包括 Quality、Unit/Socket.IO、PostgreSQL 持久化与重连、Browser smoke execution/聚合门禁、两个 regression shard 和 Docker Compose smoke。由于 tip tree 未改变，按素材路径过滤的 workflow 未由历史改写 push 触发；素材内容已由前述远端回读和隔离克隆的 `pnpm assets:verify` 验证。GitHub 隐藏 PR refs 的物理垃圾回收不在本次可验证范围内，也未执行真实 5–10 台设备 LAN 验收。

2026-09-05 PNG 母版 Git LFS 按需检出验证：`images/source/**/*.png` 的 17 个母版已转换为 131–132 字节 LFS 指针，指针逻辑总量约 2.2 KiB；当前 clone 已使用 skip-smudge，本地 `.git/lfs` 保留一份共享缓存。分组拉取实测立绘约 10.7 MiB、头像仍为约 1 KiB 指针且 9 项立绘检查通过；再拉取头像后，完整素材套件为 3 files / 26 tests passed。恢复全部指针后，完整 `pnpm test` 在沙箱外以现有 PostgreSQL 配置运行，Game 88、test-support 25、Web 255、Server 93，共 461 passed；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0。Web build 保留既有单个 558.01 kB minified / 167.88 kB gzip JavaScript chunk 建议性警告，Server esbuild 产物约 2.4 MB 并仅有体积提示。首次沙箱内全仓库测试因禁止监听本地端口及访问 PostgreSQL 出现 `EPERM`，随后按相同命令在沙箱外通过。新素材 workflow 的 YAML 已本地解析，但尚未在 GitHub Actions 上运行；未重写图片历史、未清理不可达 Git 对象、未触碰两个既有 linked worktree，也未执行 Playwright、真实 LAN 或额外部署验收。

2026-09-04 Docker Compose 部署验证：合并最新 `main` 后，完整 `pnpm test` 为 Game 88、test-support 25、Web 263、Server 87 passed / 6 PostgreSQL tests skipped，共 463 passed / 6 skipped；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0。Web build 保留单个 558.01 kB minified / 167.88 kB gzip JavaScript chunk 超过 500 kB 的建议性警告，Server esbuild 产物约 2.4 MB 并仅有体积提示。生产入口先注册 `SIGINT`/`SIGTERM` 处理器再发布监听完成日志，关闭回归不会在 ready 边界竞态退出。隔离 Docker 主机使用手动构建的镜像完成真实 Compose 验证：三服务按健康条件启动，只有网关发布回环地址端口；根路径、任意合法嵌套前缀、SPA 深链接、Lobby API、Socket.IO polling、静态资源缓存、非法前缀拒绝和上游不可用时的安全 503 均符合预期。使用原座位凭据分别通过 Node 重启、PostgreSQL 重启和整栈停止/重建后的会话校验；Docker named volume 与宿主机 bind mount 都保留数据。空密码配置在 Compose 展开阶段被拒绝，绝对 bind 路径可正确解析。验证完成后已清理测试容器、网络、镜像、named volume、bind 数据和探针状态；未修改宿主机 Nginx 或其他服务。新增 Compose smoke workflow 尚未在 GitHub Actions 上运行；未执行真实 5–10 台设备 LAN 验收，也未执行实际域名/TLS/子路径联调。

2026-09-04 浏览器 CI 稳定性与耗时治理验证：确认开发控制回归的首轮失败并非浮层撑高页面，而是测试在主页房间目录和活动会话校验完成前记录高度；受控延迟以与远端相同的 `844 → 1051` 失败完成 RED，改为等待“创建房间”入口进入可用态后 GREEN。两个核心 `@smoke` 流程独立为快速执行项，其余 28 项按文件分为两个 regression shard；既有 required `Browser smoke` context 改为三者的兼容聚合门禁。本地 smoke 为 2 passed（16.7 秒），regression shard 1 为 7 passed / 9 nightly skipped（37.3 秒），shard 2 为 12 passed（1.3 分钟）；原 CI 顺序重复十轮为 30 passed（1.3 分钟），开发控制回归未触发重试；最终未分片完整 E2E 为 21 passed / 9 nightly skipped（2.2 分钟），同样无重试。普通 CI 的四类执行 job 从 npm self-installer 路径迁移到 pnpm 11 原生 `pnpm/setup`，保留显式 frozen-lockfile 安装；CI workflow YAML 解析和 2/28 测试发现边界验证通过。PR #23 与合入后的 `main` push CI 均通过；`pnpm/setup` 在各 job 中约 5–7 秒，`main` 的 Quality、Unit/Socket.IO、PostgreSQL、smoke、regression 1/2、regression 2/2 分别为 38 秒、47 秒、41 秒、1 分 25 秒、1 分 49 秒和 4 分 17 秒，整体关键路径相对原 8 分 43 秒缩短约 51%。真实 LAN 验收仍未运行。

2026-09-04 响应式浏览器回归补充稳定性验证：合入后的 `main` regression 2/2 虽最终通过，但日志确认 10 人圆桌在 1280×685 首轮出现 Header 左区与 6 号顶部座位交叠并依靠一次 retry 恢复。20 个随机 UUID 本地采样显示未受约束的房间标题会让 Header 左区右缘在 515.6–558.7px 间波动；大厅和游戏 Header 的主标题区现于 `lg` 及以上限制为容器宽度的 42%，使既有省略号约束生效并保留中央座位安全区。并行负载下进一步完成 RED（10 轮无重试运行中 1 轮在页面尚未同步到任务阶段时误测上一阶段投票按钮）→ GREEN：测试现先等待当前玩家的目标任务牌按钮可见再采集任务阶段布局，断言阈值未放宽。修复后完整圆桌用例在并行负载下 10 passed / 0 retries（3.3 分钟），CI regression 2/2 原命令在禁用自动重试后 12 passed（1.2 分钟）；Web 259 tests、Web build、lint 与全工作区 typecheck 均通过。Build 保留既有单个 557.38 kB minified / 167.66 kB gzip JavaScript chunk 建议性警告。PR #24 首轮远端 Actions 全部通过，其中 regression 2/2 为 12 passed / 0 retries（测试本体 2.4 分钟，job 3 分 22 秒）；合入后的 `main` push CI、真实 PostgreSQL 和 LAN 验收尚未运行。

2026-09-04 普通 CI 属性测试稳定性修复验证：确认 PR #20 临时 merge commit 与 `main` squash commit 的 tree SHA 相同，而 5 人 generated-game property test 分别以 3.337 秒通过和 5.263 秒触发原 5 秒超时；历史 run `33319936335` 也曾在同一测试以 5.106 秒超时。普通 `Unit and Socket.IO replay` job 现固定使用 fast-check seed `424242`，为 5–10 人各 100 轮测试输出不含游戏选择或秘密状态的 10% 进度，并将每个人数的 correctness-test 超时从 5 秒提高到 15 秒；每日 Nightly 的轮换 seed 和长测试超时保持不变。回归完成 RED（期望至少 15 秒，实际 5 秒）→ GREEN；固定 CI 环境下 `@avalon/test-support` 为 25 passed，完整 `pnpm test` 为 Game 88、test-support 25、Server 84、Web 259，共 456 passed；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0，CI workflow YAML 解析成功。Build 保留既有单个 557.35 kB minified / 167.65 kB gzip JavaScript chunk 建议性警告。本次尚未运行远端 GitHub Actions、Playwright、真实 PostgreSQL 或 LAN 验收。

2026-09-04 方形角色头像复核与 Morgana/Loyal Servant 返工验证：重新检查此前使用“候选底图 + 原图主体全高固定 48px 羽化”的结果，确认该方法虽能保护中央身份并降低精确边界梯度，却会在两套不同的头发、服装和肩甲几何之间产生语义断裂；此前对 Morgana 与 Loyal Servant 的“未发现明显接缝”结论不成立，全图 SSIM 也不再作为扩图成功判据。返工以 `images/source/roles/Morgana.png`（752×1127）和 `images/source/roles/Loyal-Servant.png`（674×1010）为唯一权威编辑目标，分别通过内置 ImageGen 单独生成四个候选并选用候选 3；最终仅用不贯穿全图、远离原图左右边界且沿头部自然轮廓变化的语义蒙版保护脸、眼睛、头饰、伤痕和颈部，头发外缘、肩部、服装和盔甲继续使用候选重绘。最终不透明 8-bit sRGB PNG 分别为 1127×1127 和 1010×1010；身份保护区 patch SSIM 为 Morgana 脸部 0.968376、头饰 0.996080，Loyal Servant 脸部 0.993148、眼睛/伤痕 1.000000。原图边界 96px 带相对原图的 ΔE2000 均值/P95 为 Morgana 左 8.9188/37.3086、右 6.9283/25.8000，Loyal Servant 左 4.9411/13.0903、右 3.8894/12.5096；这些重绘差异明显高于旧 48px 合成和部分基线，因此按要求人工复核。边界相邻列 ΔE 均值相对附近列的比值为 Morgana 0.8919/0.9158、Loyal Servant 0.8383/0.8047，Sobel 梯度均值分别为 6.7523/8.0445 与 12.7617/12.5004，未形成垂直离群线；100%/200% 放大、256×256 方形及圆形预览确认发束、服装、肩甲曲率与高光跨界连续，无黑色楔形、双重轮廓或压缩新增光晕。质量 90 的 256×256 WebP 相对同尺寸无损 PNG 的全局亮度 SSIM 为 0.999310/0.999152，大小为 10.98/12.07 KiB。Assassin 只做诊断且未替换：以中央剑轴为基准，y=740/800/920 的左右主要肩部或披风轮廓距离约为 402/397、429/428、443/425 px，最大可辨差异约 4%，Sobel 轮廓和圆形预览均支持合理的光照/发丝遮挡与非完全对称姿态，而非右肩异常收窄。角色头像资产测试 16 passed，完整 Web 测试 258 passed，Web build 与 lint exit 0；Build 保留既有单个 557.38 kB minified / 167.65 kB gzip JavaScript chunk 建议性警告。本次未运行 LPIPS/DISTS（当前环境未提供实现）、Playwright、真实 LAN 或 PostgreSQL 验收。

2026-09-03 Merlin/Assassin 方形角色头像试点验证：以角色说明竖图为唯一原始参考，通过内置 ImageGen 横向扩充左右背景、兜帽、头发与服装，每个角色比较四个候选后选用候选 2；最终母版使用 48px 羽化融合保留原角色主体，Merlin 为 1127×1127、Assassin 为 1051×1051，均为 sRGB、8-bit、不透明 PNG。未经融合的 AI 重绘候选在 256px 中央对应区域 SSIM 为 0.37–0.46，未达到感知等价；最终候选分别提升至 0.9702 和 0.9675，方形与圆形蒙版预览人工复核未发现明显接缝、身份漂移或新增物件。Web 部署资源使用质量 90 的 256×256 不透明 WebP，Assassin 为 9.4 KiB、Merlin 为 12 KiB，相对同尺寸无损参考图的亮度 SSIM 分别为 0.999309 和 0.999253，圆桌继续由既有 `overflow-hidden rounded-full` 容器裁切；资产契约回归完成 RED（目标 WebP 缺失）→ GREEN（4 passed），同时保护 PNG 母版和 WebP 衍生图，完整 Web 测试为 246 passed，Web build 与 lint exit 0。Build 保留既有单个 557.38 kB minified / 167.65 kB gzip JavaScript chunk 建议性警告。本次未运行 Playwright、真实 LAN 或 PostgreSQL 验收。

2026-09-03 角色立绘原生最大宽度修正验证：角色图片转换器不再把所有母版的最大 WebP 宽度固定为 674px，而是为每张母版生成 `320w`、`480w` 与原生宽度候选；674px 的 Assassin、Loyal Servant、Minion 继续生成 674w，752px 的 Merlin、Mordred、Morgana、Oberon、Percival 新增 752w。帮助说明按每个角色的真实宽高生成默认 `src` 与 `srcset`，其中 Merlin、Morgana、Percival 使用 752×1127 固有尺寸，其余 MVP 角色保持各自 674px 原生尺寸。隔离临时目录中的真实 Sharp 转换回归完成 RED（752px fixture 错误产出 674w）→ GREEN（产出 752w），帮助说明静态输出回归同样完成 RED → GREEN。`pnpm --filter @avalon/web images:roles` 成功生成全部当前母版候选；完整 `pnpm test` 为 Game 88、test-support 23、Server 84、Web 243，共 438 passed；Web build 与 lint exit 0。Build 保留既有单个 557.35 kB minified / 167.65 kB gzip JavaScript chunk 建议性警告。本次未运行 Playwright、真实 LAN 或 PostgreSQL 验收。

2026-09-03 Nightly game-flow matrix 超时稳定性修复验证：保持普通 Playwright 用例 60 秒默认超时，仅将 5–10 人完整浏览器回放 matrix 提高至 120 秒；CI 首次尝试不再录制 trace，只有首次重试录制，本地无重试运行继续保留失败 trace。共享 transcript 回放器在每条命令 dispatch 前提供脱敏进度，仅含已完成/总命令数和命令类型；matrix 每 10 秒记录人数、公开阶段、命令类型和耗时，不记录 actor、投票、任务卡、暗杀目标、角色、凭据或命令 payload。最近失败的 10 人 seed `nightly-2026-09-02-10p` 在 `CI=true` 配置下使用真实 Chromium 和十个独立 browser context 完成 92 条命令，1 passed（Playwright 27.9s、回放 22.8s），首次尝试未生成 `trace.zip`。完整 `pnpm test` 为 Game 88、test-support 24、Server 78 passed / 6 skipped、Web 242，共 432 passed / 6 skipped；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0。常规 `pnpm test:e2e` 为 21 passed / 9 nightly skipped；完整 `pnpm test:e2e:matrix` 为 30 passed，5–10 人完整游戏分别约 10.2s、14.5s、16.0s、21.4s、18.3s、28.6s。Web build 保留既有单个 557.38 kB minified / 167.65 kB gzip JavaScript chunk 建议性警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。本次未运行 GitHub Actions，因此未声称远端 Nightly 已恢复；也未执行真实 LAN 或 PostgreSQL 重启验收。

2026-09-03 PC 角色说明卡片渐变层次优化验证：在同图双层填充结构不变的基础上，将宽屏装饰背景调整为 55% 亮度和 80% 饱和度；遮罩改为中央透亮、边缘由 18% 收暗至 42% 的径向渐变，并叠加顶部 2%、中部 8%、底部 30% 的纵向深色渐变，形成中央聚焦、边缘与底部自然回落的海报式层次。应用内浏览器在 1280×720 检查两排六张角色卡，确认双渐变均生效、前景保持 `object-contain`、背景没有黑框或光晕，页面无横向溢出；390×844 下六个背景和六个遮罩均为 `display:none`，前景继续保持约 88px 宽原比例布局。角色图片容器使用独立 stacking context，使内部前景层不会越过弹窗 sticky Header；369×812 下将角色图滚到 Tab 后方时，浏览器命中测试和实际页面都确认“游戏基础规则”仍是最上层可见、可点击元素。六张角色卡的“新手提示”标题统一精简为“提示”，466×812 页面统计六处新标题且无旧标题残留。主页房间列表刷新按钮改用 Lucide `RefreshCw`，帮助规则折叠项改用 20px Lucide `ChevronDown`；466×812 实测两类图标均与 44px 按钮或 48px 折叠栏精确居中，折叠箭头展开后旋转 180°。各档视口控制台均无 warning/error。Web 242 tests、Web build 与 E2E typecheck 均 exit 0，dialogs Playwright 4 passed；build 保留既有单个 557.38 kB minified / 167.65 kB gzip JavaScript chunk 建议性警告，Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。本次未运行完整 Playwright、lint、真实 LAN 或 PostgreSQL 验收。

2026-09-02 PC 角色说明卡片双层背景填充验证：六个角色的 4:3 图片区域在 `sm` 及以上使用同一响应式 WebP 作为 `object-cover` 装饰背景，参数为 1.08 倍缩放、18px 模糊、50% 亮度和 70% 饱和度，中间叠加轻量深色渐变；清晰前景继续使用 `object-contain` 并保留原 `srcset`、`sizes`、宽高、lazy loading 与 async decoding。装饰背景使用空 alt 和 `aria-hidden`，移动端保持隐藏。应用内浏览器在 1280×720 检查两排六张角色卡，画框均约为 280×210、背景完整填充且前景未裁切；390×844 下六个背景均为 `display:none`，立绘继续保持约 88px 宽原比例布局。两档视口均无横向溢出，控制台无 warning/error。Web 240 tests 与 Web build 均 exit 0；build 保留既有单个 557.25 kB minified / 167.63 kB gzip JavaScript chunk 建议性警告。本次未运行完整 Playwright、lint、真实 LAN 或 PostgreSQL 验收。

2026-09-02 Loyal Servant 背景调色与素材验证：以 Percival 为主要参考，仅调整 `Loyal-Servant.png` 的蓝色背景；顶部角落亮度由 `L*=25.33` 提升至 `36.09`，外侧背景由 `32.85` 提升至 `42.25`，外侧线性亮度比 Percival 低 `0.12 EV`，背景饱和度相对降低约 21%，蓝色色相向青蓝移动约 4°。面部保护区和画面下方 28% 与原图逐像素一致，无高光或暗部剪切。定向转换生成 `320×480`、`480×719`、`674×1010` 三档 sRGB WebP。应用内浏览器在 1280×720、DPR 2 下选用 674w，在 390×844、DPR 1 下选用 320w；桌面三列卡片和移动端横向卡片均正常显示，页面无横向溢出，控制台无 warning/error。Web 240 tests 和 Web build 均 exit 0；build 保留既有单个 556.76 kB minified / 167.48 kB gzip JavaScript chunk 建议性警告。本次未运行完整 Playwright、lint、真实 LAN 或 PostgreSQL 验收。

2026-09-01 帮助说明角色图片接入验证：角色说明为 Merlin、Percival、Assassin、Morgana 渲染三档 WebP `srcset`，浏览器根据 `sizes` 和显示密度原生选择资源；Loyal Servant 与 Minion 继续显示原占位，不使用不对应的 Mordred 或 Oberon 素材。应用内浏览器在 1280×720、DPR 2 下实际选择 674w，在 390×844、DPR 1 下实际选择 320w；移动端仅固定图片宽度并使用固有宽高自动计算高度，三张常规图片实测显示比例为 0.6667，Assassin 为 0.6413，均与文件比例一致，`sm` 以上继续保留当前 4:3 容器。六张角色卡均未越出视口，页面无横向溢出且控制台无 error/warning。Web 240 tests、Web build、lint 均 exit 0；build 保留单个 556.66 kB minified / 167.46 kB gzip JavaScript chunk 建议性警告。本次未运行完整 Playwright、真实 LAN 或 PostgreSQL 验收。

2026-09-01 角色立绘转换流程验证：Assassin、Merlin、Mordred、Morgana、Oberon、Percival 六个正式 PNG 母版已归档到 `images/source/roles/`；Assassin 的保留母版命名为 `_Assassin(Original).png`。显式 `pnpm --filter @avalon/web images:roles` 命令使用 Web 包的 Sharp 开发依赖为六个角色生成三档 WebP；Assassin 为 320×499、480×748、674×1051，其余角色为 320×480、480×719、674×1010，全部为 sRGB，五个含 Alpha 的源文件均保留 Alpha；Assassin 源文件本身不含 Alpha。转换脚本默认扫描和显式指定均排除下划线开头的母版，未生成 `assassin-original-*`。指定不存在的角色以 exit 1 汇总报告。Web 239 tests、Web build、lint 均 exit 0；build 保留既有单个 555.89 kB minified / 167.20 kB gzip JavaScript chunk 建议性警告。本次未修改图片消费 UI、未运行 Playwright，也未执行真实 LAN 或 PostgreSQL 验收。

2026-09-01 游戏与角色帮助验证：主页 Header 在移动端显示 44×44 问号图标、`sm` 及以上显示文字“帮助说明”，等待大厅与游戏页 Header 使用图标入口；统一弹窗默认打开游戏基础规则，包含阵营目标、回合流程、关键规则和 5–10 人配置，房间入口会传入并标出当前人数。角色说明覆盖当前六个角色；创建配置的帕西维尔/莫甘娜问号提供 hover/focus 提示，点击或触摸直接进入角色 Tab，将两张相关角色卡前置并以约 1.6 秒两次平缓脉冲引导视线，随后回归普通边框，减少动态效果偏好下不播放。创建配置开关已移除重复的候选人说明，checkbox、标题和帮助问号收为同一行并垂直居中。移动端每个角色使用横向列表项，左侧 88×112 空白素材位、右侧完整说明；桌面继续使用三列纵向卡片和 4:3 空白素材位，没有使用或扩展现有头像。弹窗使用语义化 Tab、方向键/Home/End 切换、Escape 关闭及触发按钮焦点恢复；320×568 下四边至少保留 16px。应用内浏览器人工复核桌面基础规则、上下文角色说明和 320px/390px/429px 主页、创建弹窗与角色列表；429×741 下三个角色配置控件中心线均为 438.5px，且配置行不再出现重复说明。确认角色顺序为 Percival、Morgana、Merlin、Loyal Servant、Assassin、Minion，390px 下素材位为 88×112 且位于名称左侧，角色说明中 `img` 数量为 0，页面无横向溢出且控制台无 error。Web 239 tests、Web build、lint 和 workspace typecheck 通过；帮助与响应式 Playwright 7 passed。Web build 仍有单个 555.89 kB minified JavaScript chunk 超过 500 kB 的建议性警告，Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。

```text
pnpm test ✅ Game 88；test-support 23；Server 84；Web 239（共 434 passed）
pnpm build ✅ Game、Server TypeScript 与 Web TypeScript + Vite build；单个 556.21 kB minified / 167.24 kB gzip chunk 建议性警告
pnpm lint ✅ exit 0，无 diagnostics
pnpm typecheck ✅ Game、test-support、Server、Web、E2E exit 0
pnpm --filter @avalon/e2e test:e2e dialogs.spec.ts responsive.spec.ts ✅ 6 passed
Playwright 本地日志 ⚠️ Node 子进程提示 `NO_COLOR` 被 `FORCE_COLOR` 覆盖；无业务 warning/error
pnpm --filter @avalon/server test:postgres ⚠️ 本轮未运行；未以 memory storage 替代
真实 5–10 浏览器 LAN 验收 ⬜ 未执行
部署环境 PostgreSQL 重启与原凭据重连 ⬜ 未执行
```

2026-08-31 普通 HTTP LAN 换座互斥补充：浏览器继续优先使用 Web Locks；当文档所用的 `http://<LAN IP>` origin 不提供 SecureContext Web Locks 时，改用同源 IndexedDB `readwrite` 事务原子获取每房间独占 lease。lease 使用 opaque owner token、有限过期时间和 owner-matched release；活动请求即使超过 lock lease，锁内重新检查的持久化 `requesting` 标记仍拒绝第二次请求，原有 transition ID、源会话和恢复 fence 保持权威。IndexedDB 缺失、打开失败或事务失败时换座安全关闭并显示既有兼容性文案，不会无锁发送请求。真实浏览器回归在应用代码运行前移除 `navigator.locks`，通过实际 IndexedDB 完成一次换座并拒绝第二标签页 contender。完整 `pnpm test` 为 Game 88、test-support 23、Server 83、Web 227，共 421 passed；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0；强制 fallback 聚焦 Playwright 为 1 passed，完整 `pnpm test:e2e` 为 18 passed / 9 nightly skipped。Web build 报告单个 540.97 kB minified / 163.29 kB gzip JavaScript chunk 超过 500 kB 的 Vite 建议性警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。部署环境 PostgreSQL restart acceptance 继续 blocked，未使用内存存储替代；Manual LAN 5-browser acceptance 仍 pending，本次自动化普通 HTTP loopback 测试不等同于真实 LAN 设备、实际 CORS/Socket.IO 或部署环境 PostgreSQL 重启演练。

2026-08-31 最终分支审查收口：同一房间换座现在使用 Web Locks `exclusive` + `ifAvailable` 浏览器全局互斥，并在锁内重新检查持久化标记和精确源会话；`requesting`、`uncertain` 及 legacy 标记都会拒绝第二次换座，不会排队到不确定迁移之后。迟到的成功、失败和恢复结果必须同时通过 opaque transition ID 与源会话 fence，不能覆盖或清除较新的标记/会话；退出/解散继续读取同一全局标记。两个同源标签页的真实浏览器回归证明首个请求持锁时空座按钮立即禁用、只发出一次换座请求，并在瞬态 503 后共同恢复唯一有效目标。Lobby 客户端保留服务端稳定错误 envelope，且创建、加入和换座的所有成功响应都在客户端边界使用共享 RoomSession Schema 解析；畸形创建/加入 2xx 不会产生可持久化会话，畸形换座 2xx 会保留 `uncertain` 标记并按源座位、目标座位顺序恢复。ownerless legacy lobby 不再展示加入操作；Percival 候选只在身份辨认或主动打开私密信息时显示、结算时移除，候选父座位可访问名称包含 `Merlin 候选`；成对房间中 Merlin 的邪恶座位知识从 Merlin 辨认持续到 Percival 辨认及之后，legacy 三步流程不变。完整 `pnpm test` 为 Game 88、test-support 23、Server 83、Web 220，共 414 passed；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0；本次聚焦 `smoke` 与 `refresh-and-privacy` Playwright 为 4 passed。此前同一最终审查轮次的完整 `pnpm test:e2e` 为 18 passed / 9 nightly skipped，本次窄幅响应解析补丁后未重跑完整 E2E。Web build 报告单个 538.44 kB minified / 162.41 kB gzip JavaScript chunk 超过 500 kB 的 Vite 建议性警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。本轮没有运行或声称通过 CI，也没有单独运行强制 PostgreSQL 命令或重启探针；部署环境 PostgreSQL restart acceptance 继续为 blocked，未用内存存储替代该验收。Manual LAN 5-browser acceptance: pending；本次未执行真实 5–10 台设备、实际 LAN/CORS/Socket.IO 或部署环境 PostgreSQL 重启演练。

2026-08-31 同日此前的自动入座、座位无关拥有者和成对角色验证：创建房间会原子进入拥有者，普通玩家由服务端分配提交时最低空座位，并发加入不会重复；拥有者移离 0 号座位后权限随玩家保持，新玩家可复用 0 号座位，刷新仍以原凭据重连。满房公共文案、320×568 下至少 44px 且可用键盘操作的换座按钮、Percival 仅看到不可区分的 Merlin/Morgana 候选，以及 10 人桌在 1024×768/1077×722 不与 Header 重叠均有浏览器回归。真实路由生命周期在服务端已提交换座但浏览器收到瞬态 503 时验证：实时 `requesting` 标记暂停旧座位失效，转为 `uncertain` 后重新校验并绑定唯一有效目标，同一浏览器的旧标签页不会删除新会话或丢失凭据。Automatic seating / seat-independent ownership / paired roles: complete。完整 `pnpm test` 为 Game 87、test-support 23、Server 83、Web 195，共 388 passed；`pnpm build`、`pnpm lint`、`pnpm typecheck` 均 exit 0；聚焦 Playwright 9 passed，完整 `pnpm test:e2e` 为 18 passed / 9 nightly skipped。Web build 报告单个 534.85 kB minified JavaScript chunk 超过 500 kB 的 Vite 建议性警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。`pnpm --filter @avalon/server test:postgres` 已强制使用真实 PostgreSQL，但当前配置的 `192.168.100.13:5432` 在沙箱内以 `EPERM` 拒绝连接（2 failed / 3 passed / 4 skipped），而外部执行因套件会初始化 schema 和清理数据、目标又不是已确认的一次性数据库而未获授权；因此 PostgreSQL restart acceptance: blocked，未用内存存储替代，也未声称通过。Manual LAN 5-browser acceptance: pending；本次未执行真实 5–10 台设备、实际 LAN/CORS/Socket.IO 或部署环境 PostgreSQL 重启演练。

- Automatic seating / seat-independent ownership / paired roles: complete
- Validation: `pnpm test` — passed; `pnpm build` — passed; `pnpm lint` — passed; `pnpm typecheck` — passed; `pnpm test:e2e` — passed
- Manual LAN 5-browser acceptance: pending
- PostgreSQL restart acceptance: blocked by unavailable/unauthorized real PostgreSQL; no memory substitute was used

2026-08-30 队伍投票可见性与按需角色头像验证：未结算队伍投票只公开提交者座位和 `x/n 已投票`，其他玩家的赞成/反对仍由 `playerView` 隔离；最后一票后逐座位结果和中央合计同时公开，并按通过任务、普通否决及第五次否决分别保留到既定边界。投票提交和结算图标位于姓名牌框外且不占用文字空间；Playwright 几何回归验证首张投票出现前后头像与姓名牌位置、尺寸不变、姓名牌左右内边距一致、图标完全位于框外，并验证 320px 窄屏右侧座位图标不会越出视口。进行中姓名牌不常驻显示本人角色；眼睛按钮只替换本人的角色头像，角色名称显示在姓名牌正下方且不参与布局，不遮挡头像或中央任务板、不暂停操作、不响应 Escape，开关偏好以版本化、无角色数据的客户端设置跨刷新、房间、阶段和同浏览器标签页同步。对局结束自动显示全部角色头像和姓名牌角色名，并隐藏眼睛与已知邪恶标记。完整验证结果见下方命令基线；聚焦 Playwright 回归 5 passed，覆盖 5、7、10 人、角色偏好持久化/跨标签页同步、投票座位几何、结算角色头像和响应式布局。应用内浏览器在当前 5 人投票房间实测姓名牌左右内边距均为 6px、框外图标间距 4px、角色名称位于姓名牌下方 2px且不与头像重叠。Web build 仍有单个 522.14 kB minified JavaScript chunk 超过 500 kB 的 Vite 建议性警告；Playwright 仅出现既有 `NO_COLOR`/`FORCE_COLOR` Node 警告。本次未执行真实 5–10 台 LAN 设备、多房间人工隔离或 PostgreSQL 重启/凭据重连验收。

2026-08-29 生产文案与开发入口验证：Web 单元测试 27 个文件、130 个用例通过；最终修复聚焦测试 4 个文件、37 个用例通过；开发工具 Web 聚焦测试 1 个文件、5 个用例通过；Server `config` 与 `dev-admin` 聚焦测试 2 个文件、13 个用例通过（使用本地端口监听）；Web build、Web lint、Web `tsc -b` 与 E2E typecheck 均 exit 0；默认 `pnpm test:e2e` 为 15 passed / 9 skipped（1.7 分钟）。Web build 仍有单个 517.57 kB minified JavaScript chunk 超过 500 kB 的 Vite 建议性警告；lint 保留 `apps/web/src/App.tsx:217:14` 未使用 `requestError` catch 参数警告；Playwright 与测试服务仅出现既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告。两组玩家文案审计仅保留默认关闭开发工具内的“座位凭据”说明，以及禁止渲染英文 `Success`/`Fail` 的测试负断言；`git diff --check` 通过，基线至当前 HEAD 的提交范围未触及 `images/`。本地浏览器/内存服务人工复核：390×844 首页无横向溢出，生产标题、创建和房间列表文案无截断，custom “打开开发控制”和 boardgame.io Debug Panel 均为 0；同尺寸满房访客可见“等待房间创建者开始游戏”（rect 约 138–252px），页面 `scrollWidth=390` 且无横纵溢出。568×320 满房访客 DOM 仅呈现紧凑“等待创建者”，页面无横纵溢出，按钮、房间标题和座位标签布局有效，两类开发入口均为 0。1280×720 身份辨认中阶段标题与“阿瓦隆 · 5人局”可见，“等待其他玩家确认”控件为 168×44 且无溢出；仅一个 `aria-live="polite"` 状态“1/5 已确认”，页面无横纵溢出且两类开发入口均为 0。用户中心键盘复核确认：打开后关闭按钮获焦，Shift+Tab 可到可见的“素材与许可” summary，折叠时 CC BY 链接不可见、展开后可见，Escape 关闭并恢复触发按钮焦点。本次不是实际 5–10 台设备 LAN、多房间人工隔离、PostgreSQL 重启或凭据重连验收；这些验收仍未执行。

2026-08-27 服务端协议面与入口加固验证：`@avalon/game` 提供 strict create/join 与最小 Room detail 契约；Server 仅开放 Web 当前使用的 Avalon Lobby 路由和项目自有 `/rooms/avalon/**`、`/dev/**`，关闭默认列表、leave、playAgain、rename、update 与 Socket chat；Socket sync 仅在 Room ID、Seat ID 合法且房间已经存在时才委托给 boardgame.io，未知、非法、已删除房间和匿名 Seat 均关闭连接且不触发依赖的按需建房；HTTP 已知请求失败保留 4xx，未预期依赖异常返回安全 500/503 且日志不含原始错误消息。HTTP 请求体限制 16 KiB，Socket 客户端消息限制 64 KiB，Seat credential 和开发 Token 统一使用有界、常量时间比较，四个 workspace 的 boardgame.io 精确固定为 `0.50.2`。非 PostgreSQL 自动测试通过（Game 59、test-support 22、Server 64、Web 116）；`pnpm build`、`pnpm lint`、`pnpm typecheck` exit 0；Playwright 15 passed / 9 nightly skipped。Web build 仍报告单个 518.34 kB chunk 警告，Playwright 仅出现既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告。本地强制 PostgreSQL 套件在第一条 `SELECT 1` 被目标 LAN 数据库 `ECONNRESET`，结果为 1 failed / 4 skipped，因此没有声称本地 PG 通过；合入仍要求 GitHub PostgreSQL 容器门禁通过。本次未执行真实 5–10 台 LAN 设备或目标 PostgreSQL 重启人工验收。

2026-08-27 房间目录契约验证：`@avalon/game` 新增共享 Zod schema 和推导类型，Web 对 `/rooms/avalon` 的成功响应执行一次接收边界解析，允许并剥离未知字段，对无效 envelope、字段、重复玩家 ID 或重复房间 ID 整批拒绝；Server 继续使用显式公开字段允许列表，并在泄密回归中证明产物通过同一 schema。PostgreSQL 强制集成套件 5 passed；完整 `pnpm test` 通过（Game 52 passed、test-support 22 passed、Server 49 passed、Web 115 passed）；`pnpm build`、`pnpm lint`、`pnpm typecheck` exit 0。Web build 仍报告既有的单个 515.39 kB chunk 警告。本次未执行 Playwright、PostgreSQL 服务重启探针或 LAN 设备验收。

2026-08-24 身份辨认响应式布局修复验证：第二、三幕参与者继续复用同一份标题、匿名确认进度和确认按钮；竖屏保持顶部提示与底部确认浮层，横屏隐藏不可用的任务计分板并在原中央区域显示辨认面板，568×320 极矮横屏使用紧凑标题且与圆桌共享垂直位移。方向切换不会重新挂载按钮或丢失焦点，进度使用 `aria-live="polite"` 状态播报。Playwright 使用 5 人和 10 人房间在 320×568、390×844、568×320、1339×786 验证任务面板可访问性、单一确认控件、44px 热区、方向切换焦点保持，以及辨认提示、按钮和完整面板边界均不与头像或姓名牌相交；浏览器截图人工复核覆盖 390×844、568×320 和 1339×786。Game tests 38 passed；test-support 22 passed；Server tests 44 passed / PostgreSQL 5 skipped；Web tests 113 passed；build、lint、typecheck exit 0；完整 PR Playwright 15 passed / 9 nightly skipped。Playwright 仅出现既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告。

2026-08-24 整体 UI 基础优化验证：主页和房间 Header 接入浏览器本地用户中心，首次从 24 个中世纪奇幻意象与 24 个身份词中组合随机中文名称（576 种组合），并生成八款 ImperialOctopus/avalon-printable 装饰头像，资料在活动房间座位存在期间保持锁定；创建/加入不再弹出名称表单，同房间允许同名且公开日志使用座位号区分。创建入口迁移到 5–10 人配置弹窗。系统消息迁移到顶部 Toast，主页无通知历史入口；房间 Header 新增无未读徽标的公开操作日志，桌面使用右侧抽屉、移动端使用底部抽屉，任务结果只显示匿名聚合。用户中心和日志面板支持焦点循环、Escape 关闭、关闭后焦点恢复与页面滚动锁定；断线与手动重连控件在窄屏使用 44px 图标，避免与日志、资料、房间菜单和 Debug 入口争抢 Header 宽度。游戏核心为已结算投票保存公开 proposer ID，同时保持旧持久化记录兼容。浏览器人工检查覆盖桌面与 390×844 的主页、用户中心、创建弹窗、等待圆桌、锁定资料、日志抽屉和 Header Debug 入口避让。Game tests 38 passed；test-support 22 passed；Server tests 44 passed / PostgreSQL 5 skipped；Web tests 113 passed；build、lint、typecheck exit 0 且 lint 无 warning；完整 PR Playwright 14 passed / 9 nightly skipped。Playwright 仅出现既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告；未执行真实 LAN 设备或目标 PostgreSQL 重启演练。

2026-08-24 开局身份辨认验证：规则核心使用 `identityRecognition` 三步参与者确认，当前产品默认关闭截止线；超过内部 `deadlineAt` 后确认仍计入当前步骤，直接调用唤醒 move 也不会推进。Web 已移除倒计时显示、计时器和自动唤醒回调，只保留匿名 `x/n`、确认与等待态；确认后操作区只保留固定的“等待中”按钮，不渲染额外辅助文案。第一幕使用 200ms 实体幕布落下并完全遮住圆桌舞台，身份牌和操作在落幕结束后延迟淡入；第二、三幕仍升幕查看圆桌座位，非参与者使用无动画的静态闭幕，reduced-motion 下直接显示终态。顶部返回和连接恢复控件始终位于幕布上方。服务端保留显式启用的权威截止线、原时间线追赶、重启保护和日志隐私回归，供未来创建房间配置接入。私密辨认 move 不计入 boardgame.io 公开 active-player move 计数；`playerView`、框架 `ctx` 与实时/持久化日志都不公开确认者或唤醒者座位。`playerView` 继续分步释放自己的角色、邪恶同伴座位和梅林可见的邪恶座位，不公开精确邪恶角色。仪式期间隐藏眼睛按钮。Game tests 38 passed；test-support 22 passed；Server tests 44 passed / PostgreSQL 5 skipped；Web tests 89 passed；build、lint、typecheck exit 0。完整 PR 级 Playwright 13 passed / 9 nightly skipped，覆盖无倒计时的专项身份仪式、刷新隐私、5 人 smoke 和 5/7/10 人目标视口；应用内浏览器在 1280×720 验证第一幕无页面滚动且圆桌完全不可见。本地仅出现既有的 `NO_COLOR`/`FORCE_COLOR` Node 警告。

2026-08-24 大屏圆桌尺寸验证：大厅与游戏页共用的圆桌外框最大直径调整为 640px；桌面和座位位置随外框缩放，头像与姓名保持独立可读尺寸，宽屏不会再小于低高度桌面基准，原本不超过 640px 的低高度和小屏布局继续沿用现有自适应规则，交互控件仍保留至少 44px 热区。Playwright 聚焦响应式回归覆盖 5、7、10 人大厅与游戏页，以及 320×568、568×320、390×844、768×1024、1024×768、1077×722、1280×685、1339×786、1440×900、1920×1080 十档视口，并验证 1339×786 的头像和姓名不小于 1280×685 基准，2 passed。Game tests 38 passed；test-support 22 passed；Server tests 49 passed；Web tests 89 passed；build、lint、typecheck exit 0。完整 PR 级 Playwright 13 passed / 9 nightly skipped。测试服务仅出现 `NO_COLOR` 被 `FORCE_COLOR` 覆盖的 Node 警告。

2026-08-23 业务确认弹窗统一验证：创建/加入名称与退出/解散房间弹窗迁移到共享原生 `ModalDialog`，显式恢复被 Tailwind preflight 重置的自动 margin，并统一视口安全边距、最大动态视口高度、内部滚动、Escape 和忙碌态关闭规则；开发控制抽屉/浮层保持不变。聚焦 Playwright 在 320×568 下通过真实创建与解散流程验证两个弹窗水平垂直居中且四边至少保留 16px；当前 543×761 浏览器实测中心偏差为 0。Web tests 85 passed；Web build、lint 和 E2E typecheck exit 0。测试服务仅出现 `NO_COLOR` 被 `FORCE_COLOR` 覆盖的 Node 警告。

2026-08-23 共享悬浮开发控制验证：主页与房间共用右下角 `Bug` 触发器、Token 输入、错误反馈和响应式浮层；主页保留上下文删除按钮，房间保留清除本机凭据、删除房间和 lobby 踢人操作。聚焦 Playwright 在 390×844、568×320、1077×722 下验证两处入口、桌面悬浮面板、移动底部抽屉、再次点击与 Escape 关闭、焦点循环、关闭后焦点恢复，以及浮层不增加页面滚动范围；房间仍保持整页无滚动。PR 审查后补充大厅当前玩家、断线和空座位的可访问名称，并在 320×568 与 568×320 下验证本人已提交的具体投票和任务牌仍然可见。完整 PR 级 E2E 10 passed / 9 nightly skipped；Web tests 85 passed；Web build、lint 和 typecheck exit 0。仅出现 `NO_COLOR` 被 `FORCE_COLOR` 覆盖的 Node 警告。

2026-08-23 圆桌美术接入与无滚动结构验证：当前玩家头像使用自己的角色素材，隐藏中的其他玩家继续使用中性头像，最终结算公开全部角色素材；游戏与大厅底部操作栏均已移除，眼睛按钮固定左下角，开局和退出/解散分别迁入桌面中央与顶部菜单，自动重连连续失败 8 秒后才提供顶部手动重连。房间壳层移除会覆盖动态视口的 `100vh`，仅保留 `100dvh` 并关闭 overscroll；`body` 的最低高度同样由 `100dvh` 覆盖，避免 iOS Chrome 动态工具栏产生页面滚动。高度至少 421px 的横屏通过负舞台上边距回收 Header 中部空白，Header 左右内容保持高层级且不得与座位重叠；5–6 人桌底部安全区至少 24px，7–10 人桌向下补偿保护顶部密集座位。Web tests 85 passed（包含动态视口壳层契约、8 秒连续断线、恢复重置和手动重试重新计时）；Web build exit 0；Playwright 聚焦响应式回归在 5、7、10 人及 320×568、568×320、390×844、768×1024、1024×768、1077×722、1280×685、1440×900 下通过，验证页面无横向或纵向滚动、可见头像/姓名条不被房间面板裁切、Header 左右内容不与座位重叠、座位与中央板无实质重叠、可见按钮至少 44px，以及选队、投票、横屏任务出牌和私密知识切换可操作。测试服务仅出现 `NO_COLOR` 被 `FORCE_COLOR` 覆盖的 Node 警告。

2026-08-23 自动化验收扩展验证：PR 浏览器门禁覆盖名称与冲突恢复、刷新与秘密提交、四种结局及 10 人响应式操作；Nightly 覆盖 5–10 人矩阵、7 人第四次任务一败/两败和双活跃房间。数据库 Pool 空闲连接错误回归仍保持 GREEN。

2026-08-23 PostgreSQL 网络中断崩溃修复验证：确认 `a90095d` 的范围仅是空闲客户端触发的 `pg.Pool` `error` 事件，不包含活动 `query()` 返回的 rejected Promise。新增 boardgame.io Socket.IO `update`、`sync`、`disconnect`、`chat` 请求错误边界；聚焦回归测试完成 RED（`sync` rejection 逸出）→ GREEN（安全日志并关闭底层连接）；Server tests 48 passed；Server typecheck exit 0。

2026-09-01 换座迟到提交与服务端错误边界修正验证：uncertain 或租约过期的换座恢复不再用一次源座位探测直接结算，而是先通过真实 participation client 精确重放原 match/source/credential/target；服务端 match queue 和“目标已持有相同 credential”幂等分支会在返回前序列化原请求与重放请求。重放成功保存目标后只清除匹配的 opaque marker；稳定 409 等拒绝才探测并保留有效源或恢复有效目标；网络、5xx、无效成功响应继续保留 uncertain marker、源会话和后续重试能力。路由刷新、陈旧 Socket snapshot 与退出/解散对账共用该路径；Playwright 的双标签页丢响应场景已实际发送重放请求并恢复目标。`prepare-start` 先认证请求中的 player ID 与 credential，再判断房间拥有者，因此有效访客稳定得到 `not_room_owner`，错误 credential 仍为 `invalid_seat_session`。换座 JSON parser 的异常进入统一 HTTP 错误边界：无效 JSON 返回结构化 400 `invalid_request`，超过 16 KiB 返回结构化 413 `payload_too_large`，限制未放宽。

```text
pnpm test ✅ Game 88；test-support 23；Server 84；Web 234（共 429 passed）
pnpm build ✅ Game、Server TypeScript 与 Web TypeScript + Vite build；单个 542.05 kB minified / 163.62 kB gzip chunk 建议性警告
pnpm lint ✅ exit 0，无 diagnostics
pnpm typecheck ✅ Game、test-support、Server、Web、E2E exit 0
pnpm exec vitest run tests/http-boundary.test.ts（apps/server）✅ 13 passed
pnpm exec vitest run tests/room-session.test.ts tests/room-participation.test.ts tests/RoomView.test.tsx（apps/web）✅ 90 passed
pnpm --filter @avalon/e2e test:e2e refresh-and-privacy.spec.ts ✅ 2 passed
pnpm test:e2e ✅ 18 passed / 9 nightly skipped
Playwright 本地日志 ⚠️ Node 子进程提示 `NO_COLOR` 被 `FORCE_COLOR` 覆盖；无业务 warning/error
pnpm --filter @avalon/server test:postgres ⚠️ 本轮未重跑；既有真实 PostgreSQL 环境/授权阻塞未解除，未以 memory storage 替代
真实 5–10 浏览器 LAN 验收 ⬜ 未执行
部署环境 PostgreSQL 重启与原凭据重连 ⬜ 未执行
```

以上本地结果只证明本功能提交的 `pnpm test`、构建和隔离浏览器自动化通过；上文 2026-08-30 及更早条目中的 GitHub Actions/PostgreSQL 容器结果仅记录当时已运行的历史基线，并未执行本功能提交。本轮没有单独运行强制 PostgreSQL 命令或重启探针，部署环境重启演练仍未运行，**也尚未完成真实 5–10 台设备的局域网验收或部署环境的 PostgreSQL 重启演练**。未声称当前提交已有 CI 结果。

## 当前架构与运行方式

生产部署：

```text
宿主机 Nginx（可选：域名 / TLS / 子路径剥离）
  └── Compose 网关（唯一发布端口）
        ├── 静态 Web
        ├── Lobby API ──> Node :8001（Compose 内网）
        └── Socket.IO ──> Node :8000（Compose 内网）
                              └── PostgreSQL :5432（Compose 内网）
```

本地开发：

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
- 玩家名称和装饰头像也只保存在浏览器 `localStorage`，不构成账号或认证身份。加入房间时会把当时的名称和头像复制到公开座位 metadata；同名允许存在，界面和操作日志以座位号区分。头像来源与 CC BY 4.0 署名可在用户中心和 `apps/web/src/assets/avatars/README.md` 查看，头像选择不表达服务端隐藏角色。
- 正常 Web 流程一次只允许同一浏览器参与现存的活动房间：所有已保存且通过凭据验证的 lobby/playing 房间显示“进入”，并阻止创建或加入新房间。该规则会同步其他标签页，但属于浏览器 UX 约束，不是可抵抗直接 API 调用的服务端授权边界。
- 等待大厅的正式离座与解散使用 boardgame.io player credential 授权并在 match queue 内重新校验状态；普通玩家只能释放自己的座位，只有当前房间拥有者可以解散房间，0 号座位本身不授予管理权限。playing 状态返回冲突并保留凭据；“返回主页”不会释放座位。
- 隐私窗口通常与普通窗口隔离，但同一隐私会话内的多个 Tab/窗口通常仍共享身份；关闭全部隐私窗口后本地凭据会消失，服务器座位不一定释放。
- 开发房间控制需要在服务端 `.env.local` 同时设置 `AVALON_DEV_TOOLS=true` 和非空 `AVALON_DEV_ADMIN_TOKEN`；本地测试时由操作者手动输入页面，Token 不得提交、嵌入 Web 配置或持久化，其他场景仍是服务器 secret。
- PostgreSQL 或 LAN 短暂不可达时，进行中的请求仍可能失败，需要在网络恢复后重试。提交 `a90095d` 只处理空闲客户端的 Pool `error` 事件；活动查询失败是独立的 Promise rejection 路径。当前空闲连接错误由 `PostgresStorage` 记录，boardgame.io Socket.IO 活动请求错误由请求边界记录并关闭底层连接以触发客户端重连；两者都只记录事件、错误码和消息，不记录凭据或请求参数，也不会把数据库故障伪装成房间不存在。
- 当前版本不为任何阶段配置自动超时；断线玩家可能阻塞身份辨认、组队、投票、任务牌或刺杀。身份辨认同样没有截止线、自动跳过或代确认入口。
- boardgame.io 内置 Debug Panel 默认关闭且不渲染；项目自定义开发控制仅在服务端显式启用后显示，不能绕过 `playerView` 或修改游戏状态。
- 加载、大厅、身份辨认、游戏与结算只允许通过单一 `RoomScreen` 组合；布局纯函数和结构外壳归 `@avalon/ui-layout`，Web 只负责真实状态、交互、主题与 DOM 测量。最低验收对为 375×667 和 667×375；不得重新引入独立大厅/游戏圆桌或按方向复制求解算法。

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
