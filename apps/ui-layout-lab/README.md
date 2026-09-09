# Avalon UI Layout Lab

这个包是房间响应式布局的独立实验室。它使用 Vite、Tailwind CSS 和原生 TypeScript/DOM，不依赖 React，也不连接 Avalon 游戏服务。

## 使用

从仓库根目录启动：

```bash
pnpm dev:ui-layout
```

本机访问 `http://localhost:4175/`；移动设备可访问终端显示的 `http://<LAN-IP>:4175/`。右下角设置按钮可切换模拟尺寸和设备尺寸。设备模式的画布是 `100dvw × 100dvh`，并隐藏预设、宽度、高度和旋转字段；Safari 工具栏收放改变动态视口时，画布会随之调整并触发重新求解。旧浏览器不支持动态视口单位时回退到 `100vw × 100vh`。

页面状态保存在 URL 查询参数中：

```text
?viewport=device&width=390&height=844&players=10&gap=8&maxAvatarSize=56&avatarSizeStep=8&geometry=1
```

设备模式仍保留 `width` 和 `height`，以便切回模拟模式时恢复之前的尺寸。

## 布局接口

`src/layout/` 是 DOM-free 的纯 TypeScript 边界。业务侧先完成顶栏、底栏、安全区和舞台外边距布局，再把最终舞台内容盒交给唯一公共入口：

```ts
solveRoundTableStageLayout({
  maxStageWidth,
  maxStageHeight,
  playerCount,
  gap, // 可选；玩家座位边界的最小间距，默认 8
  maxAvatarSize, // 可选；头像尺寸上限，默认且最大为 56，最小为 36
  avatarSizeStep, // 可选；候选头像尺寸的递减步长，默认 8
})
```

函数根据舞台宽高选择几何策略，调用方不传 `horizontal` 或 `vertical`。`gap` 对所有头像档位生效；省略时为 8，必须是大于等于 0 的有限数。头像从 `maxAvatarSize` 开始按 `avatarSizeStep` 递减，并始终把 36 作为最后候选；中间尺寸按现有四个档位插值得到其他座位参数。当前迁移切片完成高舞台策略；宽大于等于高的舞台返回 `wide-stage-strategy-pending`，并继续由旧静态原型作为对齐参考。

成功结果只包含舞台内部的形态、桌面、桌心，以及每个座位的 `playerSeatBounds`、`avatarRect`、`nameRect`、`avatarTopClearance`。返回坐标以舞台左上角为原点；完整可见包络在传入硬边界内居中。皇冠尺寸和状态标记不是求解器输入或输出；渲染器可在头像顶部预留空间内放置皇冠，并由头像圆心和半径派生状态标记。

实验室页面本身是 API 的业务调用示例：设置面板可以修改玩家座位边界的最小间距、最大头像尺寸和头像递减步长，并把它们保存在 URL 中；面板打开时不增加背景蒙层或模糊。底部内容固定为 `48 + 56 + 56 = 160`，另加 `max(8px, env(safe-area-inset-bottom))` 的底部留白；页面通过 `ResizeObserver` 测量实际舞台内容盒后重新求解。

完整算法与职责边界见[圆桌舞台布局规范](../../docs/ui-layout/round-table-stage-layout.md)和[竖向房间业务外壳规范](../../docs/ui-layout/vertical-layout.md)。

## 验证

```bash
pnpm --filter @avalon/ui-layout-lab test
pnpm --filter @avalon/ui-layout-lab typecheck
pnpm --filter @avalon/ui-layout-lab lint
pnpm --filter @avalon/ui-layout-lab build
pnpm --filter @avalon/ui-layout-lab test:e2e
```

Playwright 使用隔离端口 14175。旧的 `docs/ui-layout/prototypes/avalon-landscape-responsive-lab.html` 会保留到横向算法迁移并完成等价验证后再删除。
