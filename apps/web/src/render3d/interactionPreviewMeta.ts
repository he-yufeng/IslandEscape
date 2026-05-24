import type { InteractionType } from '@/game/GameWorld'

export interface InteractionPreviewMeta {
  title: string
  subtitle: string
}

export function getInteractionPreviewKey(interaction: InteractionType): string {
  if (!interaction) return 'default'
  if (interaction.kind === 'npc') return `npc:${interaction.characterId}`
  return interaction.kind
}

export function getInteractionPreviewMeta(interaction: InteractionType): InteractionPreviewMeta {
  if (!interaction) {
    return {
      title: 'Coastal Watch',
      subtitle: 'Move near a resource, trader, or islander to inspect it here.',
    }
  }

  switch (interaction.kind) {
    case 'fish':
      return {
        title: 'Fishing Waters',
        subtitle: 'A fresh catch keeps the island nights manageable.',
      }
    case 'farm':
      return {
        title: 'Farmland',
        subtitle: 'Plant now, harvest later. Wheat is the slower safety net.',
      }
    case 'merchant':
      return {
        title: 'Merchant Ship',
        subtitle: 'Today only. Convert surplus goods into escape money.',
      }
    case 'npc':
      return {
        title: interaction.characterName,
        subtitle: 'Close enough to negotiate, trade, or test their patience.',
      }
  }
}
