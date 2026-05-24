import { Container, Graphics, Text } from 'pixi.js'

// ============================================================
// Screen shake — applied as offset to a parent container
// ============================================================

export class ScreenShaker {
  private intensity = 0
  private duration = 0
  private elapsed = 0

  trigger(intensity: number, durationSec: number) {
    if (intensity > this.intensity || this.elapsed >= this.duration) {
      this.intensity = intensity
      this.duration = durationSec
      this.elapsed = 0
    }
  }

  /** Returns offset to apply to a container's position. ds in seconds. */
  update(ds: number): { x: number; y: number } {
    if (this.elapsed >= this.duration) return { x: 0, y: 0 }
    this.elapsed += ds
    const remaining = Math.max(0, 1 - this.elapsed / this.duration)
    const mag = this.intensity * remaining
    return {
      x: (Math.random() - 0.5) * mag * 2,
      y: (Math.random() - 0.5) * mag * 2,
    }
  }
}

// ============================================================
// Hit spark pool — small particles on bullet hit
// ============================================================

interface HitSpark {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  age: number
  duration: number
  color: number
  gfx: Graphics
}

const SPARK_POOL_SIZE = 60

export class HitSparkPool {
  private sparks: HitSpark[] = []

  constructor(container: Container) {
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      container.addChild(gfx)
      this.sparks.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, duration: 0.18, color: 0xffffff, gfx,
      })
    }
  }

  /** Spawn a burst of sparks at (x, y), pushed roughly along (dirX, dirY). */
  burst(x: number, y: number, dirX: number, dirY: number, color: number, count = 6) {
    const baseAngle = Math.atan2(dirY, dirX)
    for (let i = 0; i < count; i++) {
      const s = this.sparks.find((sp) => !sp.active)
      if (!s) return
      const spread = (Math.random() - 0.5) * 1.6
      const angle = baseAngle + spread
      const speed = 80 + Math.random() * 120
      s.active = true
      s.x = x
      s.y = y
      s.vx = Math.cos(angle) * speed
      s.vy = Math.sin(angle) * speed
      s.age = 0
      s.duration = 0.15 + Math.random() * 0.1
      s.color = color
      s.gfx.visible = true
    }
  }

  update(ds: number) {
    for (const s of this.sparks) {
      if (!s.active) continue
      s.age += ds
      if (s.age >= s.duration) {
        s.active = false
        s.gfx.visible = false
        s.gfx.clear()
        continue
      }
      s.x += s.vx * ds
      s.y += s.vy * ds
      s.vx *= 0.9
      s.vy *= 0.9
      const t = 1 - s.age / s.duration
      const g = s.gfx
      g.clear()
      g.x = s.x
      g.y = s.y
      g.circle(0, 0, 3 * t).fill({ color: s.color, alpha: t })
      g.circle(0, 0, 1.5 * t).fill({ color: 0xffffff, alpha: t * 0.8 })
    }
  }

  destroy() {
    for (const s of this.sparks) s.gfx.destroy()
    this.sparks = []
  }
}

// ============================================================
// Damage number pool — floating text that drifts up and fades
// ============================================================

interface DamageNumber {
  active: boolean
  x: number
  y: number
  vy: number
  age: number
  duration: number
  text: Text
}

const DAMAGE_NUMBER_POOL_SIZE = 30

export class DamageNumberPool {
  private numbers: DamageNumber[] = []

  constructor(container: Container) {
    for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3 },
        },
      })
      text.visible = false
      text.anchor.set(0.5, 0.5)
      container.addChild(text)
      this.numbers.push({ active: false, x: 0, y: 0, vy: -40, age: 0, duration: 0.6, text })
    }
  }

  spawn(x: number, y: number, value: string, color: number, opts?: { fontSize?: number }) {
    const slot = this.numbers.find((n) => !n.active)
    if (!slot) return
    slot.active = true
    slot.x = x + (Math.random() - 0.5) * 8
    slot.y = y - 4
    slot.vy = -50 - Math.random() * 20
    slot.age = 0
    slot.duration = 0.55
    slot.text.text = value
    slot.text.style.fill = color
    slot.text.style.fontSize = opts?.fontSize ?? 14
    slot.text.x = slot.x
    slot.text.y = slot.y
    slot.text.alpha = 1
    slot.text.scale.set(1)
    slot.text.visible = true
  }

  update(ds: number) {
    for (const n of this.numbers) {
      if (!n.active) continue
      n.age += ds
      if (n.age >= n.duration) {
        n.active = false
        n.text.visible = false
        continue
      }
      n.y += n.vy * ds
      n.vy *= 0.9
      const t = n.age / n.duration
      n.text.x = n.x
      n.text.y = n.y
      n.text.alpha = 1 - t
      const popScale = t < 0.15 ? 1 + (1 - t / 0.15) * 0.4 : 1
      n.text.scale.set(popScale)
    }
  }

  destroy() {
    for (const n of this.numbers) n.text.destroy()
    this.numbers = []
  }
}

// ============================================================
// Red vignette overlay for player damage
// ============================================================

export class VignetteOverlay {
  private gfx: Graphics
  private timer = 0
  private duration = 0
  private maxAlpha = 0
  private color = 0xff3333
  private w: number
  private h: number

  constructor(container: Container, width: number, height: number) {
    this.w = width
    this.h = height
    this.gfx = new Graphics()
    this.gfx.alpha = 0
    container.addChild(this.gfx)
  }

  trigger(durationSec: number, alpha = 0.45, color = 0xff3333) {
    if (alpha > this.maxAlpha || this.timer >= this.duration) {
      this.duration = durationSec
      this.timer = 0
      this.maxAlpha = alpha
      this.color = color
      this.draw()
    }
  }

  update(ds: number) {
    if (this.timer >= this.duration) {
      if (this.gfx.alpha !== 0) this.gfx.alpha = 0
      return
    }
    this.timer += ds
    const t = Math.min(1, this.timer / this.duration)
    this.gfx.alpha = this.maxAlpha * (1 - t)
  }

  /** Re-draw vignette gradient using nested rings (since Pixi v8 has no fillGradient on Graphics). */
  private draw() {
    const g = this.gfx
    g.clear()
    const layers = 8
    for (let i = 0; i < layers; i++) {
      const inset = (i + 1) * (Math.min(this.w, this.h) / (layers * 4))
      const a = ((layers - i) / layers) * 0.6
      g.rect(0, 0, this.w, this.h).stroke({ color: this.color, width: inset, alpha: a })
    }
  }

  destroy() {
    this.gfx.destroy()
  }
}

// ============================================================
// Ground strike marker (telegraphed AOE for boss summon)
// ============================================================

interface GroundStrike {
  active: boolean
  x: number
  y: number
  radius: number
  damage: number
  age: number
  telegraphDuration: number
  hitDuration: number
  hasFired: boolean
  gfx: Graphics
}

const STRIKE_POOL_SIZE = 12

export class GroundStrikePool {
  private strikes: GroundStrike[] = []

  constructor(container: Container) {
    for (let i = 0; i < STRIKE_POOL_SIZE; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      container.addChild(gfx)
      this.strikes.push({
        active: false, x: 0, y: 0, radius: 28, damage: 2,
        age: 0, telegraphDuration: 0.9, hitDuration: 0.25, hasFired: false, gfx,
      })
    }
  }

  spawn(x: number, y: number, opts?: { radius?: number; damage?: number; telegraph?: number }) {
    const slot = this.strikes.find((s) => !s.active)
    if (!slot) return
    slot.active = true
    slot.x = x
    slot.y = y
    slot.radius = opts?.radius ?? 28
    slot.damage = opts?.damage ?? 2
    slot.age = 0
    slot.telegraphDuration = opts?.telegraph ?? 0.9
    slot.hitDuration = 0.25
    slot.hasFired = false
    slot.gfx.visible = true
  }

  /** Returns array of strikes that fired this frame (for collision damage). */
  update(ds: number): Array<{ x: number; y: number; radius: number; damage: number }> {
    const fired: Array<{ x: number; y: number; radius: number; damage: number }> = []
    for (const s of this.strikes) {
      if (!s.active) continue
      s.age += ds
      const total = s.telegraphDuration + s.hitDuration
      if (s.age >= total) {
        s.active = false
        s.gfx.visible = false
        s.gfx.clear()
        continue
      }
      const inTelegraph = s.age < s.telegraphDuration
      if (!inTelegraph && !s.hasFired) {
        s.hasFired = true
        fired.push({ x: s.x, y: s.y, radius: s.radius, damage: s.damage })
      }
      const g = s.gfx
      g.clear()
      g.x = s.x
      g.y = s.y
      if (inTelegraph) {
        const t = s.age / s.telegraphDuration
        const pulse = 0.4 + Math.sin(s.age * 22) * 0.25
        g.circle(0, 0, s.radius).stroke({ color: 0xff4444, width: 2, alpha: 0.7 })
        g.circle(0, 0, s.radius * t).fill({ color: 0xff2222, alpha: pulse * 0.45 })
        g.circle(0, 0, 4).fill(0xffaaaa)
      } else {
        const t = (s.age - s.telegraphDuration) / s.hitDuration
        const a = 1 - t
        g.circle(0, 0, s.radius * (1 + t * 0.4)).fill({ color: 0xffaa44, alpha: a * 0.6 })
        g.circle(0, 0, s.radius * (1 + t * 0.2)).stroke({ color: 0xffffff, width: 3, alpha: a })
      }
    }
    return fired
  }

  destroy() {
    for (const s of this.strikes) s.gfx.destroy()
    this.strikes = []
  }
}
