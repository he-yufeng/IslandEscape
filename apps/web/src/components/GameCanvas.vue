<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useGameStore, CHARACTER_META } from '@/stores/game'
import { GameRenderer } from '@/game/GameRenderer'
import type { InteractionType, GameWorldEvent } from '@/game/GameWorld'

const emit = defineEmits<{
  'interaction-change': [interaction: InteractionType]
  'action-menu': []
  'player-moved': []
}>()

const game = useGameStore()
const canvasContainer = ref<HTMLElement | null>(null)

let renderer: GameRenderer | null = null

function getRenderer(): GameRenderer | null {
  return renderer
}

// Expose renderer for parent
defineExpose({ getRenderer })

onMounted(async () => {
  if (!canvasContainer.value) return

  renderer = new GameRenderer()
  await renderer.init(canvasContainer.value)

  // Handle game world events
  renderer.world.onEvent((event: GameWorldEvent) => {
    switch (event.type) {
      case 'interaction_changed':
        emit('interaction-change', event.interaction ?? null)
        break
      case 'action_menu':
        emit('action-menu')
        break
      case 'player_moved':
        emit('player-moved')
        break
    }
  })

  // Initialize characters if game state exists
  if (game.state) {
    initializeCharacters()
  }
})

onBeforeUnmount(() => {
  if (renderer) {
    renderer.destroy()
    renderer = null
  }
})

function initializeCharacters() {
  if (!renderer || !game.state) return

  const charIds = Object.keys(game.state.characters)
  const names: Record<string, string> = {}
  for (const id of charIds) {
    names[id] = CHARACTER_META[id]?.name ?? id
  }

  renderer.world.initCharacters(charIds, names)

  // Sync alive/escaped status
  for (const [id, charState] of Object.entries(game.state.characters)) {
    if (charState) {
      renderer.world.updateCharacterStatus(id, charState.alive, charState.escaped)
    }
  }

  // Initial interaction check
  setTimeout(() => {
    if (renderer) {
      const interaction = renderer.world.checkNearbyInteractions()
      emit('interaction-change', interaction)
    }
  }, 100)
}

// Watch for game state changes
watch(
  () => game.state,
  (newState) => {
    if (!renderer || !newState) return

    // If characters haven't been initialized yet
    if (renderer.world.characters.size === 0) {
      initializeCharacters()
      return
    }

    // Sync character statuses
    for (const [id, charState] of Object.entries(newState.characters)) {
      if (charState) {
        renderer.world.updateCharacterStatus(id, charState.alive, charState.escaped)
      }
    }
  },
  { deep: true },
)

// Watch for thinking character
watch(
  () => game.thinkingCharacter,
  (charId) => {
    if (!renderer) return
    renderer.world.setThinking(charId)
  },
)

// Watch for phase changes
watch(
  () => game.phase,
  (phase) => {
    if (!renderer) return

    switch (phase) {
      case 'player_labor':
      case 'player_trade':
        renderer.world.setInputEnabled(true)
        break
      case 'ai_turns':
        renderer.world.setInputEnabled(false)
        break
      case 'settlement':
        renderer.world.setInputEnabled(false)
        renderer.world.showNightEffect()
        break
      case 'game_over':
        renderer.world.setInputEnabled(false)
        break
    }
  },
)

// Watch for AI decisions to animate movement
watch(
  () => game.events.length,
  () => {
    if (!renderer) return
    const latestEvent = game.events[game.events.length - 1]
    if (!latestEvent) return

    if (latestEvent.type === 'ai_decision') {
      const decision = latestEvent.decision as Record<string, unknown> | undefined
      if (!decision) return
      const charId = latestEvent.characterId
      const world = renderer.world

      // Variant A: per-step trade sub-action (queued so it runs after labor walk).
      const subAction = decision.subAction as string | undefined
      if (subAction === 'trade_merchant') {
        world.enqueueAIAnimation(charId, async () => {
          await world.animateAIMove(charId, 'trade_merchant')
          const c = world.characters.get(charId)
          if (c) world.showFloatingText(c.col, c.row, 'Trading...', 0xffee44)
        })
        return
      }
      if (subAction === 'trade_peer') {
        const targetId = decision.target as string | null
        world.enqueueAIAnimation(charId, async () => {
          const targetChar = targetId ? world.characters.get(targetId) : null
          if (targetChar) {
            await world.animateAIMove(charId, 'trade_peer', {
              col: targetChar.col,
              row: targetChar.row,
            })
          }
          const c = world.characters.get(charId)
          if (c) world.showFloatingText(c.col, c.row, 'Negotiating...', 0xffaa44)
        })
        return
      }

      // Variant B: full decision with labor — walk to the labor target and
      // emit the +N reward floating text only after arrival.
      const labor = decision.labor as Record<string, unknown> | undefined
      if (labor) {
        const action = (labor.labor as string) || 'fish'
        world.enqueueAIAnimation(charId, async () => {
          await world.animateAIMove(charId, action)
          const c = world.characters.get(charId)
          if (!c) return
          const text = action === 'fish' ? '+3 Fish' : action === 'farm' ? 'Planted!' : action
          world.showFloatingText(c.col, c.row, text, 0xffee44)
        })
      }
    }
  },
)

// Watch for dungeon mode
watch(
  () => game.dungeonMode,
  (active) => {
    if (!renderer) return
    if (active) {
      renderer.enterDungeonMode()
      renderer.onDungeonEvent((event) => {
        game.onDungeonEvent(event as unknown as Record<string, unknown> & { type: string })
      })
    } else if (renderer.isDungeonActive()) {
      renderer.exitDungeonMode()
    }
  },
)
</script>

<template>
  <div ref="canvasContainer" class="game-canvas-container">
    <!-- PixiJS canvas gets mounted here -->
  </div>
</template>

<style scoped>
.game-canvas-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #1a3a52;
  border-radius: 8px;
  border: 2px solid #2a4a62;
}

.game-canvas-container :deep(canvas) {
  position: relative;
  z-index: 1;
}
</style>
