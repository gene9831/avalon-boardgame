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

**Initial seat assignment**: The binding of a newly joining player to the lowest-numbered unoccupied seat at that moment. Reconnection resumes the player's existing seat instead of assigning a new one.
_Avoid_: initial seat selection, slot selection

**Seat change**: A player's immediate movement from their current seat to an unoccupied seat while the room is waiting to start. The player retains their identity and any room ownership through the move.
_Avoid_: leave and rejoin, player replacement

**Seat credential**: A secret bound to one room and seat that proves authority to reconnect to or act for that seat. Public client IDs and session IDs are not seat credentials.
_Avoid_: player credential, playerCredentials

**Player**: The person occupying a seat in a room. A player is not an account; reconnecting uses the credentials bound to the seat.
_Avoid_: user, member

**Room owner**: The player who creates a room and may start or dissolve it while the room is waiting. Ownership belongs to that player rather than to a seat and follows the player through a seat change; it grants no authority to alter an active game.
_Avoid_: seat 0, host admin, administrator

## Roles and loyalty

**Role**: A character identity assigned to one player, such as Merlin, Percival, Assassin, Morgana, Loyal Servant of Arthur, or Minion of Mordred.
_Avoid_: class, character type

**Role configuration**: The public, creation-time selection of optional roles for a room. It is fixed for that room so every player enters under the same known rules.
_Avoid_: secret role settings, runtime role toggle

**Role card**: The complete presentation of a role's artwork, name, loyalty, ability, and objective during opening identity recognition. Ordinary play may privately reveal only the current player's role avatar and role name; final role revelation remains a separate public result.
_Avoid_: avatar, profile card, nameplate

**Loyalty**: A player's faction, either Good or Evil. Loyalty is distinct from the exact role.
_Avoid_: team, side

**Role visibility**: The information a player is allowed to know about roles and loyalties. A player always knows their own role; Merlin, Percival, and Evil players receive the limited information defined by the room's role configuration.
_Avoid_: permissions, role access

**Merlin candidate**: A seat that Percival knows belongs to either Merlin or Morgana without knowing which role it holds. When both roles are present, their candidate status is indistinguishable.
_Avoid_: known Merlin, suspected Evil

**Identity recognition**: The opening ceremony in which players privately learn their own role, Evil players recognize one another, Merlin recognizes Evil seats, and Percival recognizes Merlin candidates before the first team proposal.
_Avoid_: night phase, role reveal phase

**Recognition step**: One ordered part of identity recognition: role reveal, Evil recognition, Merlin recognition, or Percival recognition. Only that step's participants may view and confirm its private information; steps without a participating role are skipped.
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

**Pending team vote**: The current team vote before every player has submitted. Each player's approval or rejection remains secret, even though submission status may be public.
_Avoid_: partial vote result, live vote tally

**Vote submission status**: The public fact that a player has submitted their team vote, without revealing whether they approved or rejected.
_Avoid_: pending vote, partial vote

**Resolved team vote**: A settled team vote whose complete player-to-vote mapping and approval outcome are public and immutable.
_Avoid_: vote summary, current vote

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

## Room interface layout

**Horizontal room layout**: A room arrangement selected from available geometry rather than from a device category. Its normal mode uses one full-width top bar above a round-table stage and phase sidebar; its low-height compact mode uses a left task rail, round-table stage, and phase sidebar in one row.
_Avoid_: PC layout, desktop layout

**Compact horizontal layout**: The low-height mode of the horizontal room layout. It replaces the top bar with a left task rail so the round-table stage can use the full available height.
_Avoid_: mobile landscape layout, phone layout

**Vertical room layout**: A three-band room arrangement preferred when the usable geometry is taller than it is wide, and also available as a feasibility fallback when the horizontal arrangement cannot fit. It places a combined room-and-quest top bar, round-table stage, and fixed phase panel in three stacked bands.
_Avoid_: mobile layout, phone layout, portrait device layout

**Task rail**: The compact horizontal layout region containing the return action and vertically grouped quest progress nodes.
_Avoid_: compact top bar, task sidebar

**Round-table stage**: The hard available rectangle allocated by the room shell for the public table scene after top bars, task rails, phase controls, safe-area insets, and exterior stage spacing have been handled. Its local coordinate origin is the top-left corner, and the complete round-table footprint must remain inside it.
_Avoid_: game area, table

**Round-table footprint**: The stable union of the tabletop and all player-seat bounds for the selected seat presentation tier. Player-seat bounds include avatar-top clearance, portraits, and names; status marks are derived from avatar geometry and must remain within that stable space. Layout constraints and stage centering apply to this footprint rather than only to the tabletop, and ordinary game-state changes do not resize it.
_Avoid_: table diameter, tabletop bounds

**Round-table layout frame**: The nominal coordinate region used to size the tabletop and place player-seat centers. It is square for a circular player orbit and elongated along the straight segment for a stadium-shaped orbit; it remains smaller than the complete round-table footprint.
_Avoid_: round-table footprint, table bounds

**Tabletop**: The visible table surface inside the round-table layout frame. It follows the selected circular or stadium shape and does not include player portraits, names, or status marks.
_Avoid_: round table, round-table footprint

**Player orbit**: The viewer-relative circular or stadium-shaped path on which avatar centers are placed. Its shape is selected from the available round-table-stage geometry rather than fixed by viewport orientation. Stadium seats may depart from equal arc spacing so their actual seat boundaries keep the required visual gap. The current player's seat occupies the bottom position and the remaining seats follow room seat order clockwise.
_Avoid_: seat ring, absolute seat positions

**Phase sidebar**: The horizontal room layout region that presents the current phase's instructions and primary actions. Its layout reserves the maximum primary-action budget across supported phases, while lower-priority public history uses only the remaining space, so phase changes do not switch the room layout.
_Avoid_: fixed device sidebar, activity drawer

**Fixed phase panel**: The bottom region of the vertical room layout that presents the current phase's summary, tools, and primary action. Its three content rows have fixed heights, with separate bottom safe-area clearance, and remain unchanged by ordinary phase content.
_Avoid_: phase drawer, bottom sheet, mobile action panel

**Seat presentation tier**: One discrete, geometry-selected set of portrait, name, status-mark, spacing, and interaction-target sizes used by every player seat. It is selected from available round-table geometry rather than from a device category.
_Avoid_: mobile seat, desktop seat, continuously scaled seat

**Player seat bounds**: The stable square boundary reserved for one player seat at a selected presentation tier. It includes the avatar, name, interaction target, and crown-top reserve, while excluding dynamic status marks; ordinary game-state changes therefore never move the layout.
_Avoid_: current seat contents, portrait bounds

**Player boundary circle**: The mathematical collision boundary centered on a player's avatar, with radius equal to the avatar diameter. Player names and other business presentation may extend outside this circle; the surrounding player-seat bounds remain the positioning box for those elements.
_Avoid_: avatar circle, player-seat bounds

**Player seat gap**: The minimum Euclidean shortest boundary distance between any two player boundary circles. The round-table-stage caller supplies it, with 8 logical pixels as the default for every presentation tier.
_Avoid_: center-to-center gap, equal arc spacing

**Center protection circle**: The circular exclusion zone concentric with the tabletop. The business round-table solver fixes the combined center-content-and-boundary radius at 80 logical pixels and passes it directly to the mathematical player-layout model.
_Avoid_: center-panel margin, derived center padding
