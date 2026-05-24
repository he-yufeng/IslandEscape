<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useGameStore } from '@/stores/game'
import { InteractionPreviewRenderer } from '@/render3d/InteractionPreviewRenderer'
import {
  buildPreviewDetails,
  buildPreviewPhaseNodes,
  buildPreviewRuleSections,
} from '@/components/interactionPreviewPanel'

const game = useGameStore()
const canvasHost = ref<HTMLElement | null>(null)
const previewUnavailable = ref(false)

let renderer: InteractionPreviewRenderer | null = null

const phaseNodes = computed(() => buildPreviewPhaseNodes(game.phase))
const ruleSections = computed(() => buildPreviewRuleSections(game.state))
const previewDetails = computed(() =>
  buildPreviewDetails({
    state: game.state,
    phase: game.phase,
    interaction: game.currentInteraction,
    playerTradeSlots: game.playerTradeSlots,
    getFriendship: game.getFriendship,
    canTradeWithNpc: game.canTradeWithNpc,
  }),
)

onMounted(() => {
  if (!canvasHost.value) return

  try {
    renderer = new InteractionPreviewRenderer()
    renderer.init(canvasHost.value)
    renderer.setInteraction(game.currentInteraction)
  } catch (error) {
    previewUnavailable.value = true
    console.error('Failed to initialize interaction preview renderer', error)
  }
})

watch(
  () => game.currentInteraction,
  (interaction) => {
    renderer?.setInteraction(interaction)
  },
)

onBeforeUnmount(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <aside class="interaction-preview" aria-label="Nearby interaction preview">
    <div class="preview-shell">
      <section class="phase-panel">
        <div class="phase-head">
          <div class="phase-heading">
            <p class="phase-kicker">Turn Flow</p>
            <h2 class="phase-title">Day {{ game.day }}</h2>
          </div>

          <div class="rules-help">
            <button type="button" class="rules-button" aria-label="Show current game rules">
              ?
            </button>

            <div class="rules-popover">
              <div
                v-for="section in ruleSections"
                :key="section.title"
                class="rules-section"
              >
                <h3 class="rules-title">{{ section.title }}</h3>
                <p
                  v-for="line in section.lines"
                  :key="line"
                  class="rules-line"
                >
                  {{ line }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="phase-flow" aria-label="Current turn phase flow">
          <div
            v-for="node in phaseNodes"
            :key="node.id"
            class="phase-node-wrap"
          >
            <button
              type="button"
              :class="['phase-node', { 'phase-node-active': node.active }]"
              :aria-label="`Show ${node.label} phase details`"
            >
              <span class="phase-node-label">{{ node.label }}</span>
            </button>

            <div class="phase-node-popover">
              <h3 class="phase-node-title">{{ node.label }}</h3>
              <p class="phase-node-summary">{{ node.summary }}</p>
              <p
                v-for="line in node.details"
                :key="`${node.id}-${line}`"
                class="phase-node-line"
              >
                {{ line }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="preview-copy">
        <p class="preview-kicker">{{ previewDetails.kindLabel }}</p>
        <h2 class="preview-title">{{ previewDetails.title }}</h2>
        <p class="preview-subtitle">{{ previewDetails.subtitle }}</p>
      </section>

      <div class="preview-canvas-wrap">
        <div v-if="previewUnavailable" class="preview-fallback">
          3D preview unavailable
        </div>
        <div v-else ref="canvasHost" class="preview-canvas" />
      </div>

      <section class="preview-details">
        <article
          v-for="section in previewDetails.sections"
          :key="section.title"
          class="detail-section"
        >
          <h3 class="detail-title">{{ section.title }}</h3>
          <p v-if="section.note" class="detail-note">{{ section.note }}</p>

          <dl class="detail-grid">
            <div
              v-for="stat in section.stats"
              :key="`${section.title}-${stat.label}`"
              class="detail-row"
            >
              <dt class="detail-label">{{ stat.label }}</dt>
              <dd :class="['detail-value', stat.tone ? `detail-${stat.tone}` : '']">
                {{ stat.value }}
              </dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.interaction-preview {
  --preview-border: rgba(109, 154, 191, 0.24);
  --preview-bg-top: #102234;
  --preview-bg-bottom: #0b1826;
  --preview-panel: rgba(9, 19, 30, 0.84);
  --preview-panel-strong: rgba(15, 31, 49, 0.94);
  --preview-copy: #e6f1fb;
  --preview-mute: #9bb3c4;
  --preview-accent: #76b5d2;
  --preview-good: #8dd084;
  --preview-warn: #df9f6d;
  width: clamp(300px, 24vw, 360px);
  flex-shrink: 0;
  min-width: 300px;
  padding: 10px 0 10px 10px;
}

.preview-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid var(--preview-border);
  border-radius: 8px;
  overflow: visible;
  isolation: isolate;
  background:
    radial-gradient(circle at 20% 18%, rgba(118, 207, 255, 0.22), transparent 34%),
    linear-gradient(180deg, var(--preview-bg-top) 0%, var(--preview-bg-bottom) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.phase-panel {
  position: relative;
  z-index: 12;
  overflow: visible;
  padding: 12px 12px 8px;
  border-bottom: 1px solid rgba(113, 158, 194, 0.12);
  background: linear-gradient(180deg, rgba(8, 14, 20, 0.34), rgba(8, 14, 20, 0.08));
}

.phase-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.phase-heading {
  min-width: 0;
}

.phase-kicker,
.preview-kicker {
  margin: 0 0 4px;
  color: var(--preview-accent);
  font-family: monospace;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.phase-title,
.preview-title {
  margin: 0;
  color: var(--preview-copy);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.05;
}

.rules-help {
  position: relative;
  flex-shrink: 0;
}

.rules-button {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(132, 186, 230, 0.45);
  border-radius: 50%;
  background: rgba(13, 25, 39, 0.9);
  color: var(--preview-copy);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  font-weight: 700;
  cursor: help;
}

.rules-popover {
  position: absolute;
  top: 32px;
  right: 0;
  width: 258px;
  padding: 12px;
  border: 1px solid rgba(132, 186, 230, 0.35);
  border-radius: 8px;
  background: rgba(7, 15, 23, 0.96);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
  z-index: 40;
}

.rules-help:hover .rules-popover,
.rules-help:focus-within .rules-popover {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.rules-section + .rules-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(132, 186, 230, 0.12);
}

.rules-title {
  margin: 0 0 4px;
  color: var(--preview-copy);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
}

.rules-line {
  margin: 0;
  color: var(--preview-mute);
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
}

.phase-flow {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  align-items: start;
}

.phase-flow::before {
  content: '';
  position: absolute;
  top: 17px;
  left: 14px;
  right: 14px;
  height: 1px;
  background: linear-gradient(90deg, rgba(118, 181, 210, 0.15), rgba(118, 181, 210, 0.45), rgba(118, 181, 210, 0.15));
}

.phase-node-wrap {
  position: static;
}

.phase-node {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 34px;
  padding: 7px 4px;
  border: 1px solid rgba(132, 186, 230, 0.14);
  border-radius: 5px;
  background: rgba(10, 20, 31, 0.68);
  cursor: help;
}

.phase-node-label {
  color: var(--preview-copy);
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
  text-transform: uppercase;
}

.phase-node-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  padding: 10px 12px;
  border: 1px solid rgba(132, 186, 230, 0.3);
  border-radius: 8px;
  background: rgba(6, 14, 22, 0.96);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.36);
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
  z-index: 40;
  pointer-events: none;
}

.phase-node-wrap:hover .phase-node-popover,
.phase-node-wrap:focus-within .phase-node-popover {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
}

.phase-node-title {
  margin: 0 0 4px;
  color: var(--preview-copy);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 13px;
}

.phase-node-summary,
.phase-node-line {
  margin: 0;
  color: var(--preview-mute);
  font-family: monospace;
  font-size: 10px;
  line-height: 1.45;
}

.phase-node-summary {
  color: var(--preview-accent);
  margin-bottom: 6px;
}

.phase-node-line + .phase-node-line {
  margin-top: 4px;
}

.phase-node-active {
  border-color: rgba(141, 208, 132, 0.52);
  background: linear-gradient(180deg, rgba(25, 56, 37, 0.94), rgba(15, 42, 28, 0.88));
  box-shadow: 0 0 0 1px rgba(141, 208, 132, 0.15);
}

.phase-node-active .phase-node-label {
  color: #e8ffea;
}

.preview-copy {
  position: relative;
  z-index: 1;
  padding: 10px 14px 8px;
}

.preview-subtitle {
  margin: 6px 0 0;
  color: var(--preview-mute);
  font-family: monospace;
  font-size: 10px;
  line-height: 1.45;
}

.preview-canvas-wrap {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  height: clamp(132px, 19vh, 188px);
  min-height: 132px;
  min-width: 300px;
}

.preview-canvas-wrap::before {
  content: '';
  position: absolute;
  inset: auto 14px 18px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(132, 186, 230, 0.35), transparent);
  z-index: 1;
}

.preview-canvas {
  width: 100%;
  height: 100%;
  min-height: 132px;
}

.preview-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #9bb3c4;
  font-family: monospace;
  font-size: 12px;
  text-align: center;
  padding: 16px;
}

.preview-details {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 12px 12px;
}

.detail-section {
  padding: 10px 0 0;
  border-top: 1px solid rgba(132, 186, 230, 0.1);
}

.detail-title {
  margin: 0 0 5px;
  color: var(--preview-copy);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
}

.detail-note {
  margin: 0 0 8px;
  color: var(--preview-mute);
  font-family: monospace;
  font-size: 10px;
  line-height: 1.4;
}

.detail-grid {
  display: grid;
  gap: 6px;
  margin: 0;
}

.detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: baseline;
  padding: 6px 8px;
  border-radius: 5px;
  background: rgba(7, 15, 24, 0.36);
}

.detail-label {
  min-width: 0;
  color: var(--preview-mute);
  font-family: monospace;
  font-size: 10px;
  line-height: 1.4;
}

.detail-value {
  margin: 0;
  text-align: right;
  color: var(--preview-copy);
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
}

.detail-accent {
  color: var(--preview-accent);
}

.detail-good {
  color: var(--preview-good);
}

.detail-warn {
  color: var(--preview-warn);
}

@media (max-width: 960px) {
  .interaction-preview {
    display: none;
  }
}
</style>
