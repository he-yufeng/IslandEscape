// ============================================================
// Island Escape — Keyboard Input Manager
// ============================================================

export type InputAction = 'move_up' | 'move_down' | 'move_left' | 'move_right' | 'interact'

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
  Space: 'interact',
}

export class InputManager {
  private callback: InputCallback | null = null
  private enabled = true
  private keysDown = new Set<InputAction>()
  private handleKeyDown: (e: KeyboardEvent) => void
  private handleKeyUp: (e: KeyboardEvent) => void

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
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

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
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

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.callback = null
    this.keysDown.clear()
  }
}
