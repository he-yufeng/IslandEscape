import { Container, Graphics, Text } from 'pixi.js'
import type { InputManager } from '../InputManager'
import { PlayerCombat } from './PlayerCombat'
import { Boss } from './Boss'
import { BulletPool } from './Bullet'
import { XPOrbPool } from './XPOrb'
import { MinionPool } from './Minion'
import {
  ScreenShaker,
  HitSparkPool,
  DamageNumberPool,
  VignetteOverlay,
  GroundStrikePool,
  HitStop,
  ScreenFlash,
} from './Effects'
import {
  playShoot, playFlash, playUltimate, playBossHit, playPlayerHit,
  playBossShoot, playCardPick, playXPCollect, playBossDefeated,
  playPlayerDied, startDungeonBGM, stopBGM,
} from './AudioManager'

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
  private minions!: MinionPool
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
  private hitStop = new HitStop()
  private hitSparks!: HitSparkPool
  private damageNumbers!: DamageNumberPool
  private vignette!: VignetteOverlay
  private screenFlash!: ScreenFlash
  private strikes!: GroundStrikePool

  // Player progression bookkeeping
  private lifestealHitCount = 0
  private bossDeathPending = false
  /** Accumulator for fractional HP regen (heals 1 HP each time it crosses 1.0). */
  private regenAccumulator = 0

  // Combo system — chain consecutive bullet→boss hits for a damage multiplier.
  private comboCount = 0
  private comboTimer = 0
  /** Combo decays after this many seconds of no hits. */
  private static readonly COMBO_TIMEOUT = 2.5
  private comboText: Text | null = null
  private comboTextScale = 1

  // ============================================================
  // Wave / encounter pacing
  // ============================================================

  /** 'minions_only' = pre-fight, boss is hidden. 'boss_warning' = banner + fade-in.
   *  'boss_active' = full fight where boss attacks and additional minions trickle in. */
  private wavePhase: 'minions_only' | 'boss_warning' | 'boss_active' = 'minions_only'
  private waveTimer = 0
  private edgeMinionTimer = 0
  /** Banner Text used for 'A GREAT EVIL APPROACHES' and 'FIGHT!' announcements. */
  private waveBanner: Text | null = null
  private waveBannerTimer = 0
  private waveBannerDuration = 0

  /** Tunables — base values; the actual interval/cap is scaled per day in init(). */
  private static readonly INTRO_DURATION = 8.0   // seconds of minion-only intro
  private static readonly WARNING_DURATION = 3.0 // boss fade-in + banner
  private static readonly INTRO_SPAWN_INTERVAL_BASE = 1.5
  private static readonly BOSS_SPAWN_INTERVAL_BASE = 4.5
  private static readonly INTRO_MAX_MINIONS_BASE = 4
  private static readonly BOSS_MAX_MINIONS_BASE = 5

  /** Day this dungeon run was launched on. Drives all scaling formulas. */
  private dayLevel = 1

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

  init(dayLevel = 1) {
    startDungeonBGM()
    this.dayLevel = Math.max(1, Math.floor(dayLevel))
    this.drawArena()

    this.player = new PlayerCombat(this)
    this.player.onUltimate = () => {
      this.playerUltimate()
      this.shaker.trigger(10, 0.3)
      this.hitStop.trigger(0.06)
      this.screenFlash.trigger(0.18, 0.4, 0xfff0aa)
    }
    this.player.onFlash = (sx, sy, ex, ey) => this.spawnFlashEffect(sx, sy, ex, ey)
    this.boss = new Boss(this)

    this.boss.onShoot = (angle, count, speedMul) => this.bossShoot(angle, count, speedMul)
    this.boss.onRingShoot = (count, speedMul) => this.bossRingShoot(count, speedMul)
    this.boss.onChargeEnd = () => {} // handled by collision detection
    this.boss.onXPOrbSpawn = (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const orb = this.orbs.getInactive()
        orb?.spawn(x, y, GAME_CONFIG.XP_PER_ORB)
      }
    }
    this.boss.onSummon = (x, y) => {
      // Spawn strikes around the captured player position; phase 3 spawns more
      this.strikes.spawn(x, y, { radius: 30, damage: 2, telegraph: 0.9 })
      this.strikes.spawn(x + 50, y - 30, { radius: 26, damage: 2, telegraph: 1.0 })
      this.strikes.spawn(x - 50, y + 20, { radius: 26, damage: 2, telegraph: 1.0 })
      if (this.boss.isPhase3()) {
        this.strikes.spawn(x + 30, y + 60, { radius: 26, damage: 2, telegraph: 1.1 })
        this.strikes.spawn(x - 70, y - 60, { radius: 26, damage: 2, telegraph: 1.2 })
      }
    }
    this.boss.onDeathComplete = () => {
      this.bossDeathPending = false
      stopBGM()
      playBossDefeated()
      this.fire({
        type: 'boss_defeated',
        damageDealt: this.totalDamageDealt,
        damageTaken: this.totalDamageTaken,
        cardsCollected: this.cardSystem.currentLevel,
      })
    }
    this.boss.onSpawnMinion = (x, y) => {
      this.minions.spawn(x, y, this.minionHp())
    }
    this.boss.onPhaseEnter = (phase) => {
      // Phase transition — punchy flash + shake + brief hit-stop
      this.screenFlash.trigger(0.45, phase === 3 ? 0.85 : 0.7, phase === 3 ? 0xc080ff : 0xffaaaa)
      this.shaker.trigger(phase === 3 ? 14 : 10, 0.4)
      this.hitStop.trigger(0.08)
    }

    this.bullets = new BulletPool(this, ARENA_W, ARENA_H)
    this.orbs = new XPOrbPool(this)
    this.minions = new MinionPool(this)
    this.cardSystem = createCardSystem()
    // Scale boss difficulty for this run.
    this.boss.setDifficulty(this.dayLevel)

    // Feedback layers (built after main entities so they render on top)
    this.hitSparks = new HitSparkPool(this.effectsLayer)
    this.strikes = new GroundStrikePool(this.effectsLayer)
    this.damageNumbers = new DamageNumberPool(this.effectsLayer)
    this.vignette = new VignetteOverlay(this.effectsLayer, ARENA_W, ARENA_H)
    this.screenFlash = new ScreenFlash(this.effectsLayer, ARENA_W, ARENA_H)

    this.active = true
    this.paused = false
    this.totalDamageDealt = 0
    this.totalDamageTaken = 0
    this.lifestealHitCount = 0
    this.bossDeathPending = false
    this.regenAccumulator = 0
    this.comboCount = 0
    this.comboTimer = 0

    // Wave pacing — boss starts dormant + invisible while a small minion swarm
    // gives the player a chance to warm up.
    this.wavePhase = 'minions_only'
    this.waveTimer = 0
    this.edgeMinionTimer = 0.5
    this.boss.setActive(false)
    this.boss.setAppearAlpha(0)

    // Combo display — top-right of the arena
    if (!this.comboText) {
      this.comboText = new Text({
        text: '',
        style: {
          fontFamily: 'monospace',
          fontSize: 22,
          fontWeight: 'bold',
          fill: 0xffd54a,
          stroke: { color: 0x110a00, width: 4 },
        },
      })
      this.comboText.anchor.set(1, 0)
      this.comboText.x = ARENA_W - 12
      this.comboText.y = 12
      this.effectsLayer.addChild(this.comboText)
    }
    this.comboText.visible = false

    // Wave banner — center of arena, hidden until announced
    if (!this.waveBanner) {
      this.waveBanner = new Text({
        text: '',
        style: {
          fontFamily: 'monospace',
          fontSize: 28,
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 5 },
          align: 'center',
        },
      })
      this.waveBanner.anchor.set(0.5, 0.5)
      this.waveBanner.x = ARENA_W / 2
      this.waveBanner.y = ARENA_H / 3
      this.effectsLayer.addChild(this.waveBanner)
    }
    this.waveBanner.visible = false

    // First-second taunt — let the player know combat is starting.
    this.showWaveBanner('SHADOWS APPROACH', 0xff9090, 1.6)
  }

  private drawArena() {
    const g = this.arenaGfx
    g.clear()
    // Floor — gradient-feel via base + dark overlay
    g.rect(0, 0, ARENA_W, ARENA_H).fill(0x12121e)
    // Floor tiles with depth via radial darkening
    const cx = ARENA_W / 2
    const cy = ARENA_H / 2
    const maxDist = Math.sqrt(cx * cx + cy * cy)
    for (let y = 0; y < ARENA_H; y += 40) {
      for (let x = 0; x < ARENA_W; x += 40) {
        const checker = ((x / 40 + y / 40) % 2 === 0) ? 0x1e1e32 : 0x222238
        g.rect(x, y, 40, 40).fill(checker).stroke({ color: 0x2a2a44, width: 0.5 })
        // Random cracks on ~1/8 of tiles for atmosphere
        const seed = (x * 31 + y * 17) % 8
        if (seed === 0) {
          const cxx = x + 20
          const cyy = y + 20
          g.moveTo(cxx - 8, cyy - 4).lineTo(cxx, cyy).lineTo(cxx + 6, cyy + 7)
            .stroke({ color: 0x0a0a14, width: 1, alpha: 0.7 })
        } else if (seed === 3) {
          // Bloodstain
          g.ellipse(x + 16, y + 22, 4, 2).fill({ color: 0x6b0c0c, alpha: 0.55 })
          g.circle(x + 22, y + 18, 1.5).fill({ color: 0x6b0c0c, alpha: 0.45 })
        }
        // Subtle radial darkening for vignette feel
        const dx = x + 20 - cx
        const dy = y + 20 - cy
        const d = Math.sqrt(dx * dx + dy * dy)
        const darken = Math.min(1, d / maxDist) * 0.45
        if (darken > 0.05) {
          g.rect(x, y, 40, 40).fill({ color: 0x000000, alpha: darken })
        }
      }
    }
    // Outer wall — thicker, with carved stone look
    g.rect(0, 0, ARENA_W, ARENA_H).stroke({ color: 0x554466, width: 8 })
    g.rect(2, 2, ARENA_W - 4, ARENA_H - 4).stroke({ color: 0x2a2238, width: 2 })

    // Broken pillars in corners + mid-walls (decorative + atmosphere)
    this.drawPillar(g, 50, 50)
    this.drawPillar(g, ARENA_W - 50, 50)
    this.drawPillar(g, 50, ARENA_H - 60)
    this.drawPillar(g, ARENA_W - 50, ARENA_H - 60)
    this.drawPillar(g, ARENA_W / 2, 30, true)
    this.drawPillar(g, ARENA_W / 2, ARENA_H - 30, true)

    // Torches (corners) — slightly larger now
    this.drawTorch(g, 22, 22)
    this.drawTorch(g, ARENA_W - 22, 22)
    this.drawTorch(g, 22, ARENA_H - 32)
    this.drawTorch(g, ARENA_W - 22, ARENA_H - 32)
  }

  private drawPillar(g: Graphics, x: number, y: number, broken = false) {
    // Base
    g.ellipse(x, y + 12, 11, 3.5).fill({ color: 0x000000, alpha: 0.55 })
    // Stone block
    if (broken) {
      // Snapped at the top — jagged outline
      g.poly([x - 8, y + 8, x - 9, y - 4, x - 5, y - 6, x - 2, y - 2, x + 1, y - 6, x + 6, y - 4, x + 9, y + 1, x + 8, y + 8])
        .fill(0x4a4456)
        .stroke({ color: 0x2a2238, width: 1.5 })
    } else {
      g.rect(x - 8, y - 12, 16, 24).fill(0x4a4456).stroke({ color: 0x2a2238, width: 1.5 })
      // Cap
      g.rect(x - 10, y - 14, 20, 4).fill(0x5c5466)
    }
    // Crack
    g.moveTo(x - 2, y - 6).lineTo(x + 1, y - 1).lineTo(x - 1, y + 4)
      .stroke({ color: 0x1a1426, width: 1, alpha: 0.85 })
  }

  private drawTorch(g: Graphics, x: number, y: number) {
    // Sconce (metal bracket)
    g.rect(x - 3, y + 1, 6, 3).fill(0x1a1018)
    // Outer halo (brighter, bigger)
    g.circle(x, y - 1, 14).fill({ color: 0xffaa44, alpha: 0.18 })
    g.circle(x, y - 1, 9).fill({ color: 0xffcc66, alpha: 0.32 })
    // Flame core
    g.circle(x, y - 2, 4.5).fill(0xffaa44)
    g.circle(x, y - 3, 2.6).fill(0xffee99)
    g.circle(x, y - 4, 1.2).fill(0xffffff)
    // Flame tip wisp
    g.poly([x - 1.5, y - 5, x, y - 9, x + 1.5, y - 5]).fill({ color: 0xffcc66, alpha: 0.7 })
  }

  spawnFlashEffect(startX: number, startY: number, endX: number, endY: number) {
    playFlash()
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
    playUltimate()
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
    playBossShoot()
    const spread = 0.3
    const startAngle = angle - (spread * (count - 1)) / 2
    const dmg = this.boss.scaledBulletDamage()
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
          damage: dmg,
          size: 8,
          piercing: 0,
          owner: 'boss',
        })
      }
    }
  }

  private bossRingShoot(count: number, speedMul = 1) {
    const speed = (140 + Math.random() * 30) * speedMul
    const offset = Math.random() * Math.PI * 2
    const dmg = this.boss.scaledBulletDamage()
    for (let i = 0; i < count; i++) {
      const a = offset + (Math.PI * 2 * i) / count
      const bullet = this.bullets.getInactive()
      if (bullet) {
        bullet.spawn({
          x: this.boss.x,
          y: this.boss.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          damage: dmg,
          size: 8,
          piercing: 0,
          owner: 'boss',
        })
      }
    }
    this.shaker.trigger(4, 0.18)
  }

  /** Check if the game should pause for card picker */
  shouldPause(): boolean {
    const needed = getXpForNextLevel(this.cardSystem.currentLevel)
    return this.cardSystem.currentXP >= needed && this.active && !this.paused
  }

  /** Trigger card picker */
  triggerCardPick(): CardDef[] {
    playCardPick()
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
    const ds = dt * 0.016

    // Hit-stop first — when frozen, only the screen flash + visual ds advances.
    const stillFrozen = this.hitStop.tick(ds)
    if (stillFrozen) {
      // Keep visual feedback alive even while sim is paused.
      this.screenFlash.update(ds)
      const offset = this.shaker.update(ds * 1.5)
      this.position.set(offset.x, offset.y)
      input.clearFrameState()
      return
    }

    if (!this.active || this.paused) {
      // Even when paused, drift the shake offset back toward zero
      const o = this.shaker.update(ds)
      this.position.set(o.x, o.y)
      this.screenFlash.update(ds)
      input.clearFrameState()
      return
    }

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
      const angle = Math.atan2(mouseY - this.player.y, mouseX - this.player.x)
      this.player.markShot(now, angle)
      playShoot()
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

    // Update XP orbs (magnet range scaled by player's magnet card)
    this.orbs.updateAll(dt, this.player.x, this.player.y, this.player.effects.magnetRange ?? 1)

    // HP regen — accumulator pattern so fractional regen doesn't get truncated
    const regen = this.player.effects.hpRegenPerSec ?? 0
    if (regen > 0 && this.player.hp < this.player.maxHp) {
      this.regenAccumulator += regen * ds
      if (this.regenAccumulator >= 1) {
        const heal = Math.floor(this.regenAccumulator)
        this.regenAccumulator -= heal
        this.player.heal(heal)
        this.damageNumbers.spawn(this.player.x + 6, this.player.y - 18, `+${heal}`, 0x88ff88, { fontSize: 11 })
      }
    }

    // Wave pacing — drives intro minions, the boss-warning banner, and the
    // additional periodic minion spawns during the boss fight.
    this.tickWavePhase(ds)
    this.tickWaveBanner(ds)

    // Combo decay
    if (this.comboCount > 0) {
      this.comboTimer -= ds
      if (this.comboTimer <= 0) {
        this.comboCount = 0
        if (this.comboText) this.comboText.visible = false
      }
    }
    // Combo text squash-and-stretch decay
    if (this.comboTextScale !== 1) {
      this.comboTextScale += (1 - this.comboTextScale) * Math.min(1, ds * 8)
      if (this.comboText) this.comboText.scale.set(this.comboTextScale)
    }

    // Update minions — chase player, explode on contact
    this.minions.update(dt, this.player.x, this.player.y, this.player.getRadius(), (m) => {
      // Minion exploded into the player — apply damage with full feedback.
      const dmg = 3
      const hit = this.player.takeDamage(dmg)
      if (hit) {
        this.totalDamageTaken += dmg
        this.damageNumbers.spawn(this.player.x, this.player.y - 14, String(dmg), 0xff7777, { fontSize: 14 })
        this.onPlayerHurt(dmg)
      }
      this.hitSparks.burst(m.x, m.y, 0, -1, 0xff5070, 14)
    })

    // Update feedback pools
    this.hitSparks.update(ds)
    this.damageNumbers.update(ds)
    this.vignette.update(ds)
    this.screenFlash.update(ds)

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
        playXPCollect()
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
      this.shaker.trigger(14, 0.6)
      this.screenFlash.trigger(0.7, 0.95, 0xffffff)
      this.hitStop.trigger(0.18)
    }
    if (this.boss.isDead()) {
      this.active = false
    }

    if (this.player.hp <= 0) {
      this.active = false
      this.screenFlash.trigger(0.6, 0.7, 0xff3030)
      this.shaker.trigger(8, 0.4)
      stopBGM()
      playPlayerDied()
      this.fire({
        type: 'player_died',
        damageDealt: this.totalDamageDealt,
        cardsCollected: this.cardSystem.currentLevel,
      })
    }

    input.clearFrameState()
  }

  private onPlayerHurt(amount: number) {
    // Big charge / heavy hits get a punchier reaction (hit-stop + bigger shake).
    const heavy = amount >= 4
    this.shaker.trigger(heavy ? 12 : 6, heavy ? 0.4 : 0.25)
    this.vignette.trigger(heavy ? 0.55 : 0.4, heavy ? 0.6 : 0.45)
    if (heavy) this.hitStop.trigger(0.08)
    // Getting hit breaks your combo — adds risk/reward to staying mobile.
    if (this.comboCount > 0) {
      this.comboCount = 0
      this.comboTimer = 0
      if (this.comboText) this.comboText.visible = false
    }
  }

  private bumpCombo() {
    this.comboCount++
    this.comboTimer = DungeonArena.COMBO_TIMEOUT
    if (this.comboText) {
      // Tier up the colour as the combo grows.
      let color = 0xffffff
      if (this.comboCount >= 20) color = 0xff5050
      else if (this.comboCount >= 12) color = 0xff9933
      else if (this.comboCount >= 6) color = 0xffd54a
      else if (this.comboCount >= 3) color = 0xaaffaa
      this.comboText.text = `COMBO ×${this.comboCount}`
      this.comboText.style.fill = color
      this.comboText.visible = true
      // Tiny "punch" each hit — overshoot then settle back to 1.
      this.comboTextScale = 1.35
      this.comboText.scale.set(this.comboTextScale)
    }
  }

  // ============================================================
  // Wave pacing
  // ============================================================

  /** Day-scaled spawn interval — every day spawns happen meaningfully faster. */
  private introSpawnInterval(): number {
    // Day 1 = 1.5 s, every day -0.08 s. Day 14+ floors at 0.5 s.
    return Math.max(0.5, DungeonArena.INTRO_SPAWN_INTERVAL_BASE - (this.dayLevel - 1) * 0.08)
  }
  private bossSpawnInterval(): number {
    // Day 1 = 4.5 s, every day -0.25 s. Day 14+ floors at 1.2 s.
    return Math.max(1.2, DungeonArena.BOSS_SPAWN_INTERVAL_BASE - (this.dayLevel - 1) * 0.25)
  }
  private introMaxMinions(): number {
    // +1 every 2 days, capped much higher.
    return Math.min(10, DungeonArena.INTRO_MAX_MINIONS_BASE + Math.floor((this.dayLevel - 1) / 2))
  }
  private bossMaxMinions(): number {
    // +1 every 2 days, capped much higher.
    return Math.min(12, DungeonArena.BOSS_MAX_MINIONS_BASE + Math.floor((this.dayLevel - 1) / 2))
  }
  private minionHp(): number {
    // +1 HP per day, capped at 30.
    return Math.min(30, 4 + this.dayLevel)
  }

  private tickWavePhase(ds: number) {
    this.waveTimer += ds
    if (this.wavePhase === 'minions_only') {
      this.edgeMinionTimer -= ds
      if (this.edgeMinionTimer <= 0 && this.minions.activeCount() < this.introMaxMinions()) {
        this.spawnEdgeMinion()
        this.edgeMinionTimer = this.introSpawnInterval() + (Math.random() - 0.5) * 0.6
      }
      if (this.waveTimer >= DungeonArena.INTRO_DURATION) {
        this.wavePhase = 'boss_warning'
        this.waveTimer = 0
        // Dramatic warning — flash + shake + banner. Hold a beat.
        this.shaker.trigger(8, 0.6)
        this.screenFlash.trigger(0.55, 0.45, 0xff5050)
        this.showWaveBanner('⚠ A GREAT EVIL APPROACHES ⚠', 0xff5050, 2.5)
      }
    } else if (this.wavePhase === 'boss_warning') {
      // Lerp boss alpha 0 → 1 across the warning window for a creepy fade-in.
      const t = Math.min(1, this.waveTimer / 2.4)
      this.boss.setAppearAlpha(t)
      // Keep pumping out a few minions during the warning so the player doesn't catch a breather.
      this.edgeMinionTimer -= ds
      if (this.edgeMinionTimer <= 0 && this.minions.activeCount() < this.introMaxMinions()) {
        this.spawnEdgeMinion()
        this.edgeMinionTimer = this.introSpawnInterval() * 1.2
      }
      if (this.waveTimer >= DungeonArena.WARNING_DURATION) {
        this.wavePhase = 'boss_active'
        this.waveTimer = 0
        this.edgeMinionTimer = this.bossSpawnInterval()
        this.boss.setActive(true)
        this.boss.setAppearAlpha(1)
        // Big arrival flourish.
        this.shaker.trigger(16, 0.7)
        this.screenFlash.trigger(0.5, 0.95, 0xffd54a)
        this.hitStop.trigger(0.18)
        this.showWaveBanner(`FIGHT! — DAY ${this.dayLevel}`, 0xffd54a, 1.8)
      }
    } else {
      // boss_active — keep an additional minion stream alive so the player is
      // never just sitting back popping bullets at the boss alone.
      this.edgeMinionTimer -= ds
      if (this.edgeMinionTimer <= 0 && this.minions.activeCount() < this.bossMaxMinions()) {
        this.spawnEdgeMinion()
        this.edgeMinionTimer = this.bossSpawnInterval() + (Math.random() - 0.5) * 1.5
      }
    }
  }

  /** Spawn a minion at a random arena edge so it visibly walks in. */
  private spawnEdgeMinion() {
    const edge = Math.floor(Math.random() * 4)
    let x = 0, y = 0
    if (edge === 0) { x = 30 + Math.random() * (ARENA_W - 60); y = 32 }                 // top
    else if (edge === 1) { x = 30 + Math.random() * (ARENA_W - 60); y = ARENA_H - 32 }  // bottom
    else if (edge === 2) { x = 32; y = 60 + Math.random() * (ARENA_H - 120) }           // left
    else { x = ARENA_W - 32; y = 60 + Math.random() * (ARENA_H - 120) }                 // right
    this.minions.spawn(x, y, this.minionHp())
  }

  private showWaveBanner(text: string, color: number, duration = 2.0) {
    if (!this.waveBanner) return
    this.waveBanner.text = text
    this.waveBanner.style.fill = color
    this.waveBanner.visible = true
    this.waveBannerTimer = duration
    this.waveBannerDuration = duration
  }

  private tickWaveBanner(ds: number) {
    if (!this.waveBanner) return
    if (this.waveBannerTimer <= 0) {
      if (this.waveBanner.visible) this.waveBanner.visible = false
      return
    }
    this.waveBannerTimer -= ds
    const t = this.waveBannerTimer / this.waveBannerDuration   // 1 → 0
    // Fade in fast, fade out slow.
    const fade = t > 0.85 ? (1 - t) / 0.15 : Math.min(1, t * 1.6)
    this.waveBanner.alpha = Math.max(0, fade)
    // Slow scale pulse for emphasis
    const pulse = 1 + Math.sin((1 - t) * 14) * 0.06
    this.waveBanner.scale.set(pulse)
  }

  /** Visible expanding ring at impact point + a brief flash, no entity creation. */
  private spawnExplosion(x: number, y: number, radius: number) {
    const gfx = new Graphics()
    this.effectsLayer.addChild(gfx)
    const start = Date.now()
    const duration = 280
    const animate = () => {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / duration)
      gfx.clear()
      const r = radius * (0.4 + t * 1.1)
      const alpha = 1 - t
      gfx.circle(x, y, r).fill({ color: 0xffaa44, alpha: alpha * 0.45 })
      gfx.circle(x, y, r * 0.7).fill({ color: 0xffee88, alpha: alpha * 0.7 })
      gfx.circle(x, y, r).stroke({ color: 0xffffff, width: 2 * (1 - t), alpha })
      if (t >= 1) {
        gfx.destroy()
        return
      }
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }

  private checkCollisions() {
    const pr = this.player.getRadius()
    const br = this.boss.radius

    // Player bullets vs minions (priority — minions are squishy)
    for (const b of this.bullets.getActive()) {
      if (b.owner !== 'player') continue
      let absorbed = false
      this.minions.forEachActive((m) => {
        if (absorbed) return
        const dx = m.x - b.x
        const dy = m.y - b.y
        if (Math.sqrt(dx * dx + dy * dy) < m.radius + b.size) {
          const wasAlive = !m.dying
          if (m.takeDamage(b.damage)) {
            this.hitSparks.burst(b.x, b.y, b.vx, b.vy, 0xff80a0, 5)
            this.damageNumbers.spawn(m.x, m.y - 8, String(b.damage), 0xffaa44, { fontSize: 11 })
            // Killing blow — drop a fat XP orb so clearing minions is rewarding.
            if (wasAlive && m.dying) {
              const orb = this.orbs.getInactive()
              orb?.spawn(m.x, m.y, GAME_CONFIG.XP_PER_ORB)
              this.shaker.trigger(2, 0.08)
            }
          }
          if (b.piercing > 0) {
            b.piercing--
          } else {
            b.despawn()
            absorbed = true
          }
        }
      })
      if (absorbed) continue
    }

    // Player bullets vs boss
    for (const b of this.bullets.getActive()) {
      if (b.owner !== 'player') continue
      const dx = this.boss.x - b.x
      const dy = this.boss.y - b.y
      if (Math.sqrt(dx * dx + dy * dy) < br + b.size) {
        // Combo: each consecutive hit adds 5% damage up to a 2× cap (combo 20).
        const comboMul = 1 + Math.min(this.comboCount, 20) * 0.05
        const finalDmg = Math.max(1, Math.round(b.damage * comboMul))
        this.boss.takeDamage(finalDmg)
        this.totalDamageDealt += finalDmg
        this.bumpCombo()

        // Hit feedback
        this.hitSparks.burst(b.x, b.y, b.vx, b.vy, b.isCrit ? 0xffaa22 : 0xffdd66, b.isCrit ? 12 : 6)
        this.damageNumbers.spawn(
          this.boss.x + (Math.random() - 0.5) * 20,
          this.boss.y - this.boss.radius,
          b.isCrit ? `${finalDmg}!` : String(finalDmg),
          b.isCrit ? 0xffd54a : 0xffffff,
          { fontSize: b.isCrit ? 18 : 14 },
        )

        // Crits or heavy single-bullet damage feel chunkier with hit-stop.
        if (b.isCrit || finalDmg >= 5) {
          this.hitStop.trigger(0.04)
          this.shaker.trigger(b.isCrit ? 5 : 3, 0.12)
        }

        // Explosive shot — splash damage to nearby minions and a visual burst.
        const expR = this.player.effects.explosionRadius ?? 0
        if (expR > 0) {
          const splashDmg = Math.max(1, Math.round(finalDmg * (this.player.effects.explosionDamageMul ?? 0.5)))
          this.spawnExplosion(b.x, b.y, expR)
          // Boss is already taking the direct hit. Splash hits any other minions in range.
          this.minions.forEachActive((m) => {
            const ddx = m.x - b.x
            const ddy = m.y - b.y
            if (Math.sqrt(ddx * ddx + ddy * ddy) < expR + m.radius) {
              if (m.takeDamage(splashDmg)) {
                this.damageNumbers.spawn(m.x, m.y - 6, String(splashDmg), 0xff7744, { fontSize: 10 })
              }
            }
          })
          this.shaker.trigger(3, 0.1)
        }

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
    stopBGM()
    this.active = false
    this.position.set(0, 0)
    this.player?.destroy()
    this.boss?.destroy()
    this.bullets?.destroyAll()
    this.orbs?.destroyAll()
    this.minions?.destroyAll()
    this.hitSparks?.destroy()
    this.damageNumbers?.destroy()
    this.vignette?.destroy()
    this.screenFlash?.destroy()
    this.strikes?.destroy()
    if (this.comboText) {
      this.comboText.destroy()
      this.comboText = null
    }
    if (this.waveBanner) {
      this.waveBanner.destroy()
      this.waveBanner = null
    }
    // Clear lingering flash effects
    for (const fx of this.flashEffects) fx.gfx.destroy()
    this.flashEffects = []
  }
}
