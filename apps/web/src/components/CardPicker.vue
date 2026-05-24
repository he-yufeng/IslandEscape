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
          v-for="card in game.pendingCards"
          :key="card.id"
          class="card-btn"
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
}

.card-picker-box {
  background: #1a1a2e;
  border: 2px solid #c8a060;
  border-radius: 12px;
  padding: 24px 32px;
  text-align: center;
  max-width: 560px;
  width: 90%;
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
  transition: all 0.15s;
  color: #d0d0e0;
  font-family: monospace;
  max-width: 160px;
}
.card-btn:hover {
  border-color: #c8a060;
  background: linear-gradient(180deg, #3a3a5a, #2a2a4a);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(200, 160, 96, 0.2);
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
