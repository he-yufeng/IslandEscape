import { Container, Graphics } from 'pixi.js'
import type { InputManager } from '../InputManager'
import { PlayerCombat } from './PlayerCombat'
import { Boss } from './Boss'
import { BulletPool } from './Bullet'
import { XPOrbPool } from './XPOrb'

interface FlashEffectData {
  gfx: Graphics
  age: number
  duration: number
  startX: number
  startY: number
  endX: number
  endY: number
}
import {
  createCardSystem,
  addXP,
  levelUp,
  pickRandomCards,
  applyCard,
  computeEffects,
  getXpForNextLevel,
  type CardSystemState,
  type CardDef,
} from './CardSystem'
import { GAME_CONFIG } from '@game/shared'

export type DungeonEventCallback = (event: DungeonEvent) => void

export type DungeonEvent =
  | { type: 'card_pick'; cards: CardDef[] }
  | { type: 'stats_update'; hp: number; maxHp: number; bossHp: number; bossMaxHp: number; xp: number; xpNext: number }
  | { type: 'boss_defeated'; damageDealt: number; damageTaken: number; cardsCollected: number }
  | { type: 'player_died'; damageDealt: number; cardsCollected: number }

const ARENA_W = 640
const ARENA_H = 480

export class DungeonArena extends Container {
  private player!: PlayerCombat
  private boss!: Boss
  private bullets!: BulletPool
  private orbs!: XPOrbPool
  private cardSystem!: CardSystemState
  private eventCallback: DungeonEventCallback | null = null
  private active = false
  private paused = false

  private totalDamageDealt = 0
  private totalDamageTaken = 0
  private arenaGfx: Graphics
  private effectsLayer: Container
  private flashEffects: FlashEffectData[] = []

  constructor() {
    super()
    this.label = 'dungeon-arena'
    this.arenaGfx = new Graphics()
    this.effectsLayer = new Container()
    this.effectsLayer.label = 'flash-effects'
    this.addChild(this.arenaGfx)
    this.addChild(this.effectsLayer)
  }

  onEvent(cb: DungeonEventCallback) {
    this.eventCallback = cb
  }

  private fire(event: DungeonEvent) {
    this.eventCallback?.(event)
  }

  init() {
    this.drawArena()

    this.player = new PlayerCombat(this)
    this.player.onUltimate = () => this.playerUltimate()
    this.player.onFlash = (sx, sy, ex, ey) => this.spawnFlashEffect(sx, sy, ex, ey)
    this.boss = new Boss(this)

    this.boss.onShoot = (angle, count) => this.bossShoot(angle, count)
    this.boss.onChargeEnd = () => {} // handled by collision detection
    this.boss.onXPOrbSpawn = (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const orb = this.orbs.getInactive()
        orb?.spawn(x, y, GAME_CONFIG.XP_PER_ORB)
      }
    }

    this.bullets = new BulletPool(this, ARENA_W, ARENA_H)
    this.orbs = new XPOrbPool(this)
    this.cardSystem = createCardSystem()
    this.active = true
    this.paused = false
    this.totalDamageDealt = 0
    this.totalDamageTaken = 0
  }

  private drawArena() {
    const g = this.arenaGfx
    g.clear()
    // Floor
    g.rect(0, 0, ARENA_W, ARENA_H).fill(0x1a1a2e)
    // Floor tiles
    for (let y = 0; y < ARENA_H; y += 40) {
      for (let x = 0; x < ARENA_W; x += 40) {
        const shade = ((x / 40 + y / 40) % 2 === 0) ? 0x1e1e32 : 0x222238
        g.rect(x, y, 40, 40).fill(shade).stroke({ color: 0x2a2a44, width: 0.5 })
      }
    }
    // Walls
    g.rect(0, 0, ARENA_W, ARENA_H).stroke({ color: 0x444466, width: 6 })
    // Torches (corners)
    this.drawTorch(g, 20, 20)
    this.drawTorch(g, ARENA_W - 20, 20)
    this.drawTorch(g, 20, ARENA_H - 30)
    this.drawTorch(g, ARENA_W - 20, ARENA_H - 30)
  }

  private drawTorch(g: Graphics, x: number, y: number) {
    g.circle(x, y, 6).fill({ color: 0xffaa44, alpha: 0.6 })
    g.circle(x, y, 3).fill(0xffdd88)
    g.circle(x, y, 8).fill({ color: 0xffaa44, alpha: 0.15 })
  }

  spawnFlashEffect(startX: number, startY: number, endX: number, endY: number) {
    const gfx = new Graphics()
    this.effectsLayer.addChild(gfx)
    this.flashEffects.push({ gfx, age: 0, duration: 0.35, startX, startY, endX, endY })
  }

  private updateFlashEffects(ds: number) {
    for (let i = this.flashEffects.length - 1; i >= 0; i--) {
      const fx = this.flashEffects[i]!
      fx.age += ds
      const p = Math.min(1, fx.age / fx.duration)
      if (p >= 1) {
        fx.gfx.destroy()
        this.flashEffects.splice(i, 1)
        continue
      }

      const g = fx.gfx
      g.clear()
      const alpha = 1 - p
      const scale = 1 + p * 2

      // Expanding ring at start
      g.circle(fx.startX, fx.startY, 16 * scale).stroke({ color: 0xffffff, width: 3, alpha: alpha * 0.7 })
      g.circle(fx.startX, fx.startY, 8 * scale).stroke({ color: 0x88ccff, width: 2, alpha: alpha * 0.5 })

      // Dash line from start to end
      g.moveTo(fx.startX, fx.startY)
        .lineTo(fx.endX, fx.endY)
        .stroke({ color: 0x88ccff, width: 4, alpha: alpha * 0.6 })
      g.moveTo(fx.startX, fx.startY)
        .lineTo(fx.endX, fx.endY)
        .stroke({ color: 0xffffff, width: 2, alpha: alpha * 0.9 })

      // Afterimages along the path (3 ghosts)
      for (let ai = 0; ai < 3; ai++) {
        const t = 0.25 + ai * 0.25
        const gx = fx.startX + (fx.endX - fx.startX) * t
        const gy = fx.startY + (fx.endY - fx.startY) * t
        const ga = alpha * (1 - ai * 0.3)
        g.circle(gx, gy, 10).fill({ color: 0x88ccff, alpha: ga * 0.5 })
        g.circle(gx, gy, 6).fill({ color: 0xffffff, alpha: ga * 0.7 })
      }

      // End flash
      g.circle(fx.endX, fx.endY, 20 * scale * 0.6).stroke({ color: 0xffffff, width: 2, alpha: alpha * 0.5 })
    }
  }

  private playerUltimate() {
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      const bullet = this.bullets.getInactive()
      if (bullet) {
        bullet.spawn({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * 350,
          vy: Math.sin(angle) * 350,
          damage: this.player.effects.bulletDamage * 2,
          size: this.player.effects.bulletSize + 4,
          piercing: 2,
          owner: 'player',
        })
      }
    }
  }

  private bossShoot(angle: number, count: number) {
    const spread = 0.3
    const startAngle = angle - (spread * (count - 1)) / 2
    for (let i = 0; i < count; i++) {
      const a = startAngle + spread * i
      const speed = 160 + Math.random() * 40
      const bullet = this.bullets.getInactive()
      if (bullet) {
        bullet.spawn({
          x: this.boss.x,
          y: this.boss.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          damage: GAME_CONFIG.BOSS_BULLET_DAMAGE,
          size: 8,
          piercing: 0,
          owner: 'boss',
        })
      }
    }
  }

  /** Check if the game should pause for card picker */
  shouldPause(): boolean {
    const needed = getXpForNextLevel(this.cardSystem.currentLevel)
    return this.cardSystem.currentXP >= needed && this.active && !this.paused
  }

  /** Trigger card picker */
  triggerCardPick(): CardDef[] {
    const cards = pickRandomCards(this.cardSystem, 3)
    this.paused = true
    this.fire({ type: 'card_pick', cards })
    return cards
  }

  /** Apply selected card and resume */
  applyCardPick(cardId: string) {
    const newLevel = applyCard(this.cardSystem, cardId)

    // Heal card is immediate
    if (cardId === 'heal') {
      this.player.heal(5)
    }

    // Recompute effects
    const effects = computeEffects(this.cardSystem)
    this.player.effects = effects
    this.player.maxHp = effects.maxHp
    this.player.hp = Math.min(this.player.hp, effects.maxHp)

    levelUp(this.cardSystem)
    this.paused = false
  }

  update(dt: number, input: InputManager) {
    if (!this.active || this.paused) { input.clearFrameState(); return }

    const ds = dt * 0.016
    const mousePos = input.getMouseCanvasPosition()
    const mouseX = Math.max(0, Math.min(ARENA_W, mousePos.x))
    const mouseY = Math.max(0, Math.min(ARENA_H, mousePos.y))

    // Update player
    this.player.update(dt, input, mouseX, mouseY)

    // Player shooting
    const now = Date.now()
    if (input.isMouseDown() && this.player.canShoot(now)) {
      this.player.markShot(now)
      const angle = Math.atan2(mouseY - this.player.y, mouseX - this.player.x)
      const effects = this.player.effects

      for (let i = 0; i < effects.bulletCount; i++) {
        const spreadAngle = angle + (i - (effects.bulletCount - 1) / 2) * 0.15
        const bullet = this.bullets.getInactive()
        if (bullet) {
          bullet.spawn({
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(spreadAngle) * effects.bulletSpeed,
            vy: Math.sin(spreadAngle) * effects.bulletSpeed,
            damage: effects.bulletDamage,
            size: effects.bulletSize,
            piercing: effects.piercing,
            owner: 'player',
          })
        }
      }
    }

    // Update boss
    this.boss.update(dt, this.player.x, this.player.y)

    // Update flash effects
    this.updateFlashEffects(ds)

    // Update bullets
    this.bullets.updateAll(dt)

    // Update XP orbs
    this.orbs.updateAll(dt, this.player.x, this.player.y)

    // Check collisions
    this.checkCollisions()

    // Check XP collected from orbs
    for (const orb of this.orbs.getActive()) {
      const dx = this.player.x - orb.x
      const dy = this.player.y - orb.y
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        const levelUpTriggered = addXP(this.cardSystem, orb.value)
        orb.despawn()
        if (levelUpTriggered) {
          this.triggerCardPick()
          return
        }
      }
    }

    // Emit stats update
    const xpNeeded = getXpForNextLevel(this.cardSystem.currentLevel)
    this.fire({
      type: 'stats_update',
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      bossHp: this.boss.hp,
      bossMaxHp: this.boss.maxHp,
      xp: this.cardSystem.currentXP,
      xpNext: xpNeeded,
    })

    // Check win/lose
    if (this.boss.hp <= 0) {
      this.active = false
      this.fire({
        type: 'boss_defeated',
        damageDealt: this.totalDamageDealt,
        damageTaken: this.totalDamageTaken,
        cardsCollected: this.cardSystem.currentLevel,
      })
    }
    if (this.player.hp <= 0) {
      this.active = false
      this.fire({
        type: 'player_died',
        damageDealt: this.totalDamageDealt,
        cardsCollected: this.cardSystem.currentLevel,
      })
    }

    input.clearFrameState()
  }

  private checkCollisions() {
    const pr = this.player.getRadius()
    const br = this.boss.radius

    // Player bullets vs boss
    for (const b of this.bullets.getActive()) {
      if (b.owner !== 'player') continue
      const dx = this.boss.x - b.x
      const dy = this.boss.y - b.y
      if (Math.sqrt(dx * dx + dy * dy) < br + b.size) {
        this.boss.takeDamage(b.damage)
        this.totalDamageDealt += b.damage
        if (b.piercing > 0) {
          b.piercing--
        } else {
          b.despawn()
        }
      }
    }

    // Boss bullets vs player
    for (const b of this.bullets.getActive()) {
      if (b.owner !== 'boss') continue
      const dx = this.player.x - b.x
      const dy = this.player.y - b.y
      if (Math.sqrt(dx * dx + dy * dy) < pr + b.size) {
        const hit = this.player.takeDamage(b.damage)
        if (hit) {
          this.totalDamageTaken += b.damage
        }
        b.despawn()
      }
    }

    // Boss charge collision with player
    if (this.boss.isCharging()) {
      const dx = this.player.x - this.boss.x
      const dy = this.player.y - this.boss.y
      if (Math.sqrt(dx * dx + dy * dy) < pr + br) {
        const hit = this.player.takeDamage(this.boss.getChargeDamage())
        if (hit) {
          this.totalDamageTaken += this.boss.getChargeDamage()
        }
      }
    }
  }

  isActive(): boolean { return this.active }
  isPaused(): boolean { return this.paused }
  getCardSystem(): CardSystemState { return this.cardSystem }

  destroyArena() {
    this.active = false
    this.player?.destroy()
    this.boss?.destroy()
    this.bullets?.destroyAll()
    this.orbs?.destroyAll()
  }
}
