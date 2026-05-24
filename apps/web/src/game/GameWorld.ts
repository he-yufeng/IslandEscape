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
  | { kind: 'dungeon' }
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
  private overlayLayer: Container
  private eventCallback: GameWorldEventCallback | null = null
  private nightOverlay: Graphics | null = null
  private inputEnabled = true

  /** Per-character animation queue so labor → trade walks chain instead of overlap. */
  private aiQueues: Map<string, Array<() => Promise<void>>> = new Map()
  private aiQueueRunning: Map<string, boolean> = new Map()

  /** Pulsing highlight that follows whatever interactable the player is next to. */
  private interactionHighlight: Graphics | null = null
  private interactionHighlightTarget: { col: number; row: number; kind: string } | null = null
  private interactionHighlightPhase = 0

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

    this.overlayLayer = new Container()
    this.overlayLayer.label = 'overlay'
    this.worldContainer.addChild(this.overlayLayer)

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
      this.overlayLayer.addChild(character.overlayContainer)
    }
  }

  /** Update character alive/escaped status */
  public updateCharacterStatus(id: string, alive: boolean, escaped: boolean) {
    const char = this.characters.get(id)
    if (char) {
      char.eliminated = !alive
      char.escaped = escaped
      char.container.visible = alive && !escaped
      char.overlayContainer.visible = alive && !escaped
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
        this.setInteractionHighlight(char.col, char.row, 'npc')
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
          case 'dungeon':
            interaction = { kind: 'dungeon' }
            break
        }
        if (interaction) {
          this.setInteractionHighlight(checkCol, checkRow, interaction.kind)
          this.emit({ type: 'interaction_changed', interaction })
          return interaction
        }
      }
    }

    this.setInteractionHighlight(null)
    this.emit({ type: 'interaction_changed', interaction: null })
    return null
  }

  /**
   * Show / move / hide a pulsing ring on the tile the player can interact with.
   * The colour hints at what kind of interaction is available so it reads at a
   * glance even before the bottom-bar prompt appears.
   */
  private setInteractionHighlight(
    colOrNull: number | null,
    row?: number,
    kind?: string,
  ): void {
    if (colOrNull === null) {
      if (this.interactionHighlight) {
        this.effectsLayer.removeChild(this.interactionHighlight)
        this.interactionHighlight.destroy()
        this.interactionHighlight = null
      }
      this.interactionHighlightTarget = null
      return
    }

    const col = colOrNull
    if (!this.interactionHighlight) {
      this.interactionHighlight = new Graphics()
      this.effectsLayer.addChild(this.interactionHighlight)
    }
    this.interactionHighlightTarget = { col, row: row!, kind: kind ?? '' }
    this.drawInteractionHighlight()
  }

  private drawInteractionHighlight(): void {
    if (!this.interactionHighlight || !this.interactionHighlightTarget) return
    const t = this.interactionHighlightTarget
    const x = t.col * TILE_SIZE
    const y = t.row * TILE_SIZE
    const pulse = 0.55 + Math.sin(this.interactionHighlightPhase * 4) * 0.25

    const colorByKind: Record<string, number> = {
      fish: 0x6fd2ff,
      farm: 0xffd76a,
      merchant: 0xff9e3a,
      dungeon: 0xff5a5a,
      npc: 0xff7fb6,
    }
    const color = colorByKind[t.kind] ?? 0xc8e0ff

    const g = this.interactionHighlight
    g.clear()
    // Tile-fitting outer pulse
    g.roundRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, 5)
      .stroke({ color, width: 2, alpha: pulse })
    // Inner softer ring
    g.roundRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 4)
      .fill({ color, alpha: pulse * 0.12 })
    // Tiny corner caret marker (top-left) so the eye catches it instantly
    const sz = 5
    g.moveTo(x + 5, y + 5).lineTo(x + 5 + sz, y + 5).stroke({ color, width: 2, alpha: pulse })
    g.moveTo(x + 5, y + 5).lineTo(x + 5, y + 5 + sz).stroke({ color, width: 2, alpha: pulse })
  }

  /** Animate an AI character to a location.
   *  If targetOverride is provided, walk there directly; otherwise look up via getActionTarget
   *  using the character's current grid position so they pick the *closest* matching tile. */
  public async animateAIMove(
    characterId: string,
    action: string,
    targetOverride?: MapPosition,
  ): Promise<void> {
    const char = this.characters.get(characterId)
    if (!char || char.eliminated || char.escaped) return

    const target = targetOverride ?? getActionTarget(action, char.col, char.row)

    // Get occupied positions (excluding this character)
    const occupied = new Set<string>()
    for (const [id, c] of this.characters) {
      if (id !== characterId && !c.eliminated && !c.escaped) {
        occupied.add(`${c.col},${c.row}`)
      }
    }

    const path = findPath(char.col, char.row, target.col, target.row, occupied)
    if (path.length === 0) return

    // No artificial path-length cap — let the NPC actually arrive at their target.
    await char.walkPath(path)
  }

  /**
   * Queue a per-character animation step (e.g. walk-then-emote). Steps for the
   * same character run sequentially so labor → trade_merchant walks chain
   * cleanly instead of fighting each other.
   */
  public enqueueAIAnimation(characterId: string, task: () => Promise<void>) {
    let queue = this.aiQueues.get(characterId)
    if (!queue) {
      queue = []
      this.aiQueues.set(characterId, queue)
    }
    queue.push(task)
    void this.drainAIQueue(characterId)
  }

  private async drainAIQueue(characterId: string) {
    if (this.aiQueueRunning.get(characterId)) return
    const queue = this.aiQueues.get(characterId)
    if (!queue || queue.length === 0) return
    this.aiQueueRunning.set(characterId, true)
    try {
      while (queue.length > 0) {
        const task = queue.shift()!
        try {
          await task()
        } catch (err) {
          console.error('[ai-anim] task failed', err)
        }
      }
    } finally {
      this.aiQueueRunning.set(characterId, false)
    }
  }

  /** Whether a character has a queued or running scripted animation (used to gate idle wandering). */
  public isAIAnimating(characterId: string): boolean {
    if (this.aiQueueRunning.get(characterId)) return true
    const q = this.aiQueues.get(characterId)
    return !!(q && q.length > 0)
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

    // Idle NPC wandering — keeps the village feeling alive.
    this.tickWandering(delta)

    // Pulsing interactable highlight
    if (this.interactionHighlight && this.interactionHighlightTarget) {
      this.interactionHighlightPhase += delta * 0.016
      this.drawInteractionHighlight()
    }

    // Poll held movement keys each frame for continuous movement
    if (this.inputEnabled) {
      const dir = this.inputManager.getMovementDirection()
      if (dir) {
        this.movePlayer(dir.dcol, dir.drow)
      }
    }
  }

  /**
   * Idle wandering for NPCs. When not actively walking (e.g. between AI turns or
   * during the player's phase), pick a random adjacent walkable tile within
   * `WANDER_RADIUS` of the home tile and step there. Cooldown gates the rate so
   * NPCs don't sprint frame-by-frame.
   */
  private tickWandering(delta: number) {
    const ds = delta * 0.016
    const WANDER_RADIUS = 4

    for (const [id, char] of this.characters) {
      if (id === 'player') continue
      if (char.eliminated || char.escaped) continue
      if (char.moving) continue
      // Don't wander when a scripted AI walk (labor → trade) is queued for this NPC.
      if (this.isAIAnimating(id)) continue

      char.wanderCooldown -= ds
      if (char.wanderCooldown > 0) continue
      // Schedule the next attempt — randomized per character so they don't sync.
      char.wanderCooldown = 1.5 + Math.random() * 2.5

      // Occasionally just stay put for a beat (looks more natural).
      if (Math.random() < 0.25) continue

      const distFromHome = Math.abs(char.col - char.homeCol) + Math.abs(char.row - char.homeRow)
      const farFromHome = distFromHome > WANDER_RADIUS
      const candidates: Array<{ col: number; row: number; closer: boolean }> = []
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const

      for (const [dc, dr] of dirs) {
        const nc = char.col + dc
        const nr = char.row + dr

        const newDist = Math.abs(nc - char.homeCol) + Math.abs(nr - char.homeRow)

        if (farFromHome) {
          // We've drifted past the wander radius (e.g. AI walked to a fishing
          // spot during their turn). Only let them step back toward home.
          if (newDist >= distFromHome) continue
        } else {
          // Inside the radius — stay within an axis-aligned box around home.
          if (Math.abs(nc - char.homeCol) > WANDER_RADIUS) continue
          if (Math.abs(nr - char.homeRow) > WANDER_RADIUS) continue
        }

        if (!isWalkable(getTile(nc, nr))) continue

        // Don't walk onto another live character or the player.
        let blocked = false
        for (const [otherId, other] of this.characters) {
          if (otherId === id) continue
          if (other.eliminated || other.escaped) continue
          if (other.col === nc && other.row === nr) { blocked = true; break }
        }
        if (blocked) continue

        candidates.push({ col: nc, row: nr, closer: newDist < distFromHome })
      }

      if (candidates.length === 0) continue

      // Soft pull toward home: when within radius but offset, prefer steps that
      // close the distance so the character eventually drifts back to its spawn.
      const weighted: Array<{ col: number; row: number }> = []
      for (const c of candidates) {
        const weight = distFromHome >= 2 && c.closer ? 3 : 1
        for (let i = 0; i < weight; i++) weighted.push(c)
      }

      const pick = weighted[Math.floor(Math.random() * weighted.length)]!
      char.moveTo(pick.col, pick.row)
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
