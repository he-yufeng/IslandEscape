import { Container, Graphics } from 'pixi.js'
import { GAME_CONFIG } from '@game/shared'

const ARENA_W = 640
const ARENA_H = 480
const BOSS_RADIUS = 26
const BOSS_SPEED = 80
const SHOOT_COOLDOWN = 1.6
const CHARGE_COOLDOWN = 4.0
const RING_COOLDOWN = 6.0
const SUMMON_COOLDOWN = 8.0
const CHARGE_SPEED = 280
const CHARGE_DURATION = 0.8
const WINDUP_DURATION = 0.5
const STUN_DURATION = 1.0
const SUMMON_WINDUP = 0.6
const HIT_FLASH_DURATION = 0.12
const DEATH_DURATION = 0.9

type BossState =
  | 'idle' | 'winding_up' | 'shooting' | 'charging' | 'stunned'
  | 'summoning' | 'ring_shooting' | 'dying' | 'dead'
type WindupTrigger = 'shoot' | 'charge' | 'ring' | null

interface LightningBolt {
  baseAngle: number
  age: number
  duration: number
  segs: Array<{ x: number; y: number }>
}

export class Boss {
  public x: number
  public y: number
  public hp: number
  public maxHp: number
  public radius = BOSS_RADIUS

  private gfx: Graphics
  /** Separate aura layer drawn under the body so it visually wraps the boss. */
  private auraGfx: Graphics
  private state: BossState = 'idle'
  private nextWindupTrigger: WindupTrigger = null
  private stateTimer = 0
  private shootTimer = 0
  private chargeTimer = 0
  private ringTimer = 0
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

  // Visual animation state
  private tentaclePhase = 0
  private corePulse = 0
  /** Player position — tracked so eyes can look toward the player. */
  private lookAtX = ARENA_W / 2
  private lookAtY = ARENA_H / 2
  private lightning: LightningBolt[] = []
  private lightningSpawnTimer = 0
  /** Fades 0→1 each time a phase boundary is crossed; used for entry pulse. */
  private phaseEntryFlash = 0

  // Callbacks
  public onShoot: ((angle: number, count: number, speedMul: number) => void) | null = null
  public onRingShoot: ((count: number, speedMul: number) => void) | null = null
  public onChargeEnd: (() => void) | null = null
  public onXPOrbSpawn: ((x: number, y: number, count: number) => void) | null = null
  public onSummon: ((x: number, y: number) => void) | null = null
  public onSpawnMinion: ((x: number, y: number) => void) | null = null
  public onDeathComplete: (() => void) | null = null
  public onPhaseEnter: ((phase: 2 | 3) => void) | null = null

  constructor(container: Container) {
    this.x = ARENA_W / 2
    this.y = 90
    this.maxHp = GAME_CONFIG.BOSS_MAX_HP
    this.hp = this.maxHp

    this.auraGfx = new Graphics()
    container.addChild(this.auraGfx)
    this.gfx = new Graphics()
    container.addChild(this.gfx)
  }

  takeDamage(amount: number) {
    if (this.state === 'dying' || this.state === 'dead') return
    this.hp = Math.max(0, this.hp - amount)
    this.eyeGlow = 0.4
    this.hitFlashTimer = HIT_FLASH_DURATION

    const orbCount = 1 + Math.floor(Math.random() * 2)
    this.onXPOrbSpawn?.(this.x, this.y, orbCount)

    if (this.hp <= this.maxHp / 2 && !this.phase2) {
      this.phase2 = true
      this.phaseEntryFlash = 1
      this.onPhaseEnter?.(2)
    }
    if (this.hp <= this.maxHp / 4 && !this.phase3) {
      this.phase3 = true
      this.phaseEntryFlash = 1
      this.onPhaseEnter?.(3)
    }

    if (this.hp <= 0) {
      this.state = 'dying'
      this.stateTimer = 0
      this.deathTimer = 0
    }
  }

  update(dt: number, playerX: number, playerY: number) {
    const ds = dt * 0.016

    this.eyeGlow = Math.max(0, this.eyeGlow - ds * 2)
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - ds)
    this.tentaclePhase += ds * 1.4
    this.corePulse += ds * 2.2
    this.phaseEntryFlash = Math.max(0, this.phaseEntryFlash - ds * 1.6)
    this.lookAtX = playerX
    this.lookAtY = playerY
    this.stateTimer += ds

    // Phase 3 — periodically emit lightning bolts
    if (this.phase3 && this.state !== 'dying' && this.state !== 'dead') {
      this.lightningSpawnTimer += ds
      if (this.lightningSpawnTimer > 0.18 && this.lightning.length < 3) {
        this.lightningSpawnTimer = 0
        this.spawnLightning()
      }
    }
    for (let i = this.lightning.length - 1; i >= 0; i--) {
      const b = this.lightning[i]!
      b.age += ds
      if (b.age >= b.duration) this.lightning.splice(i, 1)
    }

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
        if (this.phase2) {
          this.summonTimer += ds
          this.ringTimer += ds
        }

        if (this.phase2 && this.summonTimer >= SUMMON_COOLDOWN * cooldownMul) {
          this.summonTimer = 0
          this.state = 'summoning'
          this.stateTimer = 0
          this.pendingSummonX = playerX
          this.pendingSummonY = playerY
        } else if (this.phase2 && this.ringTimer >= RING_COOLDOWN * cooldownMul) {
          this.ringTimer = 0
          this.state = 'winding_up'
          this.stateTimer = 0
          this.nextWindupTrigger = 'ring'
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
          const chargeSpeedMul = this.phase3 ? 1.4 : 1.0
          this.chargeVx = Math.cos(this.chargeAngle) * CHARGE_SPEED * chargeSpeedMul
          this.chargeVy = Math.sin(this.chargeAngle) * CHARGE_SPEED * chargeSpeedMul
        }
        break

      case 'winding_up':
        if (this.stateTimer >= WINDUP_DURATION) {
          if (this.nextWindupTrigger === 'charge') {
            this.state = 'charging'
            this.stateTimer = 0
          } else if (this.nextWindupTrigger === 'ring') {
            this.state = 'ring_shooting'
            this.stateTimer = 0
            const ringCount = this.phase3 ? 12 : 8
            const ringSpeedMul = this.phase3 ? 1.2 : 1.0
            this.onRingShoot?.(ringCount, ringSpeedMul)
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
        if (this.stateTimer >= 0.3) this.state = 'idle'
        break

      case 'ring_shooting':
        if (this.stateTimer >= 0.4) this.state = 'idle'
        break

      case 'charging':
        this.x += this.chargeVx * ds
        this.y += this.chargeVy * ds
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
        if (this.stateTimer >= STUN_DURATION) this.state = 'idle'
        break

      case 'summoning':
        if (this.stateTimer >= SUMMON_WINDUP) {
          this.onSummon?.(this.pendingSummonX, this.pendingSummonY)
          // Phase 2 spawns 1 shadow imp; phase 3 spawns 2 — stays threatening
          // without flooding the arena.
          if (this.onSpawnMinion) {
            const count = this.phase3 ? 2 : 1
            for (let i = 0; i < count; i++) {
              const a = Math.random() * Math.PI * 2
              const r = BOSS_RADIUS + 6
              this.onSpawnMinion(
                this.x + Math.cos(a) * r,
                this.y + Math.sin(a) * r,
              )
            }
          }
          this.state = 'idle'
        }
        break
    }

    this.draw()
  }

  private spawnLightning() {
    const segCount = 5
    const baseAngle = Math.random() * Math.PI * 2
    const length = 28 + Math.random() * 18
    const segs: Array<{ x: number; y: number }> = []
    for (let i = 0; i <= segCount; i++) {
      const t = i / segCount
      const r = BOSS_RADIUS + length * t
      const wobble = (Math.random() - 0.5) * 8 * (i === 0 || i === segCount ? 0 : 1)
      const a = baseAngle
      const perp = a + Math.PI / 2
      segs.push({
        x: Math.cos(a) * r + Math.cos(perp) * wobble,
        y: Math.sin(a) * r + Math.sin(perp) * wobble,
      })
    }
    this.lightning.push({
      baseAngle,
      age: 0,
      duration: 0.18 + Math.random() * 0.1,
      segs,
    })
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

  // ============================================================
  // Drawing
  // ============================================================

  private draw() {
    const g = this.gfx
    const ag = this.auraGfx
    g.clear()
    ag.clear()

    if (this.state === 'dying') {
      this.drawDying(g, ag)
      return
    }
    if (this.state === 'dead') return

    const phase = this.phase3 ? 3 : (this.phase2 ? 2 : 1)
    const palette = this.colorPalette(phase)

    // Hit-flash jitter
    const jitter = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 4 : 0
    g.x = this.x + jitter
    g.y = this.y + jitter
    ag.x = this.x
    ag.y = this.y

    // ---- Aura ring (under everything) ----
    const auraOuter = BOSS_RADIUS + 12 + Math.sin(this.corePulse * 0.8) * 4
    const auraInner = BOSS_RADIUS + 6
    const auraAlpha = 0.18 + Math.sin(this.corePulse * 1.4) * 0.08 + this.phaseEntryFlash * 0.5
    ag.circle(0, 0, auraOuter).fill({ color: palette.aura, alpha: auraAlpha })
    ag.circle(0, 0, auraInner).fill({ color: palette.aura, alpha: auraAlpha * 0.5 })
    // Outer rim ring
    ag.circle(0, 0, auraOuter + 2).stroke({ color: palette.auraRim, width: 1.5, alpha: 0.6 })

    // ---- Lightning (phase 3) ----
    for (const b of this.lightning) {
      const t = 1 - b.age / b.duration
      // Two-pass stroke for halo + core
      g.moveTo(b.segs[0]!.x, b.segs[0]!.y)
      for (let i = 1; i < b.segs.length; i++) {
        const s = b.segs[i]!
        g.lineTo(s.x, s.y)
      }
      g.stroke({ color: 0xffaaff, width: 4, alpha: t * 0.45 })

      g.moveTo(b.segs[0]!.x, b.segs[0]!.y)
      for (let i = 1; i < b.segs.length; i++) {
        const s = b.segs[i]!
        g.lineTo(s.x, s.y)
      }
      g.stroke({ color: 0xffffff, width: 1.5, alpha: t })
    }

    // ---- Tentacles ----
    const tentacleCount = phase === 3 ? 10 : 8
    for (let i = 0; i < tentacleCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / tentacleCount + this.tentaclePhase * 0.2
      const sway = Math.sin(this.tentaclePhase * 1.4 + i * 0.7) * 0.45
      const tipAngle = baseAngle + sway
      const tipDist = BOSS_RADIUS + 14 + Math.sin(this.tentaclePhase * 2 + i) * 5
      const midDist = BOSS_RADIUS + 5
      const baseX = Math.cos(baseAngle) * (BOSS_RADIUS - 2)
      const baseY = Math.sin(baseAngle) * (BOSS_RADIUS - 2)
      const midAngle = (baseAngle + tipAngle) / 2
      const midX = Math.cos(midAngle) * midDist
      const midY = Math.sin(midAngle) * midDist
      const tipX = Math.cos(tipAngle) * tipDist
      const tipY = Math.sin(tipAngle) * tipDist

      // Outline
      g.moveTo(baseX, baseY).lineTo(midX, midY).lineTo(tipX, tipY)
        .stroke({ color: 0x150000, width: 5.5, alpha: 0.65 })
      // Core
      g.moveTo(baseX, baseY).lineTo(midX, midY).lineTo(tipX, tipY)
        .stroke({ color: palette.tentacle, width: 3.5, alpha: 0.95 })
      // Tip blob (suction cup)
      g.circle(tipX, tipY, 2.4).fill(palette.tentacleTip)
    }

    // ---- Body shadow ----
    g.ellipse(0, BOSS_RADIUS + 4, BOSS_RADIUS - 2, 4).fill({ color: 0x000000, alpha: 0.35 })

    // ---- Body (with windup pulse) ----
    const windupScale = (this.state === 'winding_up' || this.state === 'summoning')
      ? 1 + Math.sin(this.stateTimer * 12) * 0.13
      : 1
    const stunnedAlpha = (this.state === 'stunned') ? 0.55 : 1
    const r = BOSS_RADIUS * windupScale

    // Outer flesh
    g.circle(0, 0, r).fill({ color: palette.body, alpha: stunnedAlpha })
    // Inner core
    const coreR = r * 0.66 + Math.sin(this.corePulse) * 1.8
    g.circle(0, 0, coreR).fill({ color: palette.core, alpha: stunnedAlpha })
    // Beating heart
    const heartR = r * 0.32 + (Math.sin(this.corePulse * 1.6) * 0.5 + 0.5) * 3.5
    g.circle(0, 0, heartR).fill({ color: palette.heart, alpha: 0.9 })

    // Veins from core to rim (phase 2+)
    if (phase >= 2) {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + this.tentaclePhase * 0.15
        const x1 = Math.cos(a) * (r * 0.3)
        const y1 = Math.sin(a) * (r * 0.3)
        const x2 = Math.cos(a) * (r * 0.92)
        const y2 = Math.sin(a) * (r * 0.92)
        g.moveTo(x1, y1).lineTo(x2, y2)
          .stroke({ color: palette.vein, width: 1.5, alpha: 0.75 })
      }
    }

    // Hit-flash white overlay
    if (this.hitFlashTimer > 0) {
      const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.7
      g.circle(0, 0, r).fill({ color: 0xffffff, alpha: flashAlpha })
    }

    // ---- Eyes that track the player ----
    this.drawEyes(g, palette, r)

    // ---- Telegraph indicators on top ----
    if (this.state === 'winding_up' && this.nextWindupTrigger === 'charge') {
      g.moveTo(0, 0).lineTo(
        Math.cos(this.chargeAngle) * BOSS_RADIUS * 1.6,
        Math.sin(this.chargeAngle) * BOSS_RADIUS * 1.6,
      ).stroke({ color: 0xff5050, width: 4, alpha: 0.9 })
      // Marker triangle at the tip
      const tipX = Math.cos(this.chargeAngle) * BOSS_RADIUS * 1.6
      const tipY = Math.sin(this.chargeAngle) * BOSS_RADIUS * 1.6
      g.circle(tipX, tipY, 5).fill({ color: 0xff5050, alpha: 0.9 })
    }
    if (this.state === 'winding_up' && this.nextWindupTrigger === 'ring') {
      const t = Math.min(1, this.stateTimer / WINDUP_DURATION)
      const ringR = BOSS_RADIUS * (1.4 + t * 0.9)
      g.circle(0, 0, ringR).stroke({ color: 0xff8844, width: 2.5, alpha: 0.85 - t * 0.4 })
      g.circle(0, 0, ringR * 0.7).stroke({ color: 0xffaa44, width: 1, alpha: 0.6 - t * 0.3 })
    }
    if (this.state === 'summoning') {
      const ringR = BOSS_RADIUS + 10 + Math.sin(this.stateTimer * 14) * 5
      g.circle(0, 0, ringR).stroke({ color: 0xaa44ff, width: 2.5, alpha: 0.8 })
      // Sparkle dots around the ring
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + this.stateTimer * 4
        g.circle(Math.cos(a) * ringR, Math.sin(a) * ringR, 1.8)
          .fill({ color: 0xee88ff, alpha: 0.9 })
      }
    }

    // ---- Phase entry flash ring ----
    if (this.phaseEntryFlash > 0) {
      const eR = BOSS_RADIUS + (1 - this.phaseEntryFlash) * 80
      g.circle(0, 0, eR).stroke({ color: palette.aura, width: 4, alpha: this.phaseEntryFlash })
    }
  }

  private drawEyes(g: Graphics, palette: ReturnType<typeof this.colorPalette>, r: number) {
    const eyeR = 5.5
    const eyeY = -3
    const eyeOff = 9.5
    const lookAngle = Math.atan2(this.lookAtY - this.y, this.lookAtX - this.x)
    const pupilOffX = Math.cos(lookAngle) * 2.2
    const pupilOffY = Math.sin(lookAngle) * 2.2

    // Eye whites (slightly tinted)
    g.circle(-eyeOff, eyeY, eyeR).fill(0xfff7e0)
    g.circle(eyeOff, eyeY, eyeR).fill(0xfff7e0)

    // Pupils — track the player
    const pupilColor = this.eyeGlow > 0 ? 0xff3333 : palette.pupil
    g.circle(-eyeOff + pupilOffX, eyeY + pupilOffY, eyeR * 0.55).fill(pupilColor)
    g.circle(eyeOff + pupilOffX, eyeY + pupilOffY, eyeR * 0.55).fill(pupilColor)

    // Glow on damage
    if (this.eyeGlow > 0) {
      g.circle(-eyeOff, eyeY, eyeR * 0.9).fill({ color: 0xff4444, alpha: this.eyeGlow * 0.6 })
      g.circle(eyeOff, eyeY, eyeR * 0.9).fill({ color: 0xff4444, alpha: this.eyeGlow * 0.6 })
    }

    // Tiny highlight dot — adds life
    g.circle(-eyeOff + pupilOffX - 1.2, eyeY + pupilOffY - 1.2, 0.9).fill({ color: 0xffffff, alpha: 0.9 })
    g.circle(eyeOff + pupilOffX - 1.2, eyeY + pupilOffY - 1.2, 0.9).fill({ color: 0xffffff, alpha: 0.9 })

    // Phase 3: arcing brow
    if (this.phase3) {
      g.moveTo(-eyeOff - 4, eyeY - eyeR).lineTo(-eyeOff + eyeR, eyeY - eyeR - 1)
        .stroke({ color: 0x551166, width: 1.5, alpha: 0.9 })
      g.moveTo(eyeOff - eyeR, eyeY - eyeR - 1).lineTo(eyeOff + 4, eyeY - eyeR)
        .stroke({ color: 0x551166, width: 1.5, alpha: 0.9 })
    }
    // Suppress unused warning when r passed but only used here for future tweaks.
    void r
  }

  private drawDying(g: Graphics, ag: Graphics) {
    const t = this.deathTimer / DEATH_DURATION
    const flicker = (Math.floor(this.deathTimer * 22) % 2 === 0) ? 1 : 0.35
    g.x = this.x
    g.y = this.y
    ag.x = this.x
    ag.y = this.y

    // Expanding shockwave
    const wave = BOSS_RADIUS * (1 + t * 4)
    ag.circle(0, 0, wave).stroke({ color: 0xffffff, width: 4 * (1 - t), alpha: 1 - t })
    ag.circle(0, 0, wave * 0.7).stroke({ color: 0xffaa55, width: 2, alpha: (1 - t) * 0.7 })

    // Body burst
    const scale = 1 + t * 1.4
    g.circle(0, 0, BOSS_RADIUS * scale).fill({ color: 0xffaa44, alpha: (1 - t) * flicker * 0.55 })
    g.circle(0, 0, BOSS_RADIUS * scale * 0.7).fill({ color: 0xffffff, alpha: (1 - t) * flicker * 0.85 })

    // Radial debris streaks
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12
      const len = BOSS_RADIUS * (1.5 + t * 3)
      g.moveTo(Math.cos(a) * BOSS_RADIUS * 0.6, Math.sin(a) * BOSS_RADIUS * 0.6)
        .lineTo(Math.cos(a) * len, Math.sin(a) * len)
        .stroke({ color: 0xffd06a, width: 2 * (1 - t), alpha: 1 - t })
    }
  }

  private colorPalette(phase: 1 | 2 | 3) {
    switch (phase) {
      case 1:
        return {
          body: 0xa44030,
          core: 0xc05540,
          heart: 0xff5e30,
          tentacle: 0x6a2018,
          tentacleTip: 0x8a2a20,
          vein: 0xff7044,
          aura: 0xff5e30,
          auraRim: 0xff9a66,
          pupil: 0x101010,
        }
      case 2:
        return {
          body: 0x8a1818,
          core: 0xb83030,
          heart: 0xff3030,
          tentacle: 0x4a0606,
          tentacleTip: 0x801818,
          vein: 0xff5050,
          aura: 0xe83040,
          auraRim: 0xff8090,
          pupil: 0x300010,
        }
      case 3:
        return {
          body: 0x3a1066,
          core: 0x6020a0,
          heart: 0xc080ff,
          tentacle: 0x180530,
          tentacleTip: 0x602080,
          vein: 0xc080ff,
          aura: 0xa040ff,
          auraRim: 0xe0a0ff,
          pupil: 0x101030,
        }
    }
  }

  // ============================================================
  // Public getters
  // ============================================================

  getPosition(): { x: number; y: number } { return { x: this.x, y: this.y } }
  isCharging(): boolean { return this.state === 'charging' }
  isPhase3(): boolean { return this.phase3 }
  isPhase2(): boolean { return this.phase2 }
  isDying(): boolean { return this.state === 'dying' }
  isDead(): boolean { return this.state === 'dead' }
  getChargeDamage(): number { return GAME_CONFIG.BOSS_CHARGE_DAMAGE }

  destroy() {
    this.gfx.destroy()
    this.auraGfx.destroy()
  }
}
