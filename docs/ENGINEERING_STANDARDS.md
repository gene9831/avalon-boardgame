# Avalon 工程与代码规范

本规范定义 Avalon 仓库中由 AI 或人工开发者创建、修改、测试和交付代码时应遵循的工程约定。目标不是建立一套与仓库脱节的通用风格，而是让每个变更都符合当前架构、技术栈、安全边界和验证流程。

## 1. 适用范围

本规范适用于：

- `apps/web` 中的 React UI、路由、浏览器身份和本地重连状态；
- `apps/server` 中的 boardgame.io 服务、Lobby API、Socket、会话校验、房间生命周期和持久化；
- `packages/game` 中的共享游戏规则核心、公开类型和 `playerView`；
- `packages/test-support` 与 `tests/e2e` 中的测试支持和端到端测试；
- `infra/postgres` 中的数据库部署配置；
- 根级脚本、配置和工程文档。

本文面向当前仓库。开始工作前，开发者 `MUST` 从各包的 `package.json` 和现有配置确认实际版本与工具，不得仅凭本文中的技术栈描述推断未来状态。

### 1.1 快速阅读路线

- 所有代码任务：先读第 1–5 节，再读第 11–16 节；
- Web/React：追加第 6 节；
- 游戏规则或公开类型：追加第 7 节；
- Server/API/Socket：追加第 8 节和第 10 节；
- PostgreSQL、房间生命周期或重连：追加第 9 节和第 10 节；
- 纯文档任务：重点阅读第 1–3、12、14–16 节。

### 1.2 规范关键词

- `MUST` / `MUST NOT`：不可静默违反的强制规则。
- `SHOULD` / `SHOULD NOT`：默认必须遵循；偏离时必须给出具体理由。
- `MAY`：可以按任务需要选择，不代表默认需要引入。

关键规则优先说明边界、原因和验证方式。能由 TypeScript、Oxlint、测试或 CI 自动发现的问题，应优先交给工具；架构、安全和领域判断仍需人工或 AI 审查。

### 1.3 权威优先级

发生冲突时，按以下顺序处理：

1. 用户对当前任务的明确指令；
2. [`docs/rules/`](./rules/)、已接受的 [`docs/adr/`](./adr/) 与 [MVP 设计](./superpowers/specs/2026-08-14-avalon-boardgame-design.md)；
3. [`CONTEXT.md`](../CONTEXT.md) 中的领域术语；
4. [`AGENTS.md`](../AGENTS.md) 中的项目范围、安全边界和工作流；
5. 本规范中的实现约定；
6. 外部行业指南。

代码、测试与文档不一致时，开发者 `MUST` 报告差异并核对上游来源，不得静默选择一种解释。外部指南只能解释通用原则，不得覆盖项目已接受的规则或架构。

## 2. AI 变更契约

### 2.1 修改前

AI `MUST`：

1. 检查工作树并保护用户已有或无关的修改；
2. 阅读与任务相关的规则、ADR、术语、状态和本规范章节；
3. 核对现有实现、测试、配置和依赖，而不是根据框架印象猜测；
4. 说明具体目标、修改范围、验收条件和验证计划；
5. 解决会实质改变结果的歧义，并在得到批准后再实施；
6. 按 [`AGENTS.md`](../AGENTS.md) 的分支流程工作。

### 2.2 修改中

AI `MUST`：

- 做满足目标的最小一致变更；
- 遵循现有模块边界和项目词汇；
- 不把无关重构、依赖升级或工具迁移混入任务；
- 不自行扩大 MVP 范围；
- 不用前端便利性削弱服务端权威或隐藏信息边界；
- 不修改正确的生产代码来人为制造失败测试；
- 不提交临时日志、诊断计数器、实现辅助测试或生成计划；
- 遇到事实来源冲突、安全风险或超出授权的行为时停止并报告。

### 2.3 修改后

AI `MUST` 报告：

- 实际修改的文件和可观察行为；
- 实际执行的验证命令及结果；
- 失败、警告、跳过项和缺失的环境依赖；
- 尚未执行的人工或真实环境验收；
- 是否残留临时或生成产物。

不得把短期工具进程、自动化测试或单浏览器检查描述为完成了真实 5–10 玩家 LAN、多房间隔离、PostgreSQL 重启或凭证重连验收。

## 3. 全局工程原则

### 3.1 正确性优先于局部简洁

- 安全、权限、隐藏信息、房间生命周期、持久化和规则正确性 `MUST` 优先于减少几行代码。
- 表达同一领域概念时 `MUST` 使用 [`CONTEXT.md`](../CONTEXT.md) 的术语。
- 规则和安全边界 `MUST` 只有一个权威实现；UI 可以呈现结果，但不能成为安全边界。
- 稳定状态转换和结算结果 `MUST` 保持不可逆、不可重复提交和不可被迟到写入恢复。

### 3.2 单一职责与清晰边界

- 一个模块 `SHOULD` 有一个可概括的职责和清晰的输入、输出及依赖。
- 路由、网络、持久化、状态编排和展示持续堆积在同一文件时，`SHOULD` 拆到现有职责模块中。
- 不设置机械的函数或文件行数上限。拆分依据是认知复杂度、变化原因、可测试性和依赖边界。
- 修改既有代码时采用“触及即改善”，但 `MUST NOT` 借当前任务进行无关的大范围清理。

### 3.3 明确的数据所有权

- 每份状态 `MUST` 有明确所有者：游戏规则核心、服务端房间/持久化、浏览器会话或局部 UI。
- 同一权威状态 `MUST NOT` 在 Web 和 Server 分别实现并尝试同步。
- 派生数据 `SHOULD` 在读取处计算；只有在成本、快照或协议要求明确时才持久化。
- 跨模块数据 `SHOULD` 通过公开类型和接口传递，不应读取内部实现细节。

## 4. TypeScript 与模块规范

### 4.1 严格类型

- 所有工作区 `MUST` 保持 TypeScript strict 配置及现有未使用代码检查。
- 公共接口、领域状态、持久化边界和安全边界 `MUST` 使用明确类型。
- 局部实现 `SHOULD` 利用可靠的类型推断，避免重复且容易漂移的注解。
- 不可信输入 `MUST` 先表示为 `unknown` 或等价未验证结构，再通过运行时校验缩窄。
- `any` `MUST NOT` 作为快捷修复。第三方类型缺失时，可在最小的适配层隔离使用并说明原因。
- 类型断言 `as` `MUST NOT` 代替网络、Socket、环境变量或数据库数据的运行时验证。
- 非空断言 `!` `SHOULD NOT` 用来隐藏未处理的缺失状态。

```ts
// Bad: 编译期断言伪装成输入验证。
const request = payload as JoinRoomRequest

// Good: 边界先验证，再进入已类型化的领域代码。
const request = parseJoinRoomRequest(payload)
```

### 4.2 类型建模

- 有限状态、角色、阶段和错误码 `SHOULD` 使用联合类型、字面量或可穷尽判别联合，而不是任意字符串。
- 非法状态 `SHOULD` 尽量在类型或构造边界上不可表示。
- 公共类型变更 `MUST` 检查所有消费者以及 `playerView` 暴露的数据面。
- 安全敏感结构 `SHOULD` 明确区分公开、私有、待结算和已结算数据。
- 只读输入 `SHOULD` 使用 `readonly` 或不可变约定，避免调用方被意外修改。

### 4.3 导入与导出

- 使用 ESM `import` / `export`，保持与当前包的 `"type": "module"` 一致。
- 跨工作区只从包公开导出导入，`MUST NOT` 深层导入另一包的 `src` 内部文件。
- `packages/game/src/index.ts` 等公共入口 `SHOULD` 只暴露消费者确实需要的稳定接口。
- `MUST NOT` 引入循环依赖；发现循环时应调整职责或提取无状态共享类型。
- 导入顺序和扩展名遵循相邻文件与现有工具，不为纯格式偏好改写无关文件。

### 4.4 命名

- 变量、函数和 Hook 使用 `camelCase`；React 组件、类型和类使用 `PascalCase`。
- Boolean 名称 `SHOULD` 表达判断含义，例如 `isConnected`、`canSubmitQuest`、`hasCredential`。
- 事件处理器 `SHOULD` 使用 `handleX`；传入组件的事件属性 `SHOULD` 使用 `onX`。
- 测试名称 `MUST` 描述稳定行为或回归结果，而非内部调用顺序。
- 前端组件文件沿用 `PascalCase.tsx`；纯逻辑模块沿用仓库已有的 `kebab-case.ts`。新增文件 `MUST` 与所在目录一致。
- 缩写 `SHOULD` 以可读性为准；领域名称优先使用完整词，不发明第二套别名。

### 4.5 异步与错误

- 每个 Promise `MUST` 有明确的等待、返回或拒绝处理路径。
- `try/catch` 只能在能够恢复、转换、补充上下文或记录的层级使用，`MUST NOT` 捕获后静默忽略。
- `catch` 中的未知异常 `MUST` 安全缩窄后再访问属性。
- 错误 `SHOULD` 在边界层转换为稳定业务错误；底层细节保留在受控日志中。
- 资源生命周期 `MUST` 成对：订阅/取消订阅、连接/关闭、事务开始/提交或回滚。

## 5. pnpm workspace 与包边界

| 路径 | 所有权 | 允许依赖 | 禁止承担 |
| --- | --- | --- | --- |
| `packages/game` | 规则核心、公共类型、`playerView` | browser-safe 依赖 | PostgreSQL、Socket.IO、服务端配置、UI |
| `apps/server` | 服务权威、Lobby/API、凭证、房间生命周期、持久化 | `packages/game`、Node/server 依赖 | 浏览器 UI |
| `apps/web` | React UI、路由、浏览器身份、本地重连状态 | `packages/game` 的公开导出、过滤后状态 | 权威规则、凭证授权、安全过滤 |
| `packages/test-support` | 可复用测试支持 | 被测包的公开或明确测试接口 | 生产运行时逻辑 |
| `tests/e2e` | 用户流程与跨进程验收 | 已运行的公开界面和测试支持 | 游戏规则的第二实现 |
| `infra/postgres` | 数据库部署配置 | PostgreSQL/Docker 配置 | 应用运行时逻辑 |
| 根目录 | workspace 编排 | 脚本与共享配置 | 运行时应用依赖 |

- 使用 pnpm；`MUST NOT` 使用 npm 或 yarn 修改依赖或 lockfile。
- 根包 `MUST` 保持编排职责，不得为了方便加入 Web 或 Server 运行时依赖。
- 新跨包接口 `MUST` 明确所有者、消费者和兼容性影响。
- 包边界变化 `MUST` 先说明替代方案；架构或安全边界变化需要接受的 ADR。

## 6. React 与 Web 前端

当前前端使用 React、React Router、Vite、Tailwind CSS、boardgame.io Client、Socket.IO、Vitest、Playwright 和 Oxlint。新增代码 `MUST` 优先使用这些现有能力。

### 6.1 组件与渲染

- 组件和 Hook 的 render 逻辑 `MUST` 幂等且无副作用。
- `MUST NOT` 在 render 中推进游戏、发送请求、写 `localStorage`、修改全局状态或订阅 Socket。
- 用户动作触发的副作用优先放在事件处理器；与外部系统同步的副作用才放在必要的 Effect。
- Props、state 和 Hook 输入 `MUST` 当作不可变快照，不得直接修改。
- 展示组件 `SHOULD` 通过明确 props 接收过滤后的数据，不应自行寻找凭证或重建权威状态。

```tsx
// Bad: 渲染本身触发持久化。
function PlayerName({ name }: { name: string }) {
  localStorage.setItem('player-name', name)
  return <span>{name}</span>
}

// Good: 持久化发生在明确的用户操作路径。
function handleSavePlayerName(name: string) {
  savePlayerProfile(name)
  setPlayerName(name)
}
```

### 6.2 状态所有权

- 只影响一个组件的状态 `SHOULD` 保持局部。
- 多个组件共享的状态 `SHOULD` 提升到最近公共父级，或在确有跨树共享需求时使用已有 Context 模式。
- `MUST NOT` 自行引入 Redux、Zustand 或另一套全局状态库。
- 服务端游戏状态以 boardgame.io / `playerView` 为权威；React state 只保存界面交互、连接状态或经过明确设计的浏览器状态。
- `localStorage` 只用于浏览器身份、会话和偏好等已定义用途；读取必须处理缺失、过期和损坏数据。
- 不同房间的状态 `MUST` 由 `matchID` 和经验证的 seat session 隔离。

### 6.3 网络、路由和实时连接

- REST/Lobby 调用 `SHOULD` 留在现有网络模块或新的职责清晰模块，不直接散落在展示组件中。
- 可测试的请求封装 `SHOULD` 保留可注入 `fetcher` 等现有模式。
- Socket/boardgame.io Client 创建、订阅、重连和销毁 `MUST` 有单一所有者及清理路径。
- 路由参数、服务器响应和存储数据 `MUST` 在使用前验证。
- UI `MUST` 区分加载、空状态、可恢复错误、凭证失效和不可继续状态。
- 不得因为刷新或 stale browser state 重新创建已删除房间或恢复无效凭证。

### 6.4 样式与可访问性

- 默认使用 Tailwind CSS utility；自定义 CSS 用于 utility 难以清楚表达的圆桌布局、动画、媒体查询或全局基础样式。
- `MUST NOT` 继续向未使用的样式文件添加规则；删除或迁移既有死样式应作为独立整改。
- 重复、稳定的 UI 模式 `SHOULD` 抽取为组件或受控样式，而不是复制长串差异不明的 class。
- 交互控件 `MUST` 使用正确的语义元素，并提供可理解的名称、禁用状态和键盘行为。
- 颜色不能成为状态的唯一表达；重要反馈 `SHOULD` 同时提供文本、图标或结构变化。
- 响应式变更 `SHOULD` 检查目标 LAN 设备尺寸，不只验证桌面宽屏。

## 7. Game 共享规则核心

### 7.1 权威规则

- 角色配置、任务人数、失败阈值、阶段转换、投票结算、任务结算、刺杀和胜利判断 `MUST` 只在 `packages/game` 的权威规则中定义。
- Web `MUST NOT` 复制规则来决定某个动作是否有效；客户端预提示不能代替服务端 move 校验。
- 规则变化前 `MUST` 核对 `docs/rules/`、ADR、MVP 设计和既有测试。
- move `MUST` 校验 actor、phase/stage、输入、重复提交和当前状态。
- 已结算的投票、任务和胜利结果 `MUST` 保持不可变。

### 7.2 隐藏信息

- `AvalonG` 中的公开状态与 `secret` `MUST` 明确分离。
- `playerView` 是服务端隐藏信息边界；浏览器只可收到当前 viewer 允许知道的数据。
- 角色、待投票、待任务牌和其他秘密选择在允许公开前 `MUST NOT` 进入公共状态、metadata、日志或 API summary。
- Good 玩家 `MUST NOT` 能提交 Fail 任务牌。
- 公共任务结果 `MUST` 只包含聚合信息，不得关联个人提交。
- 结束后公开身份时，应通过显式已结算字段完成，不得暴露历史 secret 容器。

```ts
// Bad: 先把 secret 展开到公共对象，再依赖 UI 不显示。
return { ...G, roleByPlayer: G.secret.roleByPlayer }

// Good: 先移除 secret，只为当前 viewer 构造最小可见信息。
const { secret: _secret, ...publicState } = G
return addViewerKnowledge(publicState, G.secret, playerID)
```

### 7.3 规则测试

- 规则变化 `MUST` 有行为测试覆盖最终预期，而不是只检查内部调用序列。
- 隐藏信息测试 `MUST` 从不同 viewer 观察结果，证明每个 viewer 获得正确且最小的数据。
- 人数矩阵、任务阈值和胜负条件应使用表驱动或参数化测试，避免复制易漂移用例。
- 随机行为 `MUST` 可通过种子、固定输入或可重复的测试支持重放。

## 8. Server、API 与 Socket

### 8.1 服务端权威与输入边界

- 服务端 `MUST` 对游戏变更、凭证、房间生命周期和持久化保持最终权威。
- 所有外部输入 `MUST` 验证形状、取值范围、认证、授权和当前房间状态。
- 公共 client ID、session ID、room ID、match ID 或 player ID `MUST NOT` 被当作认证。
- seat 访问 `MUST` 使用服务端验证的 boardgame.io player credential。
- 认证和授权判断 `MUST` 在产生副作用或返回敏感数据前完成。
- 同一请求的重放或重复提交 `MUST` 不得产生第二次结算或恢复已删除状态。

### 8.2 API 响应与错误

- API `SHOULD` 返回稳定状态码和有限、可理解的错误码或消息。
- 客户端响应 `MUST NOT` 包含堆栈、SQL、数据库结构、连接串、服务端路径、token 或隐藏游戏数据。
- 捕获错误时 `MUST` 决定是恢复、转换、记录后传播，还是关闭故障连接；不得吞掉异常。
- 未知内部错误 `SHOULD` 对客户端降级为通用响应，并在服务端使用脱敏上下文记录。
- 业务冲突与认证失败 `SHOULD` 保持可区分，但不得通过差异响应泄露秘密。

### 8.3 Socket 与生命周期

- EventEmitter、Socket 和数据库连接 `MUST` 安装适当错误处理器。
- 订阅、监听器、定时资源和连接 `MUST` 在离房、断开、测试结束或服务关闭时清理。
- Socket payload 与事件身份 `MUST` 在服务端重新验证，不得信任浏览器声明。
- 房间相关事件 `MUST` 绑定到正确 match/seat，防止跨房间状态污染。
- 进程级 `uncaughtException` 或 `unhandledRejection` `MUST NOT` 被用作继续正常服务的恢复机制。

### 8.4 配置与开发工具

- 非测试启动默认要求 PostgreSQL；memory storage 只能由明确的测试或本地开发配置启用。
- 开发管理 API `MUST` 默认关闭，并同时要求显式开关和非空服务端 token。
- 开发 token `MUST NOT` 进入 Web 配置、浏览器存储、构建产物、日志或持久化数据。
- 配置读取 `MUST` 在启动边界验证；缺少必需值时应快速失败并提供不含秘密的诊断。

## 9. PostgreSQL 与持久化

### 9.1 查询与事务

- 所有来自用户、网络或游戏状态的 SQL 值 `MUST` 使用 `$1`、`$2` 等参数化占位符。
- 表名、列名等动态 identifier 不能作为普通参数；必须来自固定白名单或安全 identifier 工具。
- 多条必须共同成功的写操作 `MUST` 使用同一 client 的显式事务。
- 事务失败 `MUST` 尝试回滚，并保留原始失败上下文；client 必须在 `finally` 中释放。
- 单条原子语句不必为了形式额外包事务；事务边界应对应业务原子性和竞态窗口。

```ts
// Bad: 网络输入拼接进 SQL。
await client.query(`SELECT * FROM matches WHERE match_id = '${matchID}'`)

// Good: 值通过参数传递。
await client.query('SELECT * FROM matches WHERE match_id = $1', [matchID])
```

### 9.2 一致性与生命周期

- 持久化 adapter `MUST` 遵守 boardgame.io Storage API 的 metadata、state、initial state 和 log 语义。
- 房间删除后，迟到、匿名或陈旧写入 `MUST NOT` 重建房间、玩家或凭证。
- metadata 写入 `MUST NOT` 恢复已移除玩家或旧 credential。
- 当前删除黑名单、版本和写队列属于单进程约束；`MUST NOT` 宣称它提供多实例一致性。
- 引入多 server、分布式锁、数据库 CAS 或迁移策略前 `MUST` 取得新的架构决定。
- schema 变化 `MUST` 说明升级、兼容、回滚和数据保留影响；破坏性操作需要明确授权和可恢复方案。

### 9.3 数据最小化

- 只持久化恢复游戏和会话所需的数据。
- 房间目录和公开 metadata `MUST` 使用允许列表构造，不能直接序列化内部 match 对象。
- credential、开发 token、连接串和不必要的 hidden state `MUST NOT` 出现在公开目录或日志中。
- 测试数据 `SHOULD` 隔离并可清理，不得依赖共享、不可控的外部数据库状态。

## 10. 安全、凭证与日志

### 10.1 最小权限和最小披露

- 每个 API、Socket event 和 move 只授予完成当前操作所需的最小权限。
- 服务端响应只包含客户端完成当前界面所需的最小数据。
- UI 隐藏、禁用按钮或路由守卫 `MUST NOT` 被视为授权控制。
- 错误响应、日志和监控信息 `MUST` 分别按其受众裁剪。

### 10.2 凭证处理

- credential/token `MUST` 由可信服务端生成并验证，且具有足够随机性。
- credential 比较 `SHOULD` 使用现有恒定时间比较模式。
- 真实或运行时生成的 credential `MUST NOT` 出现在 URL、日志、错误消息、提交内容、截图或测试快照中；测试 fixture 只能使用明确的无效占位值。
- 浏览器只保存重连所需的 seat credential；访问范围应限制在匹配的 room/seat。
- 释放 seat、解散房间或替换 credential 后，旧 credential `MUST` 失效。

### 10.3 日志

- 日志 `SHOULD` 使用结构化事件名、稳定错误码和脱敏标识。
- `MUST NOT` 记录 credential、token、密码、数据库连接串、完整 session ID、隐藏角色或待结算选择。
- 外部输入写入日志前 `MUST` 防止换行和分隔符注入。
- 安全相关失败 `SHOULD` 记录足够的 room/event 上下文用于诊断，但不得记录秘密值。

## 11. 测试规范

### 11.1 测试层选择

| 变化类型 | 首选验证 | 重点 |
| --- | --- | --- |
| 纯规则、角色、阈值、状态转换 | `@avalon/game` Vitest | 权威规则与确定性 |
| `playerView`、凭证、授权、房间隔离 | Game/Server Vitest 与 Socket 测试 | 安全边界和不同观察者 |
| 持久化 adapter、重启恢复 | Server PostgreSQL 集成测试 | 真实数据库语义 |
| React 纯逻辑、稳定静态输出 | Web Vitest | 公共 props/输出契约 |
| 路由、浏览器存储、刷新重连、多人流程 | Playwright | 用户可见行为和上下文隔离 |
| 真实 LAN、设备、PostgreSQL 重启 | 人工验收 | 自动化不能替代的环境行为 |

### 11.2 永久测试的标准

永久测试 `MUST` 能回答：“它防止哪个重要生产回归？”

应保留：

- 主要验收行为；
- 稳定公共契约；
- 隐藏信息、授权、房间隔离和持久化边界；
- 已发生且可能再次发生的重要回归。

应删除：

- 只验证实现中间状态的测试；
- 私有调用顺序、render 次数或生命周期计数；
- 临时日志、计数器、fixture 和诊断分支；
- 不代表稳定契约的微小内部路径测试。

### 11.3 测试写法

- 测试名称和断言 `SHOULD` 直接确认用户或消费者获得的结果。
- 优先正向断言；只有“不得发生”本身是稳定安全或产品要求时才使用负向断言。
- 测试 `MUST` 相互隔离，不依赖执行顺序、共享 credential 或残留房间。
- mock 只隔离慢速、不稳定或难以触达的外部边界，不应模拟被测核心行为本身。
- E2E 优先 `getByRole`、`getByLabel` 等语义定位器和 web-first assertions。
- 测试通过不代表 TypeScript 已检查；任务范围要求时 `MUST` 单独运行 typecheck。
- PostgreSQL 集成测试因缺少 `DATABASE_URL` 跳过时，`MUST` 明确报告，不能声称通过真实数据库验证。

### 11.4 TDD 风险分级

- 规则、安全、认证、房间隔离、生命周期、持久化、重连和重要回归 `MUST` 使用行为导向 TDD 或先建立稳定回归保护。
- 低风险 UI 样式、文案和机械重构 `MAY` 先实现，再用最窄的构建、类型检查或人工检查验证。
- 如果目标行为已经正确存在，新测试可以直接通过并作为覆盖；`MUST NOT` 破坏生产代码来制造 RED。

## 12. 样式、注释与文档

### 12.1 格式和 lint

- 当前 Web lint 使用 Oxlint；仓库没有统一 Prettier 流程。开发者 `MUST` 以现有配置和相邻代码为准。
- `MUST NOT` 为纯格式偏好重排无关文件或引入第二套格式工具。
- lint 报告的 error `MUST` 修复；warning 应判断是否与当前改动相关并在交付中说明。
- 自动格式化规则的引入或迁移应作为独立工程任务评估。

### 12.2 注释

- 注释解释“为什么”、不变量、协议限制或非显然取舍，`SHOULD NOT` 逐行复述代码。
- 安全或并发相关注释 `SHOULD` 指向对应 ADR、规则或回归测试。
- 临时 TODO 注释 `MUST` 有明确所有者或跟踪入口；能立即完成的小问题不应留下模糊 TODO。
- 不得在注释、示例或文档中放置真实秘密值。

### 12.3 文档同步

- 设置、命令、端口或环境变量变化 `MUST` 更新相关 README 和 `.env.example`。
- 架构、安全或数据一致性边界变化 `MUST` 更新或新增 ADR。
- 游戏行为变化 `MUST` 同步规则文档、测试和受影响 UI 文案。
- 独立模块完成后，按 [`AGENTS.md`](../AGENTS.md) 更新唯一进度来源 `docs/PROJECT_STATUS.md`；不得创建竞争状态文档。
- Codex 生成的计划和临时规格默认不进入长期仓库，任务结束后应删除，除非用户明确要求保留。

## 13. 依赖、配置与环境变量

- `MUST` 使用 pnpm 管理 workspace 依赖。
- 新生产依赖前 `MUST` 说明现有能力为何不足、包的职责、运行时成本、安全面和维护成本，并取得批准。
- `MUST NOT` 引入与现有库职责重叠的状态、路由、请求、样式或测试框架而不进行方案比较。
- 应优先使用 Node 标准库、现有依赖和小型本地模块。
- 环境变量只在拥有它的运行时读取；server secret `MUST NOT` 使用 `VITE_` 前缀或进入 Web bundle。
- `.env`、`.env.local`、credential、数据库密码和 admin token `MUST NOT` 提交。
- `.env.example` 只记录变量名、用途和安全的占位符，不包含可用秘密。
- 依赖安装、解析或更新命令需要网络访问；普通测试、构建、lint 和 typecheck 不应无故申请网络权限。

## 14. 验证矩阵

先运行最窄的相关检查，再按变化风险扩大范围。

| 变更范围 | 最低验证 |
| --- | --- |
| 纯文档/文案 | 内容、链接和 diff 审查；`git diff --check` |
| `packages/game` | `pnpm --filter @avalon/game test`；`pnpm --filter @avalon/game typecheck` |
| `apps/server` 非数据库路径 | `pnpm --filter @avalon/server test`；`pnpm --filter @avalon/server typecheck` |
| PostgreSQL adapter/重连 | 上述 Server 检查 + `pnpm test:postgres`；报告实际数据库环境 |
| `apps/web` 逻辑/UI | `pnpm --filter @avalon/web test`；按需 `pnpm --filter @avalon/web build` |
| 跨应用或 workspace 配置 | `pnpm test`、`pnpm build`、`pnpm lint`、`pnpm typecheck` |
| 关键浏览器流程 | `pnpm test:e2e`；需要矩阵时使用 `pnpm test:e2e:matrix` |

验证失败时 `MUST` 报告实际错误并区分：代码回归、既有失败、缺少服务/数据库、环境权限或网络问题。不得删改有价值测试来获得绿色结果。

## 15. 例外与规范演进

- 开发者 `MUST NOT` 静默偏离本规范。
- 合理例外必须说明：冲突规则、任务约束、风险、考虑过的替代方案和补偿验证。
- 普通局部例外记录在变更说明中；只有代码无法表达的重要不变量才写邻近注释。
- 架构、安全、权限、并发、迁移、数据一致性或跨包边界例外 `MUST` 取得明确批准，并在需要时更新 ADR。
- 技术栈、工具或目录所有权变化时，`MUST` 同步本规范和 `AGENTS.md` 的入口说明。
- 既有代码不符合新规范时，不立即批量整改；新增代码完全适用，修改处采用“触及即改善”。

## 16. AI 完成前检查清单

- [ ] 我只修改了获批范围内的文件和行为。
- [ ] 我核对了相关规则、ADR、术语和现有实现。
- [ ] 我没有复制权威规则到 Web 或泄露 hidden state。
- [ ] 我验证了所有外部输入、认证和授权边界。
- [ ] 我没有记录、提交或返回 credential、token、连接串或秘密状态。
- [ ] 我保持了包边界，没有深层跨包导入或新增重叠依赖。
- [ ] 我为稳定行为、安全边界或重要回归保留了恰当测试，并删除临时验证产物。
- [ ] 我运行了与风险相称的真实命令，并记录了失败和跳过项。
- [ ] 我同步了任务真正影响的规则、ADR、README、环境变量示例或项目状态。
- [ ] 我没有把自动测试或短期进程夸大为真实 LAN/重启验收。
- [ ] 我审查了最终 diff，确认未覆盖用户已有修改。

## 17. 官方参考依据

下列资料用于解释通用工程原则；项目来源仍按第 1.3 节优先：

- [TypeScript `strict` TSConfig reference](https://www.typescriptlang.org/tsconfig/strict.html)
- [TypeScript Handbook: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [React: Rules of React](https://react.dev/reference/rules)
- [React: Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [Node.js Errors API](https://nodejs.org/api/errors.html)
- [node-postgres: Queries](https://node-postgres.com/features/queries)
- [node-postgres: Transactions](https://node-postgres.com/features/transactions)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Vitest: Testing in Practice](https://vitest.dev/guide/learn/testing-in-practice)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
