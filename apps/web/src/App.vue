<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useGameStore } from '@/stores/game'
import GameCanvas from '@/components/GameCanvas.vue'
import HUD from '@/components/HUD.vue'
import DialoguePanel from '@/components/DialoguePanel.vue'
import InteractionPrompt from '@/components/InteractionPrompt.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import EventLog from '@/components/EventLog.vue'
import CardPicker from '@/components/CardPicker.vue'
import ResourceToasts from '@/components/ResourceToasts.vue'
import PhaseHint from '@/components/PhaseHint.vue'
import type { InteractionType } from '@/game/GameWorld'

const InteractionPreview3D = defineAsyncComponent(() => import('@/components/InteractionPreview3D.vue'))

const game = useGameStore()
const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)

async function startGame() {
  await game.newGame()
}

function onInteractionChange(interaction: InteractionType) {
  game.setInteraction(interaction)
}

function onActionMenu() {
  game.openActionMenu()
}

function onPlayerMoved() {
  // Could play a sound, etc.
}

function closeActionMenu() {
  game.closeActionMenu()
}

function onStartNegotiation() {
  // Negotiation is now opened by submitAction when server responds.
  // Just close the action menu.
  game.closeActionMenu()
}

function openMerchant() {
  // Merchant handled inside ActionMenu
}

function closeDialogue() {
  game.closeNegotiation()
}

async function endTurn() {
  game.closeActionMenu()
  // Clear any active negotiation before ending turn
  game.closeNegotiation()
  await game.submitAction({ type: 'end_turn' })
}

function onDungeonCardPicked(cardId: string) {
  game.pickCard(cardId)
  const renderer = gameCanvasRef.value?.getRenderer()
  if (renderer?.isDungeonActive()) {
    renderer.dungeon.applyCardPick(cardId)
  }
}

async function onDungeonResult(win: boolean) {
  await game.submitDungeonResult(win)
}


const showGameOverOverlay = computed(() => {
  return game.isGameOver && game.state
})

const gameOverMessage = computed(() => {
  if (!game.state) return ''
  if (game.winner === 'player') return 'You escaped the island! Victory!'
  if (game.winner) return `${game.winner} escaped the island. You lost.`
  if (!game.playerAlive) return 'You have been eliminated. Game Over.'
  return 'Game Over.'
})
</script>

<template>
  <!-- Title Screen -->
  <div v-if="!game.gameId" class="title-screen">
    <div class="title-content">
      <div class="title-logo">
        <div class="title-island">
          <div class="pixel-island"></div>
        </div>
        <h1 class="title-heading">ISLAND ESCAPE</h1>
        <p class="title-sub">A survival trading game with AI agents</p>
      </div>

      <button
        :disabled="game.isLoading"
        class="start-btn"
        @click="startGame"
      >
        <span v-if="game.isLoading">Creating game...</span>
        <span v-else>NEW GAME</span>
      </button>

      <div class="title-instructions">
        <h3 class="instructions-heading">How to play</h3>
        <ul class="instructions-list">
          <li><strong>WASD</strong> to move your character on the island</li>
          <li><strong>E / Space</strong> to interact with NPCs, fishing spots, farms, and the ship</li>
          <li><strong>Gather</strong> fish and wheat each day to survive</li>
          <li><strong>Trade</strong> with the merchant ship to earn coins</li>
          <li><strong>Negotiate</strong> with other islanders for better deals</li>
          <li>Each night costs 1 fish + 1 wheat -- run out and you're eliminated!</li>
          <li>First to collect <strong>100 coins</strong> escapes the island and wins!</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Game Screen -->
  <div v-else class="game-screen">
    <!-- HUD Bar (top) -->
    <HUD />

    <!-- Main Game Area -->
    <div class="game-main">
      <InteractionPreview3D />

      <!-- Canvas + Overlays -->
      <div class="canvas-area">
        <!-- PixiJS Canvas -->
        <GameCanvas
          ref="gameCanvasRef"
          :class="{ 'canvas-no-events': game.showActionMenu }"
          @interaction-change="onInteractionChange"
          @action-menu="onActionMenu"
          @player-moved="onPlayerMoved"
        />

        <!-- Persistent phase guidance for new players -->
        <PhaseHint v-if="!game.dungeonMode" />

        <!-- Action Menu Popup (centered over canvas) -->
        <Transition name="popup">
          <div v-if="game.showActionMenu && game.currentInteraction" class="action-menu-overlay">
            <ActionMenu
              :interaction="game.currentInteraction"
              @close="closeActionMenu"
              @start-negotiation="onStartNegotiation"
              @open-merchant="openMerchant"
            />
          </div>
        </Transition>

        <!-- Game Over Overlay -->
        <Transition name="fade">
          <div v-if="showGameOverOverlay" class="gameover-overlay">
            <div class="gameover-box">
              <h2 class="gameover-title">GAME OVER</h2>
              <p class="gameover-message">{{ gameOverMessage }}</p>
              <button class="gameover-btn" @click="startGame">Play Again</button>
            </div>
          </div>
        </Transition>

        <!-- Dungeon HUD -->
        <div v-if="game.dungeonMode && !game.dungeonResult" class="dungeon-hud">
          <div class="dungeon-hud-item">
            <span class="hud-label">HP</span>
            <div class="hud-bar-bg"><div class="hud-bar-fill player-bar" :style="{ width: (game.dungeonStats.hp / game.dungeonStats.maxHp * 100) + '%' }" /></div>
            <span class="hud-val">{{ game.dungeonStats.hp }}/{{ game.dungeonStats.maxHp }}</span>
          </div>
          <div class="dungeon-hud-item boss-item">
            <span class="hud-label">Giant Crab</span>
            <div class="hud-bar-bg boss-bar-bg"><div class="hud-bar-fill boss-bar" :style="{ width: (game.dungeonStats.bossHp / game.dungeonStats.bossMaxHp * 100) + '%' }" /></div>
          </div>
          <div class="dungeon-hud-item xp-item">
            <span class="hud-label">XP</span>
            <div class="hud-bar-bg xp-bar-bg"><div class="hud-bar-fill xp-bar" :style="{ width: (game.dungeonStats.xp / game.dungeonStats.xpNext * 100) + '%' }" /></div>
          </div>
        </div>

        <!-- Dungeon Result -->
        <div v-if="game.dungeonResult" class="dungeon-result-overlay">
          <div class="dungeon-result-box">
            <h2 :class="game.dungeonResult.win ? 'result-v' : 'result-d'">{{ game.dungeonResult.win ? 'VICTORY!' : 'DEFEATED' }}</h2>
            <p>Damage dealt: {{ game.dungeonResult.damageDealt }}</p>
            <p>Damage taken: {{ game.dungeonResult.damageTaken }}</p>
            <p>Cards: {{ game.dungeonResult.cardsCollected }}</p>
            <button class="dungeon-leave-btn" @click="onDungeonResult(!!game.dungeonResult?.win)">Return to Island</button>
          </div>
        </div>
      </div>

      <!-- Card Picker -->
      <CardPicker @select="onDungeonCardPicked" />

      <!-- Dialogue Panel (right side) -->
      <Transition name="slide-right">
        <div v-if="game.showDialoguePanel && game.dialogueTarget" class="dialogue-area">
          <DialoguePanel :target="game.dialogueTarget" @close="closeDialogue" />
        </div>
      </Transition>
    </div>

    <!-- Bottom Bar -->
    <div class="bottom-bar">
      <!-- Interaction Prompt (left/center) -->
      <div class="bottom-left">
        <InteractionPrompt
          v-if="game.isPlayerTurn"
          :interaction="game.currentInteraction"
        />
        <div v-else-if="game.phase === 'ai_turns'" class="phase-indicator">
          <span class="phase-dot ai-dot"></span>
          <span>AI characters are taking their turns...</span>
        </div>
        <div v-else-if="game.phase === 'settlement'" class="phase-indicator">
          <span class="phase-dot night-dot"></span>
          <span>Night falls... resources consumed.</span>
        </div>
      </div>

      <!-- End Turn Button (right) -->
      <div class="bottom-right">
        <button
          v-if="game.isPlayerTurn"
          class="end-turn-btn"
          :disabled="game.isLoading"
          @click="endTurn"
        >
          End Turn
        </button>
      </div>
    </div>

    <!-- Event Log (bottom, collapsible) -->
    <EventLog />

    <!-- Floating resource change toasts (overlay) -->
    <ResourceToasts />
  </div>
</template>

<style scoped>
/* ===== Title Screen ===== */
.title-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #0a1628 0%, #0f2040 50%, #0a1628 100%);
}

.title-content {
  text-align: center;
  max-width: 480px;
  padding: 32px;
}

.title-logo {
  margin-bottom: 32px;
}

.title-island {
  margin-bottom: 16px;
}

.pixel-island {
  width: 80px;
  height: 80px;
  margin: 0 auto;
  background: linear-gradient(180deg, #2389da 0%, #2389da 40%, #e8d5a3 40%, #e8d5a3 50%, #5b9a3e 50%, #5b9a3e 100%);
  border-radius: 50%;
  border: 3px solid #1a3a52;
  image-rendering: pixelated;
}

.title-heading {
  font-family: monospace;
  font-size: 36px;
  font-weight: 900;
  color: #e8d5a3;
  letter-spacing: 4px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  margin: 0;
}

.title-sub {
  font-family: monospace;
  font-size: 12px;
  color: #6a8aaa;
  margin-top: 8px;
}

.start-btn {
  display: inline-block;
  padding: 12px 40px;
  background: linear-gradient(180deg, #b45309, #8b3a06);
  border: 2px solid #d4730a;
  border-radius: 6px;
  color: #fff;
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 32px;
}
.start-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #d4730a, #b45309);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(180, 83, 9, 0.4);
}
.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.title-instructions {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #2a3a4a;
  border-radius: 8px;
  padding: 16px 20px;
  text-align: left;
}

.instructions-heading {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #c8a060;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.instructions-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: monospace;
  font-size: 11px;
  color: #8a9aaa;
  line-height: 1.6;
}
.instructions-list li {
  padding: 2px 0;
}
.instructions-list li::before {
  content: '> ';
  color: #4a6a3a;
}
.instructions-list li strong {
  color: #b0c0d0;
}

/* ===== Game Screen ===== */
.game-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #0a0a1a;
}

.game-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.canvas-area {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.dialogue-area {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
}

/* ===== Bottom Bar ===== */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #0f0f1a;
  border-top: 1px solid #2a2a4a;
  min-height: 40px;
}

.bottom-left {
  flex: 1;
  display: flex;
  align-items: center;
}

.bottom-right {
  flex-shrink: 0;
}

.phase-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
  font-size: 11px;
  color: #7a8a9a;
}

.phase-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.ai-dot {
  background: #3388cc;
}

.night-dot {
  background: #6644aa;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.end-turn-btn {
  padding: 8px 20px;
  background: linear-gradient(180deg, #334466, #223355);
  border: 1px solid #4a6a8a;
  border-radius: 4px;
  color: #c8d8e8;
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.15s;
}
.end-turn-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #445577, #334466);
  border-color: #6a8aaa;
}
.end-turn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Action Menu Overlay ===== */
.canvas-no-events :deep(canvas) {
  pointer-events: none !important;
}

.canvas-no-events {
  pointer-events: none !important;
}

.action-menu-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  pointer-events: auto !important;
}

.action-menu-overlay * {
  pointer-events: auto !important;
}

/* ===== Game Over Overlay ===== */
.gameover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  z-index: 100;
  pointer-events: auto;
}

.gameover-box {
  text-align: center;
  background: #1a1a2e;
  border: 2px solid #4a4a6a;
  border-radius: 12px;
  padding: 32px 48px;
}

.gameover-title {
  font-family: monospace;
  font-size: 28px;
  font-weight: 900;
  color: #e8a040;
  letter-spacing: 4px;
  margin: 0 0 12px 0;
}

.gameover-message {
  font-family: monospace;
  font-size: 13px;
  color: #a0b0c0;
  margin: 0 0 24px 0;
}

.gameover-btn {
  padding: 10px 32px;
  background: #b45309;
  border: 1px solid #d4730a;
  border-radius: 4px;
  color: #fff;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  letter-spacing: 1px;
}
.gameover-btn:hover {
  background: #d4730a;
}

/* ===== Dungeon HUD ===== */
.dungeon-hud {
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  display: flex;
  gap: 8px;
  z-index: 50;
  pointer-events: none;
}
.dungeon-hud-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 10px;
}
.boss-item { flex: 1; justify-content: center; }
.xp-item { min-width: 80px; }
.hud-label { color: #aabbcc; font-size: 9px; font-weight: bold; min-width: 20px; }
.hud-val { color: #ccdddd; font-size: 9px; }
.hud-bar-bg { flex: 1; height: 8px; background: #3a3a5a; border-radius: 3px; overflow: hidden; }
.boss-bar-bg { max-width: 120px; }
.xp-bar-bg { background: #2a3a2a; }
.hud-bar-fill { height: 100%; border-radius: 3px; transition: width 0.2s; }
.player-bar { background: linear-gradient(90deg, #22aa55, #44dd77); }
.boss-bar { background: linear-gradient(90deg, #cc3333, #ff5555); }
.xp-bar { background: linear-gradient(90deg, #44aaff, #88ccff); }

/* ===== Dungeon Result ===== */
.dungeon-result-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 60;
  pointer-events: auto;
}
.dungeon-result-box {
  background: #1a1a2e;
  border: 2px solid #4a4a6a;
  border-radius: 12px;
  padding: 24px 40px;
  text-align: center;
  font-family: monospace;
}
.result-v { color: #ffcc44; font-size: 28px; font-weight: 900; margin: 0 0 12px; }
.result-d { color: #ff4444; font-size: 28px; font-weight: 900; margin: 0 0 12px; }
.dungeon-result-box p { color: #aabbcc; font-size: 12px; margin: 4px 0; }
.dungeon-leave-btn {
  margin-top: 12px;
  padding: 8px 24px;
  background: #334466;
  border: 1px solid #4a6a8a;
  border-radius: 4px;
  color: #c8d8e8;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}
.dungeon-leave-btn:hover { background: #445577; }

/* ===== Transitions ===== */
.popup-enter-active {
  transition: all 0.2s ease-out;
}
.popup-leave-active {
  transition: all 0.15s ease-in;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

.slide-right-enter-active {
  transition: all 0.25s ease-out;
}
.slide-right-leave-active {
  transition: all 0.2s ease-in;
}
.slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.fade-enter-active {
  transition: opacity 0.5s ease;
}
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
