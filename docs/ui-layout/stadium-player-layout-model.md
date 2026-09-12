# 跑道玩家圆形布局模型

## 1. 状态与范围

本文定义独立、DOM-free 的纵向跑道玩家布局数学模型。它解决“固定头像尺寸时，如何在圆形或最短纵向跑道中心线上放置 5–10 个圆形玩家边界，并可选避让一个同心圆形桌心保护区”。

当前 `solveStadiumPlayerLayout`、`/stadium-layout-lab.html` 和业务入口 `solveRoundTableStageLayout` 都使用本模型。业务适配层负责头像自动降档、桌面与桌心面板几何，并固定传入 68px 桌心保护半径。

数学模型不负责 Avalon 顶栏、底栏、桌面、桌心面板、姓名、皇冠、角色标记或其他业务内容。姓名等内容可以超出玩家边界圆，其与桌心或其他业务元素的关系留给后续业务适配层处理。

## 2. 公共输入

入口为：

```ts
solveStadiumPlayerLayout({
  maxStageWidth,
  maxStageHeight,
  playerCount,
  avatarSize,
  minimumGap,
  centerProtectionRadius,
})
```

| 字段 | 含义 |
| --- | --- |
| `maxStageWidth` | 舞台硬最大宽度，CSS 逻辑像素，范围 `(0, 4096]` |
| `maxStageHeight` | 舞台硬最大高度，CSS 逻辑像素，范围 `(0, 800]` |
| `playerCount` | 玩家数量，整数 5–10 |
| `avatarSize` | 圆形头像直径，有限正数 |
| `minimumGap` | 任意两个玩家边界圆之间的最小边界距离，有限且大于等于 0 |
| `centerProtectionRadius` | 可选桌心保护圆半径，默认 0；0 表示完全关闭保护，正值必须有限 |

头像尺寸是确定输入，求解器不包含最大头像、递减步长或自动降档逻辑。

## 3. 玩家边界与硬约束

设头像直径为 `A`。玩家边界圆与头像同心：

```text
playerBoundaryRadius = A
playerBoundaryDiameter = 2 × A
```

因此数学模型中的玩家碰撞边界圆直径是头像直径的两倍。对于任意两名玩家：

```text
centerDistance >= 2 × playerBoundaryRadius + minimumGap

circleBoundaryGap = max(
  centerDistance - first.radius - second.radius,
  0
)
```

约束检查全部玩家对，不只检查视觉顺序相邻玩家；边界相切合法。

当 `centerProtectionRadius > 0` 时，保护圆、跑道和舞台使用同一中心，并对每名玩家施加：

```text
distance(roundTableCenter, playerCenter)
  >= centerProtectionRadius + playerBoundaryRadius
```

当保护半径为 0 时，不执行该约束；0 不是半径为零的障碍物。

## 4. 跑道几何

模型只生成圆形或纵向跑道，不根据舞台方向旋转。舞台方向由宽高直接推导；中心线使用短边扣除玩家圆直径后的最大公开宽度，因此宽舞台会在中央复用同一竖向算法：

```text
stadiumCenterlineWidth =
  min(maxStageWidth, maxStageHeight)
  - 2 × playerBoundaryRadius

stadiumCenterlineRadius = stadiumCenterlineWidth / 2
```

纵向跑道由上下两个半圆和左右两条等长竖直线组成：

```text
stadiumCenterlineHeight =
  stadiumCenterlineWidth + stadiumStraightLength

occupiedHeight =
  2 × playerBoundaryRadius + stadiumCenterlineHeight
```

直线段上限为：

```text
maximumStadiumStraightLength =
  maxStageHeight
  - 2 × playerBoundaryRadius
  - stadiumCenterlineWidth
```

全部玩家圆心必须位于中心线上。完整中心线与玩家边界圆包络在舞台内水平、垂直居中。

## 5. 座位顺序与对称

跑道路径从六点钟方向开始，按视觉顺时针方向递增；`relativeSeatIndex = 0` 固定在六点钟。

- 偶数人数另有一名玩家固定在十二点钟。
- 奇数人数不设置十二点钟锚点。
- 其余玩家沿左半跑道严格单调前进，再关于舞台竖直中轴镜像。
- 左右镜像玩家具有相同 Y 坐标，且 X 坐标之和等于两倍中轴 X。

左半跑道长度为：

```text
leftHalfPathLength =
  π × stadiumCenterlineRadius
  + stadiumStraightLength
```

## 6. 公开网格与固定跑道放置

玩家边界半径和非零保护半径都向上包络到 0.01px；中心线尺寸、圆心和其他公开几何量化到 0.01px。圆弧公开候选由 X 网格与 Y 网格两个方向分别投影、合并并去重；只有距理论中心线不超过 0.001px 的点才能进入候选集。直道候选直接落在公开网格上。

给定 `stadiumStraightLength` 和统一的相邻 `targetGap` 后，求解器在有限候选集上从六点钟向十二点钟选择左侧玩家。每个候选在入选前检查：

1. 舞台包含；
2. 桌心保护；
3. 与自身镜像的距离；
4. 与所有已选玩家及其镜像的最小距离；
5. 与前一个玩家的 `targetGap`；
6. 最后一名左侧玩家与顶部锚点或自身镜像的闭环 `targetGap`。

候选按路径顺序处理；同一目标 gap 下选择第一个满足全部约束的公开候选。这个选择保留最多的剩余上半路径，并为相同输入提供稳定的字典序裁决。算法不使用随机数、粗路径采样、操作次数上限或墙钟预算来提前返回 `no-fitting-layout`。

## 7. 圆形优先与最短跑道

求解顺序为：

1. 全部玩家对满足 `minimumGap`；
2. 优先使用 `stadiumStraightLength = 0` 的最大宽度圆形；
3. 圆形不可行时，最小化纵向 `stadiumStraightLength`；
4. 在最短中心线上最小化相邻 gap 的最大超出量；
5. 再最小化相邻 gap 的总超出量；
6. 最后以公开候选路径位置的字典序提供确定性平局裁决。

相邻 gap 超出量为 `adjacentBoundaryGap - minimumGap`。固定中心线先提高统一 `targetGap` 以分摊闭环剩余空间，再从公开候选结果按“最大超出量、总超出量、路径位置”评分。外层先测试圆形，再在 0.01px 直线段网格上查找第一个可行跑道。可行性随纵向直线段增加而不减，因此可以二分定位第一个可行 tick；最终仍以公开候选重新求解和复验。最长跑道也不可行时返回 `no-fitting-layout`。

模型不会为了得到布局而自动缩小头像。自然容量由圆形几何决定，不硬编码 9 人或其他人数阈值。

## 8. 最终复验

成功结果返回前，统一从公开圆形结果重新计算并验证：

- `occupiedBounds` 和全部玩家边界圆位于舞台内；
- 全部玩家对的圆边界 gap 不小于 `minimumGap`；
- 非零保护圆与全部玩家边界圆不相交；
- 全部圆心位于圆形或跑道中心线上；
- 六点钟锚点、偶数十二点钟锚点、视觉顺序和竖轴对称成立；
- `adjacentBoundaryGaps` 来自最终公开圆，而不是内部连续点。
- `maximumCenterProtectionRadius` 不大于任一玩家圆到共同中心的真实净空。

验证容差为 0.001px。公开量化后的候选若违反任一约束，就不能返回。

## 9. 输出与错误

成功结果不再暴露矩形或重复圆心数组：

```ts
type Circle = Readonly<{
  center: Point
  radius: number
}>

{
  status: 'ready',
  shape: 'circle' | 'stadium',
  centerlineBounds,
  stadiumStraightLength,
  targetGap,
  maximumCenterProtectionRadius,
  playerCircles: readonly Circle[],
  adjacentBoundaryGaps,
  occupiedBounds,
}
```

不可用结果为：

```ts
{
  status: 'unavailable',
  reason: 'invalid-input' | 'no-fitting-layout',
}
```

输入不是要求的有限数、人数不在 5–10、舞台尺寸超出支持范围、`minimumGap < 0`，或保护半径为负数/非有限值时返回 `invalid-input`。合法但空间不足或有限保护圆过大时返回 `no-fitting-layout`。

## 10. 独立实验页面

独立入口为：

```text
/stadium-layout-lab.html
```

默认参数为：

```text
maxStageWidth = 386
maxStageHeight = 482
playerCount = 5
avatarSize = 56
minimumGap = 4
centerProtectionRadius = 0
```

`maximumCenterProtectionRadius` 是当前最终布局允许的最大同心保护圆半径：取全部玩家圆到共同中心净空的最小值，再向下量化到 0.01px，保证公开值不夸大真实空间。

画布显示舞台硬边界、跑道中心线、玩家边界圆、同心头像圆和座位序号。保护半径大于 0 时显示配置的桌心保护圆；诊断层另外用浅色虚线圆显示 `maximumCenterProtectionRadius`，并显示相邻玩家圆的真实边界 gap、每名玩家圆到配置保护圆的真实 clearance，以及 `occupiedBounds`。

设置面板为非模态浮层，包含舞台宽高、5–10 人快捷按钮、头像大小、最小 gap、桌心保护半径、诊断开关和恢复默认值。有效输入实时求解并写入 URL；暂时无效输入保留上一帧和上一组合法 URL。

## 11. 文件边界与迁移状态

```text
apps/ui-layout-lab/src/stadium-model/
  geometry.ts
  solve-stadium-circle-layout.ts
  solve-stadium-player-layout.ts
  types.ts
```

- `solve-stadium-circle-layout.ts`：独立数学模型的新圆形核心。
- `solve-stadium-player-layout.ts`：独立模型公开入口，只调用圆形核心。

迁移期的旧矩形求解器及其专用测试、类型和几何函数已经删除，避免两套边界模型继续并存。

## 12. 永久回归

永久测试覆盖：

1. 圆心距离、圆边界 gap、最近边界线段和舞台包含。
2. 保护半径省略与显式 0 等价；非法半径与巨大有限半径语义不同。
3. 5–10 人的顺序、锚点、对称和全部两两圆形间距。
4. 386×482 下 5–8 人使用 56px、9–10 人使用 48px 时均有可行布局。
5. 386×482、56px、保护半径 88 下 5 人和 6 人有可行布局。
6. 圆形可行时立即返回圆形；代表性最短跑道缩短 0.01px 后不可行。
7. 公开结果量化、完整复验和相同输入的确定性。
8. Lab 的 URL 恢复、圆形绘制、保护区诊断、无效草稿保帧和无可行布局恢复。

测试不写机器墙钟硬阈值；代表性耗时只作信息记录，不改变正确性。
