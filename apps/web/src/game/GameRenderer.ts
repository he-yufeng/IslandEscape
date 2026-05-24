// ============================================================
// Island Escape — Game Renderer (PixiJS Application)
// ============================================================

import { Application } from 'pixi.js'
import { GameWorld } from './GameWorld'
import { DungeonArena } from './dungeon/DungeonArena'
import type { DungeonEvent } from './dungeon/DungeonArena'
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from './tiles'

export class GameRenderer {
  public app: Application
  public world: GameWorld
  public dungeon: DungeonArena
  private mounted = false
  private resizeObserver: ResizeObserver | null = null
  private dungeonActive = false
  private dungeonCallback: ((event: DungeonEvent) => void) | null = null

  constructor() {
    this.app = new Application()
    this.world = new GameWorld()
    this.dungeon = new DungeonArena()
  }

  /** Initialize the PixiJS application and mount to a container element */
  async init(container: HTMLElement): Promise<void> {
    if (this.mounted) return

    const worldWidth = MAP_COLS * TILE_SIZE
    const worldHeight = MAP_ROWS * TILE_SIZE

    await this.app.init({
      background: 0x1a5276,
      resizeTo: undefined,
      width: worldWidth,
      height: worldHeight,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    // Style the canvas
    const canvas = this.app.canvas as HTMLCanvasElement
    canvas.style.display = 'block'
    canvas.style.imageRendering = 'pixelated'

    container.appendChild(canvas)

    // Add the world and dungeon to the stage
    this.app.stage.addChild(this.world.worldContainer)
    this.app.stage.addChild(this.dungeon)
    this.dungeon.visible = false

    // Start the game loop
    this.app.ticker.add((ticker) => {
      if (this.dungeonActive) {
        const rect = canvas.getBoundingClientRect()
        this.world.inputManager.setCanvasRect(rect, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
        this.dungeon.update(ticker.deltaTime, this.world.inputManager)
      } else {
        this.world.update(ticker.deltaTime)
      }
    })

    this.mounted = true

    // Setup responsive sizing
    this.setupResponsiveSize(container)
  }

  onDungeonEvent(callback: (event: DungeonEvent) => void) {
    this.dungeonCallback = callback
    this.dungeon.onEvent(callback)
  }

  enterDungeonMode(dayLevel = 1) {
    this.world.worldContainer.visible = false
    this.dungeon.visible = true
    this.dungeon.init(dayLevel)
    this.dungeonActive = true
    this.world.setInputEnabled(true)
  }

  exitDungeonMode() {
    this.dungeonActive = false
    this.dungeon.visible = false
    this.dungeon.destroyArena()
    this.world.worldContainer.visible = true
    this.world.setInputEnabled(true)
  }

  isDungeonActive(): boolean {
    return this.dungeonActive
  }

  private setupResponsiveSize(container: HTMLElement) {
    const resize = () => {
      const canvas = this.app.canvas as HTMLCanvasElement
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const worldWidth = MAP_COLS * TILE_SIZE
      const worldHeight = MAP_ROWS * TILE_SIZE

      // Calculate scale to fit container while maintaining aspect ratio
      const scaleX = containerWidth / worldWidth
      const scaleY = containerHeight / worldHeight
      const scale = Math.min(scaleX, scaleY, 3) // Cap at 3x

      canvas.style.width = `${worldWidth * scale}px`
      canvas.style.height = `${worldHeight * scale}px`
    }

    this.resizeObserver = new ResizeObserver(resize)
    this.resizeObserver.observe(container)
    resize()
  }

  /** Unmount and clean up */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.world.destroy()
    this.dungeon.destroyArena()
    this.app.destroy(true, { children: true })
    this.mounted = false
  }
}
