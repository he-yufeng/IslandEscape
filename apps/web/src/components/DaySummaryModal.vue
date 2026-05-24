<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useGameStore, CHARACTER_META } from '@/stores/game'
import type { GameSSEEvent } from '@game/shared'

const game = useGameStore()

interface CharStateLine {
  id: string
  name: string
  fish: number
  wheat: number
  coins: number
}

interface SummaryData {
  day: number
  eliminated: string[]
  escaped: string[]
  states: CharStateLine[]
}

const summary = ref<SummaryData | null>(null)
const visible = ref(false)

function parseLine(line: string): { kind: 'state' | 'eliminated' | 'escaped' | 'other'; data: unknown } {
  let m = line.match(/^(\w+) was eliminated/)
  if (m) return { kind: 'eliminated', data: m[1] }
  m = line.match(/^(\w+) reached/)
  if (m) return { kind: 'escaped', data: m[1] }
  m = line.match(/^(\w+): fish (-?\d+), wheat (-?\d+), coins (-?\d+)/)
  if (m) {
    return {
      kind: 'state',
      data: {
        id: m[1]!,
        name: CHARACTER_META[m[1]!]?.name ?? m[1]!,
        fish: Number(m[2]),
        wheat: Number(m[3]),
        coins: Number(m[4]),
      } satisfies CharStateLine,
    }
  }
  return { kind: 'other', data: line }
}

function buildSummary(results: readonly string[]): SummaryData {
  const eliminated: string[] = []
  const escaped: string[] = []
  const states: CharStateLine[] = []
  for (const line of results) {
    const parsed = parseLine(line)
    if (parsed.kind === 'eliminated') eliminated.push(parsed.data as string)
    else if (parsed.kind === 'escaped') escaped.push(parsed.data as string)
    else if (parsed.kind === 'state') states.push(parsed.data as CharStateLine)
  }
  return { day: game.day, eliminated, escaped, states }
}

// Watch for settlement events and pop the modal.
watch(
  () => game.events.length,
  () => {
    const latest = game.events[game.events.length - 1] as GameSSEEvent | undefined
    if (latest?.type !== 'settlement') return
    summary.value = buildSummary(latest.results)
    visible.value = true
  },
)

const playerLine = computed(() => summary.value?.states.find((s) => s.id === 'player'))
const aiLines = computed(() => summary.value?.states.filter((s) => s.id !== 'player') ?? [])

function dismiss() {
  visible.value = false
}

function metaForId(id: string) {
  return CHARACTER_META[id] ?? { name: id, emoji: '?', personality: '' }
}
</script>

<template>
  <Transition name="day-summary">
    <div v-if="visible && summary" class="day-summary-overlay">
      <div class="day-summary-box">
        <div class="day-summary-header">
          <span class="day-summary-icon">🌙</span>
          <div>
            <p class="day-summary-kicker">Settlement</p>
            <h2 class="day-summary-title">Day {{ summary.day - 1 }} ends</h2>
          </div>
        </div>

        <p class="day-summary-flavor">
          Night fell on the island. Everyone consumed 1 fish and 1 wheat to survive.
        </p>

        <!-- Player line (highlighted) -->
        <div v-if="playerLine" class="day-summary-section">
          <div class="day-section-title">You</div>
          <div class="player-row">
            <span class="player-icon">🧑</span>
            <span class="resource-chip resource-fish">🐟 {{ playerLine.fish }}</span>
            <span class="resource-chip resource-wheat">🌾 {{ playerLine.wheat }}</span>
            <span class="resource-chip resource-coins">💰 {{ playerLine.coins }}</span>
          </div>
        </div>

        <!-- AI lines -->
        <div v-if="aiLines.length > 0" class="day-summary-section">
          <div class="day-section-title">Islanders</div>
          <div
            v-for="line in aiLines"
            :key="line.id"
            class="ai-row"
          >
            <span class="ai-name">{{ line.name }}</span>
            <span class="ai-resources">
              <span class="resource-mini">🐟 {{ line.fish }}</span>
              <span class="resource-mini">🌾 {{ line.wheat }}</span>
              <span class="resource-mini">💰 {{ line.coins }}</span>
            </span>
          </div>
        </div>

        <!-- Eliminations -->
        <div v-if="summary.eliminated.length > 0" class="day-summary-section eliminated-section">
          <div class="day-section-title danger">⚰️ Eliminated tonight</div>
          <div
            v-for="id in summary.eliminated"
            :key="id"
            class="eliminated-row"
          >
            <span class="ai-name">{{ metaForId(id).name }}</span>
            <span class="elim-tag">ran out of food</span>
          </div>
        </div>

        <!-- Escapes -->
        <div v-if="summary.escaped.length > 0" class="day-summary-section escaped-section">
          <div class="day-section-title good">⛵ Escaped the island</div>
          <div
            v-for="id in summary.escaped"
            :key="id"
            class="escaped-row"
          >
            <span class="ai-name">{{ metaForId(id).name }}</span>
            <span class="esc-tag">reached 100 coins</span>
          </div>
        </div>

        <button class="day-summary-btn" @click="dismiss">Continue to next day</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.day-summary-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(8, 12, 32, 0.65) 0%, rgba(2, 4, 16, 0.92) 100%);
  backdrop-filter: blur(3px);
  z-index: 220;
}

.day-summary-box {
  width: min(440px, 92vw);
  max-height: 85vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #1a2540 0%, #0e1628 100%);
  border: 2px solid #4a4a8a;
  border-radius: 14px;
  padding: 22px 26px 18px;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  font-family: monospace;
  color: #e6f1fb;
  animation: ds-pop 0.32s cubic-bezier(0.34, 1.4, 0.64, 1);
}

@keyframes ds-pop {
  from { transform: scale(0.88) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.day-summary-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.day-summary-icon {
  font-size: 42px;
  line-height: 1;
  filter: drop-shadow(0 2px 8px rgba(120, 100, 220, 0.5));
}

.day-summary-kicker {
  margin: 0 0 2px;
  font-size: 9px;
  letter-spacing: 2px;
  color: #a8b8e8;
  text-transform: uppercase;
}

.day-summary-title {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 22px;
  font-weight: 700;
  color: #d8c8ff;
  letter-spacing: 0.5px;
}

.day-summary-flavor {
  margin: 0 0 14px;
  font-size: 11px;
  color: #9bb3c4;
  line-height: 1.5;
  font-style: italic;
  border-left: 2px solid rgba(168, 184, 232, 0.3);
  padding-left: 10px;
}

.day-summary-section + .day-summary-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(132, 186, 230, 0.1);
}

.day-section-title {
  margin: 0 0 6px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #c8a060;
  text-transform: uppercase;
}
.day-section-title.danger { color: #ff8a8a; }
.day-section-title.good { color: #8aff9a; }

.player-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: linear-gradient(180deg, rgba(141, 208, 132, 0.08), rgba(141, 208, 132, 0.02));
  border: 1px solid rgba(141, 208, 132, 0.32);
  border-radius: 8px;
}

.player-icon {
  font-size: 22px;
  line-height: 1;
}

.resource-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.04);
}
.resource-fish { color: #76b5d2; border: 1px solid rgba(118, 181, 210, 0.35); }
.resource-wheat { color: #e2c46a; border: 1px solid rgba(226, 196, 106, 0.35); }
.resource-coins { color: #ffd54a; border: 1px solid rgba(255, 213, 74, 0.35); }

.ai-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  margin-top: 4px;
}
.ai-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ai-name {
  color: #e6f1fb;
  font-weight: 700;
}

.ai-resources {
  display: flex;
  gap: 8px;
}

.resource-mini {
  font-size: 10px;
  color: #9bb3c4;
}

.eliminated-row,
.escaped-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  margin-top: 4px;
  border-radius: 5px;
  font-size: 11px;
}

.eliminated-row {
  background: rgba(220, 38, 38, 0.08);
  border-left: 2px solid #ff8a8a;
  color: #ffb3b3;
}
.escaped-row {
  background: rgba(34, 170, 85, 0.1);
  border-left: 2px solid #8aff9a;
  color: #b3ffc8;
}

.elim-tag,
.esc-tag {
  font-size: 9px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  opacity: 0.85;
}

.day-summary-btn {
  width: 100%;
  margin-top: 18px;
  padding: 11px;
  background: linear-gradient(180deg, #4a4a8a, #2a2a5a);
  border: 1px solid #6a6acc;
  border-radius: 6px;
  color: #fff;
  font-family: monospace;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
}
.day-summary-btn:hover {
  background: linear-gradient(180deg, #5a5aaa, #3a3a7a);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(106, 106, 204, 0.4);
}
.day-summary-btn:active {
  transform: translateY(0);
}

.day-summary-enter-active,
.day-summary-leave-active {
  transition: opacity 0.25s ease;
}
.day-summary-enter-from,
.day-summary-leave-to {
  opacity: 0;
}
</style>
