<script setup lang="ts">
import { ref } from 'vue'

import CommandInput from './components/CommandInput.vue'
import LogStream from './components/LogStream.vue'
import SaveList from './components/SaveList.vue'
import StatePanel from './components/StatePanel.vue'

const turn = ref(1)
const stats = ref({ hp: 10, sanity: 8, morale: 5, gold: 12 })
const logs = ref<string[]>([
  '系统就绪：等待玩家输入回合指令。',
  '提示：v1 通信方式为 REST + SSE。',
])
const saves = ref([
  { id: 'slot-1', label: '初始营地', turn: 1 },
  { id: 'slot-2', label: '矿洞入口', turn: 4 },
])

function submitCommand(value: string) {
  logs.value.unshift(`> ${value}`)
  logs.value.unshift('narrator: 你迈出一步，风从断墙后吹来。')
  turn.value += 1
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <header class="mb-6">
      <p class="text-xs uppercase tracking-[0.25em] text-stone-500">Multiagent Text Game</p>
      <h1 class="text-3xl font-black tracking-tight text-stone-800">Turn Engine Console</h1>
    </header>

    <div class="mb-6">
      <CommandInput @submit="submitCommand" />
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="md:col-span-2">
        <LogStream :logs="logs" />
      </div>
      <div class="space-y-4">
        <StatePanel :turn="turn" :stats="stats" />
        <SaveList :items="saves" />
      </div>
    </div>
  </main>
</template>
