import { Container, Graphics } from 'pixi.js'

const ARENA_W = 640
const ARENA_H = 480
const BOSS_RADIUS = 24
const BOSS_SPEED = 60       // pixels per second
const SHOOT_COOLDOWN = 2.0  // seconds
const CHARGE_COOLDOWN = 4.0 // seconds
const SUMMON_COOLDOWN = 8.0 // seconds (phase2+)
const CHARGE_SPEED = 280    // pixels per second
const CHARGE_DURATION = 0.8 // seconds
const WINDUP_DURATION = 0.5 // seconds
const STUN_DURATION = 1.0   // seconds
const SUMMON_WINDUP = 0.6   // seconds
const HIT_FLASH_DURATION = 0.1
const DEATH_DURATION = 0.7

type BossState = 'idle' | 'winding_up' | 'shooting' | 'charging' | 'stunned' | 'summoning' | 'dying' | 'dead'

export class Boss {
  public x: number
  public y: number
  public hp: number
  public maxHp: number
  public radius = BOSS_RADIUS

  private gfx: Graphics
  private state: BossState = 'idle'
  private nextWindupTrigger: 'shoot' | 'charge' | 'summon' | null = null
  private stateTimer = 0
  private shootTimer = 0
  private chargeTimer = 0
  private summonTimer = 0
  private chargeAngle = 0
  private chargeVx = 0
  private chargeVy = 0
  private phase2 = false
  private phase3 = false
  private eyeGlow = 0
  private hitFlashTimer = 0
  private deathTimer = 0
  private pendingSummonX = 0
  private pendingSummonY = 0

  // Callbacks
  public onShoot: ((angle: number, count: number, speedMul: number) => void) | null = null
  public onChargeEnd: (() => void) | null = null
  public onXPOrbSpawn: ((x: number, y: number, count: number) => void) | null = null
  public onSummon: ((x: number, y: number) => void) | null = null
  public onDeathComplete: (() => void) | null = null

  constructor(container: Container) {
    this.x = ARENA_W / 2
    this.y = 80
    this.maxHp = 60
    this.hp = this.maxHp

    this.gfx = new Graphics()
    container.addChild(this.gfx)
  }

  takeDamage(amount: number) {
    if (this.state === 'dying' || this.state === 'dead') return
    this.hp = Math.max(0, this.hp - amount)
    this.eyeGlow = 0.3
    this.hitFlashTimer = HIT_FLASH_DURATION

    // Spawn XP orbs
    const orbCount = 1 + Math.floor(Math.random() * 2)
    this.onXPOrbSpawn?.(this.x, this.y, orbCount)

    // Phase 2 at 50% HP
    if (this.hp <= this.maxHp / 2 && !this.phase2) {
      this.phase2 = true
    }
    // Phase 3 at 25% HP
    if (this.hp <= this.maxHp / 4 && !this.phase3) {
      this.phase3 = true
    }

    // Death
    if (this.hp <= 0) {
      this.state = 'dying'
      this.stateTimer = 0
      this.deathTimer = 0
    }
  }

  update(dt: number, playerX: number, playerY: number) {
    const ds = dt * 0.016 // convert PixiJS tick delta to seconds

    this.eyeGlow = Math.max(0, this.eyeGlow - ds * 2)
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - ds)
    this.stateTimer += ds

    if (this.state === 'dying') {
      this.deathTimer += ds
      if (this.deathTimer >= DEATH_DURATION) {
        this.state = 'dead'
        this.onDeathComplete?.()
      }
      this.draw()
      return
    }
    if (this.state === 'dead') return

    const cooldownMul = this.phase3 ? 0.4 : (this.phase2 ? 0.6 : 1.0)

    switch (this.state) {
      case 'idle':
        this.moveToward(playerX, playerY, BOSS_SPEED * ds)
        this.shootTimer += ds
        this.chargeTimer += ds
        if (this.phase2) this.summonTimer += ds

        if (this.phase2 && this.summonTimer >= SUMMON_COOLDOWN * cooldownMul) {
          this.summonTimer = 0
          this.state = 'summoning'
          this.stateTimer = 0
          this.pendingSummonX = playerX
          this.pendingSummonY = playerY
        } else if (this.shootTimer >= SHOOT_COOLDOWN * cooldownMul) {
          this.shootTimer = 0
          this.state = 'winding_up'
          this.stateTimer = 0
          this.nextWindupTrigger = 'shoot'
        } else if (this.chargeTimer >= CHARGE_COOLDOWN * cooldownMul) {
          this.chargeTimer = 0
          this.state = 'winding_up'
          this.stateTimer = 0
          this.nextWindupTrigger = 'charge'
          this.chargeAngle = Math.atan2(playerY - this.y, playerX - this.x)
          const chargeSpeedMul = this.phase3 ? 1.2 : 1.0
          this.chargeVx = Math.cos(this.chargeAngle) * CHARGE_SPEED * chargeSpeedMul
          this.chargeVy = Math.sin(this.chargeAngle) * CHARGE_SPEED * chargeSpeedMul
        }
        break

      case 'winding_up':
        if (this.stateTimer >= WINDUP_DURATION) {
          if (this.nextWindupTrigger === 'charge') {
            this.state = 'charging'
            this.stateTimer = 0
          } else {
            this.state = 'shooting'
            this.stateTimer = 0
            const angle = Math.atan2(playerY - this.y, playerX - this.x)
            const count = this.phase3 ? 7 : (this.phase2 ? 5 : 3)
            const speedMul = this.phase3 ? 1.3 : 1.0
            this.onShoot?.(angle, count, speedMul)
          }
          this.nextWindupTrigger = null
        }
        break

      case 'shooting':
        if (this.stateTimer >= 0.3) {
          this.state = 'idle'
        }
        break

      case 'charging':
        this.x += this.chargeVx * ds
        this.y += this.chargeVy * ds

        // Bounce off walls
        if (this.x < BOSS_RADIUS || this.x > ARENA_W - BOSS_RADIUS) {
          this.chargeVx *= -1
          this.x = Math.max(BOSS_RADIUS, Math.min(ARENA_W - BOSS_RADIUS, this.x))
        }
        if (this.y < BOSS_RADIUS || this.y > ARENA_H - BOSS_RADIUS) {
          this.chargeVy *= -1
          this.y = Math.max(BOSS_RADIUS, Math.min(ARENA_H - BOSS_RADIUS, this.y))
        }

        if (this.stateTimer >= CHARGE_DURATION) {
          this.state = 'stunned'
          this.stateTimer = 0
          this.onChargeEnd?.()
        }
        break

      case 'stunned':
        if (this.stateTimer >= STUN_DURATION) {
          this.state = 'idle'
        }
        break

      case 'summoning':
        if (this.stateTimer >= SUMMON_WINDUP) {
          // Fire summon at the captured player position (not current — gives a tell)
          this.onSummon?.(this.pendingSummonX, this.pendingSummonY)
          this.state = 'idle'
        }
        break
    }

    this.draw()
  }

  private moveToward(px: number, py: number, maxDist: number) {
    const dx = px - this.x
    const dy = py - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 2) return
    const step = Math.min(maxDist, dist)
    this.x += (dx / dist) * step
    this.y += (dy / dist) * step
  }

  private draw() {
    const g = this.gfx
    g.clear()

    if (this.state === 'dying') {
      const t = this.deathTimer / DEATH_DURATION
      const scale = 1 + t * 1.5
      const alpha = 1 - t
      const flicker = (Math.floor(this.deathTimer * 20) % 2 === 0) ? 1 : 0.4
      g.x = this.x
      g.y = this.y
      g.circle(0, 4, BOSS_RADIUS * scale).fill({ color: 0x000000, alpha: 0.2 * alpha })
      g.circle(0, 0, BOSS_RADIUS * scale).fill({ color: 0xffaa44, alpha: alpha * flicker * 0.5 })
      g.circle(0, 0, BOSS_RADIUS * scale * 0.7).fill({ color: 0xffffff, alpha: alpha * flicker * 0.7 })
      g.circle(0, 0, BOSS_RADIUS * scale * 1.3).stroke({ color: 0xffffff, width: 3, alpha: alpha * 0.6 })
      return
    }
    if (this.state === 'dead') return

    // Hit-flash jitter
    const jitter = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 4 : 0
    g.x = this.x + jitter
    g.y = this.y + jitter

    const baseColor = this.phase3 ? 0x6633aa : (this.phase2 ? 0xcc4444 : 0xcc6633)
    const innerColor = this.phase3 ? 0xaa66cc : (this.phase2 ? 0xdd6666 : 0xdd8855)
    const windupScale = (this.state === 'winding_up' || this.state === 'summoning') ? 1 + Math.sin(this.stateTimer * 12) * 0.15 : 1
    const stunnedAlpha = (this.state === 'stunned') ? 0.6 : 1

    // Shadow
    g.circle(0, 4, BOSS_RADIUS * windupScale).fill({ color: 0x000000, alpha: 0.3 })

    // Body
    g.circle(0, 0, BOSS_RADIUS * windupScale).fill({ color: baseColor, alpha: stunnedAlpha })
    g.circle(0, 0, BOSS_RADIUS * 0.7 * windupScale).fill({ color: innerColor, alpha: stunnedAlpha })

    // Hit flash overlay
    if (this.hitFlashTimer > 0) {
      const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.6
      g.circle(0, 0, BOSS_RADIUS * windupScale).fill({ color: 0xffffff, alpha: flashAlpha })
    }

    // Eyes
    const eyeR = 5
    const eyeY = -2
    g.circle(-8, eyeY, eyeR).fill(0xffffff)
    g.circle(8, eyeY, eyeR).fill(0xffffff)
    g.circle(-8, eyeY, eyeR * 0.5).fill(0x111111)
    g.circle(8, eyeY, eyeR * 0.5).fill(0x111111)

    // Glow on damage
    if (this.eyeGlow > 0) {
      g.circle(-8, eyeY, eyeR * 0.7).fill({ color: 0xff4444, alpha: this.eyeGlow })
      g.circle(8, eyeY, eyeR * 0.7).fill({ color: 0xff4444, alpha: this.eyeGlow })
    }

    // Charge indicator
    if (this.state === 'winding_up' && this.nextWindupTrigger === 'charge') {
      g.moveTo(0, 0).lineTo(
        Math.cos(this.chargeAngle) * BOSS_RADIUS * 1.5,
        Math.sin(this.chargeAngle) * BOSS_RADIUS * 1.5,
      ).stroke({ color: 0xff4444, width: 3, alpha: 0.8 })
    }

    // Summoning ring telegraph
    if (this.state === 'summoning') {
      const ringR = BOSS_RADIUS + 8 + Math.sin(this.stateTimer * 14) * 4
      g.circle(0, 0, ringR).stroke({ color: 0xaa44ff, width: 2, alpha: 0.7 })
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }

  isCharging(): boolean {
    return this.state === 'charging'
  }

  isDying(): boolean {
    return this.state === 'dying'
  }

  isDead(): boolean {
    return this.state === 'dead'
  }

  getChargeDamage(): number {
    return 5
  }

  destroy() {
    this.gfx.destroy()
  }
}
