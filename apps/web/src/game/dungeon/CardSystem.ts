export type CardType = 'weapon' | 'buff'

export interface CardDef {
  id: string
  name: string
  description: string
  type: CardType
  maxLevel: number
  icon: string
}

export const ALL_CARDS: CardDef[] = [
  { id: 'multi_shot', name: 'Multi Shot', description: 'Fire +1 bullet in a spread', type: 'weapon', maxLevel: 3, icon: '🔫' },
  { id: 'big_bullet', name: 'Big Bullets', description: '+50% bullet size', type: 'weapon', maxLevel: 3, icon: '💣' },
  { id: 'fast_bullet', name: 'Fast Bullets', description: '+30% bullet speed', type: 'weapon', maxLevel: 3, icon: '💨' },
  { id: 'piercing', name: 'Piercing', description: 'Bullets pierce through boss', type: 'weapon', maxLevel: 3, icon: '🗡️' },
  { id: 'speed_up', name: 'Speed Up', description: '+15% move speed', type: 'buff', maxLevel: 5, icon: '👟' },
  { id: 'max_hp', name: 'Vitality', description: '+3 max HP', type: 'buff', maxLevel: 5, icon: '❤️' },
  { id: 'heal', name: 'Heal', description: 'Restore 5 HP', type: 'buff', maxLevel: 1, icon: '💚' },
  { id: 'damage_up', name: 'Power Up', description: '+1 bullet damage', type: 'buff', maxLevel: 5, icon: '⚡' },
]

export interface PlayerCards {
  [cardId: string]: number // cardId -> current level
}

export interface CardSystemState {
  currentXP: number
  currentLevel: number // how many times cards have been picked
  playerCards: PlayerCards
}

export function createCardSystem(): CardSystemState {
  return {
    currentXP: 0,
    currentLevel: 0,
    playerCards: {},
  }
}

export function getXpForNextLevel(currentLevel: number): number {
  const thresholds = [30, 60, 100, 150, 210, 280, 360]
  return thresholds[Math.min(currentLevel, thresholds.length - 1)] ?? 360
}

export function addXP(state: CardSystemState, xp: number): boolean {
  state.currentXP += xp
  const needed = getXpForNextLevel(state.currentLevel)
  return state.currentXP >= needed
}

export function levelUp(state: CardSystemState) {
  const needed = getXpForNextLevel(state.currentLevel)
  state.currentXP -= needed
  state.currentLevel++
}

export function pickRandomCards(state: CardSystemState, count: number): CardDef[] {
  const available = ALL_CARDS.filter(card => {
    const currentLevel = state.playerCards[card.id] ?? 0
    return currentLevel < card.maxLevel
  })

  // Shuffle and pick
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  const picked = shuffled.slice(0, Math.min(count, shuffled.length))

  // Fill with heal if not enough cards (heal always available until picked)
  if (picked.length < count && !state.playerCards['heal']) {
    const healCard = ALL_CARDS.find(c => c.id === 'heal')!
    if (!picked.find(c => c.id === 'heal')) {
      picked.push(healCard)
    }
  }

  return picked.slice(0, count)
}

export function applyCard(state: CardSystemState, cardId: string): number {
  const currentLevel = state.playerCards[cardId] ?? 0
  const newLevel = currentLevel + 1
  state.playerCards[cardId] = newLevel
  return newLevel
}

export interface CardEffects {
  bulletCount: number
  bulletSize: number
  bulletSpeed: number
  bulletDamage: number
  piercing: number
  moveSpeed: number
  maxHp: number
}

export function computeEffects(state: CardSystemState): CardEffects {
  const effects: CardEffects = {
    bulletCount: 1,
    bulletSize: 6,
    bulletSpeed: 300,
    bulletDamage: 2,
    piercing: 0,
    moveSpeed: 160,
    maxHp: 15,
  }

  for (const [cardId, level] of Object.entries(state.playerCards)) {
    switch (cardId) {
      case 'multi_shot':
        effects.bulletCount += level
        break
      case 'big_bullet':
        effects.bulletSize = Math.round(effects.bulletSize * (1 + level * 0.5))
        break
      case 'fast_bullet':
        effects.bulletSpeed = Math.round(effects.bulletSpeed * (1 + level * 0.3))
        break
      case 'piercing':
        effects.piercing += level
        break
      case 'speed_up':
        effects.moveSpeed = Math.round(effects.moveSpeed * (1 + level * 0.15))
        break
      case 'max_hp':
        effects.maxHp += level * 3
        break
      case 'damage_up':
        effects.bulletDamage += level
        break
      case 'heal':
        // Heal is applied immediately, not computed
        break
    }
  }

  return effects
}
