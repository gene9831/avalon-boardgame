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

设备模式仍保留 `width` 和 `height`，以便切回模拟模式时恢复之前的尺寸。模拟视口宽度上限为 4096、高度上限为 1024；它们是业务外壳尺寸，外壳扣除顶栏、底栏和边距后传给舞台求解器。

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

函数根据舞台宽高选择几何策略，调用方不传 `horizontal` 或 `vertical`。舞台尺寸使用 CSS 逻辑像素，宽度范围为 `(0, 4096]`、高度范围为 `(0, 800]`；超出范围返回 `invalid-input`。高度上限覆盖当前最大的 744×776 舞台基线，并限制同步高舞台搜索的工作量。`gap` 对所有头像档位生效；省略时为 8，必须是大于等于 0 的有限数。头像从 `maxAvatarSize` 开始按 `avatarSizeStep` 递减，并始终把 36 作为最后候选；中间尺寸按现有四个档位插值得到其他座位参数。当前迁移切片完成高舞台策略；宽大于等于高的舞台返回 `wide-stage-strategy-pending`。

成功结果只包含舞台内部的形态、桌面、桌心，以及每个座位的 `playerSeatBounds`、`avatarRect`、`nameRect`、`avatarTopClearance`。返回坐标以舞台左上角为原点；完整可见包络在传入硬边界内居中。共享严格矩形核心接收业务碰撞尺寸 `max(seatWidth, avatarTopClearance + avatarDiameter + 4 + nameHeight)`，返回正方形座位包络；业务层在其中映射头像包装层、姓名和皇冠顶部预留。皇冠尺寸和动态状态标记不是求解器输入或输出；渲染器由头像圆心和半径派生状态标记。

高舞台复用严格矩形核心：先尝试圆形，圆形可行立即返回；否则选择满足全部两两欧氏边界 gap 的最短纵向跑道。偶数人数固定上下中轴座位，奇数人数固定底部中轴座位，其余座位按顺时针顺序并关于竖直中轴镜像。桌心与座位边界保留 12px；几何模式将它显示为圆形 `.center-panel-protection`。内部诊断包含 640px 上限的圆桌基准框、完整包络、`placementGuide`、跑道直线段、请求 gap、相邻座位的欧氏 gap 和桌面中心补偿；gap 线连接真实最近边界点。

实验室页面本身是 API 的业务调用示例：设置面板可以修改玩家座位边界的最小间距、最大头像尺寸和头像递减步长，并把它们保存在 URL 中；面板打开时不增加背景蒙层或模糊。底部内容固定为 `48 + 56 + 56 = 160`，另加 `max(8px, env(safe-area-inset-bottom))` 的底部留白。业务舞台区域大于当前高舞台策略的工作盒时，页面在其中居中放置最大 `744×800` 的求解盒；`ResizeObserver` 测量该盒的实际尺寸后重新求解，因此 1024×1366 等高设备视口不会把超限高度直接传给纯函数。

完整算法与职责边界见[圆桌舞台布局规范](../../docs/ui-layout/round-table-stage-layout.md)和[竖向房间业务外壳规范](../../docs/ui-layout/vertical-layout.md)。

独立的严格跑道中心线数学模型见[跑道玩家矩形布局模型](../../docs/ui-layout/stadium-player-layout-model.md)。业务求解器与该数学工作台共用严格矩形核心；`/stadium-layout-lab.html` 保留为固定头像尺寸、最短跑道和矩形欧氏边界距离的工作台。

## 跑道玩家矩形模型

本机访问 `http://localhost:4175/stadium-layout-lab.html`；移动设备使用同一路径访问终端显示的 LAN 地址。这个页面只显示数学舞台，不包含 Avalon 顶栏、桌面、桌心或底部操作栏。

纯函数 `solveStadiumPlayerLayout` 接收 `maxStageWidth`、`maxStageHeight`、`playerCount`、`avatarSize` 和 `minimumGap`。舞台使用 CSS 逻辑像素，宽度范围为 `(0, 4096]`、高度范围为 `(0, 800]`。默认值依次为 386、482、5、56 和 4；头像尺寸固定，不会自动降档。页面的完整默认 URL 为：

```text
/stadium-layout-lab.html?maxStageWidth=386&maxStageHeight=482&players=5&avatarSize=56&minimumGap=4&diagnostics=1
```

设置面板为非模态浮层，不使用背景蒙层。有效参数会实时求解并规范化到 URL；输入暂时无效时保留上一帧和上一组有效 URL。诊断开关控制完整占用边界，以及相邻玩家矩形最近边界点之间的 gap 线和数值。

该模型的求解层位于 `src/stadium-model/`，不依赖 DOM。它是独立验证入口，同时是业务高舞台适配层所复用的严格矩形核心。

## 验证

```bash
pnpm --filter @avalon/ui-layout-lab test
pnpm --filter @avalon/ui-layout-lab typecheck
pnpm --filter @avalon/ui-layout-lab lint
pnpm --filter @avalon/ui-layout-lab build
pnpm --filter @avalon/ui-layout-lab test:e2e
```

Playwright 使用隔离端口 14175。代表性 10 人业务结果为 `359×435 → 36px 跑道`、`366×596 → 36px 跑道`、`406×684 → 40px 跑道`、`744×776 → 56px 圆形`；在 `386×482`、`gap=4`、`maxAvatarSize=56`、`avatarSizeStep=4` 下，5–10 人是 `[44, 40, 40, 40, 40, 40]`。这些结果以全部两两欧氏 gap、12px 桌心保护、包含、严格圆形优先/最短跑道和单调档位可行性为准。
