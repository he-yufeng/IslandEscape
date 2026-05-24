import { Graphics, Container } from 'pixi.js'

export interface BulletConfig {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  size: number
  piercing: number
  owner: 'player' | 'boss'
  bounces?: number
  isCrit?: boolean
}

const POOL_SIZE = 100

export class Bullet {
  public active = false
  public x = 0
  public y = 0
  public vx = 0
  public vy = 0
  public damage = 0
  public size = 6
  public piercing = 0
  public owner: 'player' | 'boss' = 'player'
  public bounces = 0
  public isCrit = false

  private gfx: Graphics
  private boundsW: number
  private boundsH: number

  constructor(container: Container, boundsW: number, boundsH: number) {
    this.boundsW = boundsW
    this.boundsH = boundsH
    this.gfx = new Graphics()
    this.gfx.visible = false
    container.addChild(this.gfx)
  }

  spawn(config: BulletConfig) {
    this.x = config.x
    this.y = config.y
    this.vx = config.vx
    this.vy = config.vy
    this.damage = config.damage
    this.size = config.size
    this.piercing = config.piercing
    this.owner = config.owner
    this.bounces = config.bounces ?? 0
    this.isCrit = config.isCrit ?? false
    this.active = true
    this.gfx.visible = true
  }

  despawn() {
    this.active = false
    this.gfx.visible = false
  }

  update(dt: number) {
    if (!this.active) return
    const ds = dt * 0.016
    this.x += this.vx * ds
    this.y += this.vy * ds

    // Wall bounce (player bullets only)
    if (this.owner === 'player' && this.bounces > 0) {
      if (this.x < this.size) { this.x = this.size; this.vx = Math.abs(this.vx); this.bounces-- }
      else if (this.x > this.boundsW - this.size) { this.x = this.boundsW - this.size; this.vx = -Math.abs(this.vx); this.bounces-- }
      if (this.y < this.size) { this.y = this.size; this.vy = Math.abs(this.vy); this.bounces-- }
      else if (this.y > this.boundsH - this.size) { this.y = this.boundsH - this.size; this.vy = -Math.abs(this.vy); this.bounces-- }
    }

    // Offscreen check
    if (
      this.x < -20 || this.x > this.boundsW + 20 ||
      this.y < -20 || this.y > this.boundsH + 20
    ) {
      this.despawn()
      return
    }

    this.draw()
  }

  private draw() {
    const g = this.gfx
    g.clear()
    g.x = this.x
    g.y = this.y
    if (this.owner === 'player') {
      const core = this.isCrit ? 0xffaa22 : 0xffdd44
      const inner = this.isCrit ? 0xffffaa : 0xffffff
      g.circle(0, 0, this.size).fill(core)
      g.circle(0, 0, this.size * 0.5).fill(inner)
      if (this.isCrit) {
        g.circle(0, 0, this.size * 1.4).stroke({ color: 0xffaa22, width: 1, alpha: 0.6 })
      }
    } else {
      g.circle(0, 0, this.size).fill(0xff3333)
      g.circle(0, 0, this.size * 0.4).fill(0xff8888)
    }
  }

  destroy() {
    this.gfx.destroy()
  }
}

export class BulletPool {
  private bullets: Bullet[] = []

  constructor(container: Container, boundsW: number, boundsH: number) {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.bullets.push(new Bullet(container, boundsW, boundsH))
    }
  }

  getInactive(): Bullet | null {
    for (const b of this.bullets) {
      if (!b.active) return b
    }
    return null
  }

  getActive(): Bullet[] {
    return this.bullets.filter(b => b.active)
  }

  updateAll(dt: number) {
    for (const b of this.bullets) {
      b.update(dt)
    }
  }

  destroyAll() {
    for (const b of this.bullets) {
      b.destroy()
    }
    this.bullets = []
  }
}
