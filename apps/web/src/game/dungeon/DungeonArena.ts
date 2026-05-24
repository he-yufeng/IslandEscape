import { Container, Graphics } from 'pixi.js'
import type { InputManager } from '../InputManager'
import { PlayerCombat } from './PlayerCombat'
import { Boss } from './Boss'
import { BulletPool } from './Bullet'
import { XPOrbPool } from './XPOrb'
import {
  ScreenShaker,
  HitSparkPool,
  DamageNumberPool,
  VignetteOverlay,
  GroundStrikePool,
} from './Effects'

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

  // Feedback pools
  private shaker = new ScreenShaker()
  private hitSparks!: HitSparkPool
  private damageNumbers!: DamageNumberPool
  private vignette!: VignetteOverlay
  private strikes!: GroundStrikePool

  // Player progression bookkeeping
  private lifestealHitCount = 0
  private bossDeathPending = false

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
    this.player.onUltimate = () => {
      this.playerUltimate()
      this.shaker.trigger(8, 0.3)
    }
    this.player.onFlash = (sx, sy, ex, ey) => this.spawnFlashEffect(sx, sy, ex, ey)
    this.boss = new Boss(this)

    this.boss.onShoot = (angle, count, speedMul) => this.bossShoot(angle, count, speedMul)
    this.boss.onChargeEnd = () => {} // handled by collision detection
    this.boss.onXPOrbSpawn = (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const orb = this.orbs.getInactive()
        orb?.spawn(x, y, GAME_CONFIG.XP_PER_ORB)
      }
    }
    this.boss.onSummon = (x, y) => {
      // Spawn 3 strikes around the captured player position
      this.strikes.spawn(x, y, { radius: 30, damage: 2, telegraph: 0.9 })
      this.strikes.spawn(x + 50, y - 30, { radius: 26, damage: 2, telegraph: 1.0 })
      this.strikes.spawn(x - 50, y + 20, { radius: 26, damage: 2, telegraph: 1.0 })
    }
    this.boss.onDeathComplete = () => {
      this.bossDeathPending = false
      this.fire({
        type: 'boss_defeated',
        damageDealt: this.totalDamageDealt,
        damageTaken: this.totalDamageTaken,
        cardsCollected: this.cardSystem.currentLevel,
      })
    }

    this.bullets = new BulletPool(this, ARENA_W, ARENA_H)
    this.orbs = new XPOrbPool(this)
    this.cardSystem = createCardSystem()

    // Feedback layers (built after main entities so they render on top)
    this.hitSparks = new HitSparkPool(this.effectsLayer)
    this.strikes = new GroundStrikePool(this.effectsLayer)
    this.damageNumbers = new DamageNumberPool(this.effectsLayer)
    this.vignette = new VignetteOverlay(this.effectsLayer, ARENA_W, ARENA_H)

    this.active = true
    this.paused = false
    this.totalDamageDealt = 0
    this.totalDamageTaken = 0
    this.lifestealHitCount = 0
    this.bossDeathPending = false
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

  private bossShoot(angle: number, count: number, speedMul = 1) {
    const spread = 0.3
    const startAngle = angle - (spread * (count - 1)) / 2
    for (let i = 0; i < count; i++) {
      const a = startAngle + spread * i
      const speed = (160 + Math.random() * 40) * speedMul
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
    applyCard(this.cardSystem, cardId)

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
    if (!this.active || this.paused) {
      // Even when paused, drift the shake offset back toward zero
      const o = this.shaker.update(dt * 0.016)
      this.position.set(o.x, o.y)
      input.clearFrameState()
      return
    }

    const ds = dt * 0.016
    const mousePos = input.getMouseCanvasPosition()
    const mouseX = Math.max(0, Math.min(ARENA_W, mousePos.x))
    const mouseY = Math.max(0, Math.min(ARENA_H, mousePos.y))

    // Update player — keep rendering during boss death, but shooting/damage are gated below
    this.player.update(dt, input, mouseX, mouseY)

    // Player shooting (disabled during boss death animation)
    const now = Date.now()
    if (
      !this.boss.isDying() && !this.boss.isDead() &&
      input.isMouseDown() && this.player.canShoot(now)
    ) {
      this.player.markShot(now)
      const angle = Math.atan2(mouseY - this.player.y, mouseX - this.player.x)
      const effects = this.player.effects

      for (let i = 0; i < effects.bulletCount; i++) {
        const spreadAngle = angle + (i - (effects.bulletCount - 1) / 2) * 0.15
        const isCrit = Math.random() < (effects.critChance ?? 0)
        const bullet = this.bullets.getInactive()
        if (bullet) {
          bullet.spawn({
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(spreadAngle) * effects.bulletSpeed,
            vy: Math.sin(spreadAngle) * effects.bulletSpeed,
            damage: effects.bulletDamage * (isCrit ? 2 : 1),
            size: effects.bulletSize,
            piercing: effects.piercing,
            owner: 'player',
            bounces: effects.bounces,
            isCrit,
          })
        }
      }
    }

    // Update boss (it manages its own dying/dead state)
    this.boss.update(dt, this.player.x, this.player.y)

    // Update flash effects
    this.updateFlashEffects(ds)

    // Update bullets
    this.bullets.updateAll(dt)

    // Update XP orbs
    this.orbs.updateAll(dt, this.player.x, this.player.y)

    // Update feedback pools
    this.hitSparks.update(ds)
    this.damageNumbers.update(ds)
    this.vignette.update(ds)

    // Update ground strikes & apply AOE damage to player
    const fired = this.strikes.update(ds)
    for (const f of fired) {
      const dx = this.player.x - f.x
      const dy = this.player.y - f.y
      if (Math.sqrt(dx * dx + dy * dy) < f.radius + this.player.getRadius()) {
        const hit = this.player.takeDamage(f.damage)
        if (hit) {
          this.totalDamageTaken += f.damage
          this.onPlayerHurt(f.damage)
        }
      }
    }

    // Check collisions (skip if boss is dying — bullets keep flying but no damage)
    if (!this.boss.isDying() && !this.boss.isDead()) {
      this.checkCollisions()
    }

    // Check XP collected from orbs
    for (const orb of this.orbs.getActive()) {
      const dx = this.player.x - orb.x
      const dy = this.player.y - orb.y
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        const gained = orb.value
        const levelUpTriggered = addXP(this.cardSystem, gained)
        this.damageNumbers.spawn(this.player.x, this.player.y - 14, `+${gained}`, 0x44ff66, { fontSize: 11 })
        orb.despawn()
        if (levelUpTriggered) {
          this.triggerCardPick()
          // Reset shake before pause
          this.position.set(0, 0)
          return
        }
      }
    }

    // Apply screen shake
    const offset = this.shaker.update(ds)
    this.position.set(offset.x, offset.y)

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

    // Win — boss death animation manages firing the event via onDeathComplete
    if (this.boss.hp <= 0 && !this.bossDeathPending && this.boss.isDying()) {
      this.bossDeathPending = true
      this.shaker.trigger(12, 0.5)
    }
    if (this.boss.isDead()) {
      this.active = false
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

  private onPlayerHurt(_amount: number) {
    this.shaker.trigger(6, 0.25)
    this.vignette.trigger(0.4, 0.45)
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

        // Hit feedback
        this.hitSparks.burst(b.x, b.y, b.vx, b.vy, b.isCrit ? 0xffaa22 : 0xffdd66, b.isCrit ? 10 : 6)
        this.damageNumbers.spawn(
          this.boss.x + (Math.random() - 0.5) * 20,
          this.boss.y - this.boss.radius,
          b.isCrit ? `${b.damage}!` : String(b.damage),
          b.isCrit ? 0xffd54a : 0xffffff,
          { fontSize: b.isCrit ? 18 : 14 },
        )

        // Lifesteal
        const required = this.player.effects.lifestealHits ?? 0
        if (required > 0) {
          this.lifestealHitCount++
          if (this.lifestealHitCount >= required) {
            this.lifestealHitCount = 0
            this.player.heal(1)
            this.damageNumbers.spawn(this.player.x, this.player.y - 12, '+1', 0xff7777, { fontSize: 12 })
          }
        }

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
          this.damageNumbers.spawn(this.player.x, this.player.y - 14, String(b.damage), 0xff6666, { fontSize: 13 })
          this.onPlayerHurt(b.damage)
        }
        b.despawn()
      }
    }

    // Boss charge collision with player
    if (this.boss.isCharging()) {
      const dx = this.player.x - this.boss.x
      const dy = this.player.y - this.boss.y
      if (Math.sqrt(dx * dx + dy * dy) < pr + br) {
        const dmg = this.boss.getChargeDamage()
        const hit = this.player.takeDamage(dmg)
        if (hit) {
          this.totalDamageTaken += dmg
          this.damageNumbers.spawn(this.player.x, this.player.y - 14, String(dmg), 0xff5555, { fontSize: 16 })
          this.shaker.trigger(10, 0.35)
          this.vignette.trigger(0.5, 0.6)
        }
      }
    }
  }

  isActive(): boolean { return this.active }
  isPaused(): boolean { return this.paused }
  getCardSystem(): CardSystemState { return this.cardSystem }

  destroyArena() {
    this.active = false
    this.position.set(0, 0)
    this.player?.destroy()
    this.boss?.destroy()
    this.bullets?.destroyAll()
    this.orbs?.destroyAll()
    this.hitSparks?.destroy()
    this.damageNumbers?.destroy()
    this.vignette?.destroy()
    this.strikes?.destroy()
    // Clear lingering flash effects
    for (const fx of this.flashEffects) fx.gfx.destroy()
    this.flashEffects = []
  }
}
