[English](README.md) | 简体中文

# 阿瓦隆桌游

这是一个在局域网中运行的《The Resistance: Avalon（抵抗组织：阿瓦隆）》基础规则在线实现，支持 5–10 名玩家。技术栈包括 React、TypeScript、Vite、boardgame.io、Socket.IO 和 PostgreSQL。

项目已经实现共享规则核心、多人传输、大厅流程、PostgreSQL 持久化、座位绑定重连、完整房间内 Web 流程、确定性回放和自动化游戏流程测试。目前主要待验收项是在真实局域网中使用 5–10 台物理设备完成整局游戏，以及在部署环境中演练 PostgreSQL 重启后的重连。

## 工作区结构

```text
apps/
  web/          React + Vite 浏览器客户端
  server/       Node + boardgame.io 服务端边界
packages/
  game/         浏览器安全的阿瓦隆规则核心与公共类型
  test-support/ 确定性 seed、transcript 和回放驱动
tests/
  e2e/          Playwright 多浏览器上下文流程
infra/
  postgres/     PostgreSQL 部署边界
docs/
  rules/        规则参考与可见性约束
  adr/          架构决策记录
  testing/      自动化与人工验收流程
```

根 package 只负责编排。服务端专用依赖不能被浏览器或共享游戏 package 导入。规则、凭据、隐藏状态和游戏变更都由服务端权威控制；浏览器只能通过 `playerView` 收到按玩家过滤后的状态。

## 环境要求

CI 验证使用以下工具链：

- Node.js 24；
- pnpm 11.21.0；
- 持久化开发和 PostgreSQL 集成测试使用 PostgreSQL 16；
- 浏览器测试需要通过 Playwright 安装 Chromium。

## 快速开始

在仓库根目录安装依赖：

```bash
pnpm install
```

为服务端选择一种存储模式：

- 如需持久化开发，将 `apps/server/.env.example` 复制为 `apps/server/.env.local`，并设置有效的 `DATABASE_URL`。
- 如需明确使用临时内存存储，创建 `apps/server/.env.local` 并写入 `AVALON_STORAGE=memory`。服务停止后所有房间都会丢失。

分别在两个终端启动服务端和 Web 客户端：

```bash
pnpm dev:server
```

```bash
pnpm dev
```

打开 `http://localhost:5173`。默认情况下，游戏服务监听 `8000` 端口，大厅 API 监听 `8001` 端口。

通过局域网访问时，浏览器会根据打开页面所使用的主机名推导两个服务地址。如果 Web 客户端和服务端运行在不同主机上，请在 `apps/web/.env.local` 中配置 `VITE_LOBBY_URL` 和 `VITE_GAME_URL`。详细配置请阅读[服务端](apps/server/README.md)、[Web 客户端](apps/web/README.md)和 [PostgreSQL 部署](infra/postgres/README.md)说明。

## 根目录脚本

下表覆盖根 `package.json` 中声明的全部脚本。

| 脚本 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 `@avalon/web` Vite 开发服务，并监听所有网络接口。 |
| `pnpm dev:server` | 启动 `@avalon/server` 大厅 API 和 Socket.IO 游戏服务；存在 `apps/server/.env.local` 时会自动加载。 |
| `pnpm build` | 对 `@avalon/game` 和 `@avalon/server` 做类型检查，然后生成 Web 生产构建。 |
| `pnpm lint` | 对 `@avalon/web` 运行 Oxlint。 |
| `pnpm preview` | 使用 Vite preview 提供已构建的 Web 文件；需要先运行 `pnpm build`。 |
| `pnpm test` | 运行所有声明了 `test` 脚本的 workspace：规则核心、回放/属性、服务端和 Web 单元测试；不包含 Playwright 和强制使用 PostgreSQL 的测试。 |
| `pnpm test:e2e` | 运行默认 Playwright 浏览器测试。常规运行执行五人 smoke 流程，并跳过仅矩阵模式使用的用例。 |
| `pnpm test:e2e:matrix` | 运行 5、6、7、8、9、10 人的确定性完整局 Playwright 矩阵。 |
| `pnpm test:postgres` | 运行服务端 PostgreSQL 存储和凭据重连集成测试；需要可访问的 `DATABASE_URL`。 |
| `pnpm test:replay --seed <seed> --players <5-10>` | 通过规则驱动回放一局确定性生成的游戏。 |
| `pnpm typecheck` | 对 game、test-support、server、Web 和 E2E workspace 进行类型检查。 |

## Workspace 脚本

在仓库根目录使用 `pnpm --filter <package> <script>` 运行 package 脚本。下表覆盖各 workspace package 声明的全部脚本。

| Package | 脚本 | 用途 |
| --- | --- | --- |
| `@avalon/game` | `test` | 运行规则核心测试。 |
| `@avalon/game` | `typecheck` | 对浏览器安全的游戏 package 做类型检查，不生成文件。 |
| `@avalon/test-support` | `replay` | 运行确定性回放 CLI，接受 `--seed` 和 `--players`。 |
| `@avalon/test-support` | `test` | 运行生成游戏、transcript、回放和属性测试。 |
| `@avalon/test-support` | `typecheck` | 对回放和测试支持代码做类型检查。 |
| `@avalon/server` | `dev` | 直接启动服务端；存在 `.env.local` 时会自动加载。 |
| `@avalon/server` | `test` | 运行不依赖 PostgreSQL 的大厅、Socket.IO 回放、配置、生命周期及服务端单元/集成测试。 |
| `@avalon/server` | `test:postgres` | 强制使用 PostgreSQL，运行存储和重启重连测试。 |
| `@avalon/server` | `test:postgres:restart-probe` | CI 内部探针，在 PostgreSQL 服务重启前后分别使用 `prepare` 和 `verify` 模式。 |
| `@avalon/server` | `typecheck` | 对服务端代码做类型检查，不生成文件。 |
| `@avalon/web` | `dev` | 在 `0.0.0.0` 上启动 Vite，供局域网开发使用。 |
| `@avalon/web` | `test` | 运行 Web 组件和浏览器状态单元测试。 |
| `@avalon/web` | `build` | 做类型检查并生成 Vite 生产构建。 |
| `@avalon/web` | `lint` | 对 Web 代码运行 Oxlint。 |
| `@avalon/web` | `preview` | 在本地提供已生成的 Web 构建。 |
| `@avalon/e2e` | `test:e2e` | 使用默认 smoke 配置运行 Playwright。 |
| `@avalon/e2e` | `test:e2e:matrix` | 启用矩阵模式并运行所有已配置的完整局浏览器用例。 |
| `@avalon/e2e` | `typecheck` | 对 Playwright spec 和浏览器回放支持代码做类型检查。 |

示例：

```bash
pnpm --filter @avalon/game test
pnpm --filter @avalon/server typecheck
pnpm --filter @avalon/web build
pnpm --filter @avalon/test-support replay --seed example-seed --players 7
```

## 测试与回放

常规本地验证命令：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

首次在本地运行 Playwright 前安装 Chromium：

```bash
pnpm --filter @avalon/e2e exec playwright install chromium
```

每个包含随机行为的游戏流程测试都有明确 seed。复用失败 seed 即可重现同一组生成决策：

```bash
pnpm test:replay --seed nightly-2026-08-22-7p --players 7
E2E_MASTER_SEED=nightly-2026-08-22-7p E2E_PLAYER_COUNT=7 pnpm test:e2e:matrix
```

GitHub Actions 会在 pull request 和推送到 `main` 时运行质量检查、单元与 Socket.IO 回放测试、PostgreSQL 重启/重连测试和浏览器 smoke 流程。夜间 workflow 完全运行在 GitHub 托管 runner 上，执行更深的属性测试以及 5–10 人确定性浏览器分片。回放参数、CI job 名称和失败 artifact 说明见[自动化游戏流程测试](docs/testing/automated-game-flow.md)。

自动化不能代替真实设备的局域网验收。物理设备、网络中断、多房间和部署环境重启测试请使用[局域网多人验收指南](docs/testing/lan-multiplayer-acceptance.md)。

## 设计参考

- [已确认的游戏设计](docs/superpowers/specs/2026-08-14-avalon-boardgame-design.md)
- [项目状态与后续步骤](docs/PROJECT_STATUS.md)
- [领域术语表](CONTEXT.md)
- [规则摘要](docs/rules/rulebook-summary.md)
- [角色可见性规则](docs/rules/role-visibility.md)
- [架构决策记录](docs/adr/)
