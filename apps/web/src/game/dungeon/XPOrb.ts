import { Graphics, Container } from 'pixi.js'

const ORB_POOL_SIZE = 80
const MAGNET_RANGE = 80
const MAGNET_SPEED = 300

export class XPOrb {
  public active = false
  public x = 0
  public y = 0
  public value = 10

  private gfx: Graphics
  private time = 0

  constructor(container: Container) {
    this.gfx = new Graphics()
    this.gfx.visible = false
    container.addChild(this.gfx)
  }

  spawn(x: number, y: number, value: number) {
    this.x = x + (Math.random() - 0.5) * 40
    this.y = y + (Math.random() - 0.5) * 40
    this.value = value
    this.active = true
    this.gfx.visible = true
    this.time = 0
  }

  despawn() {
    this.active = false
    this.gfx.visible = false
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.active) return
    const ds = dt * 0.016
    this.time += ds

    // Magnet effect: move toward player if close enough
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < MAGNET_RANGE && dist > 0) {
      const speed = MAGNET_SPEED * (1 - dist / MAGNET_RANGE) + 40
      this.x += (dx / dist) * speed * ds
      this.y += (dy / dist) * speed * ds
    }

    // Collected by player (very close)
    if (dist < 12) {
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
    // Glow
    const pulse = 1 + Math.sin(this.time * 4) * 0.2
    g.circle(0, 0, 5 * pulse).fill({ color: 0x44ff44, alpha: 0.4 })
    g.circle(0, 0, 3 * pulse).fill(0x88ff88)
    g.circle(0, 0, 1.5 * pulse).fill(0xffffff)
  }

  destroy() {
    this.gfx.destroy()
  }
}

export class XPOrbPool {
  private orbs: XPOrb[] = []

  constructor(container: Container) {
    for (let i = 0; i < ORB_POOL_SIZE; i++) {
      this.orbs.push(new XPOrb(container))
    }
  }

  getInactive(): XPOrb | null {
    for (const o of this.orbs) {
      if (!o.active) return o
    }
    return null
  }

  getActive(): XPOrb[] {
    return this.orbs.filter(o => o.active)
  }

  updateAll(dt: number, playerX: number, playerY: number) {
    for (const o of this.orbs) {
      o.update(dt, playerX, playerY)
    }
  }

  destroyAll() {
    for (const o of this.orbs) {
      o.destroy()
    }
    this.orbs = []
  }
}
