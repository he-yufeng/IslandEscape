<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore, CHARACTER_META } from '@/stores/game'
import type { InteractionType } from '@/game/GameWorld'
import type { CharacterId } from '@game/shared'

const props = defineProps<{
  interaction: InteractionType
}>()

const emit = defineEmits<{
  close: []
  'start-negotiation': [target: CharacterId]
  'open-merchant': []
}>()

const game = useGameStore()
const fishSellQty = ref(0)
const wheatSellQty = ref(0)

const isLaborPhase = computed(() => game.phase === 'player_labor')
const isTradePhase = computed(() => game.phase === 'player_trade')

const maxFish = computed(() => game.playerState?.resources.fish ?? 0)
const maxWheat = computed(() => game.playerState?.resources.wheat ?? 0)

// Friendship for NPC interactions
const npcFriendship = computed(() => {
  if (props.interaction?.kind !== 'npc') return null
  return game.getFriendship(props.interaction.characterId)
})
const npcFriendshipHearts = computed(() => {
  const f = npcFriendship.value ?? 0
  if (f >= 35) return { filled: 4, empty: 0, text: '♥♥♥♥ Best Friends' }
  if (f >= 25) return { filled: 3, empty: 1, text: '♥♥♥ Good Friends' }
  if (f >= 15) return { filled: 2, empty: 2, text: '♥♥ Friendly' }
  if (f >= 5)  return { filled: 1, empty: 3, text: '♥ Acquaintance' }
  return { filled: 0, empty: 4, text: '♡ Stranger' }
})

const dungeonUsedToday = computed(() => game.state?.playerDungeonUsedToday === true)
const dungeonDisabled = computed(() =>
  game.playerTradeSlots <= 0 || game.isLoading || dungeonUsedToday.value
)
const dungeonCostLabel = computed(() => {
  if (dungeonUsedToday.value) return '(Already entered today)'
  if (game.playerTradeSlots <= 0) return '(No trade slots)'
  return '(1 trade slot)'
})

const menuTitle = computed(() => {
  if (!props.interaction) return ''
  switch (props.interaction.kind) {
    case 'npc':
      return props.interaction.characterName
    case 'fish':
      return 'Fishing Spot'
    case 'farm':
      return 'Farmland'
    case 'merchant':
      return 'Merchant Ship'
    case 'dungeon':
      return 'Dark Cave'
    default:
      return ''
  }
})

async function doFish() {
  await game.submitAction({ type: 'fish' })
  emit('close')
}

async function doFarm() {
  await game.submitAction({ type: 'farm' })
  emit('close')
}

function startTrade(target: CharacterId) {
  // Don't send API yet — open dialogue panel and let player type first message
  game.openNegotiation(target, `conv_${Date.now()}`)
  emit('close')
}

async function enterDungeon() {
  await game.submitAction({ type: 'enter_dungeon' })
  emit('close')
}

async function doMerchantSell() {
  if (fishSellQty.value <= 0 && wheatSellQty.value <= 0) return
  // Clamp to available resources
  const fish = Math.min(fishSellQty.value, maxFish.value)
  const wheat = Math.min(wheatSellQty.value, maxWheat.value)
  await game.submitAction({
    type: 'trade_merchant',
    sell: { fish, wheat },
  })
  fishSellQty.value = 0
  wheatSellQty.value = 0
  emit('close')
}
</script>

<template>
  <div v-if="interaction" class="action-menu">
    <div class="menu-header">
      <span class="menu-title">{{ menuTitle }}</span>
      <button class="menu-close" @click="emit('close')">X</button>
    </div>

    <!-- LABOR PHASE: only fish/farm -->
    <div v-if="isLaborPhase && interaction.kind === 'fish'" class="menu-body">
      <div class="phase-tag labor">LABOR PHASE</div>
      <button class="menu-action-btn" :disabled="game.isLoading" @click="doFish">
        <span class="action-icon">Fish</span>
        <span>Go Fishing (+3 fish)</span>
      </button>
      <div class="menu-note">You must labor first, then you can trade.</div>
    </div>

    <div v-else-if="isLaborPhase && interaction.kind === 'farm'" class="menu-body">
      <div class="phase-tag labor">LABOR PHASE</div>
      <button class="menu-action-btn" :disabled="game.isLoading" @click="doFarm">
        <span class="action-icon">Farm</span>
        <span>Plant Wheat (+8 in 3 days)</span>
      </button>
      <div class="menu-note">Wheat will be ready to harvest in 3 days.</div>
    </div>

    <div v-else-if="isLaborPhase" class="menu-body">
      <div class="phase-tag labor">LABOR PHASE</div>
      <div class="menu-note">You must fish or farm first! Walk to a fishing spot or farmland.</div>
    </div>

    <!-- TRADE PHASE: NPC, merchant -->
    <div v-else-if="isTradePhase && interaction.kind === 'npc'" class="menu-body">
      <div class="phase-tag trade">TRADE PHASE</div>
      <div class="menu-info">
        {{ CHARACTER_META[interaction.characterId]?.personality ?? '' }}
      </div>
      <div class="npc-friendship">
        <span v-for="i in npcFriendshipHearts.filled" :key="'f'+i" class="heart-icon heart-filled">&#x2665;</span>
        <span v-for="i in npcFriendshipHearts.empty" :key="'e'+i" class="heart-icon heart-empty">&#x2661;</span>
        <span class="friendship-text">{{ npcFriendshipHearts.text }}</span>
      </div>
      <!-- Has ongoing negotiation with this NPC? Allow reopening even with 0 slots -->
      <button
        v-if="game.activeNegotiation?.target === interaction.characterId"
        class="menu-action-btn"
        :disabled="game.isLoading"
        @click="startTrade(interaction.characterId)"
      >
        <span class="action-icon">Chat</span>
        <span>Continue conversation</span>
      </button>
      <!-- Has ongoing negotiation with a different NPC? Block -->
      <div
        v-else-if="game.activeNegotiation"
        class="menu-note"
      >
        Finish your current conversation with {{ CHARACTER_META[game.activeNegotiation.target]?.name ?? game.activeNegotiation.target }} first.
      </div>
      <!-- No ongoing negotiation: need trade slots -->
      <button
        v-else
        class="menu-action-btn"
        :disabled="game.playerTradeSlots <= 0 || !game.canTradeWithNpc(interaction.characterId) || game.isLoading"
        @click="startTrade(interaction.characterId)"
      >
        <span class="action-icon">Trade</span>
        <span>Negotiate a trade</span>
        <span v-if="game.playerTradeSlots <= 0" class="action-note">(No trade slots)</span>
        <span v-else-if="!game.canTradeWithNpc(interaction.characterId)" class="action-note">(Already traded today)</span>
      </button>
    </div>

    <div v-else-if="isTradePhase && interaction.kind === 'fish'" class="menu-body">
      <div class="phase-tag trade">TRADE PHASE</div>
      <div class="menu-note">You already labored today. Use your trade slots or end your turn.</div>
    </div>

    <div v-else-if="isTradePhase && interaction.kind === 'farm'" class="menu-body">
      <div class="phase-tag trade">TRADE PHASE</div>
      <div class="menu-note">You already labored today. Use your trade slots or end your turn.</div>
    </div>

    <div v-else-if="isTradePhase && interaction.kind === 'merchant'" class="menu-body">
      <div class="phase-tag trade">TRADE PHASE</div>
      <div class="merchant-prices">
        <span>Fish: {{ game.merchantPrices.fishPrice }}c each</span>
        <span>Wheat: {{ game.merchantPrices.wheatPrice }}c each</span>
      </div>

      <template v-if="game.playerTradeSlots > 0">
        <div class="merchant-sell-row">
          <label>Sell Fish:</label>
          <input
            v-model.number="fishSellQty"
            type="number"
            :min="0"
            :max="maxFish"
            class="merchant-input"
          />
          <button class="max-btn" @click="fishSellQty = maxFish">MAX</button>
        </div>

        <div class="merchant-sell-row">
          <label>Sell Wheat:</label>
          <input
            v-model.number="wheatSellQty"
            type="number"
            :min="0"
            :max="maxWheat"
            class="merchant-input"
          />
          <button class="max-btn" @click="wheatSellQty = maxWheat">MAX</button>
        </div>

        <div class="merchant-total">
          Total: {{ fishSellQty * game.merchantPrices.fishPrice + wheatSellQty * game.merchantPrices.wheatPrice }} coins
        </div>

        <button
          class="menu-action-btn"
          :disabled="(fishSellQty <= 0 && wheatSellQty <= 0) || game.isLoading"
          @click="doMerchantSell"
        >
          <span class="action-icon">Sell</span>
        <span>Sell to Merchant</span>
      </button>
      </template>

      <div v-else class="menu-note">
        No trade slots remaining. End your turn to continue.
      </div>
    </div>

    <!-- Dungeon -->
    <div v-else-if="isTradePhase && interaction.kind === 'dungeon'" class="menu-body">
      <div class="phase-tag dungeon-tag">DUNGEON</div>
      <div class="menu-info">
        A dark cave looms before you. Something dangerous lurks inside...
      </div>
      <button
        class="menu-action-btn dungeon-btn"
        :disabled="dungeonDisabled"
        @click="enterDungeon"
      >
        <span class="action-icon">⚔️</span>
        <span>Enter the Dungeon</span>
        <span class="action-cost">{{ dungeonCostLabel }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-menu {
  background: #1a1a2e;
  border: 2px solid #3a4a6a;
  border-radius: 8px;
  min-width: 240px;
  max-width: 320px;
  font-family: monospace;
  font-size: 12px;
  color: #c8d8e8;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #222244;
  border-bottom: 1px solid #3a3a5a;
  border-radius: 6px 6px 0 0;
}

.menu-title {
  font-weight: bold;
  font-size: 13px;
}

.menu-close {
  background: none;
  border: none;
  color: #7a7a9a;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
}
.menu-close:hover {
  color: #ff6666;
}

.menu-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-info {
  font-size: 10px;
  color: #7a8a9a;
  padding: 4px 6px;
  background: #1a1a3a;
  border-radius: 4px;
}

.menu-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: #2a3a5a;
  border: 1px solid #3a4a6a;
  border-radius: 4px;
  color: #c8d8e8;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.menu-action-btn:hover:not(:disabled) {
  background: #3a4a6a;
}
.menu-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-icon {
  background: #4a6a8a;
  color: #e0f0ff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
}

.action-note {
  color: #aa6666;
  font-size: 9px;
}

.menu-note {
  font-size: 10px;
  color: #6a7a8a;
  padding-left: 4px;
}

.npc-friendship {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: rgba(255, 107, 157, 0.08);
  border-radius: 4px;
}
.heart-icon {
  font-size: 12px;
}
.heart-filled {
  color: #ff6b9d;
}
.heart-empty {
  color: #5a5a7a;
  opacity: 0.5;
}
.friendship-text {
  margin-left: 4px;
  font-size: 9px;
  color: #ff8fab;
}

.merchant-prices {
  display: flex;
  gap: 12px;
  padding: 6px;
  background: #1a1a3a;
  border-radius: 4px;
  font-size: 11px;
  color: #aabbcc;
}

.merchant-sell-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.merchant-sell-row label {
  font-size: 11px;
  min-width: 70px;
}

.merchant-input {
  width: 50px;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #c8d8e8;
  padding: 3px 6px;
  border-radius: 3px;
  text-align: center;
  font-family: monospace;
  font-size: 11px;
}

.max-btn {
  background: #3a3a5a;
  border: none;
  color: #8a9aaa;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 9px;
  cursor: pointer;
  font-family: monospace;
}
.max-btn:hover {
  background: #4a4a6a;
}

.merchant-total {
  font-weight: bold;
  text-align: center;
  padding: 4px;
  color: #f0c040;
}

.phase-tag {
  font-size: 9px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 3px;
  text-align: center;
  letter-spacing: 1px;
}
.phase-tag.labor {
  background: #2a5a3a;
  color: #80ff80;
}
.phase-tag.trade {
  background: #3a3a6a;
  color: #80a0ff;
}
.phase-tag.dungeon-tag {
  background: #5a1a1a;
  color: #ff6644;
}
.dungeon-btn {
  border-color: #6a3a3a !important;
  background: #3a1a1a !important;
}
.dungeon-btn:hover:not(:disabled) {
  background: #5a2a2a !important;
  border-color: #aa4444 !important;
}
.action-cost {
  font-size: 9px;
  color: #aa6666;
}
</style>
