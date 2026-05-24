<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

interface HintData {
  show: boolean
  step?: string
  title: string
  detail: string
  tone: 'labor' | 'trade' | 'idle' | 'wait' | 'night'
}

const hint = computed<HintData>(() => {
  const phase = game.phase
  const player = game.playerState
  const slots = game.playerTradeSlots
  const dungeonUsed = game.state?.playerDungeonUsedToday === true

  if (phase === 'player_labor') {
    return {
      show: true,
      step: 'Step 1 of 2',
      title: 'LABOR — Gather food',
      detail: 'Walk to a fishing spot (sand near water) or farmland (yellow tile). Press E to fish or farm.',
      tone: 'labor',
    }
  }

  if (phase === 'player_trade') {
    if (slots <= 0) {
      return {
        show: true,
        step: 'Trade slots used',
        title: 'No more trades today',
        detail: 'Click End Turn to let AI islanders take their turns and advance the day.',
        tone: 'idle',
      }
    }
    const fish = player?.resources.fish ?? 0
    const wheat = player?.resources.wheat ?? 0
    const lowOnFood = fish <= 2 || wheat <= 2
    return {
      show: true,
      step: 'Step 2 of 2',
      title: `TRADE — ${slots} slot${slots === 1 ? '' : 's'} left`,
      detail: lowOnFood
        ? 'Low on food! Negotiate with NPCs (E near them) or sell extras to the ship for coins.'
        : dungeonUsed
          ? 'Sell to the merchant ship for coins, or negotiate trades with NPCs. End Turn when done.'
          : 'Sell to the ship for coins, talk to NPCs to trade, or fight the cave boss. End Turn when done.',
      tone: 'trade',
    }
  }

  if (phase === 'ai_turns') {
    const who = game.thinkingCharacter
    return {
      show: true,
      title: 'AI ISLANDERS TAKING THEIR TURNS',
      detail: who ? `${who} is deciding what to do…` : 'Watch the event log to see their moves.',
      tone: 'wait',
    }
  }

  if (phase === 'settlement') {
    return {
      show: true,
      title: 'NIGHT — Settlement',
      detail: 'Everyone spends 1 fish and 1 wheat to survive the night.',
      tone: 'night',
    }
  }

  if (phase === 'day_start') {
    return {
      show: true,
      title: 'DAWN — A new day begins',
      detail: 'Merchant prices roll, queued harvests deliver, trade slots reset.',
      tone: 'idle',
    }
  }

  return { show: false, title: '', detail: '', tone: 'idle' }
})
</script>

<template>
  <Transition name="hint-fade">
    <div v-if="hint.show" :class="['phase-hint', `tone-${hint.tone}`]">
      <span v-if="hint.step" class="hint-step">{{ hint.step }}</span>
      <div class="hint-body">
        <div class="hint-title">{{ hint.title }}</div>
        <div class="hint-detail">{{ hint.detail }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.phase-hint {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  max-width: 92%;
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(10, 18, 30, 0.92);
  border: 1px solid rgba(132, 186, 230, 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  font-family: monospace;
  color: #e6f1fb;
  z-index: 40;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.hint-step {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.08);
  color: #c8a060;
}

.hint-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.hint-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
}

.hint-detail {
  font-size: 11px;
  line-height: 1.35;
  color: #b9cad8;
}

.tone-labor {
  border-color: rgba(120, 220, 140, 0.55);
}
.tone-labor .hint-title { color: #a8e6a8; }

.tone-trade {
  border-color: rgba(132, 186, 230, 0.55);
}
.tone-trade .hint-title { color: #aad4f0; }

.tone-wait {
  border-color: rgba(160, 130, 220, 0.55);
}
.tone-wait .hint-title { color: #c5a8e6; }

.tone-night {
  border-color: rgba(120, 90, 180, 0.55);
}
.tone-night .hint-title { color: #c0a8e0; }

.tone-idle {
  border-color: rgba(200, 160, 96, 0.45);
}
.tone-idle .hint-title { color: #e8d5a3; }

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: all 0.25s ease;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
