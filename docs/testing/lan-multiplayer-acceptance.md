# Avalon 真实环境人工验收

本文档只保留自动化无法等价模拟的部署环境检查。前后端数据流程、5–10 人游戏规则、秘密信息边界、刷新恢复、四种胜负结局、并发抢座、双房间隔离，以及桌面/窄屏视口布局由 [自动化游戏流程测试](automated-game-flow.md) 覆盖。

只有实际执行并记录证据后，才能把以下真实环境项目标记为通过。

## 1. 测试前准备

1. 按 [`infra/postgres/README.md`](../../infra/postgres/README.md) 启动实际使用的 PostgreSQL，并确认健康。
2. 在 Git 忽略的 `apps/server/.env.local` 中设置真实 `DATABASE_URL`。
3. 设置包含真实 Web 来源的 `AVALON_ORIGINS`：

   ```env
   AVALON_ORIGINS=http://localhost:5183,http://<运行 Web 的主机 IP>:5183
   ```

4. 在两个由测试者保持打开的终端中运行：

   ```bash
   pnpm dev:server
   pnpm dev
   ```

5. 本机访问 `http://localhost:5183/`，其他设备访问 `http://<主机 IP>:5183/`。

不要把数据库密码或开发管理 Token 写入本文档、截图、聊天或浏览器持久化存储。

### 升级与回滚检查

- Legacy room without role configuration opens with base roles.
- Legacy waiting room with occupied seat 0 assigns that occupant as owner on first lobby mutation.
- Legacy waiting room with empty seat 0 is ownerless and rejects joining.
- After an owner moves away from seat 0, rolling back to a seat-0-authority server is unsafe; disable affected waiting rooms or redeploy the compatible version before accepting lobby mutations.
- Verify five real browsers can create, auto-join, change seats, refresh, start, and complete recognition without role leakage.

升级后应先验证旧房间兼容性，再接受新的等待房间操作。回滚前必须检查是否存在房间拥有者已经离开 0 号座位的等待房间；不满足兼容条件时不得让旧服务继续接收入座、换座、开局或解散请求。

## 2. H1：真实 Node 服务重启

1. 使用至少 5 个独立浏览器 Profile/设备开始一局，在未结算阶段记录房间 ID、座位、角色、队长、任务序号和历史。
2. 在服务端终端按 `Ctrl-C` 停止 `pnpm dev:server`；保持 Web 和 PostgreSQL 运行。
3. 确认客户端显示连接中断或重连状态。
4. 重新运行 `pnpm dev:server`，等待自动恢复；必要时点击“重连”。
5. 使用原 Profile/设备完成一次选队、投票和任务结算。

通过条件：所有客户端使用原凭据返回原座位；房间 ID、角色、进度和历史不变；未完成阶段可继续，且没有重复提交或结算。

## 3. H2：真实 PostgreSQL 服务重启

1. 在未结算阶段记录房间 ID、座位、角色、队长、任务序号、历史和个人已提交状态。
2. 停止 `pnpm dev:server`，避免数据库重启期间产生新写入。
3. 使用部署环境的安全方式重启 PostgreSQL。仓库 Compose 部署可执行：

   ```bash
   docker compose restart postgres
   docker compose ps
   ```

4. 等待数据库健康后重新运行 `pnpm dev:server`。
5. 使用原 Profile/设备恢复房间，并完成一次选队、投票和任务结算。

通过条件：数据库重启没有删除 volume；原凭据、房间、角色、进度、历史和个人秘密提交状态保持一致；恢复后可以继续游戏。严禁为本测试执行 `docker compose down -v`。

GitHub Actions 会重启临时 PostgreSQL service container 并验证原凭据重连，但它不能替代目标部署环境的真实数据库、volume 和运维路径。

## 4. H3：真实 LAN 设备链路

至少使用手机、平板或另一台电脑中的两台设备，通过主机 LAN IP 加入同一房间；其余玩家可以使用彼此隔离的本机浏览器 Profile。

完成以下最小链路：

1. 创建 5 人房间，确认创建者立即入座并显示为房间拥有者；其余真实浏览器不选择座位，直接加入并由服务端自动分配最低空座位。
2. 在普通 `http://<主机 LAN IP>` 地址下让房间拥有者换到空座位，确认没有出现“不安全换座”错误，拥有者标记和开局权限跟随玩家；再从同一设备的两个同源标签页尝试同时换座，确认只产生一次请求且两个标签页最终绑定同一座位。刷新后仍应回到新座位，并让新玩家占用腾出的 0 号座位。
3. 坐满后确认房间列表显示“已满”，开始游戏并完成包含帕西维尔辨认的一次完整身份辨认、选队、全员投票和任务结算；任何客户端都不能看到未授权角色或秘密选择。
4. 让至少一台真实设备断开再恢复网络，然后重连并继续操作。
5. 检查服务端与设备浏览器日志。

通过条件：真实设备可创建/加入、收发 Socket.IO 状态、完成动作并重连；没有 CORS、来源、局域网路由或浏览器兼容错误。

## 5. 记录模板

```text
测试编号：H1 / H2 / H3
日期与环境：
房间 ID：
设备 / 浏览器 Profile / 座位：
重启或断网前状态：
执行动作：
恢复后状态：
实际结果：
Console / Server 错误：
证据路径：
```

三项分别记录，不要用其中一项推断另一项已经通过。完成后更新 `docs/PROJECT_STATUS.md` 的真实环境验收状态。
