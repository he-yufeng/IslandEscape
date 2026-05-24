// ============================================================
// Island Escape — Tile Map Renderer (PixiJS)
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { ISLAND_MAP, TILE_SIZE, MAP_COLS, MAP_ROWS, type TileType } from './tiles'

// ----- Color Palette -----

const COLORS: Record<TileType, number> = {
  water: 0x2389da,
  sand: 0xe8d5a3,
  grass: 0x5b9a3e,
  farmland: 0x8b6f3a,
  dock: 0x8b6b42,
  house: 0xa0522d,
  tree: 0x2d6e1e,
  rock: 0x808080,
  fishing_spot: 0x1a7ab5,
  path: 0xc4a96a,
  cave: 0x1a1a2e,
}

export class TileMap {
  public container: Container
  private waterFrame = 0
  /** Animated water/fishing tiles — redrawn each frame with shifting waves. */
  private waterTiles: Array<{ g: Graphics; type: TileType; col: number; row: number }> = []

  constructor() {
    this.container = new Container()
    this.container.label = 'tilemap'
    this.buildMap()
  }

  private buildMap() {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = ISLAND_MAP[row]![col]!
        const g = new Graphics()
        g.x = col * TILE_SIZE
        g.y = row * TILE_SIZE

        this.drawTile(g, tile, col, row)
        this.container.addChild(g)

        if (tile === 'water' || tile === 'fishing_spot') {
          this.waterTiles.push({ g, type: tile, col, row })
        }
      }
    }

    // Draw merchant ship at dock
    this.drawMerchantShip()
  }

  private drawTile(g: Graphics, tile: TileType, col: number, row: number) {
    const baseColor = COLORS[tile]

    switch (tile) {
      case 'water':
        this.drawWater(g, baseColor)
        break
      case 'sand':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(baseColor)
        // Sand texture dots
        this.drawSandDots(g)
        break
      case 'grass':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(baseColor)
        this.drawGrassBlades(g, col, row)
        break
      case 'farmland':
        this.drawFarmland(g)
        break
      case 'dock':
        this.drawDock(g)
        break
      case 'house':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x5b9a3e) // grass base
        this.drawHouse(g)
        break
      case 'tree':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x5b9a3e) // grass base
        this.drawTree(g)
        break
      case 'rock':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x5b9a3e) // grass base
        this.drawRock(g)
        break
      case 'fishing_spot':
        this.drawFishingSpot(g)
        break
      case 'cave':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x5b9a3e) // grass base
        this.drawCave(g)
        break
      case 'path':
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(baseColor)
        this.drawPathTexture(g)
        break
      default:
        g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(baseColor)
    }

    // Grid line (subtle)
    g.rect(0, 0, TILE_SIZE, TILE_SIZE).stroke({ color: 0x000000, alpha: 0.06, width: 0.5 })
  }

  private drawWater(g: Graphics, color: number, phase = 0) {
    g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(color)
    // Animated wave lines — y-offset is a sin wave so adjacent water tiles
    // appear to ripple in/out of phase, giving a sense of moving sea.
    const w1 = Math.sin(phase) * 2
    const w2 = Math.sin(phase * 1.3 + 1.6) * 2
    g.moveTo(4, 10 + w1).lineTo(12, 8 + w1).lineTo(20, 10 + w1).lineTo(28, 8 + w1)
      .stroke({ color: 0x5bb8e8, width: 1.5, alpha: 0.55 })
    g.moveTo(2, 22 + w2).lineTo(10, 20 + w2).lineTo(18, 22 + w2).lineTo(26, 20 + w2)
      .stroke({ color: 0x7fc8f0, width: 1.5, alpha: 0.5 })

    // Periodic shimmer dot — twinkles into existence based on phase.
    const shimmer = Math.max(0, Math.sin(phase * 0.8))
    if (shimmer > 0.55) {
      g.circle(8 + Math.sin(phase) * 4, 6, 1).fill({ color: 0xffffff, alpha: shimmer * 0.5 })
      g.circle(24 - Math.sin(phase) * 3, 26, 1).fill({ color: 0xffffff, alpha: shimmer * 0.4 })
    }
  }

  private drawSandDots(g: Graphics) {
    const dots = [[5, 5], [15, 10], [25, 7], [8, 22], [20, 25]]
    for (const [dx, dy] of dots) {
      g.circle(dx!, dy!, 1).fill({ color: 0xd4c090, alpha: 0.6 })
    }
  }

  private drawGrassBlades(g: Graphics, col: number, row: number) {
    // Deterministic pseudo-random based on position
    const seed = (col * 7 + row * 13) % 5
    const blades = [
      [6 + seed, 8],
      [16 + seed, 14],
      [24 - seed, 6],
      [10, 24 + seed],
    ]
    for (const [bx, by] of blades) {
      g.moveTo(bx!, by!).lineTo(bx! - 2, by! - 5).stroke({ color: 0x4a8332, width: 1, alpha: 0.5 })
    }

    // Sprinkle small flowers on roughly 1 in 5 grass tiles for visual variety.
    const decorRoll = (col * 31 + row * 17) % 5
    if (decorRoll === 0) {
      // Yellow flower
      const fx = 8 + (col % 3) * 3
      const fy = 18 + (row % 4)
      g.circle(fx, fy, 1.4).fill(0xffe066)
      g.circle(fx - 2, fy, 0.9).fill({ color: 0xffe066, alpha: 0.85 })
      g.circle(fx + 2, fy, 0.9).fill({ color: 0xffe066, alpha: 0.85 })
      g.circle(fx, fy - 2, 0.9).fill({ color: 0xffe066, alpha: 0.85 })
      g.circle(fx, fy + 2, 0.9).fill({ color: 0xffe066, alpha: 0.85 })
      g.circle(fx, fy, 0.6).fill(0xc8771f)
    } else if (decorRoll === 1) {
      // Red/pink flower
      const fx = 22 - (col % 2) * 3
      const fy = 22 - (row % 3)
      g.circle(fx, fy, 1.2).fill(0xff7099)
      g.circle(fx, fy, 0.5).fill(0xfff0a8)
    } else if (decorRoll === 2) {
      // Mushroom — adds whimsy
      const mx = 24
      const my = 24
      g.rect(mx - 1, my, 2, 3).fill(0xeee2c4)
      g.ellipse(mx, my, 3, 2).fill(0xc04848)
      g.circle(mx - 1, my - 0.5, 0.5).fill(0xfff0d8)
      g.circle(mx + 1, my, 0.4).fill(0xfff0d8)
    }
  }

  private drawFarmland(g: Graphics) {
    g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x8b6f3a)
    // Crop rows
    for (let i = 0; i < 4; i++) {
      const y = 4 + i * 8
      g.rect(2, y, TILE_SIZE - 4, 3).fill({ color: 0x6aad3e, alpha: 0.8 })
    }
  }

  private drawDock(g: Graphics) {
    g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x2389da) // water base
    // Wooden planks
    g.rect(2, 0, TILE_SIZE - 4, TILE_SIZE).fill(0x8b6b42)
    // Plank lines
    for (let i = 0; i < 4; i++) {
      g.moveTo(2, 8 * i + 4)
        .lineTo(TILE_SIZE - 2, 8 * i + 4)
        .stroke({ color: 0x704a28, width: 1, alpha: 0.4 })
    }
  }

  private drawHouse(g: Graphics) {
    // Walls
    g.rect(6, 10, 20, 18).fill(0xb86e3a)
    // Roof (triangle)
    g.poly([6, 10, 16, 2, 26, 10]).fill(0xcc3333)
    // Door
    g.rect(13, 18, 6, 10).fill(0x5a3320)
    // Window
    g.rect(8, 14, 5, 5).fill(0xffee88)
  }

  private drawTree(g: Graphics) {
    // Trunk
    g.rect(13, 18, 6, 12).fill(0x6b4226)
    // Canopy (layered circles)
    g.circle(16, 14, 10).fill(0x2d8c1e)
    g.circle(12, 12, 7).fill(0x3ba629)
    g.circle(20, 12, 7).fill(0x34961e)
  }

  private drawRock(g: Graphics) {
    // Main rock body
    g.ellipse(16, 18, 12, 10).fill(0x888888)
    g.ellipse(14, 16, 8, 7).fill(0x999999)
    // Highlight
    g.ellipse(12, 14, 4, 3).fill({ color: 0xaaaaaa, alpha: 0.6 })
  }

  private drawFishingSpot(g: Graphics, phase = 0) {
    this.drawWater(g, 0x1a7ab5, phase)
    // Fish icon with subtle bob from the same phase as the wave
    const bob = Math.sin(phase * 1.2) * 1.5
    g.ellipse(16, 16 + bob, 6, 3).fill({ color: 0xffaa44, alpha: 0.8 })
    g.poly([22, 16 + bob, 26, 12 + bob, 26, 20 + bob]).fill({ color: 0xffaa44, alpha: 0.8 })
    // Sparkle that pulses
    const sparkle = 0.3 + (Math.sin(phase * 1.7) * 0.5 + 0.5) * 0.5
    g.circle(10, 10, 2).fill({ color: 0xffffff, alpha: sparkle })
  }

  private drawCave(g: Graphics) {
    // Dark cave entrance
    g.ellipse(16, 20, 12, 8).fill(0x1a1a2e)
    // Rock arch
    g.poly([2, 20, 2, 8, 6, 4, 12, 2, 18, 2, 24, 4, 28, 8, 28, 20])
      .fill({ color: 0x666666, alpha: 0.0 })
      .stroke({ color: 0x666666, width: 2 })
    // Inner darkness
    g.ellipse(16, 18, 8, 5).fill(0x0d0d1a)
    g.ellipse(16, 17, 4, 3).fill(0x050510)
    // Glowing eyes
    g.circle(12, 16, 2).fill({ color: 0xff4444, alpha: 0.7 })
    g.circle(20, 16, 2).fill({ color: 0xff4444, alpha: 0.7 })
  }

  private drawPathTexture(g: Graphics) {
    // Subtle footprints / worn look
    const dots = [[8, 8], [16, 16], [24, 24], [12, 20], [20, 8]]
    for (const [dx, dy] of dots) {
      g.circle(dx!, dy!, 1.5).fill({ color: 0xb89a5a, alpha: 0.4 })
    }
  }

  private drawMerchantShip() {
    const ship = new Graphics()
    // Position at dock area
    ship.x = 17 * TILE_SIZE
    ship.y = 8 * TILE_SIZE - 8

    // Hull
    ship.poly([0, 20, 4, 32, 28, 32, 32, 20]).fill(0x6b3a1f)
    // Deck
    ship.rect(4, 16, 24, 6).fill(0x8b5a2b)
    // Mast
    ship.rect(14, 0, 4, 18).fill(0x5a3a1a)
    // Sail
    ship.poly([18, 2, 18, 16, 30, 10]).fill(0xf5f0e0)
    // Flag
    ship.rect(14, 0, 8, 5).fill(0xcc3333)

    // Label
    const style = new TextStyle({
      fontSize: 9,
      fill: 0xffffff,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    })
    const label = new Text({ text: 'SHIP', style })
    label.anchor.set(0.5, 1)
    label.x = 16
    label.y = -2

    ship.addChild(label)
    this.container.addChild(ship)
  }

  /** Animate water tiles (called each frame) — redraws waves with a moving phase. */
  public update(delta: number) {
    this.waterFrame += delta * 0.04
    for (const { g, type, col, row } of this.waterTiles) {
      // Per-tile phase offset so neighbouring tiles ripple out of sync.
      const phase = this.waterFrame + col * 0.55 + row * 0.4
      g.clear()
      if (type === 'water') {
        this.drawWater(g, COLORS.water, phase)
      } else {
        this.drawFishingSpot(g, phase)
      }
      // Re-apply the subtle grid line (drawTile adds it; we cleared it above).
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).stroke({ color: 0x000000, alpha: 0.06, width: 0.5 })
    }
  }

  public getWidth(): number {
    return MAP_COLS * TILE_SIZE
  }

  public getHeight(): number {
    return MAP_ROWS * TILE_SIZE
  }
}
