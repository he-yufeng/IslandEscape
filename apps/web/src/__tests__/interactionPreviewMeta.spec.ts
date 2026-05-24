import { describe, expect, it } from 'vitest'

import { getInteractionPreviewKey, getInteractionPreviewMeta } from '@/render3d/interactionPreviewMeta'

describe('interaction preview metadata', () => {
  it('returns the default preview state', () => {
    expect(getInteractionPreviewKey(null)).toBe('default')
    expect(getInteractionPreviewMeta(null).title).toBe('Coastal Watch')
  })

  it('maps direct resource interactions', () => {
    expect(getInteractionPreviewKey({ kind: 'fish' })).toBe('fish')
    expect(getInteractionPreviewMeta({ kind: 'farm' }).title).toBe('Farmland')
    expect(getInteractionPreviewMeta({ kind: 'merchant' }).title).toBe('Merchant Ship')
  })

  it('includes npc identity in the preview key and label', () => {
    const interaction = { kind: 'npc', characterId: 'tom', characterName: 'Tom' } as const

    expect(getInteractionPreviewKey(interaction)).toBe('npc:tom')
    expect(getInteractionPreviewMeta(interaction).title).toBe('Tom')
  })
})
