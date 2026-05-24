<script setup lang="ts">
import { useGameStore } from '@/stores/game'

const emit = defineEmits<{
  select: [cardId: string]
}>()

const game = useGameStore()

function selectCard(cardId: string) {
  emit('select', cardId)
}
</script>

<template>
  <div v-if="game.showCardPicker" class="card-picker-overlay">
    <div class="card-picker-box">
      <h2 class="picker-title">Choose an Upgrade</h2>
      <div class="cards-row">
        <button
          v-for="(card, idx) in game.pendingCards"
          :key="card.id"
          class="card-btn"
          :style="{ animationDelay: `${idx * 70}ms` }"
          @click="selectCard(card.id)"
        >
          <span class="card-icon">{{ card.icon }}</span>
          <span class="card-name">{{ card.name }}</span>
          <span class="card-desc">{{ card.description }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: overlay-fade 0.2s ease-out;
}

@keyframes overlay-fade {
  from { background: rgba(0, 0, 0, 0); }
  to   { background: rgba(0, 0, 0, 0.7); }
}

.card-picker-box {
  background: #1a1a2e;
  border: 2px solid #c8a060;
  border-radius: 12px;
  padding: 24px 32px;
  text-align: center;
  max-width: 560px;
  width: 90%;
  animation: box-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes box-pop {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

.picker-title {
  font-family: monospace;
  font-size: 18px;
  font-weight: 900;
  color: #c8a060;
  letter-spacing: 2px;
  margin: 0 0 20px 0;
  text-transform: uppercase;
}

.cards-row {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.card-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  background: linear-gradient(180deg, #2a2a4a, #1a1a3a);
  border: 2px solid #4a4a6a;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.12s ease-out, border-color 0.15s, background 0.15s, box-shadow 0.15s;
  color: #d0d0e0;
  font-family: monospace;
  max-width: 160px;
  opacity: 0;
  animation: card-rise 0.32s cubic-bezier(0.22, 1.2, 0.36, 1) forwards;
}

@keyframes card-rise {
  from { transform: translateY(28px) scale(0.92); opacity: 0; }
  to   { transform: translateY(0) scale(1);       opacity: 1; }
}

.card-btn:hover {
  border-color: #c8a060;
  background: linear-gradient(180deg, #3a3a5a, #2a2a4a);
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 4px 16px rgba(200, 160, 96, 0.25);
}
.card-btn:active {
  transform: translateY(0) scale(0.97);
  box-shadow: 0 2px 8px rgba(200, 160, 96, 0.2);
}

.card-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.card-name {
  font-size: 12px;
  font-weight: bold;
  color: #e8d5a3;
}

.card-desc {
  font-size: 10px;
  color: #8a9aaa;
  line-height: 1.3;
}
</style>
