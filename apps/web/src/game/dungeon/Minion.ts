import { Container, Graphics } from 'pixi.js'

const POOL_SIZE = 6
const SPAWN_RADIUS = 12
const ATTACK_RADIUS = 14
const MOVE_SPEED = 65
const SPAWN_DURATION = 0.55
const HP_DEFAULT = 4

/**
 * Shadow imp summoned by the boss in phase 2+. It chases the player and
 * explodes on contact, damaging the player. Player can shoot it to kill.
 *
 * Behaviour:
 *   - `spawn()` puts it at a position with a brief rise-from-ground anim.
 *   - `update()` chases `playerX/Y`. Returns whether to deal contact damage
 *     this frame (true if it has touched the player and is exploding).
 *   - `takeDamage()` lets bullets reduce HP. At 0 HP, transitions to dying.
 */
export class Minion {
  public active = false
  public x = 0
  public y = 0
  public hp = HP_DEFAULT
  public radius = 9
  public dying = false

  private gfx: Graphics
  private vx = 0
  private vy = 0
  private spawnTimer = 0
  private deathTimer = 0
  private hitFlashTimer = 0
  private breathPhase = Math.random() * Math.PI * 2

  constructor(container: Container) {
    this.gfx = new Graphics()
    this.gfx.visible = false
    container.addChild(this.gfx)
  }

  spawn(x: number, y: number, hp = HP_DEFAULT) {
    this.x = x
    this.y = y
    this.hp = hp
    this.active = true
    this.dying = false
    this.spawnTimer = SPAWN_DURATION
    this.deathTimer = 0
    this.hitFlashTimer = 0
    this.gfx.visible = true
  }

  takeDamage(amount: number): boolean {
    if (!this.active || this.dying) return false
    if (this.spawnTimer > 0) return false // invulnerable while emerging
    this.hp = Math.max(0, this.hp - amount)
    this.hitFlashTimer = 0.08
    if (this.hp <= 0) {
      this.dying = true
      this.deathTimer = 0.35
    }
    return true
  }

  /** @returns 'collision' if it just exploded into the player; 'normal' otherwise. */
  update(dt: number, playerX: number, playerY: number, playerR: number): 'collision' | 'normal' | null {
    if (!this.active) return null
    const ds = dt * 0.016
    this.breathPhase += ds * 4

    // Hit flash decay
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - ds)

    // Spawn rise-up animation
    if (this.spawnTimer > 0) {
      this.spawnTimer = Math.max(0, this.spawnTimer - ds)
      this.draw()
      return 'normal'
    }

    // Death animation
    if (this.dying) {
      this.deathTimer -= ds
      if (this.deathTimer <= 0) {
        this.active = false
        this.gfx.visible = false
      }
      this.draw()
      return 'normal'
    }

    // Chase the player
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 1) {
      this.vx = (dx / dist) * MOVE_SPEED
      this.vy = (dy / dist) * MOVE_SPEED
      this.x += this.vx * ds
      this.y += this.vy * ds
    }

    // Contact = explode
    if (dist < playerR + this.radius) {
      this.dying = true
      this.deathTimer = 0.3
      this.draw()
      return 'collision'
    }

    this.draw()
    return 'normal'
  }

  private draw() {
    const g = this.gfx
    g.clear()
    g.x = this.x
    g.y = this.y

    if (this.dying) {
      const t = 1 - this.deathTimer / 0.35
      const r = this.radius * (1 + t * 1.4)
      const alpha = 1 - t
      // Outer pop ring
      g.circle(0, 0, r).stroke({ color: 0xff6080, width: 3 * (1 - t), alpha })
      // Inner burst
      g.circle(0, 0, r * 0.6).fill({ color: 0xffaa44, alpha: alpha * 0.6 })
      g.circle(0, 0, r * 0.3).fill({ color: 0xffffff, alpha: alpha })
      // Debris
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6
        const len = r * 1.2
        g.moveTo(0, 0).lineTo(Math.cos(a) * len, Math.sin(a) * len)
          .stroke({ color: 0xff7090, width: 1.5 * (1 - t), alpha })
      }
      return
    }

    // Spawn rise-up emergence
    if (this.spawnTimer > 0) {
      const t = 1 - this.spawnTimer / SPAWN_DURATION
      const r = this.radius * t
      const alpha = t
      // Smoke poof
      g.circle(0, 0, this.radius * (1 - t) * 1.8).fill({ color: 0x402050, alpha: alpha * 0.45 })
      // Body emerging
      g.ellipse(0, 0, r, r * 0.85).fill({ color: 0x150028, alpha })
      g.ellipse(0, -r * 0.15, r * 0.7, r * 0.45).fill({ color: 0x6020a0, alpha: alpha * 0.85 })
      return
    }

    // Body — ominous purple/black blob with breathing
    const breath = 1 + Math.sin(this.breathPhase) * 0.08
    const r = this.radius * breath
    // Shadow
    g.ellipse(0, r * 0.7, r, r * 0.3).fill({ color: 0x000000, alpha: 0.45 })
    // Outer body
    g.circle(0, 0, r).fill(0x1a0226)
    // Inner highlight
    g.circle(0, -r * 0.15, r * 0.65).fill(0x501a80)
    // Glowing eyes — twin red dots
    const eyeY = -r * 0.2
    g.circle(-r * 0.3, eyeY, 1.6).fill(0xff5050)
    g.circle(r * 0.3, eyeY, 1.6).fill(0xff5050)
    // Glow halo around eyes
    g.circle(-r * 0.3, eyeY, 2.6).fill({ color: 0xff5050, alpha: 0.45 })
    g.circle(r * 0.3, eyeY, 2.6).fill({ color: 0xff5050, alpha: 0.45 })
    // Wispy spikes around the rim
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 + this.breathPhase * 0.3
      const tipX = Math.cos(a) * r * 1.4
      const tipY = Math.sin(a) * r * 1.4
      g.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85).lineTo(tipX, tipY)
        .stroke({ color: 0x6020a0, width: 1.2, alpha: 0.7 })
    }

    // Hit flash overlay
    if (this.hitFlashTimer > 0) {
      const fa = (this.hitFlashTimer / 0.08) * 0.7
      g.circle(0, 0, r).fill({ color: 0xffffff, alpha: fa })
    }
  }

  destroy() { this.gfx.destroy() }
}

export class MinionPool {
  private minions: Minion[] = []

  constructor(container: Container) {
    for (let i = 0; i < POOL_SIZE; i++) this.minions.push(new Minion(container))
  }

  spawn(x: number, y: number, hp?: number): Minion | null {
    const m = this.minions.find((mi) => !mi.active)
    if (!m) return null
    m.spawn(x, y, hp)
    return m
  }

  /**
   * Tick all minions. Calls `onContact(minion)` for any that exploded into
   * the player this frame so the caller can apply damage + screen feedback.
   */
  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerR: number,
    onContact: (m: Minion) => void,
  ) {
    for (const m of this.minions) {
      if (!m.active) continue
      const result = m.update(dt, playerX, playerY, playerR)
      if (result === 'collision') onContact(m)
    }
  }

  /** Iterate all active minions for bullet collision checks. */
  forEachActive(fn: (m: Minion) => void) {
    for (const m of this.minions) {
      if (m.active && !m.dying) fn(m)
    }
  }

  /** Whether any minion is currently active. Used to gate spawn frequency. */
  activeCount(): number {
    return this.minions.reduce((n, m) => n + (m.active && !m.dying ? 1 : 0), 0)
  }

  // Ensure minion radius is exposed for collision uses.
  static readonly ATTACK_RADIUS = ATTACK_RADIUS

  destroyAll() {
    for (const m of this.minions) m.destroy()
    this.minions = []
  }
}
