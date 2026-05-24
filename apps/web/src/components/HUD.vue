<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { GAME_CONFIG } from '@game/shared'

const game = useGameStore()

const fish = computed(() => game.playerState?.resources.fish ?? 0)
const wheat = computed(() => game.playerState?.resources.wheat ?? 0)
const coins = computed(() => game.playerState?.resources.coins ?? 0)
const escapeProgress = computed(() => {
  const pct = Math.min(100, Math.round((coins.value / GAME_CONFIG.WIN_COINS) * 100))
  return pct
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

    <!-- Divider -->
    <div class="hud-divider" />

    <!-- Resources -->
    <div class="hud-section" title="Fish">
      <span class="hud-icon">F</span>
      <span class="hud-value text-sky-300">{{ fish }}</span>
    </div>

    <div class="hud-section" title="Wheat">
      <span class="hud-icon">W</span>
      <span class="hud-value text-amber-300">{{ wheat }}</span>
    </div>

    <div class="hud-section" title="Coins">
      <span class="hud-icon">C</span>
      <span class="hud-value text-yellow-300">{{ coins }}</span>
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
</style>
