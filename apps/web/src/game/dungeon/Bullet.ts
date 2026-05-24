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
      g.circle(0, 0, this.size).fill(0xffdd44)
      g.circle(0, 0, this.size * 0.5).fill(0xffffff)
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
