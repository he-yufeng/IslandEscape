// ============================================================
// Island Escape — Game World (Orchestrates PixiJS + Vue State)
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { TileMap } from './TileMap'
import { Character, type CharacterConfig } from './Character'
import { InputManager, type InputAction } from './InputManager'
import {
  TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  CHARACTER_POSITIONS,
  getTile,
  getInteraction,
  getActionTarget,
  isWalkable,
  type MapPosition,
} from './tiles'
import type { CharacterId } from '@game/shared'

// Simple A* pathfinding
function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  occupiedPositions: Set<string> = new Set(),
): MapPosition[] {
  const key = (c: number, r: number) => `${c},${r}`

  // If target is not walkable, find nearest walkable tile
  let targetCol = endCol
  let targetRow = endRow
  if (!isWalkable(getTile(targetCol, targetRow))) {
    let bestDist = Infinity
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nc = endCol + dc
        const nr = endRow + dr
        if (isWalkable(getTile(nc, nr))) {
          const d = Math.abs(dc) + Math.abs(dr)
          if (d < bestDist) {
            bestDist = d
            targetCol = nc
            targetRow = nr
          }
        }
      }
    }
  }

  interface Node {
    col: number
    row: number
    g: number
    h: number
    f: number
    parent: Node | null
  }

  const openSet: Node[] = []
  const closedSet = new Set<string>()

  const heuristic = (c: number, r: number) => Math.abs(c - targetCol) + Math.abs(r - targetRow)

  const startNode: Node = {
    col: startCol,
    row: startRow,
    g: 0,
    h: heuristic(startCol, startRow),
    f: heuristic(startCol, startRow),
    parent: null,
  }
  openSet.push(startNode)

  const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]

  let iterations = 0
  const maxIterations = 500

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++
    // Get lowest f node
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!
    const currentKey = key(current.col, current.row)

    if (current.col === targetCol && current.row === targetRow) {
      // Reconstruct path
      const path: MapPosition[] = []
      let node: Node | null = current
      while (node && node.parent) {
        path.unshift({ col: node.col, row: node.row })
        node = node.parent
      }
      return path
    }

    closedSet.add(currentKey)

    for (const [dc, dr] of directions) {
      const nc = current.col + dc!
      const nr = current.row + dr!
      const nKey = key(nc, nr)

      if (closedSet.has(nKey)) continue
      if (!isWalkable(getTile(nc, nr))) continue
      // Skip occupied positions (but allow target)
      if (occupiedPositions.has(nKey) && !(nc === targetCol && nr === targetRow)) continue

      const g = current.g + 1
      const h = heuristic(nc, nr)
      const existing = openSet.find((n) => n.col === nc && n.row === nr)

      if (!existing) {
        openSet.push({ col: nc, row: nr, g, h, f: g + h, parent: current })
      } else if (g < existing.g) {
        existing.g = g
        existing.f = g + existing.h
        existing.parent = current
      }
    }
  }

  // No path found — return empty
  return []
}

export type InteractionType =
  | { kind: 'npc'; characterId: CharacterId; characterName: string }
  | { kind: 'fish' }
  | { kind: 'farm' }
  | { kind: 'merchant' }
  | null

export type GameWorldEventCallback = (event: GameWorldEvent) => void

export interface GameWorldEvent {
  type: 'interaction_changed' | 'player_moved' | 'action_menu' | 'animation_text'
  interaction?: InteractionType
  position?: MapPosition
  text?: string
}

export class GameWorld {
  public worldContainer: Container
  public tileMap: TileMap
  public characters: Map<string, Character> = new Map()
  public inputManager: InputManager

  private characterLayer: Container
  private effectsLayer: Container
  private eventCallback: GameWorldEventCallback | null = null
  private nightOverlay: Graphics | null = null
  private inputEnabled = true

  constructor() {
    this.worldContainer = new Container()
    this.worldContainer.label = 'game-world'

    // Create tile map
    this.tileMap = new TileMap()
    this.worldContainer.addChild(this.tileMap.container)

    // Character layer (above tiles)
    this.characterLayer = new Container()
    this.characterLayer.label = 'characters'
    this.worldContainer.addChild(this.characterLayer)

    // Effects layer (above everything)
    this.effectsLayer = new Container()
    this.effectsLayer.label = 'effects'
    this.worldContainer.addChild(this.effectsLayer)

    // Input manager
    this.inputManager = new InputManager()
    this.inputManager.onAction((action) => this.handleInput(action))
  }

  public onEvent(callback: GameWorldEventCallback) {
    this.eventCallback = callback
  }

  private emit(event: GameWorldEvent) {
    if (this.eventCallback) {
      this.eventCallback(event)
    }
  }

  /** Initialize characters on the map */
  public initCharacters(characterIds: string[], names: Record<string, string>) {
    // Remove existing
    for (const char of this.characters.values()) {
      char.destroy()
    }
    this.characters.clear()

    for (const id of characterIds) {
      const pos = CHARACTER_POSITIONS[id] ?? { col: 10, row: 7 }
      const config: CharacterConfig = {
        id,
        name: names[id] ?? id,
        col: pos.col,
        row: pos.row,
      }
      const character = new Character(config)
      this.characters.set(id, character)
      this.characterLayer.addChild(character.container)
    }
  }

  /** Update character alive/escaped status */
  public updateCharacterStatus(id: string, alive: boolean, escaped: boolean) {
    const char = this.characters.get(id)
    if (char) {
      char.eliminated = !alive
      char.escaped = escaped
      char.container.visible = alive && !escaped
    }
  }

  /** Show thinking indicator on character */
  public setThinking(id: string | null) {
    for (const [charId, char] of this.characters) {
      char.showThinking(charId === id)
    }
  }

  private handleInput(action: InputAction) {
    if (!this.inputEnabled) return
    if (action === 'interact') {
      const player = this.characters.get('player')
      if (player && player.moving) return
      this.emit({ type: 'action_menu' })
    }
  }

  private movePlayer(dcol: number, drow: number) {
    const player = this.characters.get('player')
    if (!player) return

    // Check for NPC collision
    const newCol = player.col + dcol
    const newRow = player.row + drow
    for (const [id, char] of this.characters) {
      if (id === 'player') continue
      if (char.col === newCol && char.row === newRow && !char.eliminated && !char.escaped) {
        return // Can't walk through NPCs
      }
    }

    const moved = player.tryMove(dcol, drow)
    if (moved) {
      this.checkNearbyInteractions()
      this.emit({
        type: 'player_moved',
        position: player.getPosition(),
      })
    }
  }

  /** Check what the player is near and emit interaction info */
  public checkNearbyInteractions(): InteractionType {
    const player = this.characters.get('player')
    if (!player) return null

    // Check adjacent tiles for interactions
    const directions = [
      [0, 0],
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]

    // Check for nearby NPCs
    for (const [id, char] of this.characters) {
      if (id === 'player' || char.eliminated || char.escaped) continue
      if (player.isAdjacentTo(char.col, char.row)) {
        const interaction: InteractionType = {
          kind: 'npc',
          characterId: id as CharacterId,
          characterName: char.name,
        }
        this.emit({ type: 'interaction_changed', interaction })
        return interaction
      }
    }

    // Check for tile interactions
    for (const [dc, dr] of directions) {
      const checkCol = player.col + dc!
      const checkRow = player.row + dr!
      const tile = getTile(checkCol, checkRow)
      const tileInteraction = getInteraction(tile)

      if (tileInteraction) {
        let interaction: InteractionType = null
        switch (tileInteraction) {
          case 'fish':
            interaction = { kind: 'fish' }
            break
          case 'farm':
            interaction = { kind: 'farm' }
            break
          case 'merchant':
            interaction = { kind: 'merchant' }
            break
        }
        if (interaction) {
          this.emit({ type: 'interaction_changed', interaction })
          return interaction
        }
      }
    }

    this.emit({ type: 'interaction_changed', interaction: null })
    return null
  }

  /** Animate an AI character to a location */
  public async animateAIMove(characterId: string, action: string): Promise<void> {
    const char = this.characters.get(characterId)
    if (!char || char.eliminated || char.escaped) return

    const target = getActionTarget(action)

    // Get occupied positions (excluding this character)
    const occupied = new Set<string>()
    for (const [id, c] of this.characters) {
      if (id !== characterId && !c.eliminated && !c.escaped) {
        occupied.add(`${c.col},${c.row}`)
      }
    }

    const path = findPath(char.col, char.row, target.col, target.row, occupied)

    if (path.length > 0) {
      // Limit path length for faster animation
      const shortPath = path.slice(0, Math.min(path.length, 8))
      await char.walkPath(shortPath)
    }
  }

  /** Show floating text effect */
  public showFloatingText(col: number, row: number, text: string, color = 0xffffff) {
    const style = new TextStyle({
      fontSize: 12,
      fill: color,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 3 },
    })
    const floatingText = new Text({ text, style })
    floatingText.anchor.set(0.5, 0.5)
    floatingText.x = col * TILE_SIZE + TILE_SIZE / 2
    floatingText.y = row * TILE_SIZE
    floatingText.alpha = 1

    this.effectsLayer.addChild(floatingText)

    // Animate upward and fade
    const startY = floatingText.y
    const startTime = Date.now()
    const duration = 1500

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = elapsed / duration
      if (progress >= 1) {
        this.effectsLayer.removeChild(floatingText)
        floatingText.destroy()
        return
      }
      floatingText.y = startY - progress * 30
      floatingText.alpha = 1 - progress
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }

  /** Night overlay effect */
  public async showNightEffect(): Promise<void> {
    if (this.nightOverlay) return

    this.nightOverlay = new Graphics()
    this.nightOverlay.rect(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
      .fill({ color: 0x000033, alpha: 0 })
    this.effectsLayer.addChild(this.nightOverlay)

    // Fade in
    await this.fadeNightOverlay(0, 0.5, 800)
    // Hold
    await this.wait(600)
    // Fade out
    await this.fadeNightOverlay(0.5, 0, 800)

    if (this.nightOverlay) {
      this.effectsLayer.removeChild(this.nightOverlay)
      this.nightOverlay.destroy()
      this.nightOverlay = null
    }
  }

  private fadeNightOverlay(from: number, to: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.nightOverlay) {
        resolve()
        return
      }
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / durationMs, 1)
        if (this.nightOverlay) {
          this.nightOverlay.alpha = from + (to - from) * progress
        }
        if (progress >= 1) {
          resolve()
        } else {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    })
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** Enable/disable player input */
  public setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled
    this.inputManager.setEnabled(enabled)
  }

  /** Update loop — called each frame */
  public update(delta: number) {
    this.tileMap.update(delta)
    for (const char of this.characters.values()) {
      char.update(delta)
    }

    // Poll held movement keys each frame for continuous movement
    if (this.inputEnabled) {
      const dir = this.inputManager.getMovementDirection()
      if (dir) {
        this.movePlayer(dir.dcol, dir.drow)
      }
    }
  }

  /** Get the player character */
  public getPlayer(): Character | undefined {
    return this.characters.get('player')
  }

  /** Get the world pixel dimensions */
  public getWorldSize(): { width: number; height: number } {
    return {
      width: MAP_COLS * TILE_SIZE,
      height: MAP_ROWS * TILE_SIZE,
    }
  }

  public destroy() {
    this.inputManager.destroy()
    for (const char of this.characters.values()) {
      char.destroy()
    }
    this.characters.clear()
    this.worldContainer.destroy({ children: true })
  }
}
