# 竖向房间布局与圆桌几何模型

## 1. 文档状态与范围

本文定义 Avalon 房间界面的目标竖向布局，是不依赖具体编程语言、UI 框架或设备类别的规范模型。

“竖向布局”表示该布局已经由上层响应式模式选择器选定。本文只规定包含任务进度的顶栏、圆桌舞台和固定阶段面板的布局，以及同一“领袖组队”场景的呈现；其他游戏阶段、身份辨认、弹层和结果动效不在本次范围内。

共享坐标系、圆桌占用包络、座位局部边界、碰撞约束和安全取整以[横向布局规范](./horizontal-layout.md)为准。当前竖向算法在独立的 [`apps/ui-layout-lab`](../../apps/ui-layout-lab/README.md) 中实现；旧[统一横竖屏交互原型](./prototypes/avalon-landscape-responsive-lab.html)暂时保留为横向迁移的对齐参考。

## 2. 设计目标

竖向布局必须同时满足以下目标：

1. 在可用尺寸 375×667 至大尺寸竖屏中保持同一上下结构。
2. 竖向布局只有紧凑竖版和普通竖版两种模式；顶栏和固定阶段面板使用同一离散高度断点，不进行无级缩放。
3. 游戏状态变化不得改变固定阶段面板高度或圆桌位置。
4. 圆桌在每个座位呈现档位中先尝试圆形玩家轨道，再尝试纵向跑道，并复用横版的完整包络与碰撞约束。
5. 5–10 人的头像、姓名、状态标记和桌心信息互不遮挡。
6. 所有可见文字不小于 12，最小交互热区不小于 44×44。
7. 正常字号下页面和固定阶段面板均不依赖滚动。
8. 空间不足时明确返回“竖向布局不可行”，不继续缩小关键内容。

## 3. 顶层结构

```text
有效布局矩形
├── 顶栏
│   ├── 返回按钮
│   ├── 房间信息
│   └── 五个任务进度
├── 圆桌舞台
│   └── 安全舞台
│       └── 圆桌占用包络
└── 固定阶段面板
```

三个区域直接相邻。分隔线可以覆盖边界，但不得额外占用布局高度。固定阶段面板不是抽屉，不显示拖拽把手，也不允许游戏内容改变其高度。

## 4. 输入与安全区

最终对外接口为 `solveRoomLayout({ width, height, playerCount })`。接口根据宽高自行选择方向，不要求调用方传入 Horizontal 或 Vertical。安全区由应用适配层扣除后，再把以下有效尺寸传给纯布局函数：

| 变量 | 含义 |
| --- | --- |
| `width`, `height` | 已扣除安全区的有效布局矩形宽和高 |
| `playerCount` | 玩家人数，取值 5–10 |

观察者对应的房间座位在进入求解器之前转换为相对座位序号；求解结果中 `relativeSeatIndex = 0` 固定在六点钟方向。

本文后续公式继续使用布局语义名称：`usableX = 0`、`usableY = 0`、`usableWidth = width`、`usableHeight = height`。应用可以把返回坐标整体平移到设备安全区的起点，纯函数本身不读取 CSS 环境变量。

区域背景可以延伸进入安全区；文字、按钮、玩家座位和圆桌占用包络只能使用有效布局矩形。

移动浏览器工具栏的临时显示或收起不改变布局档位。档位使用同一方向内稳定的可用高度，只有窗口真实调整或方向改变时才重新选择。

## 5. 基准参数

### 5.1 顶层参数

| 参数 | 默认值 | 含义 |
| --- | ---: | --- |
| `portraitMinWidth` | 375 | 竖向布局最小可用宽度 |
| `portraitMinHeight` | 667 | 竖向布局最小可用高度 |
| `portraitHeightBreak` | 800 | 紧凑竖版与普通竖版的高度分界 |
| `compactTopBarHeight` | 48 | 紧凑竖版顶栏高度 |
| `normalTopBarHeight` | 56 | 普通竖版顶栏高度 |
| `compactTopBarPadding` | 8 | 紧凑竖版顶栏左右内边距 |
| `normalTopBarPadding` | 12 | 普通竖版顶栏左右内边距 |
| `compactPhasePanelHeight` | 152 | 紧凑竖版固定阶段面板高度 |
| `normalPhasePanelHeight` | 168 | 普通竖版固定阶段面板高度 |
| `compactPhaseHeaderHeight` | 44 | 紧凑竖版标题矩形高度 |
| `normalPhaseHeaderHeight` | 48 | 普通竖版标题矩形高度 |
| `compactPhaseMiddleHeight` | 52 | 紧凑竖版选择或描述矩形高度 |
| `normalPhaseMiddleHeight` | 56 | 普通竖版选择或描述矩形高度 |
| `compactPhaseActionHeight` | 56 | 紧凑竖版确认矩形高度 |
| `normalPhaseActionHeight` | 64 | 普通竖版确认矩形高度 |
| `compactControlHeight` | 44 | 紧凑竖版按钮热区高度 |
| `normalControlHeight` | 48 | 普通竖版按钮热区高度 |
| `compactStageMargin` | 8 | 紧凑竖版安全舞台边距 |
| `normalStageMargin` | 12 | 普通竖版安全舞台边距 |
| `roundTableFrameWidthCap` | 640 | 圆桌布局基准框宽度上限 |
| `phaseContentWidthCap` | 560 | 阶段面板内部内容宽度上限 |

### 5.2 顶栏任务进度参数

| 参数 | 默认值 | 含义 |
| --- | ---: | --- |
| `taskSlotWidth` | 44 | 每个任务节点的固定槽位宽度 |
| `taskNodeDiameter` | 36 | 普通任务圆形直径 |
| `currentTaskNodeDiameter` | 40 | 当前任务圆形直径 |
| `taskSlotGap` | 0 | 相邻固定槽位间距 |

五个任务槽位的总宽度固定为：

```text
taskTrackContentWidth = 5 × taskSlotWidth = 220
```

五个槽位作为顶栏的固定宽度列。36 直径的普通任务圆形位于 44 宽槽位中央，所以相邻圆形之间自然保留约 8 的可见间距，不再额外增加槽位间距。当前任务只在自己的 44 宽槽位内放大，圆心不移动。

任务所需人数和双失败规则位于任务圆形底部的同一行，可以轻微覆盖圆形边缘。成功或失败结果仍使用圆形边框和右上角结果图标。

## 6. 顶层布局算法

### 6.1 两种竖屏模式

```text
若 usableHeight < 800：
    portraitMode = compactPortrait
    topBarHeight = 48
    topBarPadding = 8
    phasePanelHeight = 152
    phaseHeaderHeight = 44
    phaseMiddleHeight = 52
    phaseActionHeight = 56
    controlHeight = 44
    stageMargin = 8
否则：
    portraitMode = normalPortrait
    topBarHeight = 56
    topBarPadding = 12
    phasePanelHeight = 168
    phaseHeaderHeight = 48
    phaseMiddleHeight = 56
    phaseActionHeight = 64
    controlHeight = 48
    stageMargin = 12
```

宽度只参与圆桌几何求解和竖向布局可行性判断，不在紧凑竖版与普通竖版之间切换模式。

### 6.2 三个输出矩形

```text
stageHeight = usableHeight
    - topBarHeight
    - phasePanelHeight

TopBar = Rect(
    usableX,
    usableY,
    usableWidth,
    topBarHeight
)

Stage = Rect(
    usableX,
    usableY + topBarHeight,
    usableWidth,
    stageHeight
)

PhasePanel = Rect(
    usableX,
    usableY + usableHeight - phasePanelHeight,
    usableWidth,
    phasePanelHeight
)

SafeStage = inset(
    Stage,
    stageMargin,
    stageMargin,
    stageMargin,
    stageMargin
)
```

## 7. 顶栏和固定阶段面板

### 7.1 顶栏

顶栏从左到右分为三个网格列：固定宽度的返回按钮、获取全部剩余空间的房间信息、固定 220 宽的五个任务槽位。其代数关系为：

```text
roomWidth = usableWidth
    - 2 × topBarPadding
    - backButtonWidth
    - taskTrackContentWidth
    - 2 × topBarColumnGap
```

默认取值如下：

| 参数 | 紧凑竖版 | 普通竖版 |
| --- | ---: | ---: |
| `backButtonWidth` | 44 | 48 |
| `taskTrackContentWidth` | 220 | 220 |
| `topBarColumnGap` | 4 | 4 |

因此顶栏可等价表达为 `返回固定 + 房间剩余 + 任务固定`。任务进度不会被房间号挤压，房间信息也不会反向改变返回按钮或任务槽位的几何。

房间信息是次要的房间号复制入口，与连接状态点组成一个在第二列内靠左排列的内容组，使用七位十六进制字符作为最坏空间样本，例如 `7A3C9EF`。按钮优先采用内容自身宽度，不拉伸占满剩余列；只有内容宽度超过可用空间时才收缩。空间充足时显示为单行“房间 7A3C9EF”，状态点紧随其后；空间不足时房间信息自然变为上方“房间”、下方“7A3C9EF”，不得截断房间号。状态点不属于被复制的内容。

返回按钮的交互热区至少为 44×44。任务序号只在五个任务节点内显示，当前提案和阶段名称不进入顶栏。“身份”“记录”和“帮助”三个入口统一放到固定阶段面板右上角。正常连接只显示状态点，连接异常提示覆盖显示而不改变三个区域的高度。

### 7.2 固定阶段面板

阶段面板背景铺满可用宽度；内部内容宽度不超过 `phaseContentWidthCap`，并水平居中。内部始终是三个不收缩、不滚动的矩形：

```text
PhasePanelContent
├── Header：左侧阶段标题，右侧身份、记录和帮助按钮
├── Middle：横向二选一按钮，或最多两行简短描述
└── Action
    └── 最多一个确认或主操作按钮；等待状态保留矩形但不显示伪按钮
```

紧凑竖版使用 `44 + 52 + 56 = 152`，普通竖版使用 `48 + 56 + 64 = 168`。Header 与 Middle 之间使用绘制在 Header 内部的 1px 分隔线，分隔线不参与高度计算；Middle 与 Action 之间不使用明显分隔线。

身份、记录和帮助按钮在紧凑竖版和普通竖版中的热区分别为 44×44 和 48×48。三个入口从右向左占用 Header 的固定宽度，阶段标题获得其余空间。Middle 中的两个选择按钮始终等宽横向排列，按钮高度分别为 44 和 48；描述最多两行并垂直居中。Action 中的单一主按钮占满内容宽度，按钮高度分别为 44 和 48。

成员名单、当前选择、提交进度、投票结果、任务结果、刺杀目标和最终结果均由圆桌舞台呈现，不进入阶段面板。提交中只改变 Action 按钮内部状态；操作错误通过舞台上方临时提示或顶栏连接提示呈现，不得改变三个矩形的高度。

各流程映射为：

| 流程 | Header | Middle | Action |
| --- | --- | --- | --- |
| 等待开局 | 等待玩家 | 简短等待说明 | 开始游戏或留空 |
| 身份确认 | 身份辨认 | 当前步骤说明 | 确认已查看 |
| 领袖组队 | 领袖组队 | 在圆桌选择成员的说明 | 确认任务队伍 |
| 队伍投票 | 队伍投票 | 赞成／反对 | 确认投票 |
| 正义队员执行任务 | 执行任务 | 只能提交成功的说明 | 提交成功 |
| 邪恶队员执行任务 | 执行任务 | 成功／失败 | 确认任务牌 |
| 非任务队员或已提交 | 执行任务 | 等待说明 | 留空 |
| 刺杀 | 刺杀梅林 | 在圆桌选择目标的说明 | 确认刺杀 |
| 游戏结束 | 对局结束 | 简短查看提示 | 留空 |

除不适用的入口可以隐藏外，Header 的工具区位置和保留宽度不随流程变化；隐藏入口不得使其余工具或阶段标题跳位。

## 8. 竖版圆桌求解

竖版复用横向布局规范中的以下定义：

- 9.1 节的观察者相对玩家轨道；
- 9.3–9.5 节的座位边界、完整包络和包络居中；
- 10.1–10.4 节的外部适配、座位碰撞、桌心碰撞和内部最小尺寸；
- 11.1 节的档位优先、最大化和安全取整流程。

### 8.1 座位档位和形态优先级

竖屏高度断点只控制顶栏和固定阶段面板，不控制头像尺寸。无论竖屏高度是多少，圆桌求解器都按以下固定顺序尝试：

```text
56 圆形 → 56 跑道
→ 48 圆形 → 48 跑道
→ 40 圆形 → 40 跑道
→ 36 圆形 → 36 跑道
→ 布局不可用
```

| 参数 | 56 档 | 48 档 | 40 档 | 36 档 |
| --- | ---: | ---: | ---: | ---: |
| 头像直径 | 56 | 48 | 40 | 36 |
| 姓名牌最大宽度 | 112 | 96 | 80 | 72 |
| 姓名牌高度 | 26 | 24 | 22 | 20 |
| 头像顶部预留 `avatarTopClearance` | 21.33 | 18.67 | 16 | 12 |
| 座位间距 | 8 | 8 | 8 | 6 |
| 桌心直径范围 | 152–256 | 152–256 | 152–256 | 136–152 |

在同一档位内，圆形成功就不再尝试跑道。圆形失败后，跑道允许玩家中心沿轨道非等弧分布，以实际玩家座位边界的普通间距、对称桌心过道和直线段长度共同选择候选。若安全舞台内不存在可行跑道，则当前档位失败并进入下一档。

### 8.2 圆形和纵向跑道

`roundTableFrameWidth` 是圆形布局基准框边长，也是跑道布局基准框宽度。基础比例保持不变：

```text
playerOrbitWidth = 0.86 × roundTableFrameWidth
tabletopWidth = 0.74 × roundTableFrameWidth
```

圆形使用：

```text
playerOrbitHeight = playerOrbitWidth
tabletopHeight = tabletopWidth
```

纵向跑道增加直线段 `stadiumStraightLength`：

```text
playerOrbitHeight = playerOrbitWidth + stadiumStraightLength
tabletopHeight = tabletopWidth + stadiumStraightLength
```

跑道不是尽量使用全部舞台高度。候选的最大直线段由完整玩家座位边界的顶部和底部延伸共同限制。当前不额外限制玩家轨道的高宽比：

```text
maximumStraightLength = safeStageHeight
    - seatTopExtent
    - seatBottomExtent
    - playerOrbitWidth
```

### 8.3 玩家座位边界

跑道不根据当前可见标记改变几何。求解器不知道皇冠的实际尺寸，只为每档输出稳定的 `avatarTopClearance`。渲染器负责把皇冠限制在这段预留空间内；状态标记由头像圆心和半径派生，不单独扩大座位边界。

每个玩家的稳定座位边界为：

~~~text
seatLeftExtent = nameWidth / 2
seatRightExtent = nameWidth / 2

seatTopExtent =
    avatarDiameter / 2
    + avatarTopClearance

seatBottomExtent =
    avatarDiameter / 2
    + nameGap
    + nameHeight

PlayerSeatBounds = Rect(
    playerSeatCenter.x - seatLeftExtent,
    playerSeatCenter.y - seatTopExtent,
    seatLeftExtent + seatRightExtent,
    seatTopExtent + seatBottomExtent
)
~~~

所有座位都永久保留相同的头像顶部空间，以保证领袖轮换时座位不跳动。`PlayerSeatBounds`、`avatarRect` 和 `nameRect` 都是独立输出；碰撞、包络和诊断显示必须使用同一个 `PlayerSeatBounds`，不得从渲染后的 DOM 反推几何。头像中心位于 `PlayerSeatBounds` 的水平中心线上，但由于顶部预留与下方姓名高度不同，不要求与整个座位边界的几何中心重合。

### 8.4 边界间距和桌心过道

对任意两个相邻玩家，先计算轴对齐边界的分离量：

~~~text
horizontalBoundarySeparation =
    max(
        secondBounds.left - firstBounds.right,
        firstBounds.left - secondBounds.right
    )

verticalBoundarySeparation =
    max(
        secondBounds.top - firstBounds.bottom,
        firstBounds.top - secondBounds.bottom
    )

adjacentBoundaryGap =
    max(
        horizontalBoundarySeparation,
        verticalBoundarySeparation
    )
~~~

普通相邻座位的目标间距等于档位规定的 tierSeatGap。连续几何求解后，每个普通 adjacentBoundaryGap 与 tierSeatGap 的偏差不得超过 1 个逻辑单位，任意两个普通间距的差不得超过 2。

桌心信息区会把左右两组座位分成上下两段。跨越桌心的两对相邻座位使用更大的 centerAisleGap：

~~~text
leftCenterAisleGap = rightCenterAisleGap

centerAisleMidpoint =
    (
        upperPlayerSeatBounds.bottom
        + lowerPlayerSeatBounds.top
    ) / 2

tabletopCenter.y = centerAisleMidpoint
~~~

centerAisleGap 不设固定视觉值，而是取满足桌心碰撞、普通间距和左右对称约束的最小值。桌面中心相对玩家轨道中心的补偿不得超过 0.06 × roundTableFrameWidth。

### 8.5 座位顺序和对称

- 当前玩家固定在六点钟方向，其余玩家按房间座位顺序顺时针排列。
- 左右两侧关于竖直中轴镜像。
- 偶数人数在十二点钟方向有一个正对玩家。
- 奇数人数不强制顶部玩家，由一对镜像座位围合顶部。
- 姓名和标记始终保持屏幕正向，不随轨道旋转。

### 8.6 可行性和候选比较

基准框宽度上限为：

~~~text
maximumRoundTableFrameWidth = min(
    roundTableFrameWidthCap,
    (safeStageWidth - seatWidth) / 0.86,
    (
        safeStageHeight
        - seatTopExtent
        - seatBottomExtent
    ) / 0.86
)
~~~

每个候选形态必须同时满足：

- 完整圆桌占用包络位于安全舞台内；
- 任意玩家座位边界之间至少保留档位规定间距；
- 普通相邻边界间距满足容差；
- 玩家座位不进入桌心信息区及其 12 的保护间距；
- 桌心过道左右对称且留白中心与桌面中心对齐；
- 所有可见文字不小于 12，交互热区不小于 44×44。

在同一档位中，圆形等圆心角候选优先。圆形失败时，对全部可行跑道候选按以下字典序选择：

1. 最小化普通 adjacentBoundaryGap 相对 tierSeatGap 的偏差；
2. 最小化 centerAisleGap 超出桌心碰撞所需值的余量；
3. 最小化 stadiumStraightLength；
4. 最小化玩家中心相对等弧分布的总偏移。

规范只约束输入、几何和字典序目标，不绑定正式 Web 实现的内部求解技术。独立实验室使用有界、确定性的轨道候选搜索；相同输入必须返回相同结果。所有公开几何量化到 0.01 逻辑像素后，重新执行包含、座位碰撞、桌心碰撞和补偿上限检查；失败时继续搜索或进入下一档。`src/layout/` 不依赖 DOM、Vite、Tailwind 或浏览器状态，可在后续直接被正式 Web 消费。

## 9. 响应式模式选择

上层选择器只使用可用几何，不使用设备类别：

```text
preferredMode = usableWidth >= usableHeight
    ? horizontal
    : vertical

若 preferredMode 可行：
    返回 preferredMode
否则若另一个模式可行：
    返回另一个模式
否则：
    返回 layoutUnavailable
```

正方形视口优先横向布局。横向模式内部再按横向规范选择普通横版或紧凑横版。

竖向模式内部仅按可用高度选择两种布局：

```text
portraitMode = usableHeight < portraitHeightBreak
    ? compactPortrait
    : normalPortrait
```

竖向布局的基础可行性条件为：

```text
usableWidth ≥ portraitMinWidth
usableHeight ≥ portraitMinHeight
圆桌求解器至少存在一个可行档位
固定阶段面板内容预算满足
```

## 10. 计算示例

以下示例假设安全区均为 0：

| 可用尺寸 | 顶栏（含任务进度） | 舞台 | 阶段面板 | 舞台边距 |
| --- | ---: | ---: | ---: | ---: |
| 375×667 | 48 | 467 | 152 | 8 |
| 390×844 | 56 | 620 | 168 | 12 |
| 768×1024 | 56 | 800 | 168 | 12 |

独立实验室把传入尺寸直接作为有效布局矩形，画布边框和工作台缩放都不参与求解。375×667、10 人时，40 档圆形相邻座位空间不足，随后求得 40 档跑道候选：

```text
stage = 375 × 467
safeStage = 359 × 451
roundTableFrameWidth = 324
stadiumStraightLength = 54
playerOrbit = 278.64 × 332.64
tabletop = 239.76 × 293.76
roundTableFootprint = 358.64 × 414.64
standardAdjacentBoundaryGap = 8
centerAisleGap = 8.04
```

该跑道的玩家轨道高宽比约为 `1.194`。玩家中心不再沿跑道周长等距排列，而是先让八个普通相邻边界保持 8 的间距，再为两处桌心通道保留对称的最小额外空间。较大头像档位仅在安全舞台内找不到满足完整碰撞约束的圆形或跑道时才会降档。

当前交互原型的 10 人代表结果为：

| 可用尺寸 | 头像档位 | 形态 | `stadiumStraightLength` | 玩家轨道高宽比 | 普通边界间距 | 桌心通道间距 |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| 375×667 | 40 | 跑道 | 54 | 1.194 | 8 | 8.04 |
| 390×844 | 48 | 跑道 | 161 | 1.598 | 8 | 31.88 |
| 430×932 | 56 | 跑道 | 178 | 1.607 | 8 | 8.55 |
| 768×1024 | 56 | 圆形 | 0 | 1.000 | — | — |

这些数值是当前纯求解器在指定输入下的确定性输出，用于回归而不是新的设计常量。尤其是 390×844：安全舞台为 366×596，48 档玩家座位宽度为 96；通过按真实座位边界压紧普通间距并设置对称桌心通道，可以保留 48px 头像，不再因保守等弧分布降到 40px。

## 11. 诊断显示

诊断显示默认关闭。开启后至少显示：

- 顶栏（含任务进度）、圆桌舞台和固定阶段面板矩形；
- 安全舞台；
- 圆桌布局基准框；
- 圆形或纵向跑道玩家轨道；
- 完整圆桌占用包络；
- 各玩家包含头像顶部预留、头像和姓名的 `PlayerSeatBounds`；
- 普通相邻座位之间的边界间距线；
- 两处对称桌心通道间距线；
- 当前头像档位、形态、直线段长度和间距摘要。

诊断线覆盖在布局之上，不得参与尺寸计算。

## 12. 验收规则

对 375×667 的 5、8、10 人，以及常见 iPhone、iPad 竖向尺寸逐项验证：

1. 三个区域的尺寸和位置符合第 6 节公式。
2. 竖向布局只显示紧凑竖版或普通竖版；固定阶段面板高度分别为 152 或 168，且主按钮位置不随选择内容变化。
3. 顶栏按“返回固定 + 房间剩余 + 任务固定 220”分配宽度；房间号位于第二列，可按剩余宽度在一行和两行之间自然切换且不截断。
4. 五个任务槽位位于顶栏固定列，圆心水平对齐，当前任务放大不移动圆心。
5. 圆桌严格按 `56/48/40/36` 档位，并在每档中按“圆形后跑道”的顺序选择。
6. 圆形失败后，跑道允许玩家中心偏离等弧分布，并按第 8.6 节字典序选择候选，不额外限制玩家轨道高宽比。
7. 普通相邻 PlayerSeatBounds 的间距相对档位目标偏差不超过 1，任意两个普通间距之差不超过 2。
8. 两处 centerAisleGap 左右对称、取满足桌心保护区所需的最小值，且留白中点与桌面中心对齐。
9. 圆桌完整包络位于安全舞台内；座位彼此不重叠，且不与桌心信息区重叠。
10. 390×844 的 10 人布局选择 48px 跑道，不因空白矩形或等弧分布的保守碰撞降到 40px。
11. 所有姓名字号不小于 12，交互热区不小于 44×44。
12. 正常字号下页面和阶段面板不滚动、不裁切；三个阶段矩形不因内容或等待状态改变高度。
13. 打开或关闭诊断显示不改变任何布局几何。
14. 旋转原型预览时只交换宽高，再由真实模式选择器重新选择布局。
15. 加入竖向布局不得改变普通横版和紧凑横版在相同尺寸下的几何结果。

## 13. 与当前 Web 实现的关系

本文和独立实验室是目标布局规范，不代表当前 Web 游戏界面已经采用竖向三段布局。本次设计不修改正式 Web 游戏界面，也不增加任何游戏阶段行为。

当前 `solveRoomLayout` 已完成竖向求解；横向输入暂时返回 `horizontal-strategy-pending`。后续将按同一输入输出契约迁移横向模型并逐项对齐，在横向等价验证完成前保留旧静态原型。
