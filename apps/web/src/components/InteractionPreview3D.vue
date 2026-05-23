<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useGameStore } from '@/stores/game'
import { InteractionPreviewRenderer } from '@/render3d/InteractionPreviewRenderer'
import { getInteractionPreviewMeta } from '@/render3d/interactionPreviewMeta'

const game = useGameStore()
const canvasHost = ref<HTMLElement | null>(null)
const previewUnavailable = ref(false)

let renderer: InteractionPreviewRenderer | null = null

const previewMeta = computed(() => getInteractionPreviewMeta(game.currentInteraction))

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
      <div class="preview-copy">
        <p class="preview-kicker">Nearby</p>
        <h2 class="preview-title">{{ previewMeta.title }}</h2>
        <p class="preview-subtitle">{{ previewMeta.subtitle }}</p>
      </div>

      <div class="preview-canvas-wrap">
        <div v-if="previewUnavailable" class="preview-fallback">
          3D preview unavailable
        </div>
        <div v-else ref="canvasHost" class="preview-canvas" />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.interaction-preview {
  width: clamp(220px, 20vw, 320px);
  flex-shrink: 0;
  min-width: 0;
  padding: 12px 0 12px 12px;
}

.preview-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid rgba(109, 154, 191, 0.24);
  border-radius: 8px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 18%, rgba(118, 207, 255, 0.22), transparent 34%),
    linear-gradient(180deg, #102234 0%, #0b1826 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.preview-copy {
  position: relative;
  z-index: 2;
  padding: 16px 16px 10px;
  background: linear-gradient(180deg, rgba(8, 14, 20, 0.24), rgba(8, 14, 20, 0));
}

.preview-kicker {
  margin: 0 0 6px;
  color: #76b5d2;
  font-family: monospace;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.preview-title {
  margin: 0;
  color: #e6f1fb;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.05;
}

.preview-subtitle {
  margin: 8px 0 0;
  color: #9bb3c4;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.55;
}

.preview-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 220px;
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
  min-height: 220px;
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

@media (max-width: 960px) {
  .interaction-preview {
    display: none;
  }
}
</style>
