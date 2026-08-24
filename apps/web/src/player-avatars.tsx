import assassinAvatar from './assets/avatars/assassin.png'
import loyalServantAvatar from './assets/avatars/loyal-servant.png'
import merlinAvatar from './assets/avatars/merlin.png'
import minionAvatar from './assets/avatars/minion-of-mordred.png'
import mordredAvatar from './assets/avatars/mordred.png'
import morganaAvatar from './assets/avatars/morgana.png'
import oberonAvatar from './assets/avatars/oberon.png'
import percivalAvatar from './assets/avatars/percival.png'
import type { PlayerAvatarID } from './player-profile'

const PLAYER_AVATARS: Record<PlayerAvatarID, string> = {
  assassin: assassinAvatar,
  'loyal-servant': loyalServantAvatar,
  merlin: merlinAvatar,
  'minion-of-mordred': minionAvatar,
  mordred: mordredAvatar,
  morgana: morganaAvatar,
  oberon: oberonAvatar,
  percival: percivalAvatar,
}

export function PlayerAvatar({
  avatarID,
  className = '',
}: {
  avatarID: PlayerAvatarID
  className?: string
}) {
  return (
    <img
      alt=""
      className={className}
      data-player-avatar={avatarID}
      draggable={false}
      src={PLAYER_AVATARS[avatarID]}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
