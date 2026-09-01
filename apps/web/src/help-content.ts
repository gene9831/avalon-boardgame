import { getPlayerCountConfig, type Role } from '@avalon/game'

const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const

export const HELP_ROLE_ORDER = [
  'merlin',
  'percival',
  'loyal_servant',
  'assassin',
  'morgana',
  'minion',
] as const satisfies readonly Role[]

export const FOCUSED_HELP_ROLE_ORDER = [
  'percival',
  'morgana',
  'merlin',
  'loyal_servant',
  'assassin',
  'minion',
] as const satisfies readonly Role[]

export const HELP_FLOW_STEPS = [
  {
    detail: '队长选择规定人数的玩家组成任务队伍。',
    title: '组建队伍',
  },
  {
    detail: '所有玩家秘密投票；赞成票严格过半，队伍才会通过。',
    title: '队伍投票',
  },
  {
    detail: '任务成员秘密出牌；正义只能成功，邪恶可以成功或失败。',
    title: '执行任务',
  },
  {
    detail: '记录任务结果、轮换队长并继续下一轮。',
    title: '任务结算',
  },
] as const

export const HELP_KEY_RULES = [
  '平票视为否决；同一任务连续 5 次队伍提案被否决，邪恶阵营立即获胜。',
  '任务牌会打乱后统一公开，不会显示每张牌由谁提交。',
  '7 人及以上时，第 4 个任务需要至少两张失败牌才会失败。',
  '正义阵营完成三次任务后，刺客仍有一次指认梅林的机会。',
] as const

export function getHelpRoleOrder(focused: boolean): readonly Role[] {
  return focused ? FOCUSED_HELP_ROLE_ORDER : HELP_ROLE_ORDER
}

export function getHelpPlayerRows() {
  return PLAYER_COUNTS.map((playerCount) => ({
    playerCount,
    ...getPlayerCountConfig(playerCount),
  }))
}
