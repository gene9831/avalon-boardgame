# 圆桌舞台布局算法

## 1. 文档状态与范围

本文是圆桌舞台内部几何的统一规范。它不区分横屏或竖屏设备，只根据业务侧已经分配好的舞台最大宽高选择可行形态。

本文负责桌面、桌心面板和玩家座位；不负责视口、安全区、顶栏、任务轨道、阶段操作栏或舞台外边距。方向完全且独立地由传入的舞台宽高推导，不接收业务外壳模式或设备方向参数：宽不大于高时直接使用全部舞台，宽大于高时在舞台中央使用由短边限定的同一竖向算法。

业务求解器复用 DOM-free 的[跑道玩家圆形布局模型](./stadium-player-layout-model.md)：玩家碰撞边界是与头像同心、半径等于头像直径的圆；圆形不可行时选择最短纵向跑道。业务层只把头像、姓名和皇冠顶部预留映射到玩家圆的外接正方形，不再用该正方形参与碰撞求解。

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
| `maxStageWidth` | 业务侧分配给舞台内容盒的硬最大宽度，CSS 逻辑像素，范围 `(0, 4096]` |
| `maxStageHeight` | 业务侧分配给舞台内容盒的硬最大高度，CSS 逻辑像素，范围 `(0, 800]` |
| `playerCount` | 玩家人数，整数 5–10 |
| `gap` | 任意两个玩家边界圆之间的最小间距；可选，默认 8，必须是大于等于 0 的有限数 |
| `maxAvatarSize` | 候选头像尺寸上限；可选，默认 56，范围 36–56 |
| `avatarSizeStep` | 候选头像尺寸的递减步长；可选，默认 8，必须是大于等于 4 的有限数 |

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
    playerBoundaryCircle,
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
    | 'no-fitting-stage-layout',
}
```

## 3. 坐标系与硬边界

舞台左上角为 `(0, 0)`，X 轴向右，Y 轴向下。全部返回矩形均使用舞台局部坐标和逻辑像素。

```text
stageBounds = Rect(0, 0, maxStageWidth, maxStageHeight)
```

业务侧必须在调用前扣除安全区、顶栏、底栏和舞台外边距。求解器不再增加“安全舞台”内缩，也不设置 375×667 之类的视口下限。完整圆桌占用包络必须位于 `stageBounds` 内。

所有公开坐标和尺寸量化到 0.01 逻辑像素；玩家边界半径向上包络到该网格，量化后必须重新验证包含、圆形碰撞和桌心保护约束。

## 4. 座位呈现档位

求解器按头像尽量大的原则，从 `maxAvatarSize` 开始按 `avatarSizeStep` 递减，并始终把 36 作为最后候选。默认序列为：

```text
56 → 48 → 40 → 36
```

例如 `maxAvatarSize = 52`、`avatarSizeStep = 8` 时，序列为 `52 → 44 → 36`。头像候选量化到 0.01 逻辑像素；步长必须至少为 4px。

现有四档是其他座位参数的插值锚点：

| 参数 | 56 档 | 48 档 | 40 档 | 36 档 |
| --- | ---: | ---: | ---: | ---: |
| `avatarDiameter` | 56 | 48 | 40 | 36 |
| `seatWidth` / 姓名最大宽度 | 112 | 96 | 80 | 72 |
| `nameHeight` | 26 | 24 | 22 | 20 |
| `avatarTopClearance` | 28 | 24 | 20 | 18 |

非锚点头像尺寸在相邻两档之间线性插值 `seatWidth` 和 `nameHeight`；`avatarTopClearance = avatarDiameter / 2`，由头像与玩家边界圆同心直接得到。玩家边界圆的最小间距不属于头像档位，由调用方的 `gap` 统一控制；省略时全部档位都使用 8。

每个候选尺寸先尝试圆形，再尝试纵向跑道。默认调用的顺序为：

```text
56 circle → 56 stadium
→ 48 circle → 48 stadium
→ 40 circle → 40 stadium
→ 36 circle → 36 stadium
→ no-fitting-stage-layout
```

## 5. 玩家边界与业务内容

设头像直径为 `A`。公共 `playerBoundaryCircle` 与头像同心，半径为 `A`、直径为 `2A`；它是玩家间距和桌心保护的唯一碰撞边界。`playerSeatBounds` 是该圆的外接正方形，用于定位业务内容，不参与碰撞判断。

业务映射把头像中心严格放在 `playerBoundaryCircle.center`，因此头像与玩家碰撞圆在 X/Y 双轴同心。姓名区位于头像下方，间距 `nameGap = 4`；它可以超出玩家碰撞圆及其外接正方形，其与桌心的安全关系由固定桌心保护圆覆盖。业务适配层把姓名区纳入最终可见包络，并对全部业务几何做垂直居中补偿，确保仍处于舞台硬边界内。头像包装层绘制头像、皇冠和动态状态标记；状态标记由头像几何派生，不属于求解器输出，也不扩大稳定边界。

所有座位都使用同样的顶部预留，领袖轮换不会改变布局。皇冠必须由渲染器限制在预留范围内；状态标记不得反向扩大求解边界。

## 6. 桌面与放置引导框

`roundTableFrameWidth` 是内部求解基准，不是公共输出。基本比例为：

```text
placementGuideWidth = 0.86 × roundTableFrameWidth
tabletopWidth = 0.74 × roundTableFrameWidth

centerPanelDiameter = 152
centerProtectionRadius = 80
```

圆形候选使用：

```text
placementGuideHeight = placementGuideWidth
tabletopHeight = tabletopWidth
stadiumStraightLength = 0
```

纵向跑道候选使用：

```text
placementGuideHeight = placementGuideWidth + stadiumStraightLength
tabletopHeight = tabletopWidth + stadiumStraightLength
```

当前不对跑道设置高宽比上限。直线段只受舞台硬边界和完整座位上下延伸限制：

```text
maximumStadiumStraightLength = maxStageHeight
    - seatTopExtent
    - seatBottomExtent
    - placementGuideWidth
```

## 7. 碰撞与间距

碰撞以 `playerBoundaryCircle` 为单位。任意两名玩家都必须满足 `centerDistance - first.radius - second.radius >= gap`；只检查视觉顺序相邻玩家不能替代全部两两组合复验。

圆形可行时数学模型立即选择圆形，不继续压缩圆形宽度。否则它在硬边界内求满足所有两两间距的最短纵向跑道，再依次最小化相邻视觉顺序 gap 的最大超出量和总超出量。偶数人数固定六点钟和十二点钟锚点；奇数人数固定六点钟锚点；其余座位按顺时针顺序并关于竖直中轴镜像。`gap` 是硬下限，不要求间距相等。

业务桌心保护区与边界合并为固定半径 80px 的同心圆。数学模型直接接收该半径，并保证任一玩家边界圆不与其相交；152px 桌心面板位于其中。实验室的几何模式直接渲染求解结果中的 `centerProtectionCircle`，不再从面板尺寸二次计算。

## 8. 求解与居中

每个档位先计算姓名相对玩家圆的向下溢出：

```text
nameOverflow = max(0, nameGap + nameHeight - avatarDiameter / 2)
internalSolveWidth = min(maxStageWidth, maxStageHeight,
    2 × avatarDiameter + 0.86 × 640) - nameOverflow
tabletopCenterOffsetY = -nameOverflow / 2
```

业务层仍把完整 `maxStageHeight` 交给圆形数学模型，但从短边工作宽度中为姓名溢出预留空间；姓名本身不进入数学模型的碰撞计算。模型在扣除玩家圆直径后选择最大的中心线宽度，并在舞台高度内搜索圆形或最短跑道。业务层再将全部返回几何向上补偿半个姓名溢出，并将返回中心线宽度除以 `0.86` 得到内部圆桌基准框。

当 `maxStageWidth > maxStageHeight` 时，求解器据此判定为宽舞台，但不切换数学模型或旋转坐标。内部求解区域的宽度最多为 `maxStageHeight - nameOverflow`，高度仍为完整 `maxStageHeight`；水平偏移把完整结果放回原舞台中央，左右剩余空间不进入公共输出。正方形舞台直接走同一路径。

`relativeSeatIndex = 0` 固定在六点钟方向。其余座位不是按等圆心角分布：核心沿中心线按达到目标圆边界 gap 的第一个位置递推，随后关于竖直中轴镜像并保留视觉顺时针顺序。

圆形数学模型将玩家圆心严格放在圆形或跑道中心线上，使用确定性求解和 0.01px 量化后复核。头像尺寸仍是高于形态和跑道评分的第一优先级；同一组舞台与档位参数下，5–10 人的头像结果不得随人数增加而增大。

生成可行候选后，求解器计算桌面、全部 `playerSeatBounds` 和 `nameRect` 的并集，得到完整圆桌占用包络。圆形核心先在完整舞台中垂直居中；业务层再向上补偿半个底部姓名溢出，使完整业务包络中心与舞台硬边界中心重合：

```text
roundTableFootprintCenter.x = maxStageWidth / 2
roundTableFootprintCenter.y = maxStageHeight / 2
```

这里居中的是完整可见内容，不是头像轨道或桌面。映射后再次验证桌面、桌心、全部座位边界、头像和姓名矩形均位于舞台内，并验证头像与玩家边界圆双轴同心。

## 9. 内部诊断

实验室可以通过非公共详细入口取得圆桌基准框、完整占用包络、放置引导框 `placementGuide`、固定 `centerProtectionCircle`、跑道直线段、请求的玩家圆 gap、相邻视觉顺序的欧氏边界 gap，以及桌面中心补偿。渲染的 gap 线从每对相邻玩家圆的真实最近边界点开始，以其欧氏距离和旋转角显示。

这些字段只用于原型绘制和算法检查，不从 `src/layout/index.ts` 导出，也不属于正式 Web 的稳定消费契约。

## 10. 代表结果

业务外壳按[竖向布局规范](./vertical-layout.md)分配舞台后，10 人结果为：

| 页面尺寸 | 传入舞台尺寸 | 头像 | 形态 |
| --- | ---: | ---: | --- |
| 375×667 | 359×435 | 40 | 跑道 |
| 390×844 | 366×596 | 56 | 跑道 |
| 430×932 | 406×684 | 56 | 跑道 |
| 768×1024 | 744×776 | 56 | 圆形 |

以上结果均使用默认 `gap = 8`。另一个参数化回归基线为页面 402×714、舞台 386×482：使用 `gap = 4`、`maxAvatarSize = 56`、默认 `avatarSizeStep = 8` 时，5–10 人的结果为 `[56, 56, 56, 56, 48, 48]`。这些结果以全部两两圆边界 gap、固定 80px 桌心保护半径、硬边界包含、圆形优先/最短跑道与单调档位可行性为准。

## 11. 验收规则

1. 公共入口只接收舞台最大宽、高、玩家人数，以及可选的玩家边界圆最小间距、最大头像尺寸和头像递减步长。
2. 公共成功结果只包含形态、桌面、桌心和玩家座位几何。
3. 5–10 人的全部桌面、桌心和座位边界位于舞台硬边界内。
4. 完整占用包络在舞台内水平、垂直居中。
5. 头像从 `maxAvatarSize` 开始按 `avatarSizeStep` 递减并以 36 为固定下限，每个候选先圆形后跑道。
6. 当前玩家位于六点钟方向，座位顺序为视觉顺时针。
7. 玩家碰撞使用半径等于头像直径的 `playerBoundaryCircle`；姓名等业务内容不改变数学碰撞圆。
8. 每个 `playerBoundaryCircle` 的圆心必须位于返回的圆形或跑道中心线上，公共验证容差为 0.001px；偶数人数固定上下中轴锚点，奇数人数固定底部中轴锚点，其余座位竖直轴对称并保持视觉顺时针顺序。
9. 相同输入得到完全相同且最多两位小数的结果。
10. 方向只由舞台宽高推导；宽舞台使用短边限定的同一竖向算法并水平居中，不增加方向参数、不旋转座位。
11. 舞台宽度必须在 `(0, 4096]`、高度必须在 `(0, 800]`；超限、无穷值和非数字返回 `invalid-input`。800px 高度覆盖当前最大的 744×776 舞台基线，并限制同步高舞台搜索的工作量。
12. `gap` 对全部头像档位统一生效；负数、无穷值和非数字返回 `invalid-input`。
13. `maxAvatarSize` 超出 36–56，或 `avatarSizeStep` 不是大于等于 4 的有限数时返回 `invalid-input`。
14. 相同舞台和档位参数下，5–10 人的头像尺寸随人数增加保持不增。
15. 桌心面板直径固定 152px，桌心保护区与边界的合并半径固定 80px，玩家边界圆不得与其相交。
