<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const STORAGE_KEY = 'island-escape:tutorial-seen'

const props = defineProps<{
  /** Force-show even if previously dismissed (used by a help button later). */
  forceShow?: boolean
}>()

const dismissed = ref(true) // start hidden until we check storage
const stepIndex = ref(0)

interface Step {
  title: string
  body: string
  icon: string
}

const steps: Step[] = [
  {
    title: 'Welcome to Island Escape',
    icon: '🏝️',
    body: 'You are stranded with four AI islanders. First to reach 100 coins escapes — but everyone else is trying to win too. Survive each night by keeping at least 1 fish + 1 wheat in stock.',
  },
  {
    title: 'Move around',
    icon: '🎮',
    body: 'Use WASD or Arrow keys to walk. Watch for the glowing tile around you — that means you can press E to interact with whatever is there.',
  },
  {
    title: 'Day phases',
    icon: '⏳',
    body: 'Each day has two phases. LABOR: walk to the fishing spot or farmland and press E. TRADE: sell to the merchant ship for coins, or talk to an islander to negotiate. Hint at the top of the screen always tells you what to do next.',
  },
  {
    title: 'Trade with islanders',
    icon: '🤝',
    body: 'Walk up to an NPC, press E, and click Negotiate. Use Quick Trade for structured offers (e.g. "Buy 3 fish for 10 coins"). They may accept, counter, or reject. NPCs may also approach YOU with offers — a dialog will pop open.',
  },
  {
    title: 'End the day',
    icon: '🌙',
    body: 'When you\'re done, click End Turn. Watch the AI take their moves, then night falls and everyone consumes 1 fish + 1 wheat. Run out of either and you\'re eliminated.',
  },
  {
    title: 'Bonus: the cave',
    icon: '⚔️',
    body: 'A dark cave on the north shore hides a boss. Beating it earns +20 coins; losing costs resources. One run per day, costs 1 trade slot.',
  },
]

const current = computed(() => steps[stepIndex.value]!)
const isLastStep = computed(() => stepIndex.value === steps.length - 1)
const visible = computed(() => !dismissed.value)

onMounted(() => {
  if (props.forceShow) {
    dismissed.value = false
    return
  }
  try {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) dismissed.value = false
  } catch {
    dismissed.value = false
  }
})

function next() {
  if (isLastStep.value) {
    finish()
  } else {
    stepIndex.value++
  }
}

function back() {
  if (stepIndex.value > 0) stepIndex.value--
}

function finish() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Ignore — dismissal only affects this session.
  }
  dismissed.value = true
  stepIndex.value = 0
}

function skip() {
  finish()
}
</script>

<template>
  <Transition name="tutorial">
    <div v-if="visible" class="tutorial-overlay" role="dialog" aria-labelledby="tutorial-title">
      <div class="tutorial-box">
        <div class="tutorial-header">
          <span class="tutorial-step">{{ stepIndex + 1 }} / {{ steps.length }}</span>
          <button class="tutorial-skip" @click="skip">Skip</button>
        </div>

        <div class="tutorial-icon">{{ current.icon }}</div>
        <h2 id="tutorial-title" class="tutorial-title">{{ current.title }}</h2>
        <p class="tutorial-body">{{ current.body }}</p>

        <div class="tutorial-progress" aria-hidden="true">
          <span
            v-for="(_, i) in steps"
            :key="i"
            :class="['progress-dot', { 'progress-dot-active': i === stepIndex }]"
          />
        </div>

        <div class="tutorial-actions">
          <button
            class="tutorial-btn tutorial-btn-secondary"
            :disabled="stepIndex === 0"
            @click="back"
          >
            Back
          </button>
          <button class="tutorial-btn tutorial-btn-primary" @click="next">
            {{ isLastStep ? "Let's play!" : 'Next' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tutorial-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(8, 16, 32, 0.7) 0%, rgba(2, 6, 12, 0.9) 100%);
  backdrop-filter: blur(3px);
  z-index: 250;
  animation: tutorial-bg 0.3s ease-out;
}

@keyframes tutorial-bg {
  from { opacity: 0; }
  to { opacity: 1; }
}

.tutorial-box {
  width: min(460px, 92vw);
  background: linear-gradient(180deg, #14253a 0%, #0c1a2c 100%);
  border: 2px solid #c8a060;
  border-radius: 14px;
  padding: 22px 26px 18px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  font-family: monospace;
  color: #e6f1fb;
  text-align: center;
  animation: tutorial-pop 0.32s cubic-bezier(0.34, 1.4, 0.64, 1);
}

@keyframes tutorial-pop {
  from { transform: scale(0.85) translateY(16px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.tutorial-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.tutorial-step {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #c8a060;
  text-transform: uppercase;
}

.tutorial-skip {
  background: none;
  border: 1px solid rgba(200, 160, 96, 0.35);
  color: #9bb3c4;
  padding: 3px 12px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.15s;
}
.tutorial-skip:hover {
  border-color: #c8a060;
  color: #e6f1fb;
}

.tutorial-icon {
  font-size: 56px;
  line-height: 1;
  margin: 8px 0 14px;
  filter: drop-shadow(0 2px 8px rgba(200, 160, 96, 0.45));
}

.tutorial-title {
  margin: 0 0 12px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 20px;
  font-weight: 700;
  color: #e8d5a3;
  letter-spacing: 0.5px;
}

.tutorial-body {
  margin: 0 0 18px;
  font-size: 12px;
  line-height: 1.6;
  color: #b9cad8;
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  padding: 10px 14px;
  border-radius: 6px;
  border-left: 3px solid #c8a060;
}

.tutorial-progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
}

.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(200, 160, 96, 0.25);
  transition: all 0.2s;
}
.progress-dot-active {
  background: #c8a060;
  transform: scale(1.4);
  box-shadow: 0 0 8px rgba(200, 160, 96, 0.6);
}

.tutorial-actions {
  display: flex;
  gap: 10px;
}

.tutorial-btn {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s ease-out;
  border: 1px solid;
}

.tutorial-btn-secondary {
  background: transparent;
  border-color: rgba(200, 160, 96, 0.3);
  color: #9bb3c4;
}
.tutorial-btn-secondary:hover:not(:disabled) {
  background: rgba(200, 160, 96, 0.1);
  border-color: #c8a060;
  color: #e6f1fb;
}
.tutorial-btn-secondary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tutorial-btn-primary {
  background: linear-gradient(180deg, #b45309, #8b3a06);
  border-color: #d4730a;
  color: #fff;
  box-shadow: 0 2px 0 #6b2a04;
}
.tutorial-btn-primary:hover {
  background: linear-gradient(180deg, #d4730a, #b45309);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(180, 83, 9, 0.5);
}
.tutorial-btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 1px 0 #6b2a04;
}

.tutorial-enter-active { transition: opacity 0.3s ease; }
.tutorial-leave-active { transition: opacity 0.2s ease; }
.tutorial-enter-from, .tutorial-leave-to { opacity: 0; }
</style>
