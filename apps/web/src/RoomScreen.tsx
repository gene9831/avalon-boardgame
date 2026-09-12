import { RoomAssassinationScene } from './RoomAssassinationScene'
import { RoomGameResultScene } from './RoomGameResultScene'
import { RoomIdentityConfirmationScene } from './RoomIdentityConfirmationScene'
import { RoomIdentityRecognitionScene } from './RoomIdentityRecognitionScene'
import { RoomLoadingScene } from './RoomLoadingScene'
import { RoomLobbyScene } from './RoomLobbyScene'
import { RoomQuestScene } from './RoomQuestScene'
import { RoomTeamProposalScene } from './RoomTeamProposalScene'
import { RoomTeamVoteScene } from './RoomTeamVoteScene'
import type { RoomScene, RoomScreenProps } from './room-screen-props'

function assertNever(value: never): never {
  throw new Error(`Unhandled room scene: ${String(value)}`)
}

function hasSceneKind<Kind extends RoomScene['kind']>(
  props: RoomScreenProps,
  kind: Kind,
): props is Extract<RoomScreenProps, Readonly<{ scene: Readonly<{ kind: Kind }> }>> {
  return props.scene.kind === kind
}

/** Pure, exhaustive renderer for the public room scene contract. */
export function RoomScreen(props: RoomScreenProps) {
  switch (props.scene.kind) {
    case 'loading':
      if (hasSceneKind(props, 'loading')) return <RoomLoadingScene {...props} />
      throw new Error('Room scene binding did not match loading')
    case 'connectionRecovery':
      if (hasSceneKind(props, 'connectionRecovery')) return <RoomLoadingScene {...props} />
      throw new Error('Room scene binding did not match connectionRecovery')
    case 'lobby':
      if (hasSceneKind(props, 'lobby')) return <RoomLobbyScene {...props} />
      throw new Error('Room scene binding did not match lobby')
    case 'identityConfirmation':
      if (hasSceneKind(props, 'identityConfirmation')) return <RoomIdentityConfirmationScene {...props} />
      throw new Error('Room scene binding did not match identityConfirmation')
    case 'identityRecognition':
      if (hasSceneKind(props, 'identityRecognition')) return <RoomIdentityRecognitionScene {...props} />
      throw new Error('Room scene binding did not match identityRecognition')
    case 'teamProposal':
      if (hasSceneKind(props, 'teamProposal')) return <RoomTeamProposalScene {...props} />
      throw new Error('Room scene binding did not match teamProposal')
    case 'teamVote':
      if (hasSceneKind(props, 'teamVote')) return <RoomTeamVoteScene {...props} />
      throw new Error('Room scene binding did not match teamVote')
    case 'quest':
      if (hasSceneKind(props, 'quest')) return <RoomQuestScene {...props} />
      throw new Error('Room scene binding did not match quest')
    case 'assassination':
      if (hasSceneKind(props, 'assassination')) return <RoomAssassinationScene {...props} />
      throw new Error('Room scene binding did not match assassination')
    case 'gameResult':
      if (hasSceneKind(props, 'gameResult')) return <RoomGameResultScene {...props} />
      throw new Error('Room scene binding did not match gameResult')
    default:
      return assertNever(props.scene)
  }
}
