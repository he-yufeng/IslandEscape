<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  submit: [value: string]
}>()

const input = ref('')

function onSubmit() {
  const trimmed = input.value.trim()
  if (!trimmed) {
    return
  }
  emit('submit', trimmed)
  input.value = ''
}
</script>

<template>
  <form class="flex gap-2" @submit.prevent="onSubmit">
    <input
      v-model="input"
      class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[var(--accent)]"
      placeholder="输入回合指令，例如：探索北边废墟"
      type="text"
    />
    <button
      class="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      type="submit"
    >
      提交
    </button>
  </form>
</template>
