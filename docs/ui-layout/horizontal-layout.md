# 横向房间布局

## 当前生产契约

生产 Web 通过 `RoomLayout` 与 `@avalon/ui-layout/room-layout.css` 的 CSS Container Query 选择横向形状；不使用 JavaScript 或旧 `ROOM_SHELL_CLASSES`。有效内容矩形先扣除安全区，圆桌求解器只接收舞台区域中居中的实际 stage content box；该内容盒宽高最多为 744×800，即使舞台区域更大也不会把超出求解器安全上限的高度传入同步搜索。`room-shell.css` 仅供现有 Layout Lab 使用，直到另行批准迁移。

紧凑横向使用 56px 左侧 chrome：返回按钮在顶部，五个任务节点垂直排列；普通横向改用 56px 顶部 chrome。舞台和阶段区均不使用页面滚动；阶段区始终保持语义 `heading`、`middle`、`action` 三槽，唯一的底部 state-changing action 放在 `action` 槽（重连恢复例外）。

## Container Query 边界

```text
portrait                         → 竖向布局
landscape，height < 515px        → 紧凑横向三列
landscape，height ≥ 515px
  且 width < 720px               → 紧凑横向三列
landscape，height ≥ 515px
  且 width ≥ 720px               → 普通横向
```

因此 600×515 仍是紧凑横向；900×515 与 1024×768 是普通横向。紧凑横向从左到右为 56px chrome、可伸缩舞台、192px 阶段区（宽度至少 720px 时阶段区为 224–288px）。普通横向使用 56px 顶部 chrome、左侧舞台与右侧 288–384px 阶段区；高度至少 680px 时舞台内边距为 16px，否则为 12px。紧凑横向的舞台内边距为 8px。

## 已验证的样本

2026-09-11 的真实浏览器矩阵覆盖五个大厅演示场景、5 与 10 人、375×667、390×844、667×375、844×390、600×515、900×515 和 1024×768（70 个场景组合）。所有页面均 ready，座位和可见产品控件均未越界。10 人满员大厅实测：

| 视口 | stage content box | 桌面形态 |
| --- | --- | --- |
| 600×515 | 336×499 | stadium |
| 900×515 | 588×435 | circle |
| 1024×768 | 704×680 | circle |

诊断位于 stage 右上，仅显示 viewport、safe、canvas、stage、player、avatar、shape；浏览器 console 为 0 errors / 0 warnings。当前玩家仍以观察者相对顺序位于底部，当前玩家标识只存在于无障碍名称。身份辨认幕布保持原样，留待后续身份识别设计切片。
