import { Container, Graphics } from 'pixi.js'
import type { InputManager } from '../InputManager'
import type { CardEffects } from './CardSystem'

const ARENA_W = 640
const ARENA_H = 480
const PLAYER_SIZE = 16
const PLAYER_RADIUS = 12
const INVINCIBILITY_MS = 500
const SHOOT_COOLDOWN_MS = 400
const FLASH_DISTANCE = 80
const FLASH_COOLDOWN = 3.0   // seconds
const FLASH_INVINCIBILITY = 0.15
const ULTIMATE_COOLDOWN = 8.0 // seconds
const ULTIMATE_BULLETS = 12

// Pixel character colors (matching island Character.ts)
const SHIRT_COLOR = 0xdd3333
const SKIN_COLOR = 0xf0c8a0
const HAIR_COLOR = 0x4a3520
const PANTS_COLOR = 0x334455

export class PlayerCombat {
  public x: number
  public y: number
  public hp: number
  public maxHp: number
  public effects: CardEffects

  private gfx: Graphics
  private aimLine: Graphics
  private flashGfx: Graphics
  /** Halo + footstep dust drawn under the body. */
  private auraGfx: Graphics
  /** Muzzle flash overlay drawn on top of body. */
  private muzzleGfx: Graphics
  private lastShotTime = 0
  private invincibleUntil = 0
  private flashTimer = 0
  private walkFrame = 0
  private isMoving = false
  private flashCooldown = 0
  private ultimateCooldown = 0
  /** Pulses 1→0 when a bullet is fired; drives muzzle flash visual. */
  private muzzleFlashTimer = 0
  /** Aim direction snapshot at the moment of last shot — feeds muzzle flash position. */
  private lastShotAngle = 0
  /** Footstep particles below the player. */
  private dustParticles: Array<{ x: number; y: number; vx: number; vy: number; age: number; duration: number }> = []
  private dustEmitTimer = 0
  // Callbacks
  public onUltimate: (() => void) | null = null
  public onFlash: ((startX: number, startY: number, endX: number, endY: number) => void) | null = null

  constructor(container: Container) {
    this.x = ARENA_W / 2
    this.y = ARENA_H - 80
    this.maxHp = 15
    this.hp = this.maxHp
    this.effects = {
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

    this.auraGfx = new Graphics()
    this.gfx = new Graphics()
    this.aimLine = new Graphics()
    this.flashGfx = new Graphics()
    this.muzzleGfx = new Graphics()
    container.addChild(this.auraGfx)
    container.addChild(this.gfx)
    container.addChild(this.aimLine)
    container.addChild(this.flashGfx)
    container.addChild(this.muzzleGfx)
  }

  takeDamage(amount: number): boolean {
    if (Date.now() < this.invincibleUntil) return false
    this.hp = Math.max(0, this.hp - amount)
    this.invincibleUntil = Date.now() + INVINCIBILITY_MS
    this.flashTimer = INVINCIBILITY_MS
    return true
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  canShoot(now: number): boolean {
    return now - this.lastShotTime >= SHOOT_COOLDOWN_MS
  }

  markShot(now: number, angle: number) {
    this.lastShotTime = now
    this.muzzleFlashTimer = 0.12
    this.lastShotAngle = angle
  }

  update(dt: number, input: InputManager, mouseCanvasX: number, mouseCanvasY: number) {
    // Scale dt by 0.016 to convert PixiJS tick delta to seconds
    const ds = dt * 0.016

    // Move with WASD
    const dir = input.getMovementDirection()
    const speed = this.effects.moveSpeed
    this.isMoving = false
    if (dir) {
      this.isMoving = true
      const step = speed * ds
      const dx = dir.dcol * step
      const dy = dir.drow * step
      this.x = Math.max(PLAYER_SIZE, Math.min(ARENA_W - PLAYER_SIZE, this.x + dx))
      this.y = Math.max(PLAYER_SIZE, Math.min(ARENA_H - PLAYER_SIZE, this.y + dy))
      this.walkFrame += ds

      // Emit footstep dust
      this.dustEmitTimer += ds
      if (this.dustEmitTimer > 0.12) {
        this.dustEmitTimer = 0
        this.spawnDust()
      }
    }

    // Update dust particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i]!
      p.age += ds
      if (p.age >= p.duration) {
        this.dustParticles.splice(i, 1)
        continue
      }
      p.x += p.vx * ds
      p.y += p.vy * ds
      p.vx *= 0.92
      p.vy *= 0.92
    }

    // Flash skill (Space)
    this.flashCooldown = Math.max(0, this.flashCooldown - ds)
    if (input.consumeJustPressed('skill_flash') && this.flashCooldown <= 0) {
      const startX = this.x
      const startY = this.y
      const aimAngle = Math.atan2(mouseCanvasY - this.y, mouseCanvasX - this.x)
      this.x = Math.max(PLAYER_SIZE, Math.min(ARENA_W - PLAYER_SIZE, this.x + Math.cos(aimAngle) * FLASH_DISTANCE))
      this.y = Math.max(PLAYER_SIZE, Math.min(ARENA_H - PLAYER_SIZE, this.y + Math.sin(aimAngle) * FLASH_DISTANCE))
      this.invincibleUntil = Date.now() + FLASH_INVINCIBILITY * 1000
      this.flashCooldown = FLASH_COOLDOWN * (this.effects.flashCooldownMul ?? 1)
      this.onFlash?.(startX, startY, this.x, this.y)
    }

    // Ultimate skill (Q)
    this.ultimateCooldown = Math.max(0, this.ultimateCooldown - ds)
    if (input.consumeJustPressed('skill_ultimate') && this.ultimateCooldown <= 0) {
      this.ultimateCooldown = ULTIMATE_COOLDOWN
      this.onUltimate?.()
    }

    // Invincibility timer
    if (this.flashTimer > 0) {
      this.flashTimer -= ds * 1000
    }

    // Muzzle flash timer
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - ds)

    this.draw(mouseCanvasX, mouseCanvasY)
    this.drawSkillCooldowns()
    this.drawAura()
    this.drawMuzzleFlash()
  }

  private spawnDust() {
    const angle = Math.random() * Math.PI * 2
    const speed = 14 + Math.random() * 10
    this.dustParticles.push({
      x: this.x + (Math.random() - 0.5) * 4,
      y: this.y + PLAYER_SIZE * 0.85,
      vx: Math.cos(angle) * speed * 0.4,
      vy: -Math.abs(Math.sin(angle) * speed) - 6,
      age: 0,
      duration: 0.45 + Math.random() * 0.2,
    })
  }

  private draw(mouseX: number, mouseY: number) {
    const g = this.gfx
    g.clear()
    g.x = this.x
    g.y = this.y

    const flashAlpha = (this.flashTimer > 0 && Math.floor(this.flashTimer / 80) % 2 === 0) ? 0.3 : 1
    const cx = 0
    const bob = this.isMoving ? Math.sin(this.walkFrame * 10) * 1.5 : 0
    const legOffset = this.isMoving ? Math.sin(this.walkFrame * 8) * 2 : 0
    const armSwing = this.isMoving ? Math.sin(this.walkFrame * 8) * 3 : 0
    const angle = Math.atan2(mouseY - this.y, mouseX - this.x)

    // Determine facing direction for eyes
    const absDx = Math.abs(Math.cos(angle))
    const absDy = Math.abs(Math.sin(angle))
    const facing: 'down' | 'up' | 'left' | 'right' =
      absDy > absDx ? (angle > 0 ? 'down' : 'up') : (angle > 0 ? 'right' : 'left')

    // Shadow
    g.ellipse(cx, PLAYER_SIZE - 2, 8, 3).fill({ color: 0x000000, alpha: 0.2 * flashAlpha })

    // Legs
    g.rect(cx - 5, 22 + bob, 4, 8 + legOffset).fill({ color: PANTS_COLOR, alpha: flashAlpha })
    g.rect(cx + 1, 22 + bob, 4, 8 - legOffset).fill({ color: PANTS_COLOR, alpha: flashAlpha })

    // Body (shirt)
    g.roundRect(cx - 7, 12 + bob, 14, 12, 2).fill({ color: SHIRT_COLOR, alpha: flashAlpha })

    // Arms
    g.rect(cx - 10, 14 + bob + armSwing, 4, 8).fill({ color: SHIRT_COLOR, alpha: flashAlpha })
    g.rect(cx + 6, 14 + bob - armSwing, 4, 8).fill({ color: SHIRT_COLOR, alpha: flashAlpha })
    // Hands
    g.circle(cx - 8, 23 + bob + armSwing, 2).fill({ color: SKIN_COLOR, alpha: flashAlpha })
    g.circle(cx + 8, 23 + bob - armSwing, 2).fill({ color: SKIN_COLOR, alpha: flashAlpha })

    // Head
    g.circle(cx, 8 + bob, 6).fill({ color: SKIN_COLOR, alpha: flashAlpha })

    // Hair
    g.arc(cx, 6 + bob, 6, Math.PI, 0).fill({ color: HAIR_COLOR, alpha: flashAlpha })

    // Eyes
    const eyeOffX = facing === 'left' ? -2 : facing === 'right' ? 2 : 0
    g.circle(cx - 2 + eyeOffX, 7 + bob, 1).fill({ color: 0x222222, alpha: flashAlpha })
    g.circle(cx + 2 + eyeOffX, 7 + bob, 1).fill({ color: 0x222222, alpha: flashAlpha })

    // Aim line
    const al = this.aimLine
    al.clear()
    al.x = this.x
    al.y = this.y
    const len = 24
    al.moveTo(0, 0)
      .lineTo(Math.cos(angle) * len, Math.sin(angle) * len)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.5 })
  }

  /** Soft glow + footstep dust under the player. */
  private drawAura() {
    const g = this.auraGfx
    g.clear()
    // Pulsing halo
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1
    g.circle(this.x, this.y + PLAYER_SIZE * 0.85, 11 * pulse).fill({ color: 0x88ccff, alpha: 0.18 })
    g.circle(this.x, this.y + PLAYER_SIZE * 0.85, 7 * pulse).fill({ color: 0xaaddff, alpha: 0.22 })
    // Dust particles
    for (const p of this.dustParticles) {
      const t = 1 - p.age / p.duration
      const r = 1.6 + (1 - t) * 1.4
      g.circle(p.x, p.y, r).fill({ color: 0xd0c8a8, alpha: t * 0.65 })
    }
  }

  /** Bright muzzle flash that fires on each shot. */
  private drawMuzzleFlash() {
    const g = this.muzzleGfx
    g.clear()
    if (this.muzzleFlashTimer <= 0) return
    const t = this.muzzleFlashTimer / 0.12
    const muzzleX = this.x + Math.cos(this.lastShotAngle) * 14
    const muzzleY = this.y + Math.sin(this.lastShotAngle) * 14
    // Outer glow
    g.circle(muzzleX, muzzleY, 9 + (1 - t) * 3).fill({ color: 0xffaa44, alpha: t * 0.5 })
    g.circle(muzzleX, muzzleY, 5 + (1 - t) * 2).fill({ color: 0xffee88, alpha: t * 0.85 })
    g.circle(muzzleX, muzzleY, 2.5).fill({ color: 0xffffff, alpha: t })
    // Spark streaks
    for (let i = 0; i < 4; i++) {
      const a = this.lastShotAngle + (Math.random() - 0.5) * 0.7
      const len = 8 + Math.random() * 4
      g.moveTo(muzzleX, muzzleY)
        .lineTo(muzzleX + Math.cos(a) * len, muzzleY + Math.sin(a) * len)
        .stroke({ color: 0xffeeaa, width: 1.2, alpha: t * 0.7 })
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }

  getSkillCooldowns(): { flashPct: number; ultimatePct: number } {
    const flashMax = FLASH_COOLDOWN * (this.effects.flashCooldownMul ?? 1)
    return {
      flashPct: this.flashCooldown > 0 ? 1 - this.flashCooldown / flashMax : 1,
      ultimatePct: this.ultimateCooldown > 0 ? 1 - this.ultimateCooldown / ULTIMATE_COOLDOWN : 1,
    }
  }

  private drawSkillCooldowns() {
    const g = this.flashGfx
    g.clear()
    g.x = this.x
    g.y = this.y

    const barW = 28
    const barH = 3
    const yOff = PLAYER_SIZE + 8

    // Flash cooldown bar
    if (this.flashCooldown > 0) {
      const flashMax = FLASH_COOLDOWN * (this.effects.flashCooldownMul ?? 1)
      const pct = 1 - this.flashCooldown / flashMax
      g.rect(-barW / 2, yOff, barW, barH).fill(0x333355)
      g.rect(-barW / 2, yOff, barW * pct, barH).fill(0x66aaff)
    }

    // Ultimate cooldown bar
    if (this.ultimateCooldown > 0) {
      const pct = 1 - this.ultimateCooldown / ULTIMATE_COOLDOWN
      g.rect(-barW / 2, yOff + 5, barW, barH).fill(0x553333)
      g.rect(-barW / 2, yOff + 5, barW * pct, barH).fill(0xffaa44)
    }
  }

  getRadius(): number {
    return PLAYER_RADIUS
  }

  destroy() {
    this.gfx.destroy()
    this.aimLine.destroy()
    this.flashGfx.destroy()
    this.auraGfx.destroy()
    this.muzzleGfx.destroy()
  }
}
