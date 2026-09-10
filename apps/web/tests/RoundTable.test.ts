import { describe, expect, it } from 'vitest'

import { buildRoundTableSeats } from '../src/RoundTable'

describe('round table seats', () => {
  it('carries each occupied player cosmetic avatar with a legacy fallback', () => {
    const seats = buildRoundTableSeats([
      {
        id: 0,
        name: 'Arthur',
        isConnected: true,
        data: { avatarID: 'percival' },
      },
      {
        id: 1,
        name: 'Arthur',
        isConnected: true,
      },
    ], 5, '0')

    expect(seats[0]).toMatchObject({
      avatarID: 'percival',
      name: 'Arthur',
      seatNumber: 1,
    })
    expect(seats[1]).toMatchObject({
      avatarID: 'loyal-servant',
      name: 'Arthur',
      seatNumber: 2,
    })
  })

  it('numbers seats relative to the current player for solver geometry', () => {
    const seats = buildRoundTableSeats([], 5, '3')

    expect(seats.map(({ playerID, relativeSeatIndex }) => ({ playerID, relativeSeatIndex }))).toEqual([
      { playerID: '0', relativeSeatIndex: 2 },
      { playerID: '1', relativeSeatIndex: 3 },
      { playerID: '2', relativeSeatIndex: 4 },
      { playerID: '3', relativeSeatIndex: 0 },
      { playerID: '4', relativeSeatIndex: 1 },
    ])
  })
})
