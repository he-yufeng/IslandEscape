import { afterEach, describe, expect, it, vi } from 'vitest'

import { createNewGame, startDay } from '../src/engine/game'

describe('startDay daily events', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bumper crop gives every alive character +2 wheat at dawn', () => {
    // 0.9 lands in the bumper_crop band of rollDailyEvent for day >= 3.
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const game = { ...createNewGame('g1'), day: 3 }
    const wheatBefore = Object.fromEntries(
      Object.entries(game.characters).map(([id, c]) => [id, c.resources.wheat]),
    )

    const next = startDay(game)

    expect(next.dailyEvent).toBe('bumper_crop')
    for (const [id, c] of Object.entries(next.characters)) {
      if (c.alive && !c.escaped) {
        expect(c.resources.wheat).toBe(wheatBefore[id] + 2)
      }
    }
    expect(next.log.some((line) => line.includes('Bumper Crop'))).toBe(true)
  })

  it('lucky catch still gives +2 fish (unchanged sibling event)', () => {
    // 0.85 lands in the lucky_catch band for day >= 3.
    vi.spyOn(Math, 'random').mockReturnValue(0.85)
    const game = { ...createNewGame('g2'), day: 3 }
    const fishBefore = Object.fromEntries(
      Object.entries(game.characters).map(([id, c]) => [id, c.resources.fish]),
    )

    const next = startDay(game)

    expect(next.dailyEvent).toBe('lucky_catch')
    for (const [id, c] of Object.entries(next.characters)) {
      if (c.alive && !c.escaped) {
        expect(c.resources.fish).toBe(fishBefore[id] + 2)
      }
    }
  })
})
