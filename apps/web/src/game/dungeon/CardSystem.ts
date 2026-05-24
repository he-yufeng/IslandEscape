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
  { id: 'bullet_bounce', name: 'Ricochet', description: 'Bullets bounce off walls', type: 'weapon', maxLevel: 2, icon: '🎯' },
  { id: 'crit_chance', name: 'Sharpshooter', description: '+10% crit chance (2× damage)', type: 'weapon', maxLevel: 5, icon: '🎲' },
  { id: 'explosive', name: 'Explosive Shot', description: 'Bullets explode on impact, AOE damage', type: 'weapon', maxLevel: 3, icon: '💥' },
  { id: 'speed_up', name: 'Speed Up', description: '+15% move speed', type: 'buff', maxLevel: 5, icon: '👟' },
  { id: 'max_hp', name: 'Vitality', description: '+3 max HP', type: 'buff', maxLevel: 5, icon: '❤️' },
  { id: 'heal', name: 'Heal', description: 'Restore 5 HP', type: 'buff', maxLevel: 1, icon: '💚' },
  { id: 'damage_up', name: 'Power Up', description: '+1 bullet damage', type: 'buff', maxLevel: 5, icon: '⚡' },
  { id: 'lifesteal', name: 'Vampirism', description: 'Heal 1 HP every 8 hits', type: 'buff', maxLevel: 3, icon: '🩸' },
  { id: 'flash_cd', name: 'Swift Step', description: '-15% flash cooldown', type: 'buff', maxLevel: 3, icon: '⚡' },
  { id: 'magnet', name: 'Magnetism', description: '+50% XP orb pickup range', type: 'buff', maxLevel: 3, icon: '🧲' },
  { id: 'regen', name: 'Regeneration', description: '+0.5 HP regen per second', type: 'buff', maxLevel: 3, icon: '🌿' },
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
  const thresholds = [60, 130, 220, 330, 460, 610, 780]
  return thresholds[Math.min(currentLevel, thresholds.length - 1)] ?? 780
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
  bounces: number
  critChance: number
  flashCooldownMul: number
  lifestealHits: number
  /** Each level adds explosion radius. 0 means no explosion. */
  explosionRadius: number
  /** Bullet damage dealt by explosion (% of bullet damage). */
  explosionDamageMul: number
  /** Multiplier on the XP orb magnet pull range. */
  magnetRange: number
  /** HP regenerated per second while in dungeon. */
  hpRegenPerSec: number
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
    bounces: 0,
    critChance: 0,
    flashCooldownMul: 1,
    lifestealHits: 0,
    explosionRadius: 0,
    explosionDamageMul: 0.5,
    magnetRange: 1,
    hpRegenPerSec: 0,
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
      case 'bullet_bounce':
        effects.bounces += level
        break
      case 'crit_chance':
        effects.critChance += level * 0.1
        break
      case 'flash_cd':
        effects.flashCooldownMul *= Math.pow(0.85, level)
        break
      case 'lifesteal':
        // Lower hit-count requirement at higher levels (8 -> 6 -> 5 -> 4)
        effects.lifestealHits = level === 0 ? 0 : Math.max(4, 10 - level * 2)
        break
      case 'explosive':
        // L1 = 24 px, L2 = 32, L3 = 40 — small but meaningful AOE
        effects.explosionRadius = 16 + level * 8
        effects.explosionDamageMul = 0.4 + level * 0.1
        break
      case 'magnet':
        effects.magnetRange = 1 + level * 0.5
        break
      case 'regen':
        effects.hpRegenPerSec = level * 0.5
        break
      case 'heal':
        // Heal is applied immediately, not computed
        break
    }
  }

  return effects
}
