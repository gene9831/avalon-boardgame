# 圆桌舞台布局算法

## 1. 文档状态与范围

本文是圆桌舞台内部几何的统一规范。它不区分横屏或竖屏设备，只根据业务侧已经分配好的舞台最大宽高选择可行形态。

本文负责桌面、桌心面板和玩家座位；不负责视口、安全区、顶栏、任务轨道、阶段操作栏或舞台外边距。当前实现先完成高大于宽的舞台策略；宽大于等于高的策略仍待从[横向布局规范](./horizontal-layout.md)迁移。

项目术语以 [`CONTEXT.md`](../../CONTEXT.md) 为准。

## 2. 公共 API

唯一公共入口为：

```ts
solveRoundTableStageLayout({
  maxStageWidth,
  maxStageHeight,
  playerCount,
  gap,
  maxAvatarSize,
  avatarSizeStep,
})
```

输入含义：

| 字段 | 含义 |
| --- | --- |
| `maxStageWidth` | 业务侧分配给舞台内容盒的硬最大宽度 |
| `maxStageHeight` | 业务侧分配给舞台内容盒的硬最大高度 |
| `playerCount` | 玩家人数，整数 5–10 |
| `gap` | 任意两个玩家座位边界之间的最小间距；可选，默认 8，必须是大于等于 0 的有限数 |
| `maxAvatarSize` | 候选头像尺寸上限；可选，默认 56，范围 36–56 |
| `avatarSizeStep` | 候选头像尺寸的递减步长；可选，默认 8，必须是正有限数 |

成功结果只包含可直接渲染的舞台内部几何：

```ts
{
  status: 'ready',
  shape: 'circle' | 'stadium',
  tabletop: Rect,
  centerPanel: Rect,
  playerSeats: [{
    relativeSeatIndex,
    playerSeatBounds,
    avatarRect,
    nameRect,
    avatarTopClearance,
  }],
}
```

公共结果不包含顶栏、底栏、区域模式、视口方向、轨道诊断或状态标记位置。状态标记由业务侧根据头像圆心与半径派生。

不可用结果为：

```ts
{
  status: 'unavailable',
  reason:
    | 'invalid-input'
    | 'wide-stage-strategy-pending'
    | 'no-fitting-stage-layout',
}
```

## 3. 坐标系与硬边界

舞台左上角为 `(0, 0)`，X 轴向右，Y 轴向下。全部返回矩形均使用舞台局部坐标和逻辑像素。

```text
stageBounds = Rect(0, 0, maxStageWidth, maxStageHeight)
```

业务侧必须在调用前扣除安全区、顶栏、底栏和舞台外边距。求解器不再增加“安全舞台”内缩，也不设置 375×667 之类的视口下限。完整圆桌占用包络必须位于 `stageBounds` 内。

所有公开坐标和尺寸量化到 0.01 逻辑像素；量化后必须重新验证包含和碰撞约束。

## 4. 座位呈现档位

求解器按头像尽量大的原则，从 `maxAvatarSize` 开始按 `avatarSizeStep` 递减，并始终把 36 作为最后候选。默认序列为：

```text
56 → 48 → 40 → 36
```

例如 `maxAvatarSize = 52`、`avatarSizeStep = 8` 时，序列为 `52 → 44 → 36`。头像候选量化到 0.01 逻辑像素；小于 0.01 的正步长按可表达的 0.01 步长执行。

现有四档是其他座位参数的插值锚点：

| 参数 | 56 档 | 48 档 | 40 档 | 36 档 |
| --- | ---: | ---: | ---: | ---: |
| `avatarDiameter` | 56 | 48 | 40 | 36 |
| `seatWidth` / 姓名最大宽度 | 112 | 96 | 80 | 72 |
| `nameHeight` | 26 | 24 | 22 | 20 |
| `avatarTopClearance` | 21.33 | 18.67 | 16 | 12 |
| `centerPanelDiameter` 范围 | 152–256 | 152–256 | 152–256 | 136–152 |

非锚点头像尺寸在相邻两档之间线性插值 `seatWidth`、`nameHeight`、`avatarTopClearance` 和桌心尺寸范围。玩家座位边界的最小间距不属于头像档位，由调用方的 `gap` 统一控制；省略时全部档位都使用 8。

每个候选尺寸先尝试圆形，再尝试纵向跑道。默认调用的顺序为：

```text
56 circle → 56 stadium
→ 48 circle → 48 stadium
→ 40 circle → 40 stadium
→ 36 circle → 36 stadium
→ no-fitting-stage-layout
```

## 5. 玩家座位边界

玩家轨道上的点是头像中心，不是整个座位边界的中心。座位顶部永久保留皇冠可使用的空间；求解器不要求业务侧提前知道皇冠实际尺寸。

```text
seatTopExtent = avatarDiameter / 2 + avatarTopClearance

seatBottomExtent = avatarDiameter / 2
    + nameGap
    + nameHeight

playerSeatBounds = Rect(
    avatarCenter.x - seatWidth / 2,
    avatarCenter.y - seatTopExtent,
    seatWidth,
    seatTopExtent + seatBottomExtent
)
```

`nameGap = 4`。`avatarRect` 以轨道点为圆心，`nameRect` 位于头像下方。头像中心与 `playerSeatBounds` 的水平中心重合；由于顶部预留与下方姓名高度不同，两者的垂直中心通常不重合。

所有座位都使用同样的顶部预留，领袖轮换不会改变布局。皇冠必须由渲染器限制在预留范围内；状态标记不得反向扩大求解边界。

## 6. 桌面与玩家轨道

`roundTableFrameWidth` 是内部求解基准，不是公共输出。基本比例为：

```text
playerOrbitWidth = 0.86 × roundTableFrameWidth
tabletopWidth = 0.74 × roundTableFrameWidth

centerPanelDiameter = clamp(
    centerPanelDiameterMin,
    0.38 × roundTableFrameWidth,
    centerPanelDiameterMax
)
```

圆形候选使用：

```text
playerOrbitHeight = playerOrbitWidth
tabletopHeight = tabletopWidth
stadiumStraightLength = 0
```

纵向跑道候选使用：

```text
playerOrbitHeight = playerOrbitWidth + stadiumStraightLength
tabletopHeight = tabletopWidth + stadiumStraightLength
```

当前不对跑道设置高宽比上限。直线段只受舞台硬边界和完整座位上下延伸限制：

```text
maximumStadiumStraightLength = maxStageHeight
    - seatTopExtent
    - seatBottomExtent
    - playerOrbitWidth
```

## 7. 碰撞与间距

碰撞以稳定的 `playerSeatBounds` 为单位，不以头像外接圆或包含空白的临时 DOM 盒反推。

对任意两个座位边界：

```text
horizontalBoundarySeparation = max(
    secondBounds.left - firstBounds.right,
    firstBounds.left - secondBounds.right
)

verticalBoundarySeparation = max(
    secondBounds.top - firstBounds.bottom,
    firstBounds.top - secondBounds.bottom
)

adjacentBoundaryGap = max(
    horizontalBoundarySeparation,
    verticalBoundarySeparation
)
```

任意两个座位都必须满足调用方传入的 `gap`。玩家座位到桌心面板还必须保留 12 的间距。

跑道不强制头像中心等弧分布。它优先让相邻实际座位边界达到调用方要求的间距，并保持左右座位关于竖直中轴镜像。桌心采用与单侧座位数奇偶性一致的两种对齐方式：单侧座位数为偶数时，由跨过桌心的两对座位形成左右对称通道，通道留白中点与桌面中心对齐；单侧座位数为奇数时，左右各有一个座位的头像中心与桌面中心水平对齐，其余座位从该中心座位向上下对称紧凑放置。

通道对齐形态的同一直线段候选优先选择更小的桌心通道，其次选择更接近等弧分布者；全部直线段候选再优先更小的桌心通道，其次选择更短直线段。座位对齐形态固定桌面中心且不制造虚构通道。两种形态都在满足边界间距和桌心保护距离的前提下减少桌心附近无意义留白。

## 8. 求解与居中

每个档位的最大基准框宽度为：

```text
maximumRoundTableFrameWidth = floor(min(
    640,
    (maxStageWidth - seatWidth) / 0.86,
    (
        maxStageHeight
        - seatTopExtent
        - seatBottomExtent
    ) / 0.86
))
```

圆形玩家按观察者相对座位序号等圆心角排列，`relativeSeatIndex = 0` 固定在六点钟方向，其余座位按房间座位顺序顺时针。

生成可行候选后，求解器计算桌面和全部 `playerSeatBounds` 的并集，得到完整圆桌占用包络。然后将全部返回几何整体平移，使完整包络中心与舞台硬边界中心重合：

```text
roundTableFootprintCenter.x = maxStageWidth / 2
roundTableFootprintCenter.y = maxStageHeight / 2
```

这里居中的是完整可见内容，不是头像轨道或桌面。平移后再次验证桌面、桌心和全部座位边界均位于舞台内。

## 9. 内部诊断

实验室可以通过非公共入口取得以下诊断信息：圆桌基准框、完整占用包络、玩家轨道、跑道直线段、座位间距、桌心通道以及桌面中心补偿。座位对齐形态没有桌心通道，其通道配对与通道间距数组为空，通道宽度和桌面中心补偿为 0。

这些字段只用于原型绘制和算法检查，不从 `src/layout/index.ts` 导出，也不属于正式 Web 的稳定消费契约。

## 10. 代表结果

业务外壳按[竖向布局规范](./vertical-layout.md)分配舞台后，10 人结果为：

| 页面尺寸 | 传入舞台尺寸 | 头像 | 形态 |
| --- | ---: | ---: | --- |
| 375×667 | 359×435 | 40 | 跑道 |
| 390×844 | 366×596 | 48 | 跑道 |
| 430×932 | 406×684 | 56 | 跑道 |
| 768×1024 | 744×776 | 56 | 圆形 |

以上结果均使用默认 `gap = 8`。另一个参数化回归基线为页面 402×714、舞台 386×482：10 人在 `gap = 8` 时选择 40px 跑道，在 `gap = 6` 时选择 48px 跑道；使用 `gap = 4`、`maxAvatarSize = 56`、`avatarSizeStep = 4` 时，7 人和 8 人都选择 52px 跑道，9 人和 10 人都选择 48px 跑道。这些结果是确定性回归基线，不是额外的设备判断规则。

## 11. 验收规则

1. 公共入口只接收舞台最大宽、高、玩家人数，以及可选的座位边界最小间距、最大头像尺寸和头像递减步长。
2. 公共成功结果只包含形态、桌面、桌心和玩家座位几何。
3. 5–10 人的全部桌面、桌心和座位边界位于舞台硬边界内。
4. 完整占用包络在舞台内水平、垂直居中。
5. 头像从 `maxAvatarSize` 开始按 `avatarSizeStep` 递减并以 36 为固定下限，每个候选先圆形后跑道。
6. 当前玩家位于六点钟方向，座位顺序为视觉顺时针。
7. 座位碰撞使用稳定的 `playerSeatBounds`，并计入所有座位的头像顶部预留。
8. 跑道座位允许偏离等弧分布；单侧座位数为偶数时使用对称桌心通道，为奇数时使用桌心对齐座位，并始终满足实际边界间距。
9. 相同输入得到完全相同且最多两位小数的结果。
10. 宽舞台策略完成前明确返回 `wide-stage-strategy-pending`，不伪装成高舞台结果。
11. `gap` 对全部头像档位统一生效；负数、无穷值和非数字返回 `invalid-input`。
12. `maxAvatarSize` 超出 36–56，或 `avatarSizeStep` 不是正有限数时返回 `invalid-input`。
