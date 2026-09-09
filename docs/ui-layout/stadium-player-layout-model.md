# 跑道玩家矩形布局模型

## 1. 状态与范围

本文定义一个独立、DOM-free 的纵向跑道玩家布局数学模型。它用于验证“固定头像尺寸时，如何在最短的圆形或纵向跑道中心线上均匀放置 5–10 个玩家矩形”。

第一阶段只实现纯函数和独立实验页面，不替换现有 `solveRoundTableStageLayout`，也不改变房间原型。现有业务布局继续负责桌面、桌心、姓名、皇冠、状态标记、顶栏和底栏；待本模型在实验页面通过人工验收后，再单独设计接入方式。

本文中的玩家矩形是基础数学包络，不等同于 `CONTEXT.md` 中包含头像、姓名和装饰预留的 **Player seat bounds**。因此本实验不新增领域术语或 ADR。

## 2. 公共输入

唯一求解入口为：

```ts
solveStadiumPlayerLayout({
  maxStageWidth,
  maxStageHeight,
  playerCount,
  avatarSize,
  minimumGap,
})
```

| 字段 | 含义 |
| --- | --- |
| `maxStageWidth` | 舞台硬最大宽度，CSS 逻辑像素，范围 `(0, 4096]` |
| `maxStageHeight` | 舞台硬最大高度，CSS 逻辑像素，范围 `(0, 800]` |
| `playerCount` | 玩家数量，整数 5–10 |
| `avatarSize` | 圆形头像直径，有限正数 |
| `minimumGap` | 任意两个玩家矩形之间允许的最小边界距离，有限且大于等于 0 |

头像尺寸是确定输入。求解器不包含最大头像、头像递减步长或自动降档逻辑。

玩家矩形是始终与舞台坐标轴平行的正方形：

```text
playerRectSize = 2 × avatarSize
```

实验页面可在玩家矩形中心绘制直径为 `avatarSize` 的圆形头像。数学模型中头像圆与玩家矩形同心且不参与碰撞；业务侧以后可以自行增加头像纵向偏移。

## 3. 跑道几何

模型只生成圆形或纵向跑道，不根据舞台方向自动旋转。

跑道中心线使用舞台允许的最大宽度：

```text
stadiumCenterlineWidth = maxStageWidth - playerRectSize
stadiumCenterlineRadius = stadiumCenterlineWidth / 2
```

纵向跑道由上下两个半圆弧与左右两条等长竖直线段组成：

```text
stadiumCenterlineHeight =
    stadiumCenterlineWidth + stadiumStraightLength

occupiedHeight =
    playerRectSize + stadiumCenterlineHeight
```

可用直线段上限为：

```text
maximumStadiumStraightLength =
    maxStageHeight
    - playerRectSize
    - stadiumCenterlineWidth
```

当 `stadiumCenterlineWidth = 0` 时，跑道退化为一条竖直线，仍属于合法输入。`maxStageWidth < playerRectSize`，或 `maximumStadiumStraightLength < 0` 时没有可行布局。

全部玩家矩形中心必须严格位于跑道中心线上。求解先使用以原点为中心的内部坐标，完成后整体平移，使 `occupiedBounds` 在舞台内水平、垂直居中。

## 4. 矩形边界距离

对于两个边长相同且轴对齐的玩家矩形，使用真实的欧氏最短边界距离。给定两个矩形中心：

```text
horizontalClearance = max(
    abs(firstCenterX - secondCenterX) - playerRectSize,
    0
)

verticalClearance = max(
    abs(firstCenterY - secondCenterY) - playerRectSize,
    0
)

rectangleBoundaryGap = hypot(
    horizontalClearance,
    verticalClearance
)
```

该定义自动覆盖水平边缘、垂直边缘和对角顶点之间的最近距离。中心距离不能替代它：同一中心距离在水平、垂直和斜向可能分别表示分离或重叠。

所有玩家矩形两两满足硬约束：

```text
rectangleBoundaryGap >= minimumGap
```

均匀度评分只使用视觉顺序中相邻的玩家矩形，包括最后一个与当前玩家之间的闭环间距。

## 5. 座位顺序与对称

跑道路径从六点钟方向开始，按视觉顺时针方向递增。`relativeSeatIndex = 0` 是当前玩家。

- 偶数人数：当前玩家固定在六点钟，另一名玩家固定在十二点钟。
- 奇数人数：当前玩家固定在六点钟，不设置十二点钟玩家。
- 其余玩家按座位顺序沿跑道单调前进，不得交换或跨越。
- 求解器只计算左半跑道，其余玩家关于舞台竖直中轴镜像。

设左半跑道从六点钟到十二点钟的路径长度为：

```text
leftHalfPathLength =
    π × stadiumCenterlineRadius
    + stadiumStraightLength
```

## 6. 固定跑道的玩家放置

固定 `stadiumStraightLength` 和目标边界距离 `targetGap` 后，从底部锚点开始递推左侧玩家。

对每一个后续玩家：

1. 沿跑道中心线向前扫描。
2. 找到与前一个玩家矩形的边界距离第一次从小于 `targetGap` 变为大于等于 `targetGap` 的路径区间。
3. 在该区间内进行一维二分求根。
4. 选择第一次达到 `targetGap` 的位置，避免跳过更紧凑的合法解。

距离函数不被假设为跨越整条跑道全局单调；二分只用于已经括出的首次交点区间。

### 6.1 偶数闭合

偶数人数递推生成左侧非锚点玩家，最后由十二点钟锚点闭合。调整 `targetGap`，使：

```text
topAnchorBoundaryGap = targetGap
```

### 6.2 奇数闭合

奇数人数递推生成全部左侧玩家，最上方玩家与其右侧镜像闭合。调整 `targetGap`，使：

```text
topMirrorBoundaryGap = targetGap
```

闭合后必须验证全部玩家矩形，而不只验证相邻矩形。

## 7. 最短跑道求解

求解顺序是：

1. 所有玩家矩形满足 `minimumGap`。
2. 最小化 `stadiumStraightLength`。
3. 在最短直线段下，最小化相邻 gap 的最大超出量。
4. 再最小化相邻 gap 的总超出量。
5. 最后使用路径位置的字典序进行确定性平局裁决。

相邻 gap 超出量为：

```text
adjacentGapExcess = adjacentBoundaryGap - minimumGap

maximumAdjacentGapExcess = max(adjacentGapExcess)

totalAdjacentGapExcess = sum(adjacentGapExcess)
```

给定跑道宽度后，增加直线段只会增加可用空间，因此外层使用二分寻找最小可行 `stadiumStraightLength`。每个高度先使用 `minimumGap` 贪心递推判断是否容纳指定人数；确认可行后，再求解统一 `targetGap` 以分摊剩余空间。

首先测试 `stadiumStraightLength = 0`。如果圆形已经满足全部硬约束，则立即返回圆形，不继续缩小 `stadiumCenterlineWidth`。圆形仍使用相同的矩形边界距离、递推和闭合方程，不切换到等圆心角算法。

如果最长可用跑道仍不可行，则返回 `no-fitting-layout`。本模型不自动减小头像。

## 8. 数值精度

内部计算使用高于公开结果的精度。所有公开坐标、尺寸和 gap 最终量化到 0.01 逻辑像素。

量化后重新验证：

- 全部玩家矩形位于舞台内。
- 全部矩形两两边界距离不小于 `minimumGap`。
- 座位顺序和奇偶锚点正确。
- 左右镜像成立。

验证容差为 0.001px。若量化使合法 gap 减少超过该容差，则将 `targetGap` 或 `stadiumStraightLength` 向上补偿一个 0.01px 单位并重新生成，不降低 `minimumGap`。

## 9. 输出与错误

成功结果为：

```ts
{
  status: 'ready',
  shape: 'circle' | 'stadium',
  centerlineBounds,
  stadiumStraightLength,
  targetGap,
  playerRects,
  playerCenters,
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

输入不是要求的有限数、玩家人数不在 5–10、舞台宽度不在 `(0, 4096]`、舞台高度不在 `(0, 800]`，或 `minimumGap < 0` 时返回 `invalid-input`。上限针对浏览器 CSS 逻辑像素舞台；800px 高度覆盖当前 744×776 的最大舞台基线，并避免超出同步求解预算的尺寸进入搜索。合法输入无法在硬舞台内完成布局时返回 `no-fitting-layout`。

## 10. 独立实验页面

在 `apps/ui-layout-lab` 增加 Vite 多页面入口：

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
```

画布始终显示舞台硬边界、跑道中心线、玩家矩形、矩形中心的同心头像圆和座位序号。诊断层显示相邻矩形最近边界点之间的 gap 线与数值，以及 `occupiedBounds`；可由设置面板开关隐藏。

页面右下角使用非模态悬浮设置按钮。设置面板打开后不显示蒙层、不阻止画布交互，并支持 Escape、关闭按钮和再次点击悬浮按钮收起。面板包含：

- 舞台宽度
- 舞台高度
- 5–10 人快捷按钮
- 头像大小
- 最小 gap
- 显示诊断
- 恢复默认值

有效输入实时求解并同步到 URL。输入处于暂时无效状态时保留上一帧画布并显示输入错误；刷新或复制 URL 可恢复同一组有效参数。

页面不显示 Avalon 房间顶栏、桌心、桌面、底部操作栏或角色视觉。

## 11. 文件边界

第一阶段计划新增：

```text
apps/ui-layout-lab/
  stadium-layout-lab.html
  src/
    stadium-model/
      geometry.ts
      solve-stadium-player-layout.ts
      solve-stadium-player-layout.test.ts
      types.ts
    stadium-model-main.ts
    stadium-model.css
```

Vite 配置显式包含 `index.html` 和 `stadium-layout-lab.html` 两个生产构建入口。新模型不导入 DOM、房间外壳或现有 `tall-stage.ts`。

## 12. 验收与验证

永久回归覆盖：

1. 矩形欧氏最短边界距离的水平、垂直、对角和重叠情况。
2. 5–10 人的路径顺序、竖直轴对称及全部矩形两两不碰撞。
3. 偶数人数上下锚点和奇数人数底部锚点。
4. 已选直线段再缩短 0.01px 即不可行。
5. 圆形可行时终止，不继续缩小圆形宽度。
6. 量化后仍满足 `minimumGap`。
7. 相同输入得到完全相同的结果。
8. 默认页面参数、URL 恢复、实时修改和非模态悬浮设置面板。

不保留求根迭代次数或机器墙钟耗时断言。开发阶段记录 5–10 人常见输入的人工基准，目标是单次同步求解明显低于一帧，但机器相关耗时不成为稳定 API 契约。

第一阶段验收终点是独立数学页面。是否替换或复用当前房间求解器，属于后续独立设计决策。
