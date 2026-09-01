import type { Role } from '@avalon/game'

export interface RoleGuidance {
  ability: string
  beginnerTip: string
  objective: string
}

export const ROLE_GUIDANCE: Record<Role, RoleGuidance> = {
  assassin: {
    ability: '你属于邪恶阵营，可在任务中选择成功或失败。正义完成三次任务后，由你刺杀梅林。',
    beginnerTip: '观察谁在关键组队中表现得最了解邪恶阵营。',
    objective: '破坏三次任务，或在最后准确找出梅林。',
  },
  loyal_servant: {
    ability: '你没有额外身份视野。参加任务时只能提交成功。',
    beginnerTip: '结合发言、组队和投票判断阵营，不要依赖额外视野。',
    objective: '帮助正义阵营完成三次任务，并保护梅林不被刺客识破。',
  },
  merlin: {
    ability: '你会在辨认阶段看到全部邪恶阵营座位，但不会知道谁是刺客或爪牙。',
    beginnerTip: '引导队伍时保持克制，过于准确可能暴露身份。',
    objective: '引导正义完成三次任务，同时隐藏自己，避免被刺客识破。',
  },
  minion: {
    ability: '你属于邪恶阵营，可辨认同伴，并可在任务中选择成功或失败。',
    beginnerTip: '可以用成功牌隐藏自己，并协助刺客判断梅林。',
    objective: '协助邪恶阵营破坏三次任务，并帮助刺客找出梅林。',
  },
  morgana: {
    ability: '你属于邪恶阵营，会在帕西维尔眼中伪装成梅林；你可以辨认邪恶同伴，并可在任务中选择成功或失败。',
    beginnerTip: '让帕西维尔信任你，但不要因此暴露邪恶同伴。',
    objective: '误导帕西维尔，协助邪恶阵营破坏三次任务，并帮助刺客找出梅林。',
  },
  percival: {
    ability: '你会在辨认阶段看到两名梅林候选，但无法分辨谁是梅林、谁是莫甘娜。',
    beginnerTip: '保护两名候选人的信息，不要过早断定谁是真梅林。',
    objective: '帮助正义阵营完成三次任务，并保护真正的梅林不被刺客识破。',
  },
}
