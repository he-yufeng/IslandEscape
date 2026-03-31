// ============================================================
// Island Escape — Game Renderer (PixiJS Application)
// ============================================================

import { Application } from 'pixi.js'
import { GameWorld } from './GameWorld'
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from './tiles'

export class GameRenderer {
  public app: Application
  public world: GameWorld
  private mounted = false
  private resizeObserver: ResizeObserver | null = null

  constructor() {
    this.app = new Application()
    this.world = new GameWorld()
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

    // Add the world to the stage
    this.app.stage.addChild(this.world.worldContainer)

    // Start the game loop
    this.app.ticker.add((ticker) => {
      this.world.update(ticker.deltaTime)
    })

    this.mounted = true

    // Setup responsive sizing
    this.setupResponsiveSize(container)
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
    this.app.destroy(true, { children: true })
    this.mounted = false
  }
}
