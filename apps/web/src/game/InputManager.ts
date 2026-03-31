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
  private handleKeyDown: (e: KeyboardEvent) => void

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture input if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const action = KEY_MAP[e.code]
      if (action && this.enabled && this.callback) {
        e.preventDefault()
        this.callback(action)
      }
    }

    window.addEventListener('keydown', this.handleKeyDown)
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

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown)
    this.callback = null
  }
}
