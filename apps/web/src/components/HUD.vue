<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { GAME_CONFIG, DAILY_EVENT_INFO, type DailyEvent } from '@game/shared'

const game = useGameStore()

const fish = computed(() => game.playerState?.resources.fish ?? 0)
const wheat = computed(() => game.playerState?.resources.wheat ?? 0)
const coins = computed(() => game.playerState?.resources.coins ?? 0)
const escapeProgress = computed(() => {
  const pct = Math.min(100, Math.round((coins.value / GAME_CONFIG.WIN_COINS) * 100))
  return pct
})

// Pulse animation tokens — bumped on every change to retrigger CSS animation.
const fishPulse = ref(0)
const wheatPulse = ref(0)
const coinsPulse = ref(0)
const fishTone = ref<'pos' | 'neg' | ''>('')
const wheatTone = ref<'pos' | 'neg' | ''>('')
const coinsTone = ref<'pos' | 'neg' | ''>('')

watch(fish, (newVal, oldVal) => {
  if (oldVal === undefined || newVal === oldVal) return
  fishPulse.value++
  fishTone.value = newVal > oldVal ? 'pos' : 'neg'
  window.setTimeout(() => { fishTone.value = '' }, 600)
})
watch(wheat, (newVal, oldVal) => {
  if (oldVal === undefined || newVal === oldVal) return
  wheatPulse.value++
  wheatTone.value = newVal > oldVal ? 'pos' : 'neg'
  window.setTimeout(() => { wheatTone.value = '' }, 600)
})
watch(coins, (newVal, oldVal) => {
  if (oldVal === undefined || newVal === oldVal) return
  coinsPulse.value++
  coinsTone.value = newVal > oldVal ? 'pos' : 'neg'
  window.setTimeout(() => { coinsTone.value = '' }, 600)
})

const phaseLabel = computed(() => {
  switch (game.phase) {
    case 'day_start':
      return 'Dawn'
    case 'player_labor':
      return 'Labor'
    case 'player_trade':
      return 'Trade'
    case 'ai_turns':
      return 'AI Turns'
    case 'settlement':
      return 'Night'
    case 'day_end':
      return 'Day End'
    case 'game_over':
      return 'Game Over'
    default:
      return game.phase
  }
})

const phaseColor = computed(() => {
  switch (game.phase) {
    case 'player_labor':
      return 'bg-emerald-600'
    case 'player_trade':
      return 'bg-emerald-600'
    case 'ai_turns':
      return 'bg-blue-600'
    case 'settlement':
      return 'bg-indigo-700'
    case 'game_over':
      return 'bg-red-700'
    default:
      return 'bg-amber-600'
  }
})

const tradeSlots = computed(() => game.playerTradeSlots)
const merchantFish = computed(() => game.merchantPrices.fishPrice)
const merchantWheat = computed(() => game.merchantPrices.wheatPrice)

const dailyEvent = computed<DailyEvent>(() => game.state?.dailyEvent ?? 'none')
const dailyEventInfo = computed(() => DAILY_EVENT_INFO[dailyEvent.value])
</script>

<template>
  <div class="hud-bar">
    <!-- Day & Phase -->
    <div class="hud-section">
      <span class="hud-label">Day</span>
      <span class="hud-value text-amber-200">{{ game.day }}</span>
    </div>

    <div class="hud-section">
      <span :class="['hud-badge', phaseColor]">{{ phaseLabel }}</span>
    </div>

    <!-- Daily event badge — only shows on non-calm days -->
    <div
      v-if="dailyEvent !== 'none'"
      class="hud-section"
      :title="dailyEventInfo.desc"
    >
      <span class="hud-event-badge">
        <span class="hud-event-icon">{{ dailyEventInfo.icon }}</span>
        <span class="hud-event-label">{{ dailyEventInfo.label }}</span>
      </span>
    </div>

    <!-- Divider -->
    <div class="hud-divider" />

    <!-- Resources -->
    <div class="hud-section" title="Fish">
      <span class="hud-icon">F</span>
      <span :key="fishPulse" :class="['hud-value', 'text-sky-300', fishTone && `pulse-${fishTone}`]">{{ fish }}</span>
    </div>

    <div class="hud-section" title="Wheat">
      <span class="hud-icon">W</span>
      <span :key="wheatPulse" :class="['hud-value', 'text-amber-300', wheatTone && `pulse-${wheatTone}`]">{{ wheat }}</span>
    </div>

    <div class="hud-section" title="Coins">
      <span class="hud-icon">C</span>
      <span :key="coinsPulse" :class="['hud-value', 'text-yellow-300', coinsTone && `pulse-${coinsTone}`]">{{ coins }}</span>
    </div>

    <!-- Divider -->
    <div class="hud-divider" />

    <!-- Trade Slots -->
    <div class="hud-section" title="Trade slots remaining">
      <span class="hud-label">Trades</span>
      <span class="hud-value text-purple-300">{{ tradeSlots }}</span>
    </div>

    <!-- Merchant Prices -->
    <div class="hud-section" title="Merchant prices">
      <span class="hud-label text-[10px]">Ship: F={{ merchantFish }}c W={{ merchantWheat }}c</span>
    </div>

    <!-- Divider -->
    <div class="hud-divider" />

    <!-- Escape Progress -->
    <div class="hud-section hud-section-wide" title="Escape progress (100 coins needed)">
      <span class="hud-label">Escape</span>
      <div class="escape-bar">
        <div class="escape-fill" :style="{ width: escapeProgress + '%' }" />
        <span class="escape-text">{{ escapeProgress }}%</span>
      </div>
    </div>

    <!-- Status indicators -->
    <div v-if="!game.playerAlive" class="hud-section">
      <span class="hud-badge bg-red-700">ELIMINATED</span>
    </div>
    <div v-else-if="game.playerEscaped" class="hud-section">
      <span class="hud-badge bg-emerald-700">ESCAPED!</span>
    </div>

    <!-- Error message -->
    <Transition name="fade">
      <div v-if="game.errorMessage" class="hud-section">
        <span class="hud-badge bg-red-600">{{ game.errorMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hud-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: linear-gradient(180deg, #1a2a3a 0%, #0f1a2a 100%);
  border-bottom: 2px solid #2a4a5a;
  color: #c8d8e8;
  font-family: monospace;
  font-size: 12px;
  flex-wrap: wrap;
  min-height: 36px;
}

.hud-section {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hud-section-wide {
  flex: 0 0 auto;
  min-width: 140px;
}

.hud-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #7a8a9a;
  letter-spacing: 0.5px;
}

.hud-value {
  font-weight: bold;
  font-size: 14px;
}

.hud-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  background: #3a4a5a;
}

.hud-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #fff;
}

.hud-divider {
  width: 1px;
  height: 20px;
  background: #3a4a5a;
}

.escape-bar {
  position: relative;
  width: 100px;
  height: 14px;
  background: #2a3a4a;
  border-radius: 3px;
  border: 1px solid #3a5a6a;
  overflow: hidden;
}

.escape-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  transition: width 0.3s ease;
  border-radius: 2px;
}

.escape-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

.pulse-pos {
  animation: hud-pulse-pos 0.6s ease-out;
}
.pulse-neg {
  animation: hud-pulse-neg 0.6s ease-out;
}

@keyframes hud-pulse-pos {
  0%   { transform: scale(1);    text-shadow: none; }
  20%  { transform: scale(1.6);  text-shadow: 0 0 10px rgba(140, 240, 140, 0.95); color: #b3ffb3; }
  100% { transform: scale(1);    text-shadow: none; }
}

@keyframes hud-pulse-neg {
  0%   { transform: scale(1);    text-shadow: none; }
  20%  { transform: scale(1.4);  text-shadow: 0 0 8px rgba(255, 120, 80, 0.9); color: #ff9a66; }
  100% { transform: scale(1);    text-shadow: none; }
}

.hud-event-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(200, 160, 96, 0.25), rgba(200, 160, 96, 0.08));
  border: 1px solid rgba(200, 160, 96, 0.5);
  cursor: help;
  animation: event-glow 2.4s ease-in-out infinite;
}
.hud-event-icon {
  font-size: 14px;
  line-height: 1;
}
.hud-event-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #f0d5a3;
  text-transform: uppercase;
}
@keyframes event-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(200, 160, 96, 0); }
  50% { box-shadow: 0 0 8px rgba(200, 160, 96, 0.4); }
}
</style>
