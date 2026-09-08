# Avalon UI Layout Lab

这个包是房间响应式布局的独立实验室。它使用 Vite、Tailwind CSS 和原生 TypeScript/DOM，不依赖 React，也不连接 Avalon 游戏服务。

## 使用

从仓库根目录启动：

```bash
pnpm dev:ui-layout
```

本机访问 `http://localhost:4175/`；移动设备可访问终端显示的 `http://<LAN-IP>:4175/`。右下角设置按钮可切换模拟尺寸和设备尺寸。设备模式的画布是 `100svw × 100svh`，并隐藏预设、宽度、高度和旋转字段。

页面状态保存在 URL 查询参数中：

```text
?viewport=device&width=390&height=844&players=10&geometry=1
```

设备模式仍保留 `width` 和 `height`，以便切回模拟模式时恢复之前的尺寸。

## 布局接口

`src/layout/` 是 DOM-free 的纯 TypeScript 边界。调用方只需要：

```ts
solveRoomLayout({ width, height, playerCount })
```

函数根据宽高选择方向，调用方不传 `horizontal` 或 `vertical`。当前迁移切片完成竖向布局；横向输入返回 `horizontal-strategy-pending`，并继续由旧静态原型作为对齐参考。

成功结果包含顶栏、舞台、阶段面板及其三个固定高度子矩形、桌面、玩家轨道和每个座位的 `playerSeatBounds`、`avatarRect`、`nameRect`、`avatarTopClearance`。皇冠尺寸和状态标记不是求解器输入或输出；渲染器可在顶部预留空间内放置皇冠，并由头像圆心和半径派生状态标记。

## 验证

```bash
pnpm --filter @avalon/ui-layout-lab test
pnpm --filter @avalon/ui-layout-lab typecheck
pnpm --filter @avalon/ui-layout-lab lint
pnpm --filter @avalon/ui-layout-lab build
pnpm --filter @avalon/ui-layout-lab test:e2e
```

Playwright 使用隔离端口 14175。旧的 `docs/ui-layout/prototypes/avalon-landscape-responsive-lab.html` 会保留到横向算法迁移并完成等价验证后再删除。
