<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useGameStore, CHARACTER_META } from '@/stores/game'
import type { GameSSEEvent } from '@game/shared'

const game = useGameStore()
const logContainer = ref<HTMLElement | null>(null)
const collapsed = ref(false)

interface LogEntry {
  id: number
  text: string
  type: string
  colorClass: string
}

function eventToLogEntry(event: GameSSEEvent, index: number): LogEntry | null {
  const id = 10000 + index

  switch (event.type) {
    case 'log':
      return { id, text: event.message, type: 'log', colorClass: 'log-normal' }

    case 'ai_thinking': {
      const meta = CHARACTER_META[event.characterId]
      return { id, text: `${meta?.name ?? event.characterId} is thinking...`, type: 'ai', colorClass: 'log-ai' }
    }

    case 'ai_decision': {
      const meta = CHARACTER_META[event.characterId]
      const decision = event.decision as Record<string, unknown> | undefined
      const labor = (decision?.labor as Record<string, unknown>)?.labor ?? 'act'
      return { id, text: `${meta?.name ?? event.characterId} decided to ${labor}`, type: 'ai', colorClass: 'log-ai-bold' }
    }

    case 'trade_result':
      return {
        id,
        text: event.summary,
        type: 'trade',
        colorClass: event.success ? 'log-success' : 'log-error',
      }

    case 'negotiation': {
      const speaker = CHARACTER_META[event.message.speaker]
      return { id, text: `${speaker?.name ?? event.message.speaker}: "${event.message.text}"`, type: 'negotiation', colorClass: 'log-chat' }
    }

    case 'settlement':
      return { id, text: event.results.join(' | '), type: 'settlement', colorClass: 'log-night' }

    case 'elimination': {
      const meta = CHARACTER_META[event.characterId]
      return { id, text: `${meta?.name ?? event.characterId} has been eliminated!`, type: 'elimination', colorClass: 'log-danger' }
    }

    case 'escape': {
      const meta = CHARACTER_META[event.characterId]
      return { id, text: `${meta?.name ?? event.characterId} has escaped the island!`, type: 'escape', colorClass: 'log-escape' }
    }

    case 'game_over':
      return { id, text: `Game Over: ${event.reason}`, type: 'gameover', colorClass: 'log-gameover' }

    case 'day_start':
      return { id, text: `Day ${event.day} begins! Ship prices: Fish=${event.merchantPrices.fishPrice}c Wheat=${event.merchantPrices.wheatPrice}c`, type: 'day', colorClass: 'log-day' }

    case 'error':
      return { id, text: `Error: ${event.message}`, type: 'error', colorClass: 'log-error' }

    case 'state_update':
      return null

    default:
      return null
  }
}

const logEntries = computed<LogEntry[]>(() => {
  const entries: LogEntry[] = []

  // Game state log
  if (game.state?.log) {
    for (let i = 0; i < game.state.log.length; i++) {
      const line = game.state.log[i]
      entries.push({
        id: i,
        text: line,
        type: 'log',
        colorClass: line.startsWith('---') ? 'log-day' : 'log-normal',
      })
    }
  }

  // SSE events (AI dialogue, trade results, etc.)
  for (let i = 0; i < game.events.length; i++) {
    const entry = eventToLogEntry(game.events[i], i)
    if (entry) entries.push(entry)
  }

  return entries
})

// Auto-scroll
watch(
  () => logEntries.value.length,
  async () => {
    await nextTick()
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  },
)
</script>

<template>
  <div class="event-log">
    <button class="log-header" @click="collapsed = !collapsed">
      <span class="log-title">Event Log</span>
      <span class="log-count">{{ logEntries.length }}</span>
      <span class="log-toggle">{{ collapsed ? '+' : '-' }}</span>
    </button>

    <div v-if="!collapsed" ref="logContainer" class="log-body">
      <div v-if="logEntries.length === 0" class="log-empty">
        No events yet. Start a new game!
      </div>

      <div
        v-for="entry in logEntries"
        :key="entry.id"
        :class="['log-entry', entry.colorClass]"
      >
        <span class="log-text">{{ entry.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-log {
  background: #0f0f1a;
  border-top: 2px solid #2a3a4a;
  font-family: monospace;
  font-size: 11px;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  background: #1a1a2e;
  border: none;
  color: #8a9aaa;
  cursor: pointer;
  font-family: monospace;
  font-size: 11px;
  text-align: left;
}
.log-header:hover {
  background: #222244;
}

.log-title {
  font-weight: bold;
  color: #a0b0c0;
}

.log-count {
  background: #2a3a4a;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  color: #6a7a8a;
}

.log-toggle {
  margin-left: auto;
  color: #5a6a7a;
  font-size: 14px;
}

.log-body {
  max-height: 140px;
  overflow-y: auto;
  padding: 4px 8px;
}

.log-empty {
  text-align: center;
  color: #4a4a6a;
  padding: 12px;
}

.log-entry {
  padding: 2px 6px;
  border-radius: 2px;
  line-height: 1.4;
}

.log-text {
  word-break: break-word;
}

/* Color classes */
.log-normal {
  color: #8a9aaa;
}
.log-ai {
  color: #6a9acc;
}
.log-ai-bold {
  color: #7ab0dd;
  font-weight: bold;
}
.log-success {
  color: #5aba5a;
  background: rgba(90, 186, 90, 0.08);
}
.log-error {
  color: #dd5555;
  background: rgba(221, 85, 85, 0.08);
}
.log-chat {
  color: #b090dd;
  padding-left: 16px;
  border-left: 2px solid #6a4a9a;
  font-style: italic;
}
.log-night {
  color: #dd9944;
  background: rgba(221, 153, 68, 0.08);
}
.log-danger {
  color: #ff5555;
  font-weight: bold;
  background: rgba(255, 85, 85, 0.1);
}
.log-escape {
  color: #f0c040;
  font-weight: bold;
  background: rgba(240, 192, 64, 0.1);
}
.log-gameover {
  color: #ffaa33;
  font-weight: bold;
  font-size: 12px;
  background: rgba(255, 170, 51, 0.1);
}
.log-day {
  color: #eebb55;
  font-weight: 600;
  background: rgba(238, 187, 85, 0.08);
}
</style>
