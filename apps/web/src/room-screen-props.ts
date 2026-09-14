import type { ReactNode, Ref } from 'react'
import type {
  PlayerID,
  QuestCard,
  Role,
  TeamVote,
} from '@avalon/game'
import type { RoundTableStageLayoutResult } from '@avalon/ui-layout'

import type { PlayerAvatarID } from './player-profile'
import type { RoomTeamToken } from './RoomTeamTokens'

/**
 * 所有网络提交统一使用这一状态。
 *
 * pending 只会禁用原操作，不改变按钮文案。
 * 请求失败不进入场景状态，由外层统一显示 Toast 并恢复 idle。
 */
export type RoomRequestState = 'idle' | 'pending'

/**
 * 顶层只区分主要房间场景。
 *
 * 等待、选择、提交和阶段结算属于对应场景的嵌套状态，
 * 不继续扩张顶层 kind。
 */
export type RoomScene =
  | RoomLoadingScene
  | RoomConnectionRecoveryScene
  | RoomLobbyScene
  | RoomIdentityConfirmationScene
  | RoomIdentityRecognitionScene
  | RoomTeamProposalScene
  | RoomTeamVoteScene
  | RoomQuestScene
  | RoomAssassinationScene
  | RoomGameResultScene

/**
 * 所有场景共享的公开房间信息。
 *
 * 这里的数据必须已经经过服务端 playerView 和 UI 控制器过滤。
 * RoomScreen 不读取原始服务端状态，也不推导隐藏信息规则。
 */
interface RoomSceneBase<Kind extends string> {
  kind: Kind
  matchID: string
  playerCount: number | null
  players: readonly RoomPlayerPresentation[]
  questProgress: readonly RoomQuestProgressNode[]
}

export interface RoomLoadingScene
  extends RoomSceneBase<'loading'> {
  message: string
}

export interface RoomConnectionRecoveryScene
  extends RoomSceneBase<'connectionRecovery'> {
  manualReconnectAvailable: boolean
}

export interface RoomLobbyScene
  extends RoomSceneBase<'lobby'> {
  occupiedCount: number
  seatCount: number
  viewer: 'owner' | 'player'
  canStart: boolean
  startRequestState: RoomRequestState
}

export interface RoomIdentityConfirmationScene
  extends RoomSceneBase<'identityConfirmation'> {
  role: Role

  /**
   * confirming 不再是独立视觉状态：
   * view 保持 revealed，confirmRequestState 变为 pending。
   */
  view:
    | 'concealed'
    | 'revealing'
    | 'revealed'
    | 'hiding'
    | 'waiting'
    | 'reviewing'

  confirmedCount: number
  participantCount: number
  confirmRequestState: RoomRequestState
}

export type RoomIdentityClue =
  | Readonly<{
      kind: 'evilAllies'
      targetPlayerIDs: readonly PlayerID[]
    }>
  | Readonly<{
      kind: 'merlinEvil'
      targetPlayerIDs: readonly PlayerID[]
    }>
  | Readonly<{
      kind: 'percivalCandidates'
      targetPlayerIDs: readonly [PlayerID, PlayerID]
    }>
  | Readonly<{
      kind: 'none'
      targetPlayerIDs: readonly []
    }>

/**
 * 身份辨认阶段只接收已经过 playerView 授权的私密呈现。
 *
 * roleReveal 保留完整角色资料；clue 只携带当前玩家获准看到的线索；
 * observer 不携带任何私密内容，并始终显示闭合幕布。
 */
export type RoomIdentityRecognitionPresentation =
  | Readonly<{
      kind: 'roleReveal'
      role: Role
      view: 'revealed' | 'waiting'
      confirmRequestState: RoomRequestState
    }>
  | Readonly<{
      kind: 'clue'
      clue: RoomIdentityClue
      view: 'concealed' | 'revealing' | 'revealed' | 'waiting'
      confirmRequestState: RoomRequestState
    }>
  | Readonly<{
      kind: 'observer'
    }>

export interface RoomIdentityRecognitionScene
  extends RoomSceneBase<'identityRecognition'> {
  presentation: RoomIdentityRecognitionPresentation
  confirmedCount: number
  participantCount: number
}

export interface RoomTeamProposalScene
  extends RoomSceneBase<'teamProposal'> {
  questIndex: number
  requiredTeamSize: number
  selectedCount: number
  consecutiveRejectedTeams: number
  perspective: 'leader' | 'observer'
  canSubmit: boolean
  submitRequestState: RoomRequestState
  teamTokens?: readonly RoomTeamToken[]
}

export type RoomTeamVoteView =
  | Readonly<{
      kind: 'choosing'
      selectedVote: TeamVote | null
      canChoose: boolean
      submitRequestState: RoomRequestState
    }>
  | Readonly<{
      kind: 'waiting'
      submittedVote: TeamVote
    }>

export interface RoomTeamVoteScene
  extends RoomSceneBase<'teamVote'> {
  questIndex: number
  submittedCount: number
  participantCount: number
  consecutiveRejectedTeams: number
  teamTokens?: readonly RoomTeamToken[]
  view: RoomTeamVoteView
}

export type RoomQuestView =
  | Readonly<{
      kind: 'choosing'
      alignment: 'good' | 'evil'
      selectedCard: QuestCard | null
      canChoose: boolean
      submitRequestState: RoomRequestState
    }>
  | Readonly<{
      kind: 'waiting'
      participation: 'member' | 'observer'
      submittedCard: QuestCard | null
    }>
  | Readonly<{
      kind: 'result'
      succeeded: boolean
      successCount: number
      failCount: number
    }>

export interface RoomQuestScene
  extends RoomSceneBase<'quest'> {
  questIndex: number
  requiredSubmissionCount: number
  submittedCount: number
  view: RoomQuestView
}

export type RoomAssassinationView =
  | Readonly<{
      kind: 'selecting'
      targetPlayerID: PlayerID | null
      canSubmit: boolean
      submitRequestState: RoomRequestState
    }>
  | Readonly<{
      kind: 'observing'
      perspective: 'evil' | 'good'
    }>
  | Readonly<{
      kind: 'result'
      targetPlayerID: PlayerID
      targetRole: Role
      hit: boolean
      winner: 'good' | 'evil'
    }>

export interface RoomAssassinationScene
  extends RoomSceneBase<'assassination'> {
  view: RoomAssassinationView
}

export interface RoomGameResultScene
  extends RoomSceneBase<'gameResult'> {
  winner: 'good' | 'evil'
  reason: string
  questScore: string
}

/**
 * 控制器已经决定座位可以执行什么操作。
 * RoomPlayerSeat 不再结合当前阶段自行推导权限。
 */
export type RoomPlayerInteraction =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'changeSeat'
      disabled: boolean
      pending: boolean
    }>
  | Readonly<{
      kind: 'selectTeam'
      disabled: boolean
      selected: boolean
    }>
  | Readonly<{
      kind: 'selectAssassinationTarget'
      disabled: boolean
      selected: boolean
    }>

/**
 * 可同时存在的座位过程标记。
 *
 * 终局不显示过程标记时，控制器直接返回空数组。
 */
export type RoomPlayerMarker =
  | Readonly<{ kind: 'owner' }>
  | Readonly<{ kind: 'leader' }>
  | Readonly<{ kind: 'questMember' }>
  | Readonly<{
      kind: 'vote'
      status: 'pending' | TeamVote
    }>
  | Readonly<{ kind: 'knownEvil' }>
  | Readonly<{ kind: 'merlinCandidate' }>

/** 姓名牌下方最多显示一个短标签。 */
export type RoomPlayerCaption =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'role'
      role: Role
    }>
  | Readonly<{
      kind: 'recognition'
      label: '你' | '同伴' | '邪恶' | '候选人'
      tone: 'self' | 'ally' | 'evil' | 'candidate'
    }>

/**
 * 头像只接收允许当前玩家看见的内容。
 * 角色立绘和普通玩家头像共用同一个头像位置。
 */
export type RoomPlayerPortrait =
  | Readonly<{
      kind: 'playerAvatar'
      avatarID: PlayerAvatarID
      connected: boolean
    }>
  | Readonly<{
      kind: 'roleArtwork'
      role: Role
    }>

export interface RoomPlayerPresentation {
  playerID: PlayerID
  relativeSeatIndex: number
  seatNumber: number
  name: string
  occupied: boolean
  isCurrentPlayer: boolean
  portrait: RoomPlayerPortrait
  markers: readonly RoomPlayerMarker[]
  caption: RoomPlayerCaption
  emphasis:
    | 'default'
    | 'selected'
    | 'questMember'
    | 'target'
    | 'knownEvil'
    | 'dimmed'
  interaction: RoomPlayerInteraction
}

export interface RoomQuestProgressNode {
  questIndex: number
  teamSize: number | null
  failThreshold: number | null
  state: 'upcoming' | 'current' | 'success' | 'failure'
}

/**
 * 生产 RoomScreen 只开放两个外部集成位置。
 *
 * toolbar 是完整工具栏节点，而不是帮助、日志等细碎 slot。
 * RoomScreen 仍然控制两个节点的位置和可用空间。
 */
export interface RoomScreenSlots {
  back: ReactNode
  toolbar: ReactNode
}

/**
 * DOM 测量和圆桌求解由外层观察器完成。
 *
 * 回调 ref 只是把内部布局节点交给观察器；
 * RoomScreen 本身不维护测量状态。
 */
export interface RoomScreenGeometry {
  stageLayout: RoundTableStageLayoutResult | null
  layoutRef?: Ref<HTMLElement>
  stageRef?: Ref<HTMLDivElement>
}

/** 每种场景只能获得本阶段允许的操作。 */
export interface RoomActionsByKind {
  loading: null

  connectionRecovery: Readonly<{
    onReconnect(): void
  }>

  lobby: Readonly<{
    onActivatePlayer(playerID: PlayerID): void
    onStart(): void
  }>

  identityConfirmation: Readonly<{
    onReveal(): void
    onRevealComplete(): void
    onHide(): void
    onHideComplete(): void
    onConfirm(): void
    onReview(): void
    onCloseReview(): void
  }>

  identityRecognition: Readonly<{
    onReveal(): void
    onRevealComplete(): void
    onConfirm(): void
  }>

  teamProposal: Readonly<{
    onActivatePlayer(playerID: PlayerID): void
    onSubmitTeam(): void
  }>

  teamVote: Readonly<{
    onSelectVote(vote: TeamVote): void
    onConfirmVote(): void
  }>

  quest: Readonly<{
    onSelectCard(card: QuestCard): void
    onConfirmCard(): void
  }>

  assassination: Readonly<{
    onActivatePlayer(playerID: PlayerID): void
    onAssassinate(): void
  }>

  gameResult: null
}

/**
 * 通过映射类型保持 scene.kind 与 actions 的严格对应。
 *
 * 例如 teamVote 场景无法收到刺杀操作；
 * gameResult 场景只能传入 actions={null}。
 */
type RoomSceneBinding = {
  [Kind in RoomScene['kind']]: Readonly<{
    scene: Extract<RoomScene, { kind: Kind }>
    actions: RoomActionsByKind[Kind]
  }>
}[RoomScene['kind']]

/**
 * RoomScreen 的最终公开 Props。
 *
 * 它是纯场景渲染器：
 * - 不读取原始服务端 gameState；
 * - 不持有业务或请求状态；
 * - 不控制帮助、日志和房间菜单；
 * - 不负责 ResizeObserver 或诊断状态；
 * - 相同 props 始终渲染相同房间场景。
 */
export type RoomScreenProps = Readonly<{
  geometry: RoomScreenGeometry
  slots: RoomScreenSlots
}> & RoomSceneBinding
