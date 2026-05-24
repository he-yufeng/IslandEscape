import { Container, Graphics } from 'pixi.js'

const ARENA_W = 640
const ARENA_H = 480
const BOSS_RADIUS = 24
const BOSS_SPEED = 60       // pixels per second
const SHOOT_COOLDOWN = 2.0  // seconds
const CHARGE_COOLDOWN = 4.0 // seconds
const CHARGE_SPEED = 280    // pixels per second
const CHARGE_DURATION = 0.8 // seconds
const WINDUP_DURATION = 0.5 // seconds
const STUN_DURATION = 1.0   // seconds

type BossState = 'idle' | 'winding_up' | 'shooting' | 'charging' | 'stunned'

export class Boss {
  public x: number
  public y: number
  public hp: number
  public maxHp: number
  public radius = BOSS_RADIUS

  private gfx: Graphics
  private state: BossState = 'idle'
  private stateTimer = 0
  private shootTimer = 0
  private chargeTimer = 0
  private chargeAngle = 0
  private chargeVx = 0
  private chargeVy = 0
  private phase2 = false
  private eyeGlow = 0

  // Callbacks
  public onShoot: ((angle: number, count: number) => void) | null = null
  public onChargeEnd: (() => void) | null = null
  public onXPOrbSpawn: ((x: number, y: number, count: number) => void) | null = null

  constructor(container: Container) {
    this.x = ARENA_W / 2
    this.y = 80
    this.maxHp = 60
    this.hp = this.maxHp

    this.gfx = new Graphics()
    container.addChild(this.gfx)
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    this.eyeGlow = 0.3

    // Spawn XP orbs
    const orbCount = 1 + Math.floor(Math.random() * 2)
    this.onXPOrbSpawn?.(this.x, this.y, orbCount)

    // Phase 2 at 50% HP
    if (this.hp <= this.maxHp / 2 && !this.phase2) {
      this.phase2 = true
    }
  }

  update(dt: number, playerX: number, playerY: number) {
    const ds = dt * 0.016 // convert PixiJS tick delta to seconds

    this.eyeGlow = Math.max(0, this.eyeGlow - ds * 2)
    this.stateTimer += ds

    const cooldownMul = this.phase2 ? 0.6 : 1.0

    switch (this.state) {
      case 'idle':
        this.moveToward(playerX, playerY, BOSS_SPEED * ds)
        this.shootTimer += ds
        this.chargeTimer += ds

        if (this.shootTimer >= SHOOT_COOLDOWN * cooldownMul) {
          this.shootTimer = 0
          this.state = 'winding_up'
          this.stateTimer = 0
        } else if (this.chargeTimer >= CHARGE_COOLDOWN * cooldownMul) {
          this.chargeTimer = 0
          this.state = 'winding_up'
          this.stateTimer = 0
          this.chargeAngle = Math.atan2(playerY - this.y, playerX - this.x)
          this.chargeVx = Math.cos(this.chargeAngle) * CHARGE_SPEED
          this.chargeVy = Math.sin(this.chargeAngle) * CHARGE_SPEED
        }
        break

      case 'winding_up':
        if (this.stateTimer >= WINDUP_DURATION) {
          if (this.chargeTimer === 0 && this.shootTimer === 0) {
            this.state = 'charging'
            this.stateTimer = 0
          } else {
            this.state = 'shooting'
            this.stateTimer = 0
            const angle = Math.atan2(playerY - this.y, playerX - this.x)
            const count = this.phase2 ? 5 : 3
            this.onShoot?.(angle, count)
          }
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
    g.x = this.x
    g.y = this.y

    const color = this.phase2 ? 0xcc4444 : 0xcc6633
    const windupScale = (this.state === 'winding_up') ? 1 + Math.sin(this.stateTimer * 12) * 0.15 : 1
    const stunnedAlpha = (this.state === 'stunned') ? 0.6 : 1

    // Shadow
    g.circle(0, 4, BOSS_RADIUS * windupScale).fill({ color: 0x000000, alpha: 0.3 })

    // Body
    g.circle(0, 0, BOSS_RADIUS * windupScale).fill({ color, alpha: stunnedAlpha })
    g.circle(0, 0, BOSS_RADIUS * 0.7 * windupScale).fill({ color: 0xdd8855, alpha: stunnedAlpha })

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
    if (this.state === 'winding_up' && this.chargeAngle !== undefined) {
      g.moveTo(0, 0).lineTo(
        Math.cos(this.chargeAngle) * BOSS_RADIUS * 1.5,
        Math.sin(this.chargeAngle) * BOSS_RADIUS * 1.5,
      ).stroke({ color: 0xff4444, width: 3, alpha: 0.8 })
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }

  isCharging(): boolean {
    return this.state === 'charging'
  }

  getChargeDamage(): number {
    return 5
  }

  destroy() {
    this.gfx.destroy()
  }
}
