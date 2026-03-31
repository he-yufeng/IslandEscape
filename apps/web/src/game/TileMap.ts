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
}

export class TileMap {
  public container: Container
  private waterFrame = 0
  private waterTiles: Graphics[] = []

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
          this.waterTiles.push(g)
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

  private drawWater(g: Graphics, color: number) {
    g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(color)
    // Wave lines
    g.moveTo(4, 10).lineTo(12, 8).lineTo(20, 10).lineTo(28, 8)
      .stroke({ color: 0x5bb8e8, width: 1.5, alpha: 0.5 })
    g.moveTo(2, 22).lineTo(10, 20).lineTo(18, 22).lineTo(26, 20)
      .stroke({ color: 0x5bb8e8, width: 1.5, alpha: 0.5 })
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

  private drawFishingSpot(g: Graphics) {
    this.drawWater(g, 0x1a7ab5)
    // Fish icon
    g.ellipse(16, 16, 6, 3).fill({ color: 0xffaa44, alpha: 0.7 })
    g.poly([22, 16, 26, 12, 26, 20]).fill({ color: 0xffaa44, alpha: 0.7 })
    // Sparkle
    g.circle(10, 10, 2).fill({ color: 0xffffff, alpha: 0.5 })
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

  /** Animate water tiles (called each frame) */
  public update(delta: number) {
    this.waterFrame += delta * 0.02
    // Subtle alpha oscillation on water tiles
    for (const wt of this.waterTiles) {
      wt.alpha = 0.92 + 0.08 * Math.sin(this.waterFrame + wt.x * 0.05 + wt.y * 0.03)
    }
  }

  public getWidth(): number {
    return MAP_COLS * TILE_SIZE
  }

  public getHeight(): number {
    return MAP_ROWS * TILE_SIZE
  }
}
