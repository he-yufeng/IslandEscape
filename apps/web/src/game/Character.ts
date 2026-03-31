// ============================================================
// Island Escape — Character Sprite (PixiJS)
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { TILE_SIZE, type MapPosition, getTile, isWalkable } from './tiles'

// Character colors by ID
const SHIRT_COLORS: Record<string, number> = {
  player: 0xdd3333,  // red
  tom: 0xe88834,     // orange
  sam: 0x3388cc,     // blue
  lily: 0x44aa55,    // green
  jack: 0x8844aa,    // purple
}

const SKIN_COLOR = 0xf0c8a0
const HAIR_COLOR = 0x4a3520
const PANTS_COLOR = 0x334455

export interface CharacterConfig {
  id: string
  name: string
  col: number
  row: number
}

export class Character {
  public container: Container
  public id: string
  public name: string

  // Grid position
  public col: number
  public row: number

  // Pixel position (for smooth interpolation)
  public pixelX: number
  public pixelY: number

  // Movement interpolation
  private targetPixelX: number
  private targetPixelY: number
  private isMoving = false
  private moveSpeed = 160 // pixels per second

  // Visual elements
  private sprite: Graphics
  private nameLabel: Text
  private thinkingBubble: Graphics | null = null

  // Animation state
  private bobOffset = 0
  private facing: 'down' | 'up' | 'left' | 'right' = 'down'
  private walkFrame = 0

  // State flags
  public eliminated = false
  public escaped = false

  constructor(config: CharacterConfig) {
    this.id = config.id
    this.name = config.name
    this.col = config.col
    this.row = config.row
    this.pixelX = config.col * TILE_SIZE
    this.pixelY = config.row * TILE_SIZE
    this.targetPixelX = this.pixelX
    this.targetPixelY = this.pixelY

    this.container = new Container()
    this.container.label = `character-${config.id}`
    this.container.x = this.pixelX
    this.container.y = this.pixelY

    // Draw sprite
    this.sprite = new Graphics()
    this.drawCharacter()
    this.container.addChild(this.sprite)

    // Name label
    const style = new TextStyle({
      fontSize: 8,
      fill: 0xffffff,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2.5 },
      align: 'center',
    })
    this.nameLabel = new Text({ text: config.name, style })
    this.nameLabel.anchor.set(0.5, 1)
    this.nameLabel.x = TILE_SIZE / 2
    this.nameLabel.y = -2
    this.container.addChild(this.nameLabel)
  }

  private drawCharacter() {
    const g = this.sprite
    g.clear()

    const shirtColor = SHIRT_COLORS[this.id] ?? 0xaaaaaa
    const cx = TILE_SIZE / 2  // center x
    const bob = Math.round(this.bobOffset)

    // Shadow
    g.ellipse(cx, TILE_SIZE - 2, 8, 3).fill({ color: 0x000000, alpha: 0.2 })

    // Legs
    const legOffset = this.isMoving ? Math.sin(this.walkFrame * 8) * 2 : 0
    g.rect(cx - 5, 22 + bob, 4, 8 + legOffset).fill(PANTS_COLOR)
    g.rect(cx + 1, 22 + bob, 4, 8 - legOffset).fill(PANTS_COLOR)

    // Body (shirt)
    g.roundRect(cx - 7, 12 + bob, 14, 12, 2).fill(shirtColor)

    // Arms
    const armSwing = this.isMoving ? Math.sin(this.walkFrame * 8) * 3 : 0
    g.rect(cx - 10, 14 + bob + armSwing, 4, 8).fill(shirtColor)
    g.rect(cx + 6, 14 + bob - armSwing, 4, 8).fill(shirtColor)
    // Hands
    g.circle(cx - 8, 23 + bob + armSwing, 2).fill(SKIN_COLOR)
    g.circle(cx + 8, 23 + bob - armSwing, 2).fill(SKIN_COLOR)

    // Head
    g.circle(cx, 8 + bob, 6).fill(SKIN_COLOR)

    // Hair
    g.arc(cx, 6 + bob, 6, Math.PI, 0).fill(HAIR_COLOR)

    // Eyes
    if (this.facing === 'down' || this.facing === 'left' || this.facing === 'right') {
      const eyeOffX = this.facing === 'left' ? -2 : this.facing === 'right' ? 2 : 0
      g.circle(cx - 2 + eyeOffX, 7 + bob, 1).fill(0x222222)
      g.circle(cx + 2 + eyeOffX, 7 + bob, 1).fill(0x222222)
    }

    // Eliminated overlay
    if (this.eliminated) {
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color: 0xff0000, alpha: 0.3 })
      // X eyes
      g.moveTo(cx - 3, 5 + bob).lineTo(cx - 1, 9 + bob).stroke({ color: 0xff0000, width: 1.5 })
      g.moveTo(cx - 1, 5 + bob).lineTo(cx - 3, 9 + bob).stroke({ color: 0xff0000, width: 1.5 })
      g.moveTo(cx + 1, 5 + bob).lineTo(cx + 3, 9 + bob).stroke({ color: 0xff0000, width: 1.5 })
      g.moveTo(cx + 3, 5 + bob).lineTo(cx + 1, 9 + bob).stroke({ color: 0xff0000, width: 1.5 })
    }
  }

  /** Move to a new grid position with smooth interpolation */
  public moveTo(col: number, row: number): Promise<void> {
    return new Promise((resolve) => {
      this.col = col
      this.row = row
      this.targetPixelX = col * TILE_SIZE
      this.targetPixelY = row * TILE_SIZE
      this.isMoving = true

      // Update facing direction
      const dx = this.targetPixelX - this.pixelX
      const dy = this.targetPixelY - this.pixelY
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = dx > 0 ? 'right' : 'left'
      } else {
        this.facing = dy > 0 ? 'down' : 'up'
      }

      this._moveResolve = resolve
    })
  }

  private _moveResolve: (() => void) | null = null

  /** Try to move one tile in a direction. Returns true if successful. */
  public tryMove(dcol: number, drow: number): boolean {
    if (this.isMoving) return false

    const newCol = this.col + dcol
    const newRow = this.row + drow
    const tile = getTile(newCol, newRow)

    if (!isWalkable(tile)) return false

    this.moveTo(newCol, newRow)
    return true
  }

  /** Animate a multi-step path */
  public async walkPath(path: MapPosition[]): Promise<void> {
    for (const pos of path) {
      await this.moveTo(pos.col, pos.row)
      // Wait for the move to complete
      await this.waitUntilStopped()
    }
  }

  private waitUntilStopped(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.isMoving) {
          resolve()
        } else {
          requestAnimationFrame(check)
        }
      }
      check()
    })
  }

  /** Snap to grid position immediately (no animation) */
  public snapTo(col: number, row: number) {
    this.col = col
    this.row = row
    this.pixelX = col * TILE_SIZE
    this.pixelY = row * TILE_SIZE
    this.targetPixelX = this.pixelX
    this.targetPixelY = this.pixelY
    this.container.x = this.pixelX
    this.container.y = this.pixelY
    this.isMoving = false
  }

  /** Show thinking bubble */
  public showThinking(show: boolean) {
    if (show && !this.thinkingBubble) {
      const bubble = new Graphics()
      bubble.roundRect(-6, -22, 44, 16, 6).fill(0xffffff).stroke({ color: 0x888888, width: 1 })
      // "..." dots
      bubble.circle(8, -14, 2).fill(0x888888)
      bubble.circle(16, -14, 2).fill(0x888888)
      bubble.circle(24, -14, 2).fill(0x888888)
      this.thinkingBubble = bubble
      this.container.addChild(bubble)
    } else if (!show && this.thinkingBubble) {
      this.container.removeChild(this.thinkingBubble)
      this.thinkingBubble.destroy()
      this.thinkingBubble = null
    }
  }

  /** Frame update — smooth movement & animation */
  public update(delta: number) {
    if (this.eliminated || this.escaped) {
      this.container.alpha = this.eliminated ? 0.4 : 0.6
      return
    }

    if (this.isMoving) {
      this.walkFrame += delta * 0.016

      const dx = this.targetPixelX - this.pixelX
      const dy = this.targetPixelY - this.pixelY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const step = this.moveSpeed * delta * 0.016

      if (dist <= step) {
        // Arrived
        this.pixelX = this.targetPixelX
        this.pixelY = this.targetPixelY
        this.isMoving = false
        this.walkFrame = 0
        this.bobOffset = 0

        if (this._moveResolve) {
          const resolve = this._moveResolve
          this._moveResolve = null
          resolve()
        }
      } else {
        this.pixelX += (dx / dist) * step
        this.pixelY += (dy / dist) * step
        // Walking bob
        this.bobOffset = Math.sin(this.walkFrame * 10) * 1.5
      }

      this.drawCharacter()
    }

    this.container.x = this.pixelX
    this.container.y = this.pixelY

    // Thinking bubble animation
    if (this.thinkingBubble) {
      this.thinkingBubble.alpha = 0.7 + 0.3 * Math.sin(Date.now() * 0.005)
    }
  }

  /** Get grid position */
  public getPosition(): MapPosition {
    return { col: this.col, row: this.row }
  }

  /** Check if this character is adjacent to a position */
  public isAdjacentTo(col: number, row: number): boolean {
    const dc = Math.abs(this.col - col)
    const dr = Math.abs(this.row - row)
    return (dc + dr === 1) || (dc === 0 && dr === 0)
  }

  public destroy() {
    this.container.destroy({ children: true })
  }
}
