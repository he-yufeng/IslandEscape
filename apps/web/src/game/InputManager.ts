// ============================================================
// Island Escape — Keyboard Input Manager
// ============================================================

export type InputAction = 'move_up' | 'move_down' | 'move_left' | 'move_right' | 'interact' | 'skill_flash' | 'skill_ultimate'

export type InputCallback = (action: InputAction) => void

const KEY_MAP: Record<string, InputAction> = {
  // WASD
  KeyW: 'move_up',
  KeyA: 'move_left',
  KeyS: 'move_down',
  KeyD: 'move_right',
  // Arrow keys
  ArrowUp: 'move_up',
  ArrowDown: 'move_down',
  ArrowLeft: 'move_left',
  ArrowRight: 'move_right',
  // Interaction
  KeyE: 'interact',
  Space: 'skill_flash',
  KeyQ: 'skill_ultimate',
}

export class InputManager {
  private callback: InputCallback | null = null
  private enabled = true
  private keysDown = new Set<InputAction>()
  private justPressed = new Set<InputAction>()
  private handleKeyDown: (e: KeyboardEvent) => void
  private handleKeyUp: (e: KeyboardEvent) => void

  // Mouse state for dungeon combat
  private _mouseX = 0
  private _mouseY = 0
  private _mouseDown = false
  private canvasRect: DOMRect | null = null
  private handleMouseMove: (e: MouseEvent) => void
  private handleMouseDown: (e: MouseEvent) => void
  private handleMouseUp: (e: MouseEvent) => void

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        if (!this.keysDown.has(action)) {
          this.justPressed.add(action)
        }
        this.keysDown.add(action)
        // Only fire one-shot callback for interact (movement is polled in game loop)
        if (action === 'interact' && this.enabled && this.callback) {
          this.callback(action)
        }
      }
    }

    this.handleKeyUp = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code]
      if (action) {
        this.keysDown.delete(action)
      }
    }

    this.handleMouseMove = (e: MouseEvent) => {
      this._mouseX = e.clientX
      this._mouseY = e.clientY
    }

    this.handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this._mouseDown = true
        this._mouseX = e.clientX
        this._mouseY = e.clientY
      }
    }

    this.handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this._mouseDown = false
      }
    }

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
  }

  public onAction(callback: InputCallback) {
    this.callback = callback
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  /** Returns the movement direction based on currently held keys */
  public getMovementDirection(): { dcol: number; drow: number } | null {
    if (this.keysDown.has('move_up')) return { dcol: 0, drow: -1 }
    if (this.keysDown.has('move_down')) return { dcol: 0, drow: 1 }
    if (this.keysDown.has('move_left')) return { dcol: -1, drow: 0 }
    if (this.keysDown.has('move_right')) return { dcol: 1, drow: 0 }
    return null
  }

  private canvasScaleX = 1
  private canvasScaleY = 1

  /** Update the canvas bounding rect for mouse coordinate conversion */
  public setCanvasRect(rect: DOMRect, worldWidth: number, worldHeight: number) {
    this.canvasRect = rect
    this.canvasScaleX = worldWidth / rect.width
    this.canvasScaleY = worldHeight / rect.height
  }

  /** Get mouse position in game world coordinates (top-left origin) */
  public getMouseCanvasPosition(): { x: number; y: number } {
    if (!this.canvasRect) return { x: this._mouseX, y: this._mouseY }
    return {
      x: (this._mouseX - this.canvasRect.left) * this.canvasScaleX,
      y: (this._mouseY - this.canvasRect.top) * this.canvasScaleY,
    }
  }

  public isMouseDown(): boolean {
    return this._mouseDown
  }

  /** Check if an action was just pressed this frame (consumed on read) */
  public consumeJustPressed(action: InputAction): boolean {
    if (this.justPressed.has(action)) {
      this.justPressed.delete(action)
      return true
    }
    return false
  }

  /** Clear just-pressed state each frame */
  public clearFrameState() {
    this.justPressed.clear()
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('mousemove', this.handleMouseMove)
    window.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('mouseup', this.handleMouseUp)
    this.callback = null
    this.keysDown.clear()
    this.justPressed.clear()
  }
}
