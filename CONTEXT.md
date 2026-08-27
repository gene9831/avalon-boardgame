# Avalon Online Game Context

This context defines the shared language for the online version of The Resistance: Avalon. It describes the game concepts and avoids implementation-specific names unless they are part of the domain language.

## Rooms and players

**Room**: One independently playable Avalon game for 5–10 players. A room has its own seats, role assignment, phase, history, and result.
_Avoid_: shared game, lobby game

**Room directory**: The public, non-authoritative collection of discoverable room summaries. It contains room status and public seat information, but never credentials or hidden game state.
_Avoid_: Lobby match list, complete room state

**Room detail**: The public, non-authoritative description of one room used to enter or reconnect to it. It contains only required room, seat, and public player profile data; it excludes client IDs, seat credentials, unknown metadata, and hidden game state.
_Avoid_: match metadata, complete match data

**Seat**: A stable position in a room, identified by a seat number and occupied by at most one player at a time.
_Avoid_: slot, account

**Seat credential**: A secret bound to one room and seat that proves authority to reconnect to or act for that seat. Public client IDs and session IDs are not seat credentials.
_Avoid_: player credential, playerCredentials

**Player**: The person occupying a seat in a room. A player is not an account; reconnecting uses the credentials bound to the seat.
_Avoid_: user, member

**Room creator**: The player in seat 0 who may start the room after all seats are occupied. This role has no ongoing administrative authority after the game starts.
_Avoid_: host admin, administrator

## Roles and loyalty

**Role**: A character identity assigned to one player, such as Merlin, Assassin, Loyal Servant of Arthur, or Minion of Mordred.
_Avoid_: class, character type

**Loyalty**: A player's faction, either Good or Evil. Loyalty is distinct from the exact role.
_Avoid_: team, side

**Role visibility**: The information a player is allowed to know about roles and loyalties. A player always knows their own role; Merlin and Evil players receive the limited faction information defined by the MVP rules.
_Avoid_: permissions, role access

**Identity recognition**: The opening ceremony in which players privately learn their own role, Evil players recognize one another, and Merlin recognizes Evil seats before the first team proposal.
_Avoid_: night phase, role reveal phase

**Recognition step**: One ordered part of identity recognition: role reveal, Evil recognition, or Merlin recognition. Only that step's participants may view and confirm its private information.
_Avoid_: recognition round, night action

**Identity confirmation**: A participant's acknowledgement that they have finished viewing the current recognition step. It is not a game decision and carries no strategic choice.
_Avoid_: identity vote, ready vote

## Game flow

**Quest team**: The players selected by the current leader to attempt the current quest.
_Avoid_: party, squad, team

**Team proposal**: The leader's current selection of players for a quest team, before the room votes on it.
_Avoid_: assignment, roster

**Team vote**: Each player's simultaneous approval or rejection of the current team proposal. A strict majority approves; a tie rejects.
_Avoid_: room vote, team approval

**Quest card**: A secret Success or Fail choice submitted by a member of the quest team. Good players must submit Success; Evil players may submit either result.
_Avoid_: mission card, action card

**Quest result**: The public outcome of a completed quest, including its team, the number of Success and Fail cards, and whether the quest succeeded.
_Avoid_: round result

**Rejection streak**: The number of consecutive team proposals rejected while attempting the same quest. Five consecutive rejections immediately give Evil the victory.
_Avoid_: vote counter, reject count

**Assassination**: The final phase entered after Good completes three quests, in which Assassin identifies a Good player as Merlin.
_Avoid_: final vote, execution

**Settled event**: A completed vote, quest, or victory decision that must not be changed by diagnostics or reconnection handling.
_Avoid_: committed event, final action

**Debug mode**: A read-only diagnostic view in the web page. It exposes connection and public game diagnostics, but it is not a game authority and never reveals the complete secret state.
_Avoid_: admin mode, operator mode
