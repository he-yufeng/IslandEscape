<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'

interface Toast {
  id: number
  kind: 'fish' | 'wheat' | 'coins'
  delta: number
}

const game = useGameStore()
const toasts = ref<Toast[]>([])
let toastSeq = 0

function pushToast(kind: Toast['kind'], delta: number) {
  if (delta === 0) return
  const t: Toast = { id: ++toastSeq, kind, delta }
  toasts.value.push(t)
  // Auto-remove after animation completes
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((x) => x.id !== t.id)
  }, 1500)
}

function watchResource(kind: Toast['kind']) {
  watch(
    () => game.playerState?.resources[kind] ?? null,
    (newVal, oldVal) => {
      if (newVal === null || oldVal === null || oldVal === undefined) return
      const delta = newVal - oldVal
      if (delta !== 0) pushToast(kind, delta)
    },
  )
}

watchResource('fish')
watchResource('wheat')
watchResource('coins')

function label(kind: Toast['kind']): string {
  if (kind === 'fish') return 'fish'
  if (kind === 'wheat') return 'wheat'
  return 'coins'
}
</script>

<template>
  <div class="resource-toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        :class="['toast', `toast-${t.kind}`, t.delta > 0 ? 'toast-pos' : 'toast-neg']"
      >
        <span class="toast-delta">{{ t.delta > 0 ? '+' : '' }}{{ t.delta }}</span>
        <span class="toast-kind">{{ label(t.kind) }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.resource-toasts {
  position: fixed;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 80;
  pointer-events: none;
}

.toast {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 18px;
  background: rgba(15, 25, 40, 0.92);
  border: 1px solid rgba(120, 160, 200, 0.4);
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  animation: float-up 1.4s ease-out forwards;
}

.toast-delta {
  font-size: 16px;
  font-weight: 900;
}

.toast-kind {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.85;
}

.toast-pos { color: #6dd070; }
.toast-pos .toast-delta { color: #8aff88; }

.toast-neg { color: #df9f6d; }
.toast-neg .toast-delta { color: #ff9a66; }

.toast-fish .toast-kind { color: #76b5d2; }
.toast-wheat .toast-kind { color: #e2c46a; }
.toast-coins .toast-kind { color: #ffd54a; }

@keyframes float-up {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.92);
  }
  12% {
    opacity: 1;
    transform: translateY(0) scale(1.02);
  }
  20% {
    transform: translateY(-2px) scale(1);
  }
  80% {
    opacity: 1;
    transform: translateY(-22px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-44px) scale(0.96);
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
