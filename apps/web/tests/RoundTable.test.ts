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
})
